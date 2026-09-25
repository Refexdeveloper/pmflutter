import { useRoutes } from 'react-router-dom'
import routes from './config'

export function EamRoutes() {
  return useRoutes(routes)
}

