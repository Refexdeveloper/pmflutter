/**
 * Adapts copied ContractsMyItemsPro.jsx → config-driven PmMyItemsProShell.jsx
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const target = path.resolve(__dirname, '../src/PmMyItemsProShell.jsx')
let src = fs.readFileSync(target, 'utf8')

// --- Imports ---
src = src.replace(
  /import \{ kf, KissflowSDKContext \} from '\.\/sdk\/index\.js'/,
  `import { KissflowSDKContext } from './sdk/index.js'`,
)
src = src.replace(
  /import \{\s*buildContractProcessApiPaths,\s*resolveKfContractApplicationId,\s*buildContractAdminApiPaths,\s*buildTotalVendorsReportCountPath,\s*buildVendorMasterApiPaths,\s*\} from '\.\/kfContractPaths\.js'/,
  `import { buildPmEntityApiPaths, buildPmAdminApiPaths, resolvePmPopupId } from './lib/kfPmMyItemsPaths.js'`,
)
src = src.replace(
  /import \{ mapKfContractItem, contractStatusPillClass, resolveContractSlaDeadlineRaw \} from '\.\/kfContractItemMap\.js'/,
  `import { mapPmMyItemsItem, mapKfPmAdminItem, resolvePmSlaDeadlineRaw, pmStatusPillClass } from './lib/kfPmMyItemsMap.js'`,
)

// Remove unused contract-only helpers that reference contract value extraction heavily —
// keep shell helpers; remap SLA + map calls.

src = src.replace(/resolveContractSlaDeadlineRaw/g, 'resolvePmSlaDeadlineRaw')
src = src.replace(/contractStatusPillClass/g, 'pmStatusPillClass')
src = src.replace(/mapKfContractItem/g, 'mapKfPmAdminItem__NEEDS_ENTITY')

// Popup constant
src = src.replace(
  /const CONTRACT_WORKFLOW_POPUP_ID = 'Popup_6xSap6ocDi'\nfunction resolveContractPopupId\(\) \{ return envVite\('VITE_KF_CONTRACT_POPUP_ID'\) \|\| CONTRACT_WORKFLOW_POPUP_ID \}/,
  `function resolveEntityPopupId(entityConfig) { return resolvePmPopupId(entityConfig) }`,
)

// STATUS maps — keep but note entity can override via closure

// Replace mapKfItemToContract body usage: we'll wrap merge to use entity
// Change mergeMyItemsRowWithVmsShape to use mapPmMyItemsItem

src = src.replace(
  /function mergeMyItemsRowWithVmsShape\(item, listUrlSegment\) \{\s*const legacy = mapKfItemToContract\(item, listUrlSegment\)\s*if \(!legacy\) return null\s*const vms = mapKfPmAdminItem__NEEDS_ENTITY\(item\)\s*if \(!vms\) return legacy\s*const endIso = \(vms\.endDate && String\(vms\.endDate\)\.trim\(\)\) \|\| \(legacy\.endDate && legacy\.endDate !== '—' \? String\(legacy\.endDate\)\.slice\(0, 10\) : ''\)\s*const valueDisplay = hasTopLevelContractValueForVmsMap\(item\) && vms\.valueDisplay \? vms\.valueDisplay : legacy\.valueDisplay\s*return \{\s*\.\.\.legacy,\s*name: \(vms\.contractTitle && String\(vms\.contractTitle\)\.trim\(\)\) \|\| legacy\.name,\s*valueDisplay,\s*endDate: endIso \|\| legacy\.endDate,\s*vendor: \(legacy\.vendor && String\(legacy\.vendor\)\.trim\(\)\) \|\| vms\.vendor \|\| legacy\.vendor,\s*contractType: vms\.contractType && vms\.contractType !== 'Other' \? vms\.contractType : legacy\.contractType,\s*slaDeadline: vms\.slaDeadline !== '' && vms\.slaDeadline != null \? vms\.slaDeadline : legacy\.slaDeadline,\s*\}\s*\}/,
  `function mergeMyItemsRowWithVmsShape(item, listUrlSegment, entityConfig) {
  return mapPmMyItemsItem(item, entityConfig, listUrlSegment)
}`,
)

// mapKfContractTaskToRow
src = src.replace(
  /function mapKfContractTaskToRow\(item, fallbackActivityId\) \{\s*const merged = mergeMyItemsRowWithVmsShape\(item, undefined\)\s*const row = merged \|\| mapKfItemToContract\(item, undefined\)\s*if \(!row\) return null\s*const createdBy = item\._created_by\?\.Name \|\| row\.createdBy\s*const createdByInitials = initialsFromUser\(item\._created_by\)\s*const statusDisplay = formatStatusForDisplay\(row\.status\) \|\| row\.status \|\| 'In progress'\s*return \{ \.\.\.row, activityId: row\.activityId \|\| fallbackActivityId \|\| '', createdBy, createdByInitials, status: statusDisplay \}\s*\}/,
  `function mapKfContractTaskToRow(item, fallbackActivityId, entityConfig) {
  const row = mergeMyItemsRowWithVmsShape(item, undefined, entityConfig)
  if (!row) return null
  const createdBy = item._created_by?.Name || row.createdBy
  const createdByInitials = initialsFromUser(item._created_by)
  const statusDisplay = formatStatusForDisplay(row.status) || row.status || 'In progress'
  return { ...row, activityId: row.activityId || fallbackActivityId || '', createdBy, createdByInitials, status: statusDisplay }
}`,
)

// fetchContractTaskDetailMerged — add entityConfig param for mapper
src = src.replace(
  /return mapKfContractTaskToRow\(payload, baseTask\?\.activityId \|\| activityIdFallback \|\| ''\)/,
  `return mapKfContractTaskToRow(payload, baseTask?.activityId || activityIdFallback || '', __ENTITY_CONFIG__)`,
)

// buildMyItemsPath
src = src.replace(
  /function buildMyItemsPath\(contractPaths, statusFilter, pageNumber, pageSize\) \{\s*const segment = STATUS_TO_SEGMENT\[statusFilter\] \|\| 'draft'\s*const pn = Math\.max\(1, Number\(pageNumber\) \|\| 1\)\s*const ps = Math\.min\(1000, Math\.max\(1, Number\(pageSize\) \|\| 1000\)\)\s*return `\/process\/2\/\$\{contractPaths\.accountId\}\/\$\{contractPaths\.processId\}\/myitems\/\$\{segment\}\?apply_preference=true&page_number=\$\{pn\}&page_size=\$\{ps\}&skip_aggregation=true&_application_id=\$\{encodeURIComponent\(contractPaths\.applicationId\)\}`\s*\}/,
  `function buildMyItemsPath(contractPaths, statusFilter, pageNumber, pageSize, entityConfig) {
  const segment = (entityConfig?.statusToSegment || STATUS_TO_SEGMENT)[statusFilter] || 'draft'
  if (typeof contractPaths.getMyItemsPath === 'function') {
    return contractPaths.getMyItemsPath(segment, pageNumber, pageSize)
  }
  const pn = Math.max(1, Number(pageNumber) || 1)
  const ps = Math.min(1000, Math.max(1, Number(pageSize) || 1000))
  return \`/process/2/\${contractPaths.accountId}/\${contractPaths.processId}/myitems/\${segment}?apply_preference=true&page_number=\${pn}&page_size=\${ps}&skip_aggregation=true&_application_id=\${encodeURIComponent(contractPaths.applicationId)}\`
}`,
)

// ITEMS_COLUMNS — will be overridden inside factory; leave defaults

// Export factory
src = src.replace(
  /\/\/ ============= Main Component =============\nexport default function ContractsMyItems\(\) \{/,
  `// ============= Main Component (factory) =============
export function createPmMyItemsPro(entityConfig) {
  if (!entityConfig) throw new Error('createPmMyItemsPro: entityConfig is required')
  const __ENTITY_CONFIG__ = entityConfig
  const ITEMS_COLUMNS_CFG = entityConfig.columns || ITEMS_COLUMNS
  const TASKS_COLUMNS_CFG = entityConfig.columns || TASKS_COLUMNS
  const DEFAULT_VISIBLE_ITEMS_CFG = Object.fromEntries(ITEMS_COLUMNS_CFG.map((c) => [c.id, true]))
  const DEFAULT_VISIBLE_TASKS_CFG = Object.fromEntries(TASKS_COLUMNS_CFG.map((c) => [c.id, true]))
  const STATUS_OPTIONS_CFG = entityConfig.statusOptions || STATUS_OPTIONS
  const STATUS_TO_SEGMENT_CFG = entityConfig.statusToSegment || STATUS_TO_SEGMENT
  const L = entityConfig.labels || {}

  function createOverviewCardsForEntity(kpis) {
    return [
      { key: 'total', label: L.totalKpi || 'Total', value: kpis.total, icon: L.icon || 'ri-file-list-3-line', accent: { borderClass: 'border border-blue-200/70', washClass: 'bg-gradient-to-br from-white from-[14%] via-white via-[48%] to-blue-100/48', radialWash: 'bg-[radial-gradient(155%_118%_at_88%_88%,rgba(59,130,246,0.22)_0%,transparent_72%)]', iconGradient: 'from-blue-500 to-blue-600', valueClass: 'text-blue-600', watermarkColor: 'text-blue-600' } },
      { key: 'active', label: L.activeKpi || 'Active', value: kpis.active, icon: 'ri-shield-check-line', accent: { borderClass: 'border border-emerald-200/70', washClass: 'bg-gradient-to-br from-white from-[14%] via-white via-[48%] to-emerald-100/44', radialWash: 'bg-[radial-gradient(155%_118%_at_88%_88%,rgba(16,185,129,0.20)_0%,transparent_72%)]', iconGradient: 'from-emerald-500 to-emerald-600', valueClass: 'text-emerald-600', watermarkColor: 'text-emerald-600' } },
      { key: 'expiring', label: L.dueSoonKpi || 'Due Soon', value: kpis.expiringSoon, segmented: true, icon: 'ri-calendar-schedule-line', accent: vmsBrandKpiAccent() },
      { key: 'expired', label: L.overdueKpi || 'Overdue', value: kpis.expired, icon: 'ri-time-line', accent: { borderClass: 'border border-rose-200/70', washClass: 'bg-gradient-to-br from-white from-[14%] via-white via-[48%] to-rose-100/44', radialWash: 'bg-[radial-gradient(155%_118%_at_88%_88%,rgba(244,63,94,0.19)_0%,transparent_72%)]', iconGradient: 'from-rose-500 to-rose-600', valueClass: 'text-rose-600', watermarkColor: 'text-rose-600' } },
      { key: 'nda', label: L.unassignedKpi || 'Unassigned', value: kpis.ndaMiss, icon: 'ri-user-unfollow-line', accent: vmsBrandKpiAccentLight() },
      { key: 'msa', label: L.delayedKpi || 'Delayed', value: kpis.msaMiss, icon: 'ri-timer-flash-line', accent: { borderClass: 'border border-orange-200/70', washClass: 'bg-gradient-to-br from-white from-[14%] via-white via-[48%] to-orange-100/42', radialWash: 'bg-[radial-gradient(155%_118%_at_88%_88%,rgba(249,115,22,0.19)_0%,transparent_72%)]', iconGradient: 'from-orange-500 to-orange-600', valueClass: 'text-orange-600', watermarkColor: 'text-orange-600' } },
      { key: 'sow', label: L.highPriorityKpi || 'High Priority', value: kpis.sowMiss, icon: 'ri-error-warning-line', accent: { borderClass: 'border border-sky-200/70', washClass: 'bg-gradient-to-br from-white from-[14%] via-white via-[48%] to-sky-100/47', radialWash: 'bg-[radial-gradient(155%_118%_at_88%_88%,rgba(14,165,233,0.20)_0%,transparent_72%)]', iconGradient: 'from-sky-500 to-sky-600', valueClass: 'text-sky-600', watermarkColor: 'text-sky-600' } },
      { key: 'vendors', label: L.peopleKpi || 'Unique Owners', value: kpis.vendors, icon: 'ri-team-line', accent: vmsBrandKpiAccent() },
    ]
  }

  return function PmMyItemsProPage() {`,
)

// Close factory at end of file
if (!src.trimEnd().endsWith('}')) {
  // file ends with export default function body closing }
}
// The file ends with `}` for ContractsMyItems. We need `}\n}` for inner + factory.
src = src.replace(/\n\}\s*$/, '\n  }\n}\n')

// Paths inside component
src = src.replace(
  /const contractPaths = useMemo\(\(\) => buildContractProcessApiPaths\(kfInstance\), \[kfInstance\]\)\s*const adminPaths = useMemo\(\(\) => buildContractAdminApiPaths\(kfInstance\), \[kfInstance\]\)\s*const totalVendorsCountPath = useMemo\(\(\) => buildTotalVendorsReportCountPath\(kfInstance\), \[kfInstance\]\)\s*const vendorMasterPaths = useMemo\(\(\) => buildVendorMasterApiPaths\(kfInstance\), \[kfInstance\]\)/,
  `const contractPaths = useMemo(() => buildPmEntityApiPaths(kfInstance, __ENTITY_CONFIG__), [kfInstance])
  const adminPaths = useMemo(() => buildPmAdminApiPaths(kfInstance, __ENTITY_CONFIG__), [kfInstance])
  const totalVendorsCountPath = useMemo(() => null, [])
  const vendorMasterPaths = useMemo(() => null, [])`,
)

// visible columns defaults
src = src.replace(
  /const \[visibleColumnsItems, setVisibleColumnsItems\] = useState\(DEFAULT_VISIBLE_ITEMS\)\s*const \[visibleColumnsTasks, setVisibleColumnsTasks\] = useState\(DEFAULT_VISIBLE_TASKS\)/,
  `const [visibleColumnsItems, setVisibleColumnsItems] = useState(DEFAULT_VISIBLE_ITEMS_CFG)
  const [visibleColumnsTasks, setVisibleColumnsTasks] = useState(DEFAULT_VISIBLE_TASKS_CFG)`,
)

src = src.replace(
  /const \[currentStepName, setCurrentStepName\] = useState\('Review contract'\)/,
  `const [currentStepName, setCurrentStepName] = useState(L.reviewStepFallback || 'Review')`,
)

// merge calls with entity
src = src.replace(
  /mergeMyItemsRowWithVmsShape\(row, segment\)/g,
  'mergeMyItemsRowWithVmsShape(row, segment, __ENTITY_CONFIG__)',
)
src = src.replace(
  /mapKfContractTaskToRow\(row, ''\)/g,
  "mapKfContractTaskToRow(row, '', __ENTITY_CONFIG__)",
)
src = src.replace(
  /mapKfItemToContract\(payload, segment\)/g,
  'mapPmMyItemsItem(payload, __ENTITY_CONFIG__, segment)',
)
src = src.replace(
  /mapKfPmAdminItem__NEEDS_ENTITY\(list\[i\]\)/g,
  'mapKfPmAdminItem(list[i], __ENTITY_CONFIG__)',
)
src = src.replace(/mapKfPmAdminItem__NEEDS_ENTITY/g, 'mapKfPmAdminItem')

// buildMyItemsPath call
src = src.replace(
  /const path = buildMyItemsPath\(contractPaths, statusFilter, 1, 1000\)/,
  'const path = buildMyItemsPath(contractPaths, statusFilter, 1, 1000, __ENTITY_CONFIG__)',
)

// admin path
src = src.replace(
  /const path = adminPaths\.getContractItemsPath\(1, 1000\)/,
  'const path = adminPaths.getAdminItemsPath ? adminPaths.getAdminItemsPath(1, 1000) : adminPaths.getContractItemsPath(1, 1000)',
)

// STATUS_OPTIONS in UI — replace STATUS_OPTIONS.map with STATUS_OPTIONS_CFG
src = src.replace(/STATUS_OPTIONS\.map/g, 'STATUS_OPTIONS_CFG.map')
src = src.replace(/STATUS_TO_SEGMENT\[/g, 'STATUS_TO_SEGMENT_CFG[')

// createOverviewCards → createOverviewCardsForEntity
src = src.replace(/createOverviewCards\(/g, 'createOverviewCardsForEntity(')

// New Contract labels
src = src.replace(/New Contract/g, "${NEW_BTN_PLACEHOLDER}")
// Fix - can't use template in replace like that for JSX text. Use L.newButton via another pass.

src = src.split('${NEW_BTN_PLACEHOLDER}').join('{L.newButton}')

// primaryActionLabel="New Contract" already became {L.newButton} incorrectly if inside quotes
src = src.replace(/primaryActionLabel=\{L\.newButton\}/g, 'primaryActionLabel={L.newButton}')
src = src.replace(/primaryActionLabel="\{L\.newButton\}"/g, 'primaryActionLabel={L.newButton}')

// Search placeholders - find common patterns
src = src.replace(
  /placeholder="Search contracts[^"]*"/gi,
  'placeholder={L.searchPlaceholder || "Search…"}',
)
src = src.replace(
  /placeholder=\{`Search[^`]*`\}/g,
  'placeholder={L.searchPlaceholder || "Search…"}',
)

// Review contract fallbacks
src = src.replace(/'Review contract'/g, "(L.reviewStepFallback || 'Review')")
src = src.replace(/"Review contract"/g, "(L.reviewStepFallback || 'Review')")

// openPopup ID
src = src.replace(/resolveContractPopupId\(\)/g, 'resolveEntityPopupId(__ENTITY_CONFIG__)')
src = src.replace(/openPopup\('Popup_6xSap6ocDi'/g, 'openPopup(resolveEntityPopupId(__ENTITY_CONFIG__)')

// ITEMS_COLUMNS / TASKS_COLUMNS in render
src = src.replace(/\bITEMS_COLUMNS\b/g, 'ITEMS_COLUMNS_CFG')
src = src.replace(/\bTASKS_COLUMNS\b/g, 'TASKS_COLUMNS_CFG')

// Case-mode: skip pending when no pendingCountPath — soft-guard already via null paths
// Fix fetchPending when pendingCountPath null
src = src.replace(
  /useEffect\(function fetchPendingActivityCount\(\) \{\s*if \(!contractPaths\) return/,
  `useEffect(function fetchPendingActivityCount() {
    if (!contractPaths || !contractPaths.pendingCountPath && contractPaths.kind === 'case') {
      setPendingActivities([])
      setTasksFromApi([])
      setTotalTasksCount(0)
      return
    }
    if (!contractPaths) return`,
)

// Accordion labels: Contract → entity (light touch)
src = src.replace(/>Vendor Name</g, '>{ITEMS_COLUMNS_CFG.find(c=>c.id===\'vendor\')?.label || \'Owner\'}<')
// too risky for accordion

// fetchContractProgressResponse — guard null progress path
src = src.replace(
  /async function fetchContractProgressResponse/,
  `async function fetchContractProgressResponse`,
)

// Add default export helper note at end
src += `
\n/** @deprecated use createPmMyItemsPro(entityConfig) via entity wrappers */\nexport default createPmMyItemsPro\n`

fs.writeFileSync(target, src)
console.log('Adapted', target, 'bytes', src.length)
