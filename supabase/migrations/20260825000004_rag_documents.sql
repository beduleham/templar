-- ============================================================================
-- RAG 지식 베이스 — 문서 업로드 · 청킹 · 검색
--
-- 임베딩 생성은 아직 연결하지 않았다. 스키마·인덱스·검색 함수·접근 통제를 먼저
-- 세워두고, 임베딩 모델이 정해지면 rag_chunks.embedding 을 채우기만 하면 된다.
-- 그때까지 검색은 트라이그램 기반 키워드 검색으로 동작한다.
--
-- 두 검색 함수는 반환 형태가 같다. 애플리케이션은 임베딩 유무만 보고
-- 호출 대상을 바꾸면 되며 화면은 그대로다.
-- ============================================================================

-- 지식 문서 관련 감사 액션. 같은 트랜잭션에서 사용하지 않으므로 안전하다.
alter type audit_action_type add value if not exists 'RAG_DOCUMENT_UPLOADED';
alter type audit_action_type add value if not exists 'RAG_DOCUMENT_CHUNKED';
alter type audit_action_type add value if not exists 'RAG_DOCUMENT_DELETED';

create extension if not exists vector;
-- 임베딩 연결 전 키워드 검색 폴백용
create extension if not exists pg_trgm;

create type rag_source_type as enum ('pdf', 'docx', 'txt', 'md');

create type rag_document_status as enum (
  'pending',     -- 업로드됨, 청킹 대기
  'processing',  -- 청킹·임베딩 진행 중
  'indexed',     -- 검색 가능
  'failed'
);

-- 임베딩 차원. 모델을 바꾸면 이 값과 rag_chunks.embedding 을 함께 바꾼다.
comment on type rag_document_status is
  '문서 인덱싱 상태. indexed 는 모든 청크에 임베딩이 있을 때만 허용된다.';

-- ── rag_documents ───────────────────────────────────────────────────────────
create table rag_documents (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references projects (id) on delete cascade,
  title          text not null check (length(btrim(title)) between 1 and 200),
  source_type    rag_source_type not null,
  -- 업로드 한도 10MB — 화면 검증과 같은 값을 DB에서도 못 박는다
  byte_size      bigint not null
                   check (byte_size > 0 and byte_size <= 10 * 1024 * 1024),
  chunk_count    integer not null default 0 check (chunk_count >= 0),
  status         rag_document_status not null default 'pending',
  error_message  text,
  uploaded_by    uuid references profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  -- 같은 프로젝트에 같은 제목의 문서를 중복 업로드하지 않는다
  unique (project_id, title),
  constraint rag_documents_failed_needs_reason check (
    (status = 'failed' and error_message is not null) or status <> 'failed'
  )
);

create index rag_documents_project_id_idx on rag_documents (project_id, created_at desc);
create index rag_documents_status_idx on rag_documents (status);

create trigger rag_documents_set_updated_at
  before update on rag_documents
  for each row execute function set_updated_at();

-- ── rag_chunks ──────────────────────────────────────────────────────────────
create table rag_chunks (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references rag_documents (id) on delete cascade,
  -- RLS 판정과 검색 성능을 위해 비정규화한다. 트리거가 일관성을 보장한다.
  project_id   uuid not null references projects (id) on delete cascade,
  chunk_index  integer not null check (chunk_index >= 0),
  content      text not null check (length(btrim(content)) > 0),
  token_count  integer not null default 0 check (token_count >= 0),
  -- 아직 비어 있다. 임베딩 API를 연결하면 채운다.
  embedding    vector(1536),
  created_at   timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index rag_chunks_document_id_idx on rag_chunks (document_id, chunk_index);
create index rag_chunks_project_id_idx on rag_chunks (project_id);

-- 의미 검색용. NULL 임베딩은 인덱싱되지 않으므로 지금 만들어 둬도 비용이 없다.
create index rag_chunks_embedding_idx
  on rag_chunks using hnsw (embedding vector_cosine_ops);

-- 키워드 검색 폴백용
create index rag_chunks_content_trgm_idx
  on rag_chunks using gin (content gin_trgm_ops);

-- ── 일관성 트리거 ───────────────────────────────────────────────────────────
create or replace function archon_sync_chunk_project()
returns trigger
language plpgsql
as $$
declare
  owner_project uuid;
begin
  select project_id into owner_project
  from rag_documents where id = new.document_id;

  if owner_project is null then
    raise exception '존재하지 않는 document_id 입니다: %', new.document_id;
  end if;

  new.project_id := owner_project;
  return new;
end;
$$;

create trigger rag_chunks_sync_project
  before insert or update of document_id, project_id on rag_chunks
  for each row execute function archon_sync_chunk_project();

-- 청크 수는 저장된 행에서 파생시킨다
create or replace function archon_recalc_chunk_count()
returns trigger
language plpgsql
as $$
declare
  target uuid := coalesce(new.document_id, old.document_id);
begin
  update rag_documents d
  set chunk_count = (select count(*) from rag_chunks c where c.document_id = target)
  where d.id = target;
  return null;
end;
$$;

create trigger rag_chunks_recalc_count
  after insert or delete on rag_chunks
  for each row execute function archon_recalc_chunk_count();

/*
 * indexed 는 "검색 가능"을 뜻한다. 청크가 하나도 없거나 임베딩이 비어 있는 문서를
 * indexed 로 표시하면 검색 결과에서 조용히 빠지므로, 그 상태 전이를 막는다.
 * 임베딩을 연결하기 전까지 문서는 pending/processing 에 머문다.
 */
create or replace function archon_check_document_indexed()
returns trigger
language plpgsql
as $$
declare
  total     integer;
  embedded  integer;
begin
  if new.status <> 'indexed' or old.status = 'indexed' then
    return new;
  end if;

  select count(*), count(embedding)
  into total, embedded
  from rag_chunks where document_id = new.id;

  if total = 0 then
    raise exception '청크가 없는 문서는 indexed 로 표시할 수 없습니다';
  end if;

  if embedded <> total then
    raise exception
      '임베딩이 비어 있는 청크가 있습니다 (%/% 완료). 임베딩 연결 후 다시 시도하세요',
      embedded, total;
  end if;

  return new;
end;
$$;

create trigger rag_documents_check_indexed
  before update of status on rag_documents
  for each row execute function archon_check_document_indexed();

-- ── 검색 함수 ───────────────────────────────────────────────────────────────
-- 두 함수의 반환 형태는 동일하다. security invoker 이므로 RLS가 그대로 적용된다.

/** 의미 검색 — 임베딩이 채워진 청크만 대상으로 코사인 거리 정렬 */
create or replace function rag_search_semantic(
  p_project   uuid,
  p_embedding vector(1536),
  p_limit     integer default 5
)
returns table (
  chunk_id     uuid,
  document_id  uuid,
  title        text,
  chunk_index  integer,
  content      text,
  score        double precision
)
language sql
stable
as $$
  select c.id, c.document_id, d.title, c.chunk_index, c.content,
         -- 코사인 거리를 0~1 유사도로 뒤집는다
         1 - (c.embedding <=> p_embedding) as score
  from rag_chunks c
  join rag_documents d on d.id = c.document_id
  where c.project_id = p_project
    and c.embedding is not null
  order by c.embedding <=> p_embedding
  limit greatest(p_limit, 1);
$$;

/** 키워드 검색 — 임베딩 연결 전까지 화면이 동작하도록 하는 폴백 */
create or replace function rag_search_keyword(
  p_project uuid,
  p_query   text,
  p_limit   integer default 5
)
returns table (
  chunk_id     uuid,
  document_id  uuid,
  title        text,
  chunk_index  integer,
  content      text,
  score        double precision
)
language sql
stable
as $$
  select c.id, c.document_id, d.title, c.chunk_index, c.content,
         similarity(c.content, p_query)::double precision as score
  from rag_chunks c
  join rag_documents d on d.id = c.document_id
  where c.project_id = p_project
    and c.content ilike '%' || p_query || '%'
  order by similarity(c.content, p_query) desc, c.chunk_index
  limit greatest(p_limit, 1);
$$;

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table rag_documents enable row level security;
alter table rag_chunks    enable row level security;

-- 문서 열람 범위는 상세 스펙과 같다 — NDA 서명자·의뢰자·운영사
create policy rag_documents_select on rag_documents
  for select to authenticated
  using (archon_can_view_spec(project_id));

create policy rag_documents_write on rag_documents
  for all to authenticated
  using (archon_is_project_client(project_id) or archon_is_admin())
  with check (archon_is_project_client(project_id) or archon_is_admin());

create policy rag_chunks_select on rag_chunks
  for select to authenticated
  using (archon_can_view_spec(project_id));

-- 청크 생성은 인덱싱 워커(service_role)가 담당한다.
-- authenticated 에는 쓰기 정책을 두지 않아 RLS 기본 거부가 적용된다.

grant select, insert, update, delete on rag_documents to authenticated;
grant select on rag_chunks to authenticated;
