import { findActivity, NURI_AREAS, type PlanContent } from '../../lib/plan'
import EditableCell from '../shared/EditableCell'

interface PlanTableProps {
  content: PlanContent
  onActivityChange: (
    period: string,
    area: string,
    patch: { activity_name?: string; description?: string; objective?: string },
  ) => void
}

export default function PlanTable({ content, onActivityChange }: PlanTableProps) {
  const periods = content.schedule.map((p) => p.period)

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-180 text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500">
            <th className="w-28 px-3 py-3 text-left font-semibold">누리과정 영역</th>
            {periods.map((period) => (
              <th key={period} className="px-3 py-3 text-left font-semibold">
                {period}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {NURI_AREAS.map((area) => (
            <tr key={area} className="align-top">
              <th
                scope="row"
                className="bg-emerald-50/50 px-3 py-3 text-left text-xs font-semibold text-emerald-800"
              >
                {area}
              </th>
              {periods.map((period) => {
                const activity = findActivity(content, period, area)
                if (!activity) return <td key={period} className="px-2 py-2" />
                return (
                  <td key={period} className="min-w-40 px-2 py-2">
                    <EditableCell
                      value={activity.activity_name}
                      onSave={(activity_name) =>
                        onActivityChange(period, area, {
                          activity_name: activity_name || '(활동 없음)',
                        })
                      }
                      ariaLabel={`${period} ${area} 활동명`}
                      placeholder="활동명"
                      className="text-xs font-semibold"
                      displayClassName="text-xs font-semibold text-slate-800"
                    />
                    {activity.objective !== undefined && (
                      <div className="mt-1 flex gap-1">
                        <span className="shrink-0 pt-0.5 text-[10px] font-semibold text-emerald-600">
                          목표
                        </span>
                        <EditableCell
                          value={activity.objective}
                          onSave={(objective) =>
                            onActivityChange(period, area, { objective })
                          }
                          ariaLabel={`${period} ${area} 활동 목표`}
                          isTextArea
                          placeholder="활동 목표"
                          className="text-[11px]"
                          displayClassName="text-[11px] leading-relaxed text-slate-500"
                        />
                      </div>
                    )}
                    <EditableCell
                      value={activity.description}
                      onSave={(description) =>
                        onActivityChange(period, area, { description })
                      }
                      ariaLabel={`${period} ${area} 활동 내용`}
                      isTextArea
                      placeholder="활동 내용"
                      className="mt-1 text-[11px]"
                      displayClassName="mt-1 text-[11px] leading-relaxed text-slate-500 line-clamp-3"
                    />
                    {activity.materials && activity.materials.length > 0 && (
                      <p className="mt-1 truncate px-1 text-[10px] text-slate-400">
                        준비물: {activity.materials.join(', ')}
                      </p>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
