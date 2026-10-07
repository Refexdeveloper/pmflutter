export function isCompletedItemStatus(status) {
  const value = String(status || '').trim().toLowerCase()
  return value === 'completed' || value === 'closed' || value === 'done'
}

/** Row action shown when the item status is Completed. */
export default function CompletedStatusUpdate({ status, onUpdate, label = 'Update' }) {
  if (!isCompletedItemStatus(status) || typeof onUpdate !== 'function') return null
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        onUpdate()
      }}
      className="inline-flex h-7 shrink-0 items-center rounded-lg bg-[#1E88E5] px-2.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-[#1565C0]"
    >
      {label}
    </button>
  )
}
