import { Loader2, Sparkles } from 'lucide-react'
import {
  planTypeLabels,
  TARGET_AGES,
  type GeneratePlanParams,
  type PlanType,
  type TargetAge,
} from '../../lib/plan'

interface PlanSetupFormProps {
  value: GeneratePlanParams
  loading: boolean
  onChange: (value: GeneratePlanParams) => void
  onGenerate: () => void
}

const planTypes = (Object.keys(planTypeLabels) as PlanType[]).map((value) => ({
  value,
  label: `${planTypeLabels[value]} 계획안`,
}))

export default function PlanSetupForm({
  value,
  loading,
  onChange,
  onGenerate,
}: PlanSetupFormProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">계획안 설정</h2>
      <div className="mt-3 flex flex-wrap items-end gap-4">
        <label className="block text-xs font-medium text-slate-500">
          대상 연령
          <select
            value={value.targetAge}
            onChange={(e) =>
              onChange({ ...value, targetAge: e.target.value as TargetAge })
            }
            className="mt-1.5 block w-32 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          >
            {TARGET_AGES.map((age) => (
              <option key={age} value={age}>
                {age}
              </option>
            ))}
          </select>
        </label>

        <fieldset>
          <legend className="text-xs font-medium text-slate-500">구분</legend>
          <div className="mt-1.5 flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-sm font-medium">
            {planTypes.map((type) => (
              <button
                key={type.value}
                type="button"
                onClick={() => onChange({ ...value, planType: type.value })}
                aria-pressed={value.planType === type.value}
                className={`rounded-md px-3 py-1.5 transition-colors ${
                  value.planType === type.value
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="block text-xs font-medium text-slate-500">
          대주제
          <input
            type="text"
            value={value.theme}
            onChange={(e) => onChange({ ...value, theme: e.target.value })}
            placeholder="예: 우주와 지구"
            className="mt-1.5 block w-44 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </label>

        <label className="block text-xs font-medium text-slate-500">
          소주제 (선택)
          <input
            type="text"
            value={value.subTheme ?? ''}
            onChange={(e) => onChange({ ...value, subTheme: e.target.value })}
            placeholder="예: 태양계 행성 탐험"
            className="mt-1.5 block w-44 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </label>

        <button
          type="button"
          onClick={onGenerate}
          disabled={loading || value.theme.trim() === ''}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="size-4" aria-hidden />
          )}
          AI 계획안 생성
        </button>
      </div>
    </section>
  )
}
