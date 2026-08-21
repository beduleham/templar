import { useState } from 'react'
import { findActivity, NURI_AREAS, type PlanContent } from '../../lib/plan'

interface PlanTableProps {
  content: PlanContent
  onActivityChange: (
    period: string,
    area: string,
    patch: { activity_name: string; description: string },
  ) => void
}

interface EditingCell {
  period: string
  area: string
  name: string
  description: string
}

export default function PlanTable({ content, onActivityChange }: PlanTableProps) {
  const [editing, setEditing] = useState<EditingCell | null>(null)
  const periods = content.schedule.map((p) => p.period)

  const startEdit = (period: string, area: string) => {
    const activity = findActivity(content, period, area)
    if (!activity) return
    setEditing({
      period,
      area,
      name: activity.activity_name,
      description: activity.description,
    })
  }

  const commitEdit = () => {
    if (!editing) return
    onActivityChange(editing.period, editing.area, {
      activity_name: editing.name.trim() || '(활동 없음)',
      description: editing.description.trim(),
    })
    setEditing(null)
  }

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
                const isEditing =
                  editing?.period === period && editing?.area === area
                return (
                  <td key={period} className="px-1.5 py-1.5">
                    {isEditing ? (
                      <div
                        className="rounded-lg border border-emerald-300 bg-emerald-50/40 p-2"
                        onBlur={(e) => {
                          if (!e.currentTarget.contains(e.relatedTarget)) commitEdit()
                        }}
                      >
                        <input
                          autoFocus
                          value={editing.name}
                          onChange={(e) =>
                            setEditing({ ...editing, name: e.target.value })
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitEdit()
                            if (e.key === 'Escape') setEditing(null)
                          }}
                          aria-label={`${period} ${area} 활동명`}
                          className="w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold outline-none focus:border-emerald-500"
                        />
                        <textarea
                          value={editing.description}
                          onChange={(e) =>
                            setEditing({ ...editing, description: e.target.value })
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') setEditing(null)
                          }}
                          rows={3}
                          aria-label={`${period} ${area} 활동 설명`}
                          className="mt-1 w-full resize-none rounded border border-slate-300 bg-white px-2 py-1 text-xs outline-none focus:border-emerald-500"
                        />
                      </div>
                    ) : (
                      <button
                        type="button"
                        onDoubleClick={() => startEdit(period, area)}
                        title="더블클릭하여 수정"
                        className="block w-full rounded-lg p-2 text-left hover:bg-slate-50"
                      >
                        <p className="text-xs font-semibold text-slate-800">
                          {activity?.activity_name}
                        </p>
                        <p className="mt-1 line-clamp-3 text-[11px] leading-relaxed text-slate-500">
                          {activity?.description}
                        </p>
                      </button>
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
