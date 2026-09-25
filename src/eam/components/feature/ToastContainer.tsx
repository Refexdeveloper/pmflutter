import { useAppContext } from '@eam/context/AppContext'

export const ToastContainer = () => {
  const { toasts, removeToast } = useAppContext()

  const typeStyles = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    warning: 'bg-accent text-gray-900',
    info: 'bg-secondary',
  } as const

  const typeIcons = {
    success: 'ri-checkbox-circle-line',
    error: 'ri-error-warning-line',
    warning: 'ri-alert-line',
    info: 'ri-information-line',
  } as const

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex min-w-[280px] max-w-[360px] items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-white animate-slide-in ${typeStyles[toast.type]}`}
        >
          <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center">
            <i className={typeIcons[toast.type]} />
          </div>
          <span className="flex-1">{toast.message}</span>
          <button
            type="button"
            onClick={() => removeToast(toast.id)}
            className="flex h-5 w-5 cursor-pointer items-center justify-center opacity-75 transition-opacity hover:opacity-100"
          >
            <i className="ri-close-line text-sm" />
          </button>
        </div>
      ))}
    </div>
  )
}

