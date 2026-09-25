import LeadDashboardPage from './LeadDashboardPage.jsx';

/** SPA shell route: outer layout on; Kissflow embed uses `LeadDashboardPage` directly with default `useLayout={false}`. */
export default function SalesLeadDashboardPage(props) {
  return <LeadDashboardPage useLayout {...props} />;
}
