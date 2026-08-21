import { useState } from 'react'

interface EditableCellProps {
  value: string
  onSave: (value: string) => void
  ariaLabel: string
  /** true면 여러 줄 textarea, false면 한 줄 input */
  isTextArea?: boolean
  placeholder?: string
  className?: string
  displayClassName?: string
}

/**
 * 클릭하면 입력창으로 전환되는 인라인 편집 셀 (Plain Text 전용).
 * blur 또는 Enter(입력형)로 확정, ESC로 수정 전 값으로 되돌린다.
 */
export default function EditableCell({
  value,
  onSave,
  ariaLabel,
  isTextArea = false,
  placeholder,
  className = '',
  displayClassName = '',
}: EditableCellProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  const startEdit = () => {
    setDraft(value)
    setEditing(true)
  }

  const commit = () => {
    setEditing(false)
    const next = draft.trim()
    if (next !== value) onSave(next)
  }

  const cancel = () => {
    setDraft(value)
    setEditing(false)
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={startEdit}
        title="클릭하여 수정"
        aria-label={`${ariaLabel} 수정`}
        className={`block w-full cursor-text rounded px-1 py-0.5 text-left hover:bg-emerald-50/60 ${displayClassName}`}
      >
        {value || <span className="text-slate-300">{placeholder ?? '입력'}</span>}
      </button>
    )
  }

  const shared = {
    autoFocus: true,
    value: draft,
    placeholder,
    'aria-label': ariaLabel,
    onBlur: commit,
    className: `w-full rounded border border-emerald-400 bg-white px-1.5 py-1 outline-none ${className}`,
  }

  return isTextArea ? (
    <textarea
      {...shared}
      rows={3}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') cancel()
      }}
    />
  ) : (
    <input
      {...shared}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit()
        if (e.key === 'Escape') cancel()
      }}
    />
  )
}
