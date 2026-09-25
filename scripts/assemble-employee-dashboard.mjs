import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function stripImports(src) {
  return src.replace(/^import .+$/gm, '');
}

function stripDefaultExport(src) {
  return src.replace(/^export default /m, '');
}

function stripNamedExports(src) {
  return src
    .replace(/^export const /gm, 'const ')
    .replace(/^export async function /gm, 'async function ')
    .replace(/^export function /gm, 'function ');
}

const lib = stripNamedExports(read('src/lib/kfProjectDashboard.js'));
const motionConfig = read('src/pages/employee-dashboard/motion.js').replace(/^export const EMP_MOTION =/m, 'const EMP_MOTION =');
const notifications = read('src/mocks/employee-dashboard.js').replace(
  /^export const employeeNotifications =/m,
  'const employeeNotifications =',
);

const toast = stripDefaultExport(stripImports(read('src/components/base/Toast.jsx')));
const empHeader = stripDefaultExport(stripImports(read('src/pages/employee-dashboard/components/EmpHeader.jsx')));
const empKpi = stripDefaultExport(stripImports(read('src/pages/employee-dashboard/components/EmpKPICards.jsx')));
const empProgress = stripDefaultExport(stripImports(read('src/pages/employee-dashboard/components/EmpProgressChart.jsx')));
const empProjects = stripDefaultExport(stripImports(read('src/pages/employee-dashboard/components/EmpProjectsTable.jsx')));
let empSubtasks = stripDefaultExport(stripImports(read('src/pages/employee-dashboard/components/EmpSubtasksTable.jsx')));

// Avoid duplicate helper names when merged into one module.
empSubtasks = empSubtasks
  .replace('function formatDate(d) {', 'function formatTaskDate(d) {')
  .replace(/formatDate\(/g, 'formatTaskDate(');

let page = stripImports(read('src/pages/employee-dashboard/page.jsx'));
page = page
  .replace("const { embed } = useContext(ProjectTrackerEmbedContext);\n  const useChromeLayout = useLayoutProp && !embed;\n", 'const useChromeLayout = useLayoutProp;\n')
  .replace('export default function EmployeeDashboardPage', 'function EmployeeDashboardPage');

const header = `/* eslint-disable max-lines -- Single-file Kissflow employee dashboard bundle */
import { useState, useCallback, useContext, useEffect, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AppLayout from './components/feature/AppLayout.jsx';
import { KissflowSDKContext, kf } from './sdk/index.js';
`;

const footer = `
export default function EmployeeDashboardProject({ useLayout = false }) {
  return <EmployeeDashboardPage useLayout={useLayout} />;
}
`;

const out = [
  header,
  '\n/** --- Shared data helpers --- */\n',
  lib,
  '\n/** --- Employee motion presets --- */\n',
  motionConfig,
  '\n/** --- Employee fallback notifications --- */\n',
  notifications,
  '\n/** --- Toast --- */\n',
  toast,
  '\n/** --- Employee components --- */\n',
  empHeader,
  '\n',
  empKpi,
  '\n',
  empProgress,
  '\n',
  empProjects,
  '\n',
  empSubtasks,
  '\n/** --- Employee page --- */\n',
  page,
  '\n',
  footer,
].join('\n');

fs.writeFileSync(path.join(root, 'src/EmployeeDashboardProject.jsx'), out, 'utf8');
console.log('Wrote src/EmployeeDashboardProject.jsx');
