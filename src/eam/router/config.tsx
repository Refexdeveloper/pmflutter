import type { RouteObject } from 'react-router-dom'
import { Layout } from '@eam/components/feature/Layout'
import DashboardPage from '@eam/pages/dashboard/page'
import AssetMasterPage from '@eam/pages/asset-master/page'
import NotFound from '@eam/pages/NotFound'

const routes: RouteObject[] = [
  { path: '/', element: <Layout><DashboardPage /></Layout> },
  { path: '/assets', element: <Layout><AssetMasterPage /></Layout> },
  // Remaining routes will be added as we port pages (assign, requests, warranty, etc.)
  { path: '*', element: <NotFound /> },
]

export default routes

