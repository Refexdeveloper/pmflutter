import { MemoryRouter } from 'react-router-dom'
import { AppProvider } from '@eam/context/AppContext'
import { EamRoutes } from '@eam/router'

export default function EamShell({ initialRoute = '/' }: { initialRoute?: string }) {
  const safeRoute = typeof initialRoute === 'string' && initialRoute.startsWith('/') ? initialRoute : '/'

  return (
    <AppProvider>
      <MemoryRouter initialEntries={[safeRoute]}>
        <EamRoutes />
      </MemoryRouter>
    </AppProvider>
  )
}

