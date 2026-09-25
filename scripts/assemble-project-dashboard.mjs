/**
 * One-off bundler: merges dashboard + lib + components into a single ProjectDashboardPage.jsx.
 * Run: node scripts/assemble-project-dashboard.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function stripLibExports(src) {
  return src
    .replace(/^export const /gm, 'const ')
    .replace(/^export async function /gm, 'async function ')
    .replace(/^export function /gm, 'function ');
}

function stripDefaultExport(src) {
  return src.replace(/^export default /m, '');
}

const lib = stripLibExports(fs.readFileSync(path.join(root, 'src/lib/kfProjectDashboard.js'), 'utf8'));

const kpi = stripDefaultExport(
  fs.readFileSync(path.join(root, 'src/pages/dashboard/components/KPISection.jsx'), 'utf8')
    .replace(/^import .+$/gm, '')
    .replace(/ctoDashboardKPIs/g, 'DEFAULT_CTO_KPI_METRICS'),
);

const rag = stripDefaultExport(
  fs.readFileSync(path.join(root, 'src/pages/dashboard/components/RAGSummaryBar.jsx'), 'utf8').replace(/^import .+$/gm, ''),
);

const health = stripDefaultExport(
  fs.readFileSync(path.join(root, 'src/pages/dashboard/components/ProjectHealthTable.jsx'), 'utf8').replace(/^import .+$/gm, ''),
);

const sub = stripDefaultExport(
  fs.readFileSync(path.join(root, 'src/pages/dashboard/components/SubtaskTable.jsx'), 'utf8').replace(/^import .+$/gm, ''),
);

const delay = stripDefaultExport(
  fs.readFileSync(path.join(root, 'src/pages/dashboard/components/DelayRevisionSection.jsx'), 'utf8').replace(/^import .+$/gm, ''),
);

let modal = stripDefaultExport(
  fs.readFileSync(path.join(root, 'src/pages/dashboard/components/ProjectDrillDownModal.jsx'), 'utf8').replace(/^import .+$/gm, ''),
);
modal = modal
  .replace('function StatusBadge({ status })', 'function DrillDownStatusBadge({ status })')
  .replace(/<StatusBadge /g, '<DrillDownStatusBadge ');

const DEFAULT_KPI = `const DEFAULT_CTO_KPI_METRICS = {
  totalProjects: 8,
  activeProjects: 6,
  completedProjects: 0,
  delayedProjects: 3,
  totalSubtasks: 15,
  openTasks: 9,
  completedTasks: 5,
  overdueTasks: 2,
  trendTotalProjects: '+12.5%',
  trendActiveProjects: '75% of total',
  trendCompletedProjects: '0% completion rate',
  trendDelayedProjects: '37.5% at risk',
};
`;

const header = `/* eslint-disable max-lines -- Single-file Kissflow + app dashboard bundle */
import { useState, useCallback, useContext, useEffect, useRef, useMemo } from 'react';
import { motion, LayoutGroup, AnimatePresence } from 'framer-motion';
import AppLayout from './components/feature/AppLayout.jsx';
import { KissflowSDKContext, kf } from './sdk/index.js';

`;

const mainFromPremium = fs.readFileSync(path.join(root, 'src/pages/dashboard/page-premium.jsx'), 'utf8');

const mainBody = stripDefaultExport(mainFromPremium.replace(/^import .+$/gm, '')).replace(/\n\n+/g, '\n');

const footer = `

/**
 * Premium project dashboard — single file for Kissflow custom components (copy-paste friendly).
 * In the SPA, \`DashboardPage.jsx\` passes useLayout={true}; Kissflow embed uses default useLayout={false}.
 */
export default function ProjectDashboardPage({ useLayout = false }) {
  return <DashboardPagePremium useLayout={useLayout} />;
}
`;

const out = [
  header,
  '/** --- Kissflow API / data layer (from kfProjectDashboard) --- */\n',
  lib,
  '\n\n/** --- Default KPI fallback (from cto-dashboard mock) --- */\n',
  DEFAULT_KPI,
  '\n\n/** --- KPI section --- */\n',
  kpi,
  '\n\n/** --- RAG summary --- */\n',
  rag,
  '\n\n/** --- Project health table --- */\n',
  health,
  '\n\n/** --- Subtask table --- */\n',
  sub,
  '\n\n/** --- Delay / revision --- */\n',
  delay,
  '\n\n/** --- Drill-down modal --- */\n',
  modal,
  '\n\n/** --- Main dashboard (from page-premium) --- */\n',
  mainBody,
  footer,
].join('');

fs.writeFileSync(path.join(root, 'src/ProjectDashboardPage.jsx'), out, 'utf8');
console.log('Wrote src/ProjectDashboardPage.jsx');
