interface PlaceholderPageProps {
  title: string;
  description: string;
}

/** 라우팅 골격 단계에서 사용하는 준비 중 카드 UI */
export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="bg-card text-card-foreground rounded-xl border p-8 shadow-sm">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-muted-foreground mt-2 text-sm">{description}</p>
        <p className="text-muted-foreground mt-6 rounded-md border border-dashed p-4 text-center text-sm">
          준비 중인 페이지입니다.
        </p>
      </div>
    </div>
  );
}
