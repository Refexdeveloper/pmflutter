import { Navigate } from "react-router-dom";
import NotFound from "../pages/NotFound";
import DashboardPage from "../DashboardPage.jsx";
import PMDashboardPage from "../PMDashboardPage.jsx";
import EmployeeDashboardPage from "../EmployeeDashboardPage.jsx";
import ProjectsPage from "../ProjectsPage.jsx";
import TasksPage from "../TasksPage.jsx";
import ReportsPage from "../ReportsPage.jsx";
import HelpPage from "../HelpPage.jsx";
import EAMDashboardProject from "../EAMDashboardProject.jsx";
import EAMAssetMasterProject from "../EAMAssetMasterProject.jsx";
import EAMAssignAssetProject from "../EAMAssignAssetProject.jsx";
import EAMRequestsProject from "../EAMRequestsProject.jsx";
import EAMCompanyLocationProject from "../EAMCompanyLocationProject.jsx";
import EAMWarrantyProject from "../EAMWarrantyProject.jsx";
import EAMQRCodesProject from "../EAMQRCodesProject.jsx";
import EAMMyAssetsProject from "../EAMMyAssetsProject.jsx";
import SalesLeadDashboardPage from "../SalesLeadDashboardPage.jsx";
const routes = [
    { path: "/", element: <Navigate to="/dashboard" replace/> },
    { path: "/dashboard", element: <DashboardPage /> },
    { path: "/pm-dashboard", element: <PMDashboardPage /> },
    { path: "/employee-dashboard", element: <EmployeeDashboardPage /> },
    { path: "/projects", element: <ProjectsPage /> },
    { path: "/tasks", element: <TasksPage /> },
    { path: "/reports", element: <ReportsPage /> },
    { path: "/help", element: <HelpPage /> },
    { path: "/sales-dashboard", element: <SalesLeadDashboardPage /> },
    { path: "/eam", element: <EAMDashboardProject /> },
    { path: "/eam/assets", element: <EAMAssetMasterProject /> },
    { path: "/eam/assign", element: <EAMAssignAssetProject /> },
    { path: "/eam/requests", element: <EAMRequestsProject /> },
    { path: "/eam/company-location", element: <EAMCompanyLocationProject /> },
    { path: "/eam/warranty", element: <EAMWarrantyProject /> },
    { path: "/eam/qr-codes", element: <EAMQRCodesProject /> },
    { path: "/eam/my-assets", element: <EAMMyAssetsProject /> },
    { path: "*", element: <NotFound /> },
];
export default routes;
