import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { TopHeader } from './TopHeader'
import { ToastContainer } from './ToastContainer'
import { useAppContext } from '@eam/context/AppContext'

interface LayoutProps {
  children: ReactNode
}

export const Layout = ({ children }: LayoutProps) => {
  const { sidebarCollapsed } = useAppContext()

  return (
    <div className="min-h-screen" style={{ background: '#f5f7fa' }}>
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage: 'radial-gradient(circle, #d1dde8 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          opacity: 0.35,
        }}
      />

      <Sidebar />
      <TopHeader />

      <main
        className="relative min-h-screen pt-16 transition-all duration-300 ease-in-out"
        style={{ marginLeft: sidebarCollapsed ? '64px' : '240px' }}
      >
        <div className="p-6">{children}</div>
      </main>

      <ToastContainer />
    </div>
  )
}

