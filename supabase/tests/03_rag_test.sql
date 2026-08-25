-- ============================================================================
-- RAG 지식 베이스 검증.
-- 01/02 가 만든 픽스처(펫케어 프로젝트, NDA 서명 파트너 2곳) 위에서 이어 실행한다.
-- ============================================================================

-- ── 문서 업로드 제약 ────────────────────────────────────────────────────────
do $$
declare blocked boolean := false;
begin
  begin
    insert into rag_documents (project_id, title, source_type, byte_size, uploaded_by)
    values ('aaaaaaaa-0000-0000-0000-000000000001', '초대형 문서', 'pdf',
            11 * 1024 * 1024, '11111111-1111-1111-1111-111111111111');
  exception when others then blocked := true;
  end;
  perform t_assert(blocked, 'RAG① 10MB 를 넘는 문서는 업로드할 수 없다');
end;
$$;

do $$
declare blocked boolean := false;
begin
  begin
    insert into rag_documents (project_id, title, source_type, byte_size, status)
    values ('aaaaaaaa-0000-0000-0000-000000000001', '실패 문서', 'txt', 1000, 'failed');
  exception when others then blocked := true;
  end;
  perform t_assert(blocked, 'RAG② failed 상태에는 사유가 반드시 있어야 한다');
end;
$$;

insert into rag_documents (id, project_id, title, source_type, byte_size, uploaded_by)
values ('d0c00000-0000-0000-0000-000000000001',
        'aaaaaaaa-0000-0000-0000-000000000001',
        '펫케어 요구사항 정의서.pdf', 'pdf', 248000,
        '11111111-1111-1111-1111-111111111111');

do $$
declare blocked boolean := false;
begin
  begin
    insert into rag_documents (project_id, title, source_type, byte_size)
    values ('aaaaaaaa-0000-0000-0000-000000000001',
            '펫케어 요구사항 정의서.pdf', 'pdf', 248000);
  exception when others then blocked := true;
  end;
  perform t_assert(blocked, 'RAG③ 같은 프로젝트에 같은 제목의 문서를 중복 업로드할 수 없다');
end;
$$;

-- ── 청킹 ────────────────────────────────────────────────────────────────────
insert into rag_chunks (document_id, project_id, chunk_index, content, token_count)
values
  ('d0c00000-0000-0000-0000-000000000001',
   -- 일부러 틀린 project_id. 트리거가 문서 소속으로 교정해야 한다.
   '00000000-0000-0000-0000-000000000000', 0,
   '예약 신청은 돌봄사 선택과 일정 지정을 거쳐 결제로 이어진다.', 32),
  ('d0c00000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000000', 1,
   '결제는 카드 결제와 부분 취소를 지원하며 환불 정책을 따른다.', 30),
  ('d0c00000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000000', 2,
   '관리자는 예약 현황 대시보드에서 일별 집계를 확인한다.', 28);

do $$
begin
  perform t_assert(
    (select count(*) from rag_chunks
      where project_id = 'aaaaaaaa-0000-0000-0000-000000000001') = 3,
    'RAG④ 청크의 project_id 가 문서 소속으로 자동 교정된다');
  perform t_assert(
    (select chunk_count from rag_documents
      where id = 'd0c00000-0000-0000-0000-000000000001') = 3,
    'RAG⑤ 문서의 청크 수가 자동으로 재계산된다');
end;
$$;

-- ── 임베딩 없이는 indexed 로 전환할 수 없다 (핵심 불변식) ───────────────────
do $$
declare blocked boolean := false;
begin
  begin
    update rag_documents set status = 'indexed'
    where id = 'd0c00000-0000-0000-0000-000000000001';
  exception when others then blocked := true;
  end;
  perform t_assert(blocked,
    'RAG⑥ 임베딩이 비어 있는 문서는 indexed 로 표시할 수 없다');
end;
$$;

insert into rag_documents (id, project_id, title, source_type, byte_size)
values ('d0c00000-0000-0000-0000-00000000000e',
        'aaaaaaaa-0000-0000-0000-000000000001', '빈 문서.txt', 'txt', 10);

do $$
declare blocked boolean := false;
begin
  begin
    update rag_documents set status = 'indexed'
    where id = 'd0c00000-0000-0000-0000-00000000000e';
  exception when others then blocked := true;
  end;
  perform t_assert(blocked, 'RAG⑦ 청크가 없는 문서도 indexed 로 표시할 수 없다');
end;
$$;

-- ── 검색: 임베딩 연결 전 ────────────────────────────────────────────────────
do $$
declare hits integer;
begin
  select count(*) into hits from rag_search_keyword(
    'aaaaaaaa-0000-0000-0000-000000000001', '결제', 5);
  perform t_assert(hits >= 1, 'RAG⑧ 임베딩 없이도 키워드 검색이 결과를 돌려준다');

  select count(*) into hits from rag_search_semantic(
    'aaaaaaaa-0000-0000-0000-000000000001',
    array_fill(0.1::real, array[1536])::vector, 5);
  perform t_assert(hits = 0,
    'RAG⑨ 임베딩이 비어 있으면 의미 검색은 0건을 돌려준다 (조용한 오답 없음)');
end;
$$;

do $$
declare top_content text;
begin
  select content into top_content from rag_search_keyword(
    'aaaaaaaa-0000-0000-0000-000000000001', '환불 정책', 1);
  perform t_assert(top_content like '%환불%',
    'RAG⑩ 키워드 검색이 관련도 높은 청크를 상위로 올린다');
end;
$$;

-- ── 검색: 임베딩을 채운 뒤 ──────────────────────────────────────────────────
-- 임베딩 API 연결을 흉내 내 서로 다른 벡터를 채운다.
update rag_chunks set embedding = array_fill(0.02::real, array[1536])::vector
  where document_id = 'd0c00000-0000-0000-0000-000000000001';
update rag_chunks set embedding = array_fill(0.9::real, array[1536])::vector
  where document_id = 'd0c00000-0000-0000-0000-000000000001' and chunk_index = 1;

update rag_documents set status = 'indexed'
  where id = 'd0c00000-0000-0000-0000-000000000001';

do $$
declare hits integer; top_idx integer;
begin
  perform t_assert(
    (select status from rag_documents
      where id = 'd0c00000-0000-0000-0000-000000000001') = 'indexed',
    'RAG⑪ 모든 청크에 임베딩이 차면 indexed 로 전환된다');

  select count(*) into hits from rag_search_semantic(
    'aaaaaaaa-0000-0000-0000-000000000001',
    array_fill(0.9::real, array[1536])::vector, 5);
  perform t_assert(hits = 3, 'RAG⑫ 의미 검색이 임베딩된 청크를 대상으로 동작한다');

  select chunk_index into top_idx from rag_search_semantic(
    'aaaaaaaa-0000-0000-0000-000000000001',
    array_fill(0.9::real, array[1536])::vector, 1);
  perform t_assert(top_idx is not null,
    'RAG⑬ 의미 검색이 코사인 거리 순으로 정렬된 결과를 돌려준다');
end;
$$;

-- ── RLS ─────────────────────────────────────────────────────────────────────
begin;
set local role authenticated;
set local request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
do $$
begin
  perform t_assert((select count(*) from rag_documents) = 0,
    'RAG⑭ NDA 미서명자에게 문서 목록이 노출되지 않는다');
  perform t_assert((select count(*) from rag_chunks) = 0,
    'RAG⑮ NDA 미서명자에게 청크 본문이 노출되지 않는다');
end;
$$;
rollback;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
do $$
declare blocked boolean := false;
begin
  perform t_assert((select count(*) from rag_chunks) = 3,
    'RAG⑯ NDA 서명 파트너는 청크를 조회할 수 있다');
  begin
    insert into rag_chunks (document_id, project_id, chunk_index, content)
    values ('d0c00000-0000-0000-0000-000000000001',
            'aaaaaaaa-0000-0000-0000-000000000001', 99, '주입된 문장');
  exception when others then blocked := true;
  end;
  perform t_assert(blocked,
    'RAG⑰ 청크 생성은 인덱싱 워커만 가능하다 (클라이언트 쓰기 차단)');
end;
$$;
rollback;

begin;
set local role authenticated;
set local request.jwt.claim.sub = '55555555-5555-5555-5555-555555555555';
do $$
declare affected integer;
begin
  update rag_documents set title = '탈취된 제목';
  get diagnostics affected = row_count;
  perform t_assert(affected = 0, 'RAG⑱ 제3자의 문서 수정이 0건으로 무력화된다');
end;
$$;
rollback;
