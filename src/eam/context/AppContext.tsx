import { createContext, useContext, useState, type ReactNode } from 'react'

export type UserRole = 'manager' | 'employee'

interface AppContextType {
  role: UserRole
  setRole: (role: UserRole) => void
  currentEmployeeId: string
  toasts: Toast[]
  addToast: (message: string, type?: Toast['type']) => void
  removeToast: (id: string) => void
  sidebarCollapsed: boolean
  setSidebarCollapsed: (v: boolean) => void
}

export interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
}

const AppContext = createContext<AppContextType | null>(null)

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [role, setRole] = useState<UserRole>('manager')
  const [toasts, setToasts] = useState<Toast[]>([])
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const currentEmployeeId = 'e1'

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  const addToast = (message: string, type: Toast['type'] = 'success') => {
    const id = Date.now().toString()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => removeToast(id), 4000)
  }

  return (
    <AppContext.Provider
      value={{
        role,
        setRole,
        currentEmployeeId,
        toasts,
        addToast,
        removeToast,
        sidebarCollapsed,
        setSidebarCollapsed,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export const useAppContext = () => {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppContext must be used within AppProvider')
  return ctx
}

