export default function CreateDetailsPopup({
  title,
  onClose,
  onSubmit,
  busy,
  children,
  error,
  submitLabel = 'Submit',
  busyLabel = 'Waiting for Kissflow…',
}) {
  return (
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-900/45 p-4 sm:p-6 md:p-10">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close"
        onClick={onClose}
      />
      <form
        onSubmit={(event) => {
          if (busy) {
            event.preventDefault()
            event.stopPropagation()
            return
          }
          onSubmit?.(event)
        }}
        className="relative z-[1] flex max-h-[min(92vh,920px)] w-full max-w-[1100px] flex-col overflow-hidden rounded-2xl bg-[#f4f7fe] shadow-2xl"
      >
        <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 py-3 sm:px-6">
          <h1 className="text-[17px] font-semibold text-slate-800">{title}</h1>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            aria-label="Close"
          >
            <i className="ri-close-line text-2xl" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-8 sm:py-6">
          {children}
        </div>

        <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-3 sm:px-6">
          {error ? (
            <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 rounded border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="h-9 rounded bg-[#1E62F0] px-4 text-sm font-semibold text-white hover:bg-blue-600 disabled:opacity-60"
            >
              {busy ? (busyLabel || 'Waiting for Kissflow…') : (submitLabel || 'Submit')}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
