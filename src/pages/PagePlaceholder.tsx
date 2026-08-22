interface PagePlaceholderProps {
  title: string
  description: string
}

export default function PagePlaceholder({ title, description }: PagePlaceholderProps) {
  return (
    <section className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-slate-500">{description}</p>
      <div className="mt-8 flex h-64 items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-white">
        <p className="text-sm font-medium text-slate-400">{title} (준비 중)</p>
      </div>
    </section>
  )
}
