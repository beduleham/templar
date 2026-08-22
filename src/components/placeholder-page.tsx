interface PlaceholderPageProps {
  title: string;
  description: string;
}

/** 라우팅 골격 단계에서 사용하는 준비 중 카드 UI */
export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="bg-card text-card-foreground rounded-3xl border p-8 shadow-[0_8px_40px_rgba(0,0,0,0.05)] lg:p-10">
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="text-muted-foreground mt-2.5 text-[15px] leading-relaxed">
          {description}
        </p>
        <div className="bg-muted text-muted-foreground mt-8 rounded-2xl p-6 text-center text-sm">
          준비 중인 페이지입니다.
        </div>
      </div>
    </div>
  );
}
