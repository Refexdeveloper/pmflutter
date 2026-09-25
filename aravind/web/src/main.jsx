import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { KissflowSDKContext } from '../../../src/sdk/context.jsx'
import App from './App.jsx'
import './index.css'

const stubKf = {
  user: {
    Name: 'Aravind Srinivasan',
    FirstName: 'Aravind',
    Email: 'aravind.srinivasan@refex.co.in',
    Role: { Name: 'Employee' },
  },
  client: {
    showInfo: (message) => window.alert(String(message || '')),
    showError: (message) => window.alert(String(message || '')),
  },
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <KissflowSDKContext.Provider
      value={{
        kf: stubKf,
        sdkReady: true,
        sdkFailed: true,
        identityReady: true,
        isNonKissflowUser: true,
      }}
    >
      <App />
    </KissflowSDKContext.Provider>
  </StrictMode>,
)
