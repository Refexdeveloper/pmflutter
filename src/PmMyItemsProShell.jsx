import React, { useState, useMemo, useEffect, useLayoutEffect, useContext, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { KissflowSDKContext } from './sdk/index.js'
import { getApiBase } from './apiBase.js'
import { buildPmEntityApiPaths, buildPmAdminApiPaths, resolvePmPopupId } from './lib/kfPmMyItemsPaths.js'
import { mapPmMyItemsItem, mapKfPmAdminItem, resolvePmSlaDeadlineRaw, pmStatusPillClass } from './lib/kfPmMyItemsMap.js'
import { fetchPmMyItemsEntityData, filterMyTasksForUser } from './lib/kfPmMyItemsData.js'
import { openPmNewItemPopup, buildPmPopupParams } from './lib/kfPmMyItemsCreate.js'
import { useSlaDeadlineMeta, slaDeadlineTitle } from './slaMeta.js'
import PtSelect from './components/PtSelect.jsx'
import {
  vmsPageClass,
  vmsPageInnerClass,
  vmsSectionShellClass,
  vmsSectionHeaderClass,
  vmsSearchInputClass,
  vmsGhostBtnClass,
  vmsPrimaryBtnClass,
  vmsSecondaryBtnClass,
  vmsDangerBtnClass,
  vmsIconBtnClass,
  vmsSegmentBtnClass,
  vmsChipBtnClass,
  vmsTableHeadClass,
  vmsTableHeadCellClass,
  vmsTableRowClass,
  vmsTableDivideClass,
  vmsExpandBtnClass,
  vmsPaginationBarClass,
  vmsPaginationBtnClass,
  vmsAccordionShellClass,
  vmsWorkflowStepClass,
  vmsHeaderShellClass,
  vmsAvatarClass,
  vmsRoleAccentClass,
  vmsBrandKpiAccent,
  vmsBrandKpiAccentLight,
  vmsBrandProgressBarClass,
} from './pm/ptTheme.js'
import SatelliteOrbitMenu from './components/SatelliteOrbitMenu.jsx'
import AOS from 'aos'

// ============= Helper Functions (same as original, kept for brevity) =============
function envVite(name) {
  try {
    const v = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[name]
    return v != null && String(v).trim() !== '' ? String(v).trim() : ''
  } catch {
    return ''
  }
}

function resolveEntityPopupId(entityConfig) { return resolvePmPopupId(entityConfig) }

function parseKfCountResponse(response) {
  const r = response?.data ?? response
  const raw = r?.Count ?? r?.count ?? r?.Total ?? r?.total
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  const n = parseInt(String(raw ?? '').replace(/,/g, ''), 10)
  return Number.isFinite(n) ? n : null
}

function stringifyKfRole(abc) {
  if (!abc) return ''
  if (typeof abc === 'string') return abc.trim()
  if (Array.isArray(abc)) {
    for (const x of abc) {
      const s = stringifyKfRole(x)
      if (s) return s
    }
    return ''
  }
  if (typeof abc === 'object') {
    const n = abc.Name ?? abc._name ?? abc.Title ?? abc.title ?? abc.Role ?? abc.role ?? ''
    return n != null ? String(n).trim() : ''
  }
  return ''
}

const STATUS_TO_SEGMENT = {
  'Draft': 'draft',
  'In progress': 'inprogress',
  'Completed': 'completed',
  'Withdrawn': 'withdrawn',
  'Rejected': 'rejected',
}

const SEGMENT_TO_STATUS_LABEL = {
  draft: 'Draft',
  inprogress: 'In progress',
  completed: 'Completed',
  withdrawn: 'Withdrawn',
  rejected: 'Rejected',
}

function stringifyKfFieldValue(val) {
  if (val == null) return ''
  if (typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean') return String(val)
  if (typeof val === 'object') {
    if (val.Name != null) return String(val.Name)
    if (val._name != null) return String(val._name)
    if (val.Title != null) return String(val.Title)
    if (val.value != null) return stringifyKfFieldValue(val.value)
    if (val.label != null) return String(val.label)
    if (Array.isArray(val) && val.length) return val.map(stringifyKfFieldValue).filter(Boolean).join(', ')
  }
  return ''
}

function getVal(item, keys, def = '') {
  const sources = [item, item?.Data, item?.data, item?._data, item?._source_data, item?._fields].filter(Boolean)
  for (const src of sources) {
    for (const k of keys) {
      const v = src?.[k]
      if (v !== undefined && v !== null && v !== '') return v
    }
    const lowerKeys = keys.map((k) => String(k).toLowerCase())
    for (const [k, v] of Object.entries(src || {})) {
      if (v !== undefined && v !== null && v !== '' && lowerKeys.includes(String(k).toLowerCase())) return v
    }
  }
  return def
}

function contractValueFromFieldRecord(f) {
  if (!f || typeof f !== 'object') return null
  const name = String(
    f.Name ?? f.name ?? f.Field_name ?? f.field_name ?? f.Title ?? f.Label ?? f.Display_name ?? f.display_name ?? '',
  ).toLowerCase().replace(/\s+/g, '_')
  const isValueField = name && (name.includes('contract_value') || name.includes('contract_amount') || name.includes('total_contract') || (name.includes('contract') && name.includes('value')) || name.includes('agreement_value') || name.includes('total_value') || name.includes('estimated_contract') || /^value_of/.test(name))
  if (!isValueField) return null
  const raw = f.Value ?? f.value ?? f.Selected_Value ?? f.selected_value ?? f.Result ?? f.result ?? f.Field_value ?? f.field_value ?? f.Default_value ?? f.default_value
  if (raw === undefined || raw === null || raw === '') return null
  if (typeof raw === 'object' && raw.value != null) return raw.value
  return raw
}

function extractContractValueRawFromFieldsBlob(fields) {
  if (fields == null) return null
  if (Array.isArray(fields)) {
    for (const f of fields) {
      const v = contractValueFromFieldRecord(f)
      if (v != null) return v
    }
    return null
  }
  if (typeof fields === 'object') {
    for (const f of Object.values(fields)) {
      const v = contractValueFromFieldRecord(f)
      if (v != null) return v
    }
  }
  return null
}

function extractContractValueRawFromFields(item) {
  if (!item || typeof item !== 'object') return null
  const buckets = [item, item.Data, item.data, item._data, item._source_data]
  if (Array.isArray(item._current_context)) {
    for (const c of item._current_context) {
      if (c && typeof c === 'object') buckets.push(c)
    }
  }
  for (const b of buckets) {
    if (!b || typeof b !== 'object') continue
    const v = extractContractValueRawFromFieldsBlob(b._fields) ?? extractContractValueRawFromFieldsBlob(b.fields) ?? extractContractValueRawFromFieldsBlob(b._field_values) ?? extractContractValueRawFromFieldsBlob(b.field_values)
    if (v != null) return v
  }
  return null
}

function extractContractValueLooseFromItem(item) {
  if (!item || typeof item !== 'object') return null
  const buckets = [item, item.Data, item.data, item._data, item._source_data]
  if (Array.isArray(item._current_context)) {
    for (const c of item._current_context) {
      if (c && typeof c === 'object') buckets.push(c)
    }
  }
  for (const src of buckets) {
    if (!src || typeof src !== 'object' || Array.isArray(src)) continue
    for (const [k, v] of Object.entries(src)) {
      if (!k || k.startsWith('_')) continue
      if (k === 'fields') continue
      const lk = String(k).toLowerCase()
      if (lk.includes('payment') && lk.includes('type')) continue
      const looksLikeContractValue = (lk.includes('contract') && (lk.includes('value') || lk.includes('amount'))) || lk === 'total_value' || lk === 'agreement_value' || lk.includes('total_contract_value') || lk.includes('estimated_contract_value')
      if (!looksLikeContractValue) continue
      if (v === undefined || v === null || v === '') continue
      if (typeof v === 'object' && v.value != null) return v.value
      return v
    }
  }
  return null
}

function formatStatusForDisplay(raw) {
  if (raw == null || raw === '') return ''
  const t = String(raw).trim()
  const norm = t.replace(/\s+/g, '')
  // Prefer Kissflow process myitems labels (Draft / In progress / …) so Tasks & Subtasks
  // match ContractsMyItemsPro. Keep PT dashboard labels (Open / Active / …) as passthrough.
  const map = {
    InProgress: 'In progress',
    inprogress: 'In progress',
    INPROGRESS: 'In progress',
    'In Progress': 'In progress',
    'In progress': 'In progress',
    Draft: 'Draft',
    draft: 'Draft',
    Completed: 'Completed',
    completed: 'Completed',
    Withdrawn: 'Withdrawn',
    withdrawn: 'Withdrawn',
    Rejected: 'Rejected',
    rejected: 'Rejected',
    Active: 'Active',
    active: 'Active',
    Planning: 'Planning',
    planning: 'Planning',
    'On Hold': 'On Hold',
    OnHold: 'On Hold',
    onhold: 'On Hold',
    Open: 'Open',
    open: 'Open',
    Overdue: 'Overdue',
    overdue: 'Overdue',
    Pending: 'Draft',
    pending: 'Draft',
    Expired: 'Completed',
    expired: 'Completed',
  }
  return map[t] || map[norm] || t
}

/** Map Kissflow myitems/status/count response → UI tab labels. */
function mapMyItemsStatusCountResponse(response, statusOptions) {
  if (!response || typeof response !== 'object') return null
  const api = {
    Draft: response.Draft ?? response.draft ?? 0,
    'In progress': response.InProgress ?? response['In progress'] ?? response.inprogress ?? 0,
    Completed: response.Completed ?? response.completed ?? 0,
    Withdrawn: response.Withdrawn ?? response.withdrawn ?? 0,
    Rejected: response.Rejected ?? response.rejected ?? 0,
    Open: response.Open ?? response.Draft ?? response.draft ?? 0,
    'In Progress': response.InProgress ?? response['In Progress'] ?? 0,
    Overdue: response.Overdue ?? response.overdue ?? 0,
    Active: response.Active ?? response.active ?? 0,
    Planning: response.Planning ?? response.planning ?? 0,
    'On Hold': response.OnHold ?? response['On Hold'] ?? response.onhold ?? 0,
  }
  const out = {}
  const opts = Array.isArray(statusOptions) && statusOptions.length ? statusOptions : Object.keys(api)
  opts.forEach((label) => {
    out[label] = Number(api[label] ?? 0) || 0
  })
  return out
}

function getStatusBadgeClass(status) {
  const s = String(formatStatusForDisplay(status) || '').toLowerCase()
  if (s.includes('completed') || s.includes('closed') || s.includes('done')) return 'bg-green-50 text-[#43A047] border-green-200'
  if (s.includes('progress') || s.includes('review') || s.includes('active')) return 'bg-blue-50 text-[#1E88E5] border-blue-200'
  if (s.includes('hold') || s.includes('blocked') || s.includes('planning')) return 'bg-orange-50 text-[#FB8C00] border-orange-200'
  if (s.includes('overdue') || s.includes('delay')) return 'bg-rose-50 text-[#EF4444] border-rose-200'
  if (s.includes('open') || s.includes('pending')) return 'bg-sky-50 text-[#0284C7] border-sky-200'
  return 'bg-gray-100 text-[#7F8C8D] border-gray-200'
}

function resolveStatusFromItem(item, listUrlSegment) {
  let raw = item._status ?? item.Status ?? item.status ?? item._workflow_status ?? item.Workflow_status
  if (raw == null || String(raw).trim() === '') {
    const step = item._current_step ?? item.Current_step ?? item.current_step
    if (step != null && typeof step === 'object') {
      raw = step.Name ?? step._name ?? step.Title ?? step.Step_name
    } else if (step != null) {
      raw = step
    }
  }
  if (raw != null && String(raw).trim() !== '') {
    return formatStatusForDisplay(raw)
  }
  if (listUrlSegment && SEGMENT_TO_STATUS_LABEL[listUrlSegment]) {
    return SEGMENT_TO_STATUS_LABEL[listUrlSegment]
  }
  return 'Draft'
}

function parseContractValueDisplay(raw) {
  if (raw == null || raw === '') return '—'
  if (typeof raw === 'number' && !Number.isNaN(raw)) {
    try {
      return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(raw)
    } catch {
      return String(raw)
    }
  }
  if (typeof raw === 'object' && raw.value != null) return parseContractValueDisplay(raw.value)
  const s = String(raw).replace(/[^0-9.-]/g, '')
  const n = parseFloat(s)
  if (Number.isFinite(n)) {
    try {
      return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
    } catch {
      return String(raw)
    }
  }
  return stringifyKfFieldValue(raw) || '—'
}

function formatContractDateUs(raw) {
  if (raw == null || raw === '') return '—'
  const d = new Date(raw)
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' })
  }
  const s = String(raw).trim()
  return s || '—'
}

function parsePercentField(raw) {
  if (raw == null || raw === '') return null
  if (typeof raw === 'number' && !Number.isNaN(raw)) {
    const n = raw > 0 && raw <= 1 ? Math.round(raw * 100) : Math.round(raw)
    return Math.max(0, Math.min(100, n))
  }
  const s = String(raw).replace(/%/g, '').replace(/,/g, '').trim()
  const n = parseFloat(s)
  if (!Number.isFinite(n)) return null
  const x = n > 0 && n <= 1 ? Math.round(n * 100) : Math.round(n)
  return Math.max(0, Math.min(100, x))
}

function formatYesNoLabel(val) {
  if (val == null || val === '') return '—'
  if (typeof val === 'boolean') return val ? 'Yes' : 'No'
  const s = String(val).trim().toLowerCase()
  if (['yes', 'y', 'true', '1'].includes(s)) return 'Yes'
  if (['no', 'n', 'false', '0'].includes(s)) return 'No'
  return String(val)
}

function summarizeContractDocuments(val) {
  if (val == null || val === '') return 'No attachments'
  if (Array.isArray(val)) {
    if (val.length === 0) return 'No attachments'
    const names = val.map((x) => (x && typeof x === 'object' ? (x.Name || x._name || x.filename || x.File_name) : x)).filter(Boolean)
    if (names.length) return names.map(String).join(', ')
    return `${val.length} attachment(s)`
  }
  if (typeof val === 'object') {
    const n = val.Name || val._name || val.filename
    if (n) return String(n)
  }
  const str = stringifyKfFieldValue(val)
  if (!str) return 'No attachments'
  return str
}

function formatRequestNumberDisplay(raw) {
  const s = stringifyKfFieldValue(raw).trim()
  if (!s) return '—'
  if (/^ctr#/i.test(s)) return s
  return `CTR# ${s.replace(/^#?\s*/i, '')}`
}

function resolveVendorFromItem(item) {
  const direct = stringifyKfFieldValue(getVal(item, ['Vendor', 'Vendor_Name', 'VendorName', 'Vendor_Name_A00', 'Vendor_Master', 'Vendor_Master_A02', 'Vendor_Details', 'Supplier', 'Supplier_Name', 'Party_Name'], ''))
  if (direct) return direct
  for (const src of [item, item?.Data, item?.data, item?._data, item?._source_data, item?._fields]) {
    if (!src || typeof src !== 'object') continue
    for (const [k, v] of Object.entries(src)) {
      if (!k || k.startsWith('_')) continue
      const lk = String(k).toLowerCase()
      if (!lk.includes('vendor') && !lk.includes('supplier') && !lk.includes('party')) continue
      if (lk.includes('id') || lk.includes('code') || lk.includes('count') || lk.includes('total')) continue
      const s = stringifyKfFieldValue(v).trim()
      if (s) return s
    }
  }
  return ''
}

function mapKfItemToContract(item, listUrlSegment) {
  if (!item || typeof item !== 'object') return null
  const id = getVal(item, ['_id', 'id'], '')
  const ctx = Array.isArray(item._current_context) ? item._current_context : []
  const firstCtx = ctx.length > 0 ? ctx[0] : null
  const activityId = item._activity_id ?? item._activityId ?? item._context_activity_id ?? item._current_activity_id ?? item._activity?._id ?? item._activity?.id ?? firstCtx?._context_activity_id ?? firstCtx?._context_current_step_id ?? ''
  const activityInstanceId = item._activity_instance_id ?? item._context_activity_instance_id ?? item._activityInstanceId ?? item._activity_instance?._id ?? item._activity_instance?.id ?? item._context_activity_instance?._id ?? item._context_activity_instance?.id ?? firstCtx?._context_activity_instance_id ?? firstCtx?._context_activity_instance ?? ''
  const normalizedActivityInstanceId = Array.isArray(activityInstanceId) ? (activityInstanceId[0] ?? '') : activityInstanceId
  const name = stringifyKfFieldValue(getVal(item, ['Contract_Title', 'Name', 'Untitled_Field'], '')) || id || '—'
  const vendor = resolveVendorFromItem(item)
  const valueRaw = getVal(item, ['Contract_Value', 'ContractValue', 'Total_Contract_Value', 'Contract_Amount', 'Agreement_Value', 'Total_Value', 'Estimated_Contract_Value', 'Value_of_Contract', 'Grand_Total', 'Contract_Total'], null) ?? extractContractValueRawFromFields(item) ?? extractContractValueLooseFromItem(item)
  const valueDisplay = parseContractValueDisplay(valueRaw)
  const startRaw = getVal(item, ['Effective_Date', 'effective_date', 'Contract_Start_Date', 'Start_Date', 'Contract_StartDate', 'StartDate'], '')
  const endRaw = getVal(item, ['End_Date', 'EndDate'], '')
  const endDate = endRaw ? String(endRaw).slice(0, 10) : '—'
  const startDateDisplay = formatContractDateUs(startRaw)
  const endDateDisplay = formatContractDateUs(endRaw)
  const contractType = stringifyKfFieldValue(getVal(item, ['Contract_Type', 'Type_of_Contract', 'ContractType', 'Type'], '')) || '—'
  const contractRequestDisplay = formatRequestNumberDisplay(getVal(item, ['Contract_Request_Number', 'Contract_Request_No', 'Request_Number', 'CTR_Number', 'Contract_Request#'], ''))
  const contractCategory = stringifyKfFieldValue(getVal(item, ['Contract_Category', 'Category_of_Contract', 'Contract_Cat'], '')) || '—'
  const contractDescription = stringifyKfFieldValue(getVal(item, ['Contract_Description', 'Scope_Description', 'Scope_of_Work'], '')) || stringifyKfFieldValue(getVal(item, ['Description'], ''))
  const currency = stringifyKfFieldValue(getVal(item, ['Currency', 'Contract_Currency', 'Currency_Code'], '')) || 'INR'
  const paymentType = stringifyKfFieldValue(getVal(item, ['Payment_Type', 'PaymentType', 'Payment_Method', 'Mode_of_Payment'], '')) || '—'
  const contractDocumentsSummary = summarizeContractDocuments(getVal(item, ['Contract_Documents', 'Contract_Document', 'Attachments', 'Upload_Documents', 'Files'], null))
  const ndaRaw = getVal(item, ['NDA_Available'], '')
  const msaRaw = getVal(item, ['MSA_Available'], '')
  const sowRaw = getVal(item, ['SOW_Available'], '')
  const ratingOverall = parsePercentField(getVal(item, ['Untitled_Field_1', 'Overall_Score', 'Vendor_Score', 'Performance_Score', 'Contract_Rating', 'Rating'], null))
  const ratingTat = parsePercentField(getVal(item, ['TAT_Adherence', 'TAT_Rating', 'TAT_Score', 'Turnaround_Adherence'], null))
  const ratingService = parsePercentField(getVal(item, ['Service_Rate', 'Service_Rating', 'Service_Score'], null))
  const ratingResponse = parsePercentField(getVal(item, ['Response_Rate', 'Response_Rating', 'Response_Score'], null))
  const ratingPm = parsePercentField(getVal(item, ['PM_Adherence', 'PM_Adherence_Rating', 'Preventive_Maintenance_Adherence', 'PM_Score'], null))
  const createdBy = item._created_by?.Name || item.Created_by?.Name || stringifyKfFieldValue(getVal(item, ['_current_assigned_to', 'AssignedTo', 'assigned_to'], '')) || null
  const currentStep = stringifyKfFieldValue(getVal(item, ['_current_step', 'Current_step', 'current_step'], ''))
  const slaDeadline = resolvePmSlaDeadlineRaw(item)
  return {
    id, name, vendor, rawItem: item, valueDisplay, endDate, startDateDisplay, endDateDisplay, contractType, contractRequestDisplay, contractCategory, contractDescription, currency, paymentType, contractDocumentsSummary, ratingOverall, ratingTat, ratingService, ratingResponse, ratingPm, nda: stringifyKfFieldValue(ndaRaw), msa: stringifyKfFieldValue(msaRaw), sow: stringifyKfFieldValue(sowRaw), fullName: vendor, phoneNumber: stringifyKfFieldValue(getVal(item, ['Contact_Phone', 'Phone_Number'], '')), emailId: stringifyKfFieldValue(getVal(item, ['Contact_Email', 'Email_Id', 'Email'], '')), address: stringifyKfFieldValue(getVal(item, ['Vendor_Address', 'Address'], '')), message: stringifyKfFieldValue(getVal(item, ['Remarks', 'Internal_Notes', 'Your_Message', 'Message', 'Notes'], '')) || contractDescription || '', website: contractType, createdDate: stringifyKfFieldValue(getVal(item, ['Created_at', '_created_at', '_modified_at', 'Modified_at'], '')), modifiedAt: stringifyKfFieldValue(getVal(item, ['_modified_at', 'Modified_at'], '')), completedAt: stringifyKfFieldValue(getVal(item, ['_completed_at', 'Completed_at'], '')), status: resolveStatusFromItem(item, listUrlSegment), progress: Number(getVal(item, ['_progress', 'Progress'], 0)) || 0, createdBy, currentStep, activityId, activityInstanceId: normalizedActivityInstanceId, slaDeadline,
  }
}

function hasTopLevelContractValueForVmsMap(item) {
  if (!item || typeof item !== 'object') return false
  const raw = item.Contract_Value ?? item.ContractValue
  if (raw == null) return false
  if (typeof raw === 'string' && raw.trim() === '') return false
  return true
}

function mergeMyItemsRowWithVmsShape(item, listUrlSegment, entityConfig) {
  return mapPmMyItemsItem(item, entityConfig, listUrlSegment)
}

function initialsFromUser(user) {
  if (!user) return 'U'
  const name = user.Name || user.FirstName || ''
  const parts = String(name).trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] || '') + (parts[1][0] || '')
  if (user.FirstName && user.LastName) return (user.FirstName[0] || '') + (user.LastName[0] || '')
  return name.slice(0, 2).toUpperCase() || 'U'
}

function mapKfContractTaskToRow(item, fallbackActivityId, entityConfig) {
  const row = mergeMyItemsRowWithVmsShape(item, undefined, entityConfig)
  if (!row) return null
  const createdBy = item._created_by?.Name || row.createdBy
  const createdByInitials = initialsFromUser(item._created_by)
  const statusDisplay = formatStatusForDisplay(row.status) || row.status || 'In progress'
  return { ...row, activityId: row.activityId || fallbackActivityId || '', createdBy, createdByInitials, status: statusDisplay }
}

async function fetchContractTaskDetailMerged(contractPaths, kfInstance, baseTask, activityIdFallback, entityConfig) {
  const instanceId = baseTask?.id || baseTask?._id
  const activityInstanceId = baseTask?.activityInstanceId || baseTask?._activity_instance_id
  if (!instanceId || !activityInstanceId) return null
  const path =
    typeof contractPaths.getInstancePath === 'function'
      ? contractPaths.getInstancePath(instanceId, activityInstanceId)
      : `/process/2/${contractPaths.accountId}/${contractPaths.processId}/${encodeURIComponent(String(instanceId))}/${encodeURIComponent(String(activityInstanceId))}?_application_id=${encodeURIComponent(contractPaths.applicationId)}`
  const sdk = kfInstance
  try {
    let response
    if (sdk?.api) {
      const resp = await sdk.api(path, { method: 'GET', headers: { Accept: 'application/json' } })
      response = resp?.data ?? resp ?? null
    } else {
      const res = await fetch(getApiBase() + path, { method: 'GET', credentials: 'include', headers: { Accept: 'application/json' } })
      if (!res.ok) return null
      response = await res.json()
    }
    const row = response?.Data ?? response?.data ?? response?.Item ?? response
    const payload = row && typeof row === 'object' && !Array.isArray(row) ? row : response
    return mapKfContractTaskToRow(payload, baseTask?.activityId || activityIdFallback || '', entityConfig)
  } catch {
    return null
  }
}

function normalizeCreatorMatchKey(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Creator id + display name from a table/KPI row (my items, tasks, or admin map row with raw/rawItem). */
function extractCreatedByFromRow(row) {
  if (!row || typeof row !== 'object') return { id: '', name: '' }
  const raw = row.rawItem ?? row.raw
  let id = ''
  let name = ''
  if (row.createdBy != null) {
    if (typeof row.createdBy === 'string') name = String(row.createdBy).trim()
    else if (typeof row.createdBy === 'object') {
      name = String(row.createdBy.Name || row.createdBy._name || '').trim()
      id = String(row.createdBy._id || row.createdBy.id || '').trim()
    }
  }
  if (raw && typeof raw === 'object') {
    const cb = raw._created_by ?? raw.Created_by
    if (cb && typeof cb === 'object') {
      if (!id) id = String(cb._id || cb.id || '').trim()
      if (!name) {
        const fn = String(cb.FirstName || '').trim()
        const ln = String(cb.LastName || '').trim()
        name = (fn || ln) ? `${fn} ${ln}`.trim() : String(cb.Name || cb._name || '').trim()
      }
    } else if (!name && typeof cb === 'string') {
      name = cb.trim()
    }
  }
  return { id, name }
}

/** True when Kissflow creator matches the signed-in user (by _id, else exact normalized name). */
function rowCreatedByMatchesUser(row, user) {
  if (!user || typeof user !== 'object') return true
  const { id: creatorId, name: creatorName } = extractCreatedByFromRow(row)
  const userId = user._id != null ? String(user._id).trim() : ''
  if (userId && creatorId && userId === creatorId) return true
  const a = normalizeCreatorMatchKey(creatorName)
  if (!a) return false
  const candidates = []
  if (user.Name) candidates.push(normalizeCreatorMatchKey(user.Name))
  const firstLast = [user.FirstName, user.LastName].filter(Boolean).join(' ')
  if (firstLast) candidates.push(normalizeCreatorMatchKey(firstLast))
  if (user.FirstName) candidates.push(normalizeCreatorMatchKey(user.FirstName))
  const uniq = [...new Set(candidates.filter(Boolean))]
  return uniq.some((c) => c.length > 0 && c === a)
}

function buildMyItemsPath(contractPaths, statusFilter, pageNumber, pageSize, entityConfig) {
  const segment = (entityConfig?.statusToSegment || STATUS_TO_SEGMENT)[statusFilter] || 'draft'
  if (typeof contractPaths.getMyItemsPath === 'function') {
    return contractPaths.getMyItemsPath(segment, pageNumber, pageSize)
  }
  const pn = Math.max(1, Number(pageNumber) || 1)
  const ps = Math.min(1000, Math.max(1, Number(pageSize) || 1000))
  return `/process/2/${contractPaths.accountId}/${contractPaths.processId}/myitems/${segment}?apply_preference=true&page_number=${pn}&page_size=${ps}&skip_aggregation=true&_application_id=${encodeURIComponent(contractPaths.applicationId)}`
}

const STATUS_OPTIONS = ['Draft', 'In progress', 'Completed', 'Withdrawn', 'Rejected']

const ITEMS_COLUMNS = [
  { id: 'vendor', label: 'Owner', width: 'min-w-[180px]' },
  { id: 'contractCategory', label: 'Category', width: 'min-w-[100px]' },
  { id: 'createdAt', label: 'Date Created', width: 'min-w-[140px]' },
  { id: 'valueDisplay', label: 'Progress', width: 'min-w-[120px]' },
  { id: 'status', label: 'Status', width: 'min-w-[100px]' },
  { id: 'sla', label: 'SLA', width: 'min-w-[110px]' },
  { id: 'endDate', label: 'End Date', width: 'min-w-[100px]' },
]

const TASKS_COLUMNS = [
  { id: 'vendor', label: 'Owner', width: 'min-w-[180px]' },
  { id: 'contractCategory', label: 'Category', width: 'min-w-[100px]' },
  { id: 'createdAt', label: 'Date Created', width: 'min-w-[140px]' },
  { id: 'valueDisplay', label: 'Progress', width: 'min-w-[120px]' },
  { id: 'status', label: 'Status', width: 'min-w-[100px]' },
  { id: 'sla', label: 'SLA', width: 'min-w-[110px]' },
  { id: 'endDate', label: 'End Date', width: 'min-w-[100px]' },
]

const DEFAULT_VISIBLE_ITEMS = Object.fromEntries(ITEMS_COLUMNS.map((c) => [c.id, true]))
const DEFAULT_VISIBLE_TASKS = Object.fromEntries(TASKS_COLUMNS.map((c) => [c.id, true]))

function formatDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function formatIsoDateToDisplay(iso) {
  if (!iso) return ''
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return ''
  return `${m[3]}-${m[2]}-${m[1]}`
}

function formatDateToIso(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) return ''
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function startOfMonth(date) { return new Date(date.getFullYear(), date.getMonth(), 1) }

function ratingToFiveScale(n) {
  if (n == null || !Number.isFinite(n)) return null
  const raw = Number(n)
  const outOfFive = raw <= 5 ? raw : raw / 20
  return Math.max(0, Math.min(5, outOfFive))
}

function StarRatingDock({ value }) {
  const [hoveredIdx, setHoveredIdx] = useState(null)
  const rating = ratingToFiveScale(value)
  if (rating == null) return <span className="text-slate-500">—</span>
  const filled = Math.round(rating)
  return (
    <div
      className="inline-flex shrink-0 flex-nowrap items-end gap-0.5 py-1 sm:gap-1"
      onMouseLeave={() => setHoveredIdx(null)}
      aria-label={`${filled} out of 5 stars`}
    >
      {[0, 1, 2, 3, 4].map((idx) => {
        const distance = hoveredIdx == null ? 9 : Math.abs(hoveredIdx - idx)
        const scale = hoveredIdx == null ? 1 : distance === 0 ? 1.9 : distance === 1 ? 1.45 : distance === 2 ? 1.15 : 1
        const filledStar = idx < filled
        return (
          <span
            key={idx}
            onMouseEnter={() => setHoveredIdx(idx)}
            className={`select-none text-base leading-none transition-transform duration-150 ease-out sm:text-[1.3rem] ${filledStar ? 'text-[#1E88E5]' : 'text-[#BFDBFE]'}`}
            style={{ transform: `scale(${scale})`, transformOrigin: 'bottom center' }}
          >
            ★
          </span>
        )
      })}
    </div>
  )
}

function ItemVendorNameCell({ item, vendorCellLoadingById }) {
  const resolved = String(item.vendor || resolveVendorFromItem(item.rawItem) || '').trim()
  const isLoading = !!vendorCellLoadingById[item.id] && !resolved
  if (isLoading) {
    return (
      <span className="inline-flex items-center gap-1.5 text-slate-400">
        <motion.span className="h-3 w-3 rounded-full border-2 border-[#BFDBFE] border-t-[#1E88E5]" animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }} />
        <span className="text-xs">Loading…</span>
      </span>
    )
  }
  return <span className="text-xs font-medium text-slate-700 sm:text-sm">{resolved || '—'}</span>
}

function parseDateSafe(raw) {
  if (!raw) return null
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

function startOfDay(date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()) }

function daysBetween(from, to) {
  const a = startOfDay(from).getTime()
  const b = startOfDay(to).getTime()
  return Math.floor((b - a) / (24 * 60 * 60 * 1000))
}

function isDocAvailable(val) {
  if (val == null || val === '') return false
  const s = String(val).trim().toLowerCase()
  if (['yes', 'y', 'true', '1', 'available'].includes(s)) return true
  if (['no', 'n', 'false', '0', 'not available', 'missing', '—'].includes(s)) return false
  return !!s
}

function formatContractStepStatusLabel(raw) {
  const t = String(raw || '').trim()
  if (!t) return '—'
  if (/not\s*started/i.test(t)) return 'Not started'
  if (/in\s*progress/i.test(t)) return 'In progress'
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function contractStepStatusBadgeClass(status) {
  const s = String(status || '').toLowerCase()
  if (s.includes('completed')) return 'bg-emerald-600 text-white'
  if (s.includes('in progress')) return 'bg-[#1E88E5] text-white'
  if (s.includes('rejected')) return 'bg-rose-600 text-white'
  if (s.includes('withdrawn')) return 'bg-orange-500 text-white'
  return 'bg-slate-400 text-white'
}

function contractStatusTrackerSteps(item) {
  const status = String(formatStatusForDisplay(item?.status) || item?.status || '').toLowerCase()
  const endRaw = item?.endDate || item?.endDateDisplay
  const endDate = endRaw ? parseDateSafe(endRaw) : null
  const hasExpiredDate = !!endDate && startOfDay(endDate) < startOfDay(new Date())

  if (status.includes('rejected')) {
    return [
      { title: 'Drafted', status: 'Completed' },
      { title: 'Review', status: 'Completed' },
      { title: 'Rejected', status: 'Rejected' },
      { title: 'Closed', status: 'Not Started' },
    ]
  }
  if (status.includes('withdrawn')) {
    return [
      { title: 'Drafted', status: 'Completed' },
      { title: 'Review', status: 'Completed' },
      { title: 'Withdrawn', status: 'Withdrawn' },
      { title: 'Closed', status: 'Not Started' },
    ]
  }
  if (status.includes('completed')) {
    return [
      { title: 'Drafted', status: 'Completed' },
      { title: 'Review', status: 'Completed' },
      { title: 'Active', status: 'Completed' },
      { title: 'Closed', status: 'Completed' },
    ]
  }
  if (status.includes('draft')) {
    return [
      { title: 'Drafted', status: 'In Progress' },
      { title: 'Review', status: 'Not Started' },
      { title: 'Active', status: 'Not Started' },
      { title: 'Closure', status: 'Not Started' },
    ]
  }
  if (hasExpiredDate || status.includes('expired')) {
    return [
      { title: 'Drafted', status: 'Completed' },
      { title: 'Review', status: 'Completed' },
      { title: 'Active', status: 'Completed' },
      { title: 'Expired', status: 'Completed' },
    ]
  }
  return [
    { title: 'Drafted', status: 'Completed' },
    { title: 'Review', status: 'Completed' },
    { title: 'Active', status: 'In Progress' },
    { title: 'Closure', status: 'Not Started' },
  ]
}

function contractWorkflowProgress(steps) {
  const done = steps.filter((s) => String(s.status).toLowerCase().includes('completed')).length
  return Math.round((done / Math.max(1, steps.length)) * 100)
}

function flattenProgressSteps(progress) {
  const apiSteps = Array.isArray(progress?.Steps) ? progress.Steps : []
  if (!apiSteps.length) return []
  const out = []
  apiSteps.forEach((s) => {
    const title = s?.Name || s?.Id || 'Step'
    const status = formatStatusForDisplay(s?._status || s?.Status || '')
    out.push({ title, status: status || 'In Progress' })
    const nestedProcesses = Array.isArray(s?.Process) ? s.Process : []
    nestedProcesses.forEach((p) => {
      const nestedSteps = Array.isArray(p?.Steps) ? p.Steps : []
      nestedSteps.forEach((n) => {
        const nTitle = n?.Name || n?.Id || p?.ProcessName || 'Step'
        const nStatus = formatStatusForDisplay(n?._status || n?.Status || '')
        out.push({ title: nTitle, status: nStatus || 'In Progress' })
      })
    })
  })
  return out
}

async function fetchContractProgressResponse(kfInstance, paths, instanceId) {
  if (!paths?.accountId || !paths?.processId || !instanceId) return null
  if (paths.kind === 'case') return null
  const sdk = kfInstance
  const progressPath =
    typeof paths.getProgressPath === 'function' && paths.getProgressPath(instanceId)
      ? paths.getProgressPath(instanceId)
      : `/process/2/${paths.accountId}/${paths.processId}/${encodeURIComponent(String(instanceId))}/progress`
  if (!progressPath) return null
  if (sdk?.api) {
    const resp = await sdk.api(progressPath, { method: 'GET', headers: { Accept: 'application/json' } })
    return resp?.data ?? resp ?? null
  }
  const res = await fetch(getApiBase() + progressPath, {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Progress HTTP ${res.status}`)
  return await res.json()
}

function AccordionDetailTile({ label, value, icon, highlight = false, className = '' }) {
  return (
    <div
      className={`rounded-xl px-3 py-2.5 ring-1 ${
        highlight
          ? 'bg-blue-50/80 ring-[#1E88E5]/25'
          : 'bg-slate-50/80 ring-slate-100/90'
      } ${className}`}
    >
      <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#7F8C8D]">
        {icon ? <i className={`${icon} text-xs text-[#1E88E5]`} aria-hidden /> : null}
        {label}
      </p>
      <p className="text-sm font-semibold text-[#2C3E50] break-words [overflow-wrap:anywhere]">{value || '—'}</p>
    </div>
  )
}

function DocChip({ label, available }) {
  return (
    <div
      className={`inline-flex min-w-[5.5rem] flex-1 items-center gap-2 rounded-xl border px-2.5 py-2 ${
        available
          ? 'border-emerald-200/80 bg-emerald-50/70 text-emerald-800'
          : 'border-slate-200/80 bg-slate-50/70 text-slate-500'
      }`}
    >
      <span
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
          available ? 'bg-emerald-500 text-white shadow-sm' : 'bg-slate-200 text-slate-500'
        }`}
      >
        <i className={`${available ? 'ri-check-line' : 'ri-close-line'} text-sm`} aria-hidden />
      </span>
      <span className="text-xs font-semibold">{label}</span>
    </div>
  )
}

function ContractWorkflowTimeline({ steps, loading = false, item = null }) {
  const fallbackSteps = item ? contractStatusTrackerSteps(item) : []
  const displaySteps = loading ? [] : (steps?.length ? steps : fallbackSteps)
  const progress = contractWorkflowProgress(displaySteps)
  const isLive = !loading && steps?.length > 0

  return (
    <div className={`${vmsAccordionShellClass()} p-3 sm:p-4`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="inline-flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-800">
          <i className="ri-route-line text-[#1E88E5]" aria-hidden />
          Workflow Progress
        </p>
        <span className="shrink-0 text-xs font-semibold tabular-nums text-[#1565C0]">
          {loading ? 'Loading…' : `${progress}%`}
        </span>
      </div>
      {loading ? (
        <div className="py-6 text-center text-xs text-slate-500">
          <i className="ri-loader-4-line animate-spin mr-1.5 text-[#1E88E5]" aria-hidden />
          Fetching live workflow progress…
        </div>
      ) : (
        <>
      <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-slate-200/80">
        <motion.div
          className={vmsBrandProgressBarClass()}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        />
      </div>
      {!isLive && displaySteps.length > 0 ? (
        <p className="mb-2 text-[10px] text-slate-400">Showing estimated progress from contract status.</p>
      ) : null}
      <div className="space-y-2.5">
        {displaySteps.map((step, idx) => {
          const isLast = idx === displaySteps.length - 1
          const isDone = String(step.status).toLowerCase().includes('completed')
          const isActive = String(step.status).toLowerCase().includes('in progress')
          return (
            <div key={`${step.title}-${idx}`} className="relative flex items-start gap-3 pl-1 min-w-0">
              <div className="relative mt-0.5 flex w-5 shrink-0 justify-center">
                {!isLast ? (
                  <span
                    className={`absolute top-6 bottom-[-10px] left-1/2 -translate-x-1/2 border-l-2 ${
                      isDone ? 'border-emerald-300' : 'border-dashed border-slate-300'
                    }`}
                  />
                ) : null}
                <div
                  className={`relative z-10 flex h-5 w-5 items-center justify-center rounded-full ${
                    isDone
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : isActive
                        ? 'border-2 border-[#1E88E5] bg-[#E3F2FD] text-[#1565C0]'
                        : 'border border-slate-300 bg-white text-slate-500'
                  }`}
                >
                  {isDone ? (
                    <i className="ri-check-line text-[10px]" aria-hidden />
                  ) : (
                    <span className="text-[9px] font-bold">{idx + 1}</span>
                  )}
                </div>
              </div>
              <div className={`min-w-0 flex-1 ${vmsWorkflowStepClass()}`}>
                <div className="flex items-start justify-between gap-2 min-w-0">
                  <p className="min-w-0 text-sm font-medium text-slate-800 break-words">{step.title}</p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold leading-snug ${contractStepStatusBadgeClass(step.status)}`}
                  >
                    {formatContractStepStatusLabel(step.status)}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
        </>
      )}
    </div>
  )
}

// ============= Beautiful Accordion Component =============
function ElegantContractAccordion({ item, onViewDetails, onClose, flash, workflowSteps, workflowLoading = false }) {
  const getSlaMeta = useSlaDeadlineMeta()
  if (!item) return null

  const accordionId = item?.id ? `contract-accordion-${item.id}` : undefined
  const liveSteps = Array.isArray(workflowSteps) ? workflowSteps : []
  const workflowProgress = contractWorkflowProgress(
    workflowLoading ? [] : (liveSteps.length ? liveSteps : contractStatusTrackerSteps(item)),
  )
  const slaMeta = item.id ? getSlaMeta(item.id, item.slaDeadline) : null
  const vendorInitial = (item.vendor || item.name || '?').charAt(0).toUpperCase()
  const description = item.contractDescription || item.message || '—'

  const detailFields = [
    { label: 'Owner', value: item.vendor, icon: 'ri-user-3-line' },
    { label: 'Related', value: item.contractType, icon: 'ri-file-text-line' },
    { label: 'Priority', value: item.contractCategory, icon: 'ri-price-tag-3-line' },
    { label: 'Progress', value: item.valueDisplay, icon: 'ri-percent-line', highlight: true },
    { label: 'Start Date', value: item.startDateDisplay, icon: 'ri-calendar-check-line' },
    { label: 'End Date', value: item.endDateDisplay || item.endDate, icon: 'ri-calendar-close-line' },
    { label: 'Created', value: item.createdDate ? formatDateTime(item.createdDate) : '—', icon: 'ri-time-line' },
    { label: 'Notes', value: item.paymentType && item.paymentType !== '—' ? item.paymentType : (item.message || '—'), icon: 'ri-sticky-note-line' },
  ]

  return (
    <motion.div
      id={accordionId}
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className={`mx-2 mb-3 mt-2 overflow-hidden sm:mx-4 sm:mb-4 sm:mt-3 ${
        flash ? 'ring-2 ring-[#93C5FD]/70 ring-offset-2 ring-offset-white' : ''
      }`}
    >
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-lg shadow-slate-200/40">
        {/* Hero header */}
        <div className="relative overflow-hidden border-b border-slate-100 bg-gradient-to-r from-white to-blue-50/40 px-4 py-4 sm:px-5">
          <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-[#1E88E5]/8 blur-3xl" aria-hidden />

          <div className="relative flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#1E88E5] text-sm font-bold text-white shadow-sm ring-2 ring-white">
                {vendorInitial}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#1E88E5]">Overview</p>
                <h3 className="mt-0.5 text-base font-bold leading-snug text-[#2C3E50] break-words [overflow-wrap:anywhere] sm:text-lg">
                  {item.name || '—'}
                </h3>
                <p className="mt-1 text-xs text-[#7F8C8D]">
                  {item.vendor || '—'}
                  {item.createdDate ? ` · Updated ${formatDateTime(item.createdDate)}` : ''}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <span className={`inline-flex px-2.5 py-1 text-xs font-semibold rounded-full border ${getStatusBadgeClass(item.status)}`}>
                {formatStatusForDisplay(item.status) || '—'}
              </span>
              {slaMeta?.label ? (
                <span
                  className={`inline-flex px-2.5 py-1 text-[11px] font-semibold rounded-full border ${slaMeta.pill}`}
                  title={slaDeadlineTitle(item.slaDeadline)}
                >
                  SLA · {slaMeta.label}
                </span>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close details"
                className={vmsIconBtnClass(false)}
              >
                <i className="ri-close-line text-base" />
              </button>
            </div>
          </div>

          <div className="relative mt-3 grid grid-cols-3 gap-2">
            {[
              { label: 'Value', value: item.valueDisplay || '—', icon: 'ri-money-rupee-circle-line' },
              { label: 'Type', value: item.contractType || '—', icon: 'ri-file-list-3-line' },
              { label: 'Progress', value: `${workflowProgress}%`, icon: 'ri-pulse-line' },
            ].map(({ label, value, icon }) => (
              <div key={label} className="rounded-xl border border-white/80 bg-white/70 px-2.5 py-2 shadow-sm backdrop-blur-sm">
                <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  <i className={`${icon} text-[#1E88E5]`} aria-hidden />
                  {label}
                </p>
                <p className="mt-0.5 truncate text-sm font-bold text-slate-900">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="grid grid-cols-1 gap-3 p-3 sm:p-4 xl:grid-cols-[1.55fr_1fr]">
          {/* Contract details */}
          <div className={`${vmsAccordionShellClass()} p-3 sm:p-4`}>
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[#1E88E5]">Details</p>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
              {detailFields.map(({ label, value, icon, highlight }) => (
                <AccordionDetailTile key={label} label={label} value={value} icon={icon} highlight={highlight} />
              ))}
            </div>
            <div className="mt-3">
              <AccordionDetailTile
                label="Description"
                value={description}
                icon="ri-align-left"
                className="min-h-[4.5rem]"
              />
            </div>

            <div className="mt-4 border-t border-slate-200/70 pt-4">
              <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-[#1E88E5]/80">
                <i className="ri-star-smile-line text-[#1E88E5]" aria-hidden />
                Vendor Performance
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
                {[
                  { label: 'Overall', value: item.ratingOverall },
                  { label: 'TAT', value: item.ratingTat },
                  { label: 'Service', value: item.ratingService },
                  { label: 'Response', value: item.ratingResponse },
                  { label: 'PM', value: item.ratingPm },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="rounded-xl border border-slate-200/70 bg-white/80 px-2.5 py-2 text-center shadow-sm"
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                    <div className="mt-1 flex justify-center">
                      <StarRatingDock value={value} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="flex flex-col gap-3">
            <ContractWorkflowTimeline steps={liveSteps} loading={workflowLoading} item={item} />

            <div className={`${vmsAccordionShellClass()} p-3 sm:p-4`}>
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
                <i className="ri-folder-open-line text-[#1E88E5]" aria-hidden />
                Documents
              </p>
              <div className="flex flex-wrap gap-2">
                <DocChip label="SOW" available={isDocAvailable(item.sow)} />
                <DocChip label="NDA" available={isDocAvailable(item.nda)} />
                <DocChip label="MSA" available={isDocAvailable(item.msa)} />
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-500">
                <i className="ri-information-line shrink-0" aria-hidden />
                Green chips indicate uploaded documents on file.
              </p>
            </div>

            <div className={`${vmsAccordionShellClass()} flex flex-col gap-2 p-3 sm:p-4`}>
              <button type="button" onClick={onViewDetails} className={vmsPrimaryBtnClass()}>
                <i className="ri-external-link-line" aria-hidden />
                View Full Details
              </button>
              <button type="button" onClick={onClose} className={vmsSecondaryBtnClass()}>
                <i className="ri-arrow-up-s-line" aria-hidden />
                Collapse
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ============= Animated Bar Component =============
function AnimatedBar({ widthPct, color, trackClass, delay }) {
  const x = Math.min(100, Math.max(0, widthPct)) / 100
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full ${trackClass}`}>
      <motion.div
        className="h-full w-full origin-left rounded-full"
        style={{ backgroundColor: color }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: x }}
        transition={{ type: 'spring', stiffness: 120, damping: 18, delay }}
      />
    </div>
  )
}

// ============= KPI Card with RAG Design =============
const createRagCards = (onTrack, atRisk, delayed, total) => {
  const pct = (n) => total > 0 ? Math.round((n / total) * 100) : 0
  return [
    {
      key: 'on-track',
      label: 'On Track',
      value: onTrack,
      icon: 'ri-checkbox-circle-line',
      pct: pct(onTrack),
      footnote: '% of contracts',
      valueColor: 'text-emerald-600',
      iconWrap: 'bg-emerald-500/15 ring-1 ring-emerald-500/25',
      barColor: '#22C55E',
      barTrack: 'bg-emerald-100/80',
      cardBg: 'from-emerald-50/95 via-white to-green-50/80',
      borderHover: 'hover:border-emerald-300/60',
      glow: 'rgba(34,197,94,0.22)',
    },
    {
      key: 'at-risk',
      label: 'At Risk',
      value: atRisk,
      icon: 'ri-alert-line',
      pct: pct(atRisk),
      footnote: '% of contracts',
      valueColor: 'text-amber-600',
      iconWrap: 'bg-amber-500/15 ring-1 ring-amber-500/30',
      barColor: '#F59E0B',
      barTrack: 'bg-amber-100/80',
      cardBg: 'from-amber-50/95 via-white to-yellow-50/70',
      borderHover: 'hover:border-amber-300/60',
      glow: 'rgba(245,158,11,0.2)',
    },
    {
      key: 'delayed',
      label: 'Delayed',
      value: delayed,
      icon: 'ri-timer-line',
      pct: pct(delayed),
      footnote: '% of contracts',
      valueColor: 'text-rose-600',
      iconWrap: 'bg-red-500/15 ring-1 ring-red-500/30',
      barColor: '#EF4444',
      barTrack: 'bg-red-100/80',
      cardBg: 'from-rose-50/95 via-white to-red-50/75',
      borderHover: 'hover:border-red-300/55',
      glow: 'rgba(239,68,68,0.2)',
    },
  ]
}

function KpiRagCard({ card, total, index }) {
  const totalValue = total || card.value
  const percentage = totalValue > 0 ? Math.round((card.value / totalValue) * 100) : 0
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, type: 'spring', stiffness: 300, damping: 24 }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      className={`group relative overflow-hidden rounded-2xl bg-gradient-to-br ${card.cardBg} border border-slate-200/90 transition-colors duration-200 ${card.borderHover}`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="space-y-0.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{card.label}</p>
            <p className={`text-2xl font-black tracking-tight ${card.valueColor}`}>{card.value}</p>
          </div>
          <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${card.iconWrap} shadow-sm`}>
            <i className={`${card.icon} text-base ${card.valueColor.replace('text-', 'text-')}`}></i>
          </div>
        </div>
        
        <div className="mt-3 space-y-1.5">
          <AnimatedBar widthPct={percentage} color={card.barColor} trackClass={card.barTrack} delay={0.1 + index * 0.05} />
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-medium text-slate-500">{card.footnote}</span>
            <span className="text-[10px] font-bold text-slate-600">{percentage}%</span>
          </div>
        </div>
      </div>
      
      {/* Decorative shine effect on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
        <div className="absolute -inset-full top-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/20 to-transparent rotate-12 group-hover:animate-shine" />
      </div>
    </motion.div>
  )
}

// ============= KPI Cards (wider BR color wash ~+20%; underline removed) =============
const createOverviewCards = (kpis) => [
  {
    key: 'total',
    label: 'Total Contracts',
    value: kpis.total,
    icon: 'ri-file-paper-2-line',
    accent: {
      borderClass: 'border border-blue-200/70',
      washClass:
        'bg-gradient-to-br from-white from-[14%] via-white via-[48%] to-blue-100/48',
      radialWash:
        'bg-[radial-gradient(155%_118%_at_88%_88%,rgba(59,130,246,0.22)_0%,transparent_72%)]',
      iconGradient: 'from-blue-500 to-blue-600',
      valueClass: 'text-blue-600',
      watermarkColor: 'text-blue-600',
    },
  },
  {
    key: 'active',
    label: 'Active Contracts',
    value: kpis.active,
    icon: 'ri-shield-check-line',
    accent: {
      borderClass: 'border border-emerald-200/70',
      washClass:
        'bg-gradient-to-br from-white from-[14%] via-white via-[48%] to-emerald-100/44',
      radialWash:
        'bg-[radial-gradient(155%_118%_at_88%_88%,rgba(16,185,129,0.20)_0%,transparent_72%)]',
      iconGradient: 'from-emerald-500 to-emerald-600',
      valueClass: 'text-emerald-600',
      watermarkColor: 'text-emerald-600',
    },
  },
  {
    key: 'expiring',
    label: 'Expiring Soon',
    value: kpis.expiringSoon,
    segmented: true,
    icon: 'ri-calendar-schedule-line',
    accent: vmsBrandKpiAccent(),
  },
  {
    key: 'expired',
    label: 'Expired',
    value: kpis.expired,
    icon: 'ri-time-line',
    accent: {
      borderClass: 'border border-rose-200/70',
      washClass:
        'bg-gradient-to-br from-white from-[14%] via-white via-[48%] to-rose-100/44',
      radialWash:
        'bg-[radial-gradient(155%_118%_at_88%_88%,rgba(244,63,94,0.19)_0%,transparent_72%)]',
      iconGradient: 'from-rose-500 to-rose-600',
      valueClass: 'text-rose-600',
      watermarkColor: 'text-rose-600',
    },
  },
  {
    key: 'nda',
    label: 'NDA Missing',
    value: kpis.ndaMiss,
    icon: 'ri-file-warning-line',
    accent: vmsBrandKpiAccentLight(),
  },
  {
    key: 'msa',
    label: 'MSA Missing',
    value: kpis.msaMiss,
    icon: 'ri-shield-line',
    accent: {
      borderClass: 'border border-orange-200/70',
      washClass:
        'bg-gradient-to-br from-white from-[14%] via-white via-[48%] to-orange-100/42',
      radialWash:
        'bg-[radial-gradient(155%_118%_at_88%_88%,rgba(249,115,22,0.19)_0%,transparent_72%)]',
      iconGradient: 'from-orange-500 to-orange-600',
      valueClass: 'text-orange-600',
      watermarkColor: 'text-orange-600',
    },
  },
  {
    key: 'sow',
    label: 'SOW Missing',
    value: kpis.sowMiss,
    icon: 'ri-clipboard-line',
    accent: {
      borderClass: 'border border-sky-200/70',
      washClass:
        'bg-gradient-to-br from-white from-[14%] via-white via-[48%] to-sky-100/47',
      radialWash:
        'bg-[radial-gradient(155%_118%_at_88%_88%,rgba(14,165,233,0.20)_0%,transparent_72%)]',
      iconGradient: 'from-sky-500 to-sky-600',
      valueClass: 'text-sky-600',
      watermarkColor: 'text-sky-600',
    },
  },
  {
    key: 'vendors',
    label: 'Total Vendors',
    value: kpis.vendors,
    icon: 'ri-team-line',
    accent: vmsBrandKpiAccent(),
  },
]

function KpiCardWatermark({ iconClass, colorClass }) {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[2] overflow-hidden rounded-2xl"
      aria-hidden
    >
      {/* Inset BR watermark — dock-style zoom on card hover only; clipped by rounded card */}
      <div className="absolute bottom-2 right-2 origin-bottom-right transition-transform duration-[380ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] will-change-transform group-hover:scale-[1.22] md:bottom-2.5 md:right-2.5">
        <i
          className={`${iconClass} ${colorClass} block text-[4.35rem] leading-none opacity-[0.13] transition-opacity duration-300 ease-out select-none group-hover:opacity-[0.18] md:text-[4.85rem]`}
        />
      </div>
    </div>
  )
}

function KpiOverviewCard({ card, index, expiringWindow = '90', onExpiringWindowChange }) {
  const valueDisplay = card?.value ?? 0
  const a = card?.accent || {}
  const borderClass = a.borderClass || 'border border-slate-200/70'
  const washClass = a.washClass || 'bg-gradient-to-br from-white via-white to-slate-50/40'
  const radialWash = a.radialWash || ''
  const iconGradient = a.iconGradient || 'from-slate-500 to-slate-600'
  const valueCls = a.valueClass || 'text-slate-700'
  const wmColor = a.watermarkColor || 'text-slate-400'
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, type: 'spring', stiffness: 400, damping: 38 }}
      className={`group relative min-h-[96px] overflow-hidden rounded-2xl bg-white shadow-[0_1px_0_rgba(15,23,42,0.04),0_1px_3px_rgba(15,23,42,0.07)] md:min-h-[108px] ${borderClass}`}
    >
      <div className="pointer-events-none absolute inset-0 z-0 bg-white" aria-hidden />
      <div
        className={`pointer-events-none absolute inset-0 z-[1] ${washClass}`}
        aria-hidden
      />
      {radialWash ? (
        <div
          className={`pointer-events-none absolute inset-0 z-[1] opacity-[0.76] ${radialWash}`}
          aria-hidden
        />
      ) : null}

      <KpiCardWatermark iconClass={card.icon} colorClass={wmColor} />

      <div className="relative z-10 flex min-h-[96px] flex-col p-2.5 md:min-h-[108px] md:p-3">
        <div
          className={`relative z-10 inline-flex h-9 w-9 shrink-0 cursor-default items-center justify-center rounded-lg bg-gradient-to-br md:h-7 md:w-7 ${iconGradient} shadow-sm ring-1 ring-black/[0.06]`}
        >
          <i className={`${card.icon} text-lg leading-none text-white md:text-sm`} />
        </div>

        <div className="mt-2 min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase leading-snug tracking-[0.12em] text-slate-500 md:text-[11px] md:tracking-wide">
            {card.label}
          </p>

          {card.segmented ? (
            <div className="mt-1 flex h-[62px] flex-col justify-between">
              <div className="inline-flex w-fit max-w-full overflow-hidden rounded-md border border-[#BFDBFE] bg-white p-0.5 shadow-sm">
                {['30', '60', '90'].map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onExpiringWindowChange?.(w) }}
                    className={`rounded px-1 py-0.5 text-[9px] font-semibold transition-colors md:px-1 ${
                      expiringWindow === w ? 'bg-[#1E88E5] text-white shadow-sm' : 'text-slate-600 hover:bg-[#EFF6FF]'
                    }`}
                  >
                    {w}d
                  </button>
                ))}
              </div>
              <div className="flex flex-col items-start">
                <p className={`text-[26px] font-bold leading-none tabular-nums tracking-tight md:text-[28px] ${valueCls}`}>
                  {valueDisplay}
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-2 flex h-[48px] items-end md:mt-3 md:h-[54px]">
              <div>
                <p className={`text-3xl font-bold leading-none tabular-nums tracking-tight ${valueCls}`}>
                  {valueDisplay}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

function CompactMetricCard({ label, value, icon, color, index, onClick }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, type: 'spring', stiffness: 400, damping: 26 }}
      whileHover={{ y: -1, scale: 1.01 }}
      onClick={onClick}
      className={`bg-white rounded-2xl border border-slate-200/80 p-3 shadow-sm hover:shadow-md transition-all duration-200 ${onClick ? 'cursor-pointer hover:border-[#BFDBFE]' : ''}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
          <p className="text-xl font-bold text-slate-800">{value}</p>
        </div>
        <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center text-white shadow-sm`}>
          <i className={`${icon} text-sm`}></i>
        </div>
      </div>
    </motion.div>
  )
}

function TableSkeleton({ cols = 6, rows = 6, leadingCols = 0 }) {
  const totalCols = Math.max(1, cols + leadingCols)
  return (
    <tbody className="divide-y divide-slate-200">
      {Array.from({ length: rows }).map((_, rIdx) => (
        <tr key={rIdx} className="animate-pulse">
          {Array.from({ length: totalCols }).map((__, cIdx) => (
            <td key={cIdx} className="px-3 py-3">
              <div className={`h-3 rounded ${cIdx === 0 ? 'w-6' : cIdx === 1 ? 'w-10' : 'w-full'} bg-slate-100`} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  )
}

function TableEmptyState({ title, subtitle, primaryActionLabel, onPrimaryAction, secondaryActionLabel, onSecondaryAction }) {
  return (
    <div className="px-4 py-10 text-center sm:px-6 sm:py-14">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-[#E8F0FE] text-[#1E88E5] shadow-sm sm:h-12 sm:w-12">
        <i className="ri-search-eye-line text-lg sm:text-xl" />
      </div>
      <div className="mt-3 sm:mt-4">
        <p className="text-xs font-semibold text-slate-800 sm:text-sm">{title}</p>
        {subtitle ? <p className="mt-1 text-[11px] text-slate-500 sm:text-xs">{subtitle}</p> : null}
      </div>
      {(primaryActionLabel || secondaryActionLabel) && (
        <div className="mt-5 flex flex-col sm:flex-row gap-2 justify-center items-center">
          {primaryActionLabel && (
            <button
              type="button"
              onClick={onPrimaryAction}
              className={vmsPrimaryBtnClass()}
            >
              {primaryActionLabel}
            </button>
          )}
          {secondaryActionLabel && (
            <button
              type="button"
              onClick={onSecondaryAction}
              className={vmsSecondaryBtnClass()}
            >
              {secondaryActionLabel}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ============= Main Component (factory) =============
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
  const isCaseEntity = entityConfig.kind === 'case'

  function createOverviewCardsForEntity(_kpis) {
    return []
  }

  return function PmMyItemsProPage() {
  const { kf: kfFromContext, sdkReady } = useContext(KissflowSDKContext)
  const kfInstance = kfFromContext ?? (typeof window !== 'undefined' ? window.kf : null)
  const contractPaths = useMemo(() => buildPmEntityApiPaths(kfInstance, __ENTITY_CONFIG__), [kfInstance])
  const adminPaths = useMemo(() => buildPmAdminApiPaths(kfInstance, __ENTITY_CONFIG__), [kfInstance])
  const totalVendorsCountPath = useMemo(() => null, [])
  const vendorMasterPaths = useMemo(() => null, [])

  const [adminContractRows, setAdminContractRows] = useState(null)
  const [vendorTotalFromReport, setVendorTotalFromReport] = useState(null)
  const [vendorMasterRows, setVendorMasterRows] = useState([])
  const [activeTab, setActiveTab] = useState('items')
  const [statusFilter, setStatusFilter] = useState(() => (STATUS_OPTIONS_CFG && STATUS_OPTIONS_CFG[0]) || 'Active')
  const [allPtItems, setAllPtItems] = useState(null)
  const [ptTasksPool, setPtTasksPool] = useState([])
  const usePtApis = Boolean(__ENTITY_CONFIG__?.usePtDashboardApis)
  const [search, setSearch] = useState('')
  const [items, setItems] = useState(null)
  const [itemsLoading, setItemsLoading] = useState(false)
  const [user, setUser] = useState(null)
  const [roleName, setRoleName] = useState('')
  const [itemsPage, setItemsPage] = useState(1)
  const [tasksPage, setTasksPage] = useState(1)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [selectedItemIds, setSelectedItemIds] = useState(new Set())
  const [selectedContract, setSelectedContract] = useState(null)
  const [statusCountsFromApi, setStatusCountsFromApi] = useState(null)
  const [pendingActivities, setPendingActivities] = useState(null)
  const [currentActivityId, setCurrentActivityId] = useState(null)
  const [currentStepName, setCurrentStepName] = useState(L.reviewStepFallback || 'Review')
  const [totalTasksCount, setTotalTasksCount] = useState(0)
  const [tasksFromApi, setTasksFromApi] = useState(null)
  const [tasksLoading, setTasksLoading] = useState(false)
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false)
  const [columnsPopoverOpen, setColumnsPopoverOpen] = useState(false)
  const [filterFromDate, setFilterFromDate] = useState('')
  const [filterToDate, setFilterToDate] = useState('')
  const [activeDateField, setActiveDateField] = useState(null)
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()))
  const [visibleColumnsItems, setVisibleColumnsItems] = useState(DEFAULT_VISIBLE_ITEMS_CFG)
  const [visibleColumnsTasks, setVisibleColumnsTasks] = useState(DEFAULT_VISIBLE_TASKS_CFG)
  const [expandedItemId, setExpandedItemId] = useState(null)
  const [expandedTaskId, setExpandedTaskId] = useState(null)
  const [scrollToAccordionId, setScrollToAccordionId] = useState(null)
  const [accordionFlashId, setAccordionFlashId] = useState(null)
  const [itemDetailsById, setItemDetailsById] = useState({})
  const [taskDetailsById, setTaskDetailsById] = useState({})
  const [progressByContractId, setProgressByContractId] = useState({})
  const [progressLoadingId, setProgressLoadingId] = useState(null)
  const progressFetchInFlightRef = useRef(null)
  const [itemVendorCellLoadingById, setItemVendorCellLoadingById] = useState({})
  const [deletingDrafts, setDeletingDrafts] = useState(false)
  const [watchParamsTick, setWatchParamsTick] = useState(0)
  const [expiringWindow] = useState('90')
  const getSlaMeta = useSlaDeadlineMeta()
  const hydratedMissingVendorIdsRef = useRef(new Set())
  const taskValuePrefetchInFlightRef = useRef(new Set())
  const filterPopoverRef = useRef(null)
  const columnsPopoverRef = useRef(null)
  const filterDropdownRef = useRef(null)
  const columnsDropdownRef = useRef(null)
  const [filterAnchorRect, setFilterAnchorRect] = useState(null)
  const [columnsAnchorRect, setColumnsAnchorRect] = useState(null)
  
  const greeting = useMemo(() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }, [])
  
  const firstName = user?.FirstName || (user?.Name ? String(user.Name).split(/\s+/)[0] : '') || 'User'
  const roleLabel = roleName || user?.Role?.Name?.trim() || user?._user_type || user?.Groups?.[0]?.Name || user?.Roles?.[0]?.Name || 'User'

  const calendarMonthLabel = useMemo(() => calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), [calendarMonth])
  
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth)
    const monthStartWeekday = monthStart.getDay()
    const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate()
    const cells = []
    for (let i = 0; i < monthStartWeekday; i += 1) cells.push(null)
    for (let day = 1; day <= daysInMonth; day += 1) cells.push(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), day))
    return cells
  }, [calendarMonth])

  const selectedIsoForCalendar = activeDateField === 'from' ? filterFromDate : activeDateField === 'to' ? filterToDate : ''

  function openDatePicker(field) {
    setActiveDateField(field)
    const seed = (field === 'from' ? filterFromDate : filterToDate) || (field === 'from' ? filterToDate : filterFromDate) || formatDateToIso(new Date())
    const seedDate = new Date(`${seed}T00:00:00`)
    setCalendarMonth(startOfMonth(isNaN(seedDate.getTime()) ? new Date() : seedDate))
  }

  function selectCalendarDate(dateObj) {
    const iso = formatDateToIso(dateObj)
    if (!iso) return
    if (activeDateField === 'from') setFilterFromDate(iso)
    if (activeDateField === 'to') setFilterToDate(iso)
    setActiveDateField(null)
  }

  useLayoutEffect(function positionFilterPopover() {
    if (!filterPopoverOpen || !filterPopoverRef.current) { setFilterAnchorRect(null); return }
    const rect = filterPopoverRef.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const pad = 10
    const gap = 8
    const narrowMobile = vw < 640
    const width = narrowMobile ? vw - pad * 2 : Math.min(320, Math.max(260, vw - pad * 2))
    const estimatedHeight = activeDateField ? 560 : 260
    const spaceBelow = vh - rect.bottom - gap
    const shouldOpenUp = spaceBelow < estimatedHeight && rect.top > spaceBelow
    const unclampedLeft = rect.right - width
    const left = narrowMobile ? pad : Math.max(pad, Math.min(unclampedLeft, vw - width - pad))
    const top = shouldOpenUp ? rect.top - estimatedHeight - gap : rect.bottom + gap
    const clampedTop = Math.max(pad, Math.min(top, vh - pad - 120))
    setFilterAnchorRect({ top: clampedTop, left, width })
  }, [filterPopoverOpen, activeDateField])

  useLayoutEffect(function positionColumnsPopover() {
    if (!columnsPopoverOpen || !columnsPopoverRef.current) { setColumnsAnchorRect(null); return }
    const rect = columnsPopoverRef.current.getBoundingClientRect()
    const vw = window.innerWidth
    const pad = 10
    const narrowMobile = vw < 640
    setColumnsAnchorRect({
      top: rect.bottom + 8,
      right: narrowMobile ? pad : vw - rect.right,
      width: narrowMobile ? Math.min(vw - pad * 2, 280) : 224,
    })
  }, [columnsPopoverOpen])

  useEffect(function keepFilterPopoverAnchoredOnViewportChanges() {
    if (!filterPopoverOpen) return
    const recalc = () => {
      if (!filterPopoverRef.current) return
      const rect = filterPopoverRef.current.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight
      const pad = 10
      const gap = 8
      const narrowMobile = vw < 640
      const width = narrowMobile ? vw - pad * 2 : Math.min(320, Math.max(260, vw - pad * 2))
      const estimatedHeight = activeDateField ? 560 : 260
      const spaceBelow = vh - rect.bottom - gap
      const shouldOpenUp = spaceBelow < estimatedHeight && rect.top > spaceBelow
      const unclampedLeft = rect.right - width
      const left = narrowMobile ? pad : Math.max(pad, Math.min(unclampedLeft, vw - width - pad))
      const top = shouldOpenUp ? rect.top - estimatedHeight - gap : rect.bottom + gap
      const clampedTop = Math.max(pad, Math.min(top, vh - pad - 120))
      setFilterAnchorRect({ top: clampedTop, left, width })
    }
    const onViewportChange = (e) => {
      if (e?.type === 'scroll') {
        const t = e.target
        const drop = filterDropdownRef.current
        if (drop && (t === drop || drop.contains(t))) return
      }
      window.requestAnimationFrame(recalc)
    }
    window.addEventListener('resize', onViewportChange)
    window.addEventListener('scroll', onViewportChange, true)
    return () => {
      window.removeEventListener('resize', onViewportChange)
      window.removeEventListener('scroll', onViewportChange, true)
    }
  }, [filterPopoverOpen, activeDateField])

  useEffect(function keepColumnsPopoverAnchoredOnViewportChanges() {
    if (!columnsPopoverOpen) return
    const recalc = () => {
      if (!columnsPopoverRef.current) return
      const rect = columnsPopoverRef.current.getBoundingClientRect()
      const vw = window.innerWidth
      const pad = 10
      const narrowMobile = vw < 640
      setColumnsAnchorRect({
        top: rect.bottom + 8,
        right: narrowMobile ? pad : vw - rect.right,
        width: narrowMobile ? Math.min(vw - pad * 2, 280) : 224,
      })
    }
    const onViewportChange = (e) => {
      if (e?.type === 'scroll') {
        const t = e.target
        const drop = columnsDropdownRef.current
        if (drop && (t === drop || drop.contains(t))) return
      }
      window.requestAnimationFrame(recalc)
    }
    window.addEventListener('resize', onViewportChange)
    window.addEventListener('scroll', onViewportChange, true)
    return () => {
      window.removeEventListener('resize', onViewportChange)
      window.removeEventListener('scroll', onViewportChange, true)
    }
  }, [columnsPopoverOpen])

  useEffect(() => { if (filterPopoverOpen) return; setActiveDateField(null) }, [filterPopoverOpen])

  useEffect(function setupWatchParamsRefetch() {
    if (!kfInstance?.context?.watchParams) return
    function handleWatchParams(data) {
      if (data && typeof data === 'object') {
        if (data.statusFilter != null) setStatusFilter(String(data.statusFilter))
        if (data.search != null) setSearch(String(data.search))
      }
      setWatchParamsTick((n) => n + 1)
    }
    kfInstance.context.watchParams(handleWatchParams)
  }, [kfInstance])

  useEffect(function hydrateUserFromKfSdk() {
    const kf = kfInstance
    if (!kf?.user) return
    setUser((prev) => {
      if (prev && (prev.Name || prev.FirstName)) return prev
      const u = kf.user
      return { _id: u._id, Name: u.Name, FirstName: u.FirstName || (u.Name && String(u.Name).split(/\s+/)[0]) || 'User', LastName: u.LastName, Email: u.Email, Role: u.Role, Roles: u.Roles, Groups: u.Groups, _user_type: u._user_type || u.Groups?.[0]?.Name || u.Roles?.[0]?.Name || 'User' }
    })
  }, [kfInstance, sdkReady])

  useEffect(function setupRoleNameOnLoad() {
    const sdk = kfInstance
    if (!sdk?.user) return
    let cancelled = false
    const abc = sdk.user?.Role || sdk.context?.user?.Role || sdk.user?.Roles?.[0] || sdk.context?.user?.Roles?.[0] || null
    const roleFromSdk = stringifyKfRole(abc)
    if (roleFromSdk) setRoleName(roleFromSdk)
    if (!sdk.app) return
    async function run() {
      try {
        if (!roleFromSdk) return
        await sdk.app.setVariable('user_role_name', roleFromSdk)
        const variableName = await sdk.app.getVariable('user_role_name')
        const variableRole = String(variableName || '').trim()
        const resolvedRole = variableRole && variableRole.toLowerCase() !== 'user' ? variableRole : String(roleFromSdk || '').trim()
        if (!resolvedRole || cancelled) return
        setRoleName(resolvedRole)
      } catch (e) { if (!cancelled) console.warn('Role setup failed:', e?.message || e) }
    }
    run()
    return () => { cancelled = true }
  }, [kfInstance])

  useEffect(function fetchPtDashboardEntityData() {
    if (!usePtApis) return
    const kf = kfInstance
    if (!kf?.api && !sdkReady) return
    let cancelled = false
    setItemsLoading(true)
    setTasksLoading(true)
    async function run() {
      try {
        const { items: allItems, tasks, statusCounts } = await fetchPmMyItemsEntityData(kf, __ENTITY_CONFIG__)
        if (cancelled) return
        setAllPtItems(allItems)
        setAdminContractRows(allItems)
        setStatusCountsFromApi(statusCounts)
        setPtTasksPool(filterMyTasksForUser(tasks, kf?.user || user))
        setPendingActivities([])
        setCurrentActivityId(null)
        setCurrentStepName(L.reviewStepFallback || 'Open items')
        setTotalTasksCount(tasks.length)
      } catch (e) {
        if (!cancelled) {
          console.warn('[PmMyItemsPro] PT API fetch failed:', e?.message || e)
          setAllPtItems([])
          setAdminContractRows([])
          setPtTasksPool([])
        }
      } finally {
        if (!cancelled) {
          setItemsLoading(false)
          setTasksLoading(false)
        }
      }
    }
    run()
    return () => { cancelled = true }
  }, [usePtApis, sdkReady, watchParamsTick, kfInstance])

  // Derive My Items list from PT pool + status filter (client-side)
  useEffect(function syncPtItemsToStatusFilter() {
    if (!usePtApis) return
    if (!Array.isArray(allPtItems)) {
      setItems(allPtItems)
      return
    }
    const filtered = statusFilter
      ? allPtItems.filter((row) => (formatStatusForDisplay(row?.status) || row?.status) === statusFilter)
      : allPtItems
    setItems(filtered)
  }, [usePtApis, allPtItems, statusFilter])

  useEffect(function syncPtTasksTab() {
    if (!usePtApis) return
    setTasksFromApi(ptTasksPool)
    setTotalTasksCount(Array.isArray(ptTasksPool) ? ptTasksPool.length : 0)
  }, [usePtApis, ptTasksPool])

  useEffect(function fetchStatusCounts() {
    if (usePtApis) return
    if (!contractPaths?.statusCountPath) {
      setStatusCountsFromApi(null)
      return
    }
    const kf = kfInstance
    let cancelled = false
    async function run() {
      try {
        let response
        if (kf?.api) {
          const resp = await kf.api(contractPaths.statusCountPath, { method: 'GET', headers: { Accept: 'application/json' } })
          response = resp?.data ?? resp ?? null
        } else {
          const res = await fetch(getApiBase() + contractPaths.statusCountPath, { method: 'GET', credentials: 'include', headers: { Accept: 'application/json' } })
          if (!res.ok) return
          response = await res.json()
        }
        if (!cancelled && response && typeof response === 'object') {
          setStatusCountsFromApi(mapMyItemsStatusCountResponse(response, STATUS_OPTIONS_CFG))
        }
      } catch (e) { if (!cancelled) console.warn('Status count fetch failed:', e?.message || e) }
    }
    run()
    return () => { cancelled = true }
  }, [usePtApis, sdkReady, watchParamsTick, contractPaths, kfInstance])

  useEffect(function fetchPendingActivityCount() {
    if (usePtApis) return
    if (!contractPaths || contractPaths.kind === 'case' || !contractPaths.pendingCountPath) {
      setPendingActivities([])
      setTasksFromApi([])
      setTotalTasksCount(0)
      return
    }
    const kf = kfInstance
    let cancelled = false
    async function run() {
      try {
        let response
        const pendingCountPath = `/process/2/${contractPaths.accountId}/${contractPaths.processId}/pending/activity/count?_application_id=${encodeURIComponent(contractPaths.applicationId)}`
        if (kf?.api) {
          const resp = await kf.api(pendingCountPath, { method: 'GET', headers: { Accept: 'application/json' } })
          response = resp?.data ?? resp ?? null
        } else {
          const res = await fetch(getApiBase() + pendingCountPath, { method: 'GET', credentials: 'include', headers: { Accept: 'application/json' } })
          if (!res.ok) return
          response = await res.json()
        }
        if (cancelled) return
        const list = Array.isArray(response) ? response : (response?.Data ?? response?.data ?? [])
        const activities = Array.isArray(list) ? list : []
        setPendingActivities(activities)
        const stillExists = activities.some((a) => a?._id === currentActivityId)
        const firstActivity = activities.find((a) => a?._id) || null
        if (activities.length === 1 && activities[0]?._id) {
          setCurrentActivityId(activities[0]._id)
          setCurrentStepName(activities[0].StepName || (L.reviewStepFallback || 'Review'))
          setTotalTasksCount(activities[0].Count ?? 0)
          return
        }
        if (!stillExists || !currentActivityId) {
          if (firstActivity?._id) setCurrentActivityId(firstActivity._id)
          setCurrentStepName(firstActivity?.StepName || (L.reviewStepFallback || 'Review'))
          setTotalTasksCount(firstActivity?.Count ?? 0)
        }
      } catch (e) { if (!cancelled) console.warn('Pending activity count failed:', e?.message || e) }
    }
    run()
    return () => { cancelled = true }
  }, [usePtApis, sdkReady, watchParamsTick, contractPaths, kfInstance, currentActivityId])

  useEffect(function fetchUser() {
    if (!contractPaths) return
    const kf = kfInstance
    const userId = kf?.user?._id || kf?.context?.user?._id || 'UsCyVwuplHVM'
    const path = contractPaths.userPathPrefix + userId + contractPaths.userPathSuffix
    let cancelled = false
    async function run() {
      try {
        let response
        if (kf?.api) {
          const resp = await kf.api(path, { method: 'GET', headers: { Accept: 'application/json' } })
          response = resp?.data ?? resp ?? null
        } else {
          const res = await fetch(getApiBase() + path, { method: 'GET', credentials: 'include', headers: { Accept: 'application/json' } })
          if (!res.ok) return
          response = await res.json()
        }
        if (!cancelled && response && (response._id || response.Name)) setUser(response)
      } catch (e) { if (!cancelled) console.warn('User fetch failed:', e?.message || e) }
      if (!cancelled && kf?.user?.Name) {
        setUser((prev) => {
          if (prev && (prev._id || prev.Name)) return prev
          const u = kf.user
          return { _id: u._id, Name: u.Name, FirstName: u.FirstName || (u.Name && String(u.Name).split(/\s+/)[0]) || 'User', LastName: u.LastName, Email: u.Email, Role: u.Role, Roles: u.Roles, Groups: u.Groups, _user_type: u._user_type || u.Groups?.[0]?.Name || u.Roles?.[0]?.Name || 'User' }
        })
      }
    }
    run()
    return () => { cancelled = true }
  }, [sdkReady, contractPaths, kfInstance])

  useEffect(function fetchItemsByStatus() {
    if (usePtApis) return
    if (!contractPaths) return
    const kf = kfInstance
    let cancelled = false
    setItemsLoading(true)
    const path = buildMyItemsPath(contractPaths, statusFilter, 1, 1000, __ENTITY_CONFIG__)
    const segment = STATUS_TO_SEGMENT_CFG[statusFilter] || 'draft'
    async function run() {
      try {
        let response
        if (kf?.api) {
          const resp = await kf.api(path, { method: 'GET', headers: { Accept: 'application/json' } })
          response = resp?.data ?? resp ?? null
        } else {
          const res = await fetch(getApiBase() + path, { method: 'GET', credentials: 'include', headers: { Accept: 'application/json' } })
          if (!res.ok) return
          response = await res.json()
        }
        if (cancelled) return
        const data = Array.isArray(response) ? response : response?.Data ?? response?.data ?? response?.Item ?? response?.items ?? null
        const list = Array.isArray(data) ? data.map((row) => mergeMyItemsRowWithVmsShape(row, segment, __ENTITY_CONFIG__)).filter(Boolean) : []
        hydratedMissingVendorIdsRef.current = new Set()
        setItemDetailsById({})
        setItemVendorCellLoadingById({})
        setItems(list)
      } catch (e) { if (!cancelled) { console.warn('Contract items fetch failed:', e?.message || e); setItems(null) } } 
      finally { if (!cancelled) setItemsLoading(false) }
    }
    run()
    return () => { cancelled = true }
  }, [usePtApis, sdkReady, statusFilter, watchParamsTick, contractPaths, kfInstance])

  useEffect(function fetchAdminContractsForKpis() {
    if (usePtApis) return
    if (!adminPaths) return
    const kf = kfInstance
    let cancelled = false
    async function run() {
      try {
        const path = adminPaths.getAdminItemsPath ? adminPaths.getAdminItemsPath(1, 1000) : adminPaths.getContractItemsPath(1, 1000)
        let response
        if (kf?.api) {
          const resp = await kf.api(path, { method: 'GET', headers: { Accept: 'application/json' } })
          response = resp?.data ?? resp ?? null
        } else {
          const res = await fetch(getApiBase() + path, { method: 'GET', credentials: 'include', headers: { Accept: 'application/json' } })
          if (!res.ok) return
          response = await res.json()
        }
        if (cancelled) return
        const data = response?.Data ?? response?.data ?? (Array.isArray(response) ? response : null)
        const list = Array.isArray(data) ? data : []
        const mapped = []
        for (let i = 0; i < list.length; i += 1) { const row = mapKfPmAdminItem(list[i], __ENTITY_CONFIG__); if (row) mapped.push(row) }
        if (!cancelled) setAdminContractRows(mapped)
      } catch (e) { if (!cancelled) { console.warn('Admin contract list for KPIs failed:', e?.message || e); setAdminContractRows(null) } }
    }
    run()
    return () => { cancelled = true }
  }, [usePtApis, sdkReady, watchParamsTick, adminPaths, kfInstance])

  useEffect(() => {
    if (!totalVendorsCountPath) { setVendorTotalFromReport(null); return }
    const kf = kfInstance
    let cancelled = false
    async function fetchVendorCount() {
      try {
        let response
        if (kf?.api) { response = await kf.api(totalVendorsCountPath, { method: 'GET', headers: { Accept: 'application/json' } }) } 
        else {
          const res = await fetch(getApiBase() + totalVendorsCountPath, { method: 'GET', credentials: 'include', headers: { Accept: 'application/json' } })
          if (!res.ok) throw new Error(`Vendor count HTTP ${res.status}`)
          response = await res.json()
        }
        if (cancelled) return
        const n = parseKfCountResponse(response)
        setVendorTotalFromReport(n)
      } catch (e) { if (!cancelled) console.warn('Vendor master count fetch failed:', e?.message || e); setVendorTotalFromReport(null) }
    }
    fetchVendorCount()
    return () => { cancelled = true }
  }, [sdkReady, watchParamsTick, kfInstance, totalVendorsCountPath])

  useEffect(() => {
    if (!vendorMasterPaths) { setVendorMasterRows([]); return }
    const kf = kfInstance
    let cancelled = false
    function mapVendor(item) { if (!item || typeof item !== 'object') return null; const name = String(item.Vendor_Name || item.Name || '').trim(); if (!name) return null; return { id: item._id || '', name, raw: item } }
    async function run() {
      try {
        const path = vendorMasterPaths.getVendorItemsPath(1, 1000)
        let response
        if (kf?.api) {
          const resp = await kf.api(path, { method: 'GET', headers: { Accept: 'application/json' } })
          response = resp?.data ?? resp ?? null
        } else {
          const res = await fetch(getApiBase() + path, { method: 'GET', credentials: 'include', headers: { Accept: 'application/json' } })
          if (!res.ok) throw new Error(`Vendor list HTTP ${res.status}`)
          response = await res.json()
        }
        if (cancelled) return
        const data = response?.Data ?? response?.data ?? (Array.isArray(response) ? response : null)
        const list = Array.isArray(data) ? data : []
        setVendorMasterRows(list.map(mapVendor).filter(Boolean))
      } catch (e) { if (!cancelled) { console.warn('Vendor master list fetch failed:', e?.message || e); setVendorMasterRows([]) } }
    }
    run()
    return () => { cancelled = true }
  }, [sdkReady, watchParamsTick, kfInstance, vendorMasterPaths])

  useEffect(function hydrateMissingItemVendorsAndValues() {
    const MAX_ITEM_DETAIL_HYDRATE = 300
    if (!contractPaths) return
    if (!Array.isArray(items) || items.length === 0) { setItemVendorCellLoadingById({}); return }
    const sdk = kfInstance
    const segment = STATUS_TO_SEGMENT_CFG[statusFilter] || 'draft'
    const appQ = `_application_id=${encodeURIComponent(contractPaths.applicationId)}`
    const candidates = [...items].filter((x) => { if (!x?.id) return false; const needVendor = !String(x.vendor || '').trim(); const needValue = !x.valueDisplay || x.valueDisplay === '—'; return needVendor || needValue }).sort((a, b) => { const av = !String(a.vendor || '').trim() ? 0 : 1; const bv = !String(b.vendor || '').trim() ? 0 : 1; return av - bv }).slice(0, MAX_ITEM_DETAIL_HYDRATE)
    if (candidates.length === 0) { setItemVendorCellLoadingById({}); return }
    const needVendorById = new Set(candidates.filter((c) => !String(c.vendor || '').trim()).map((c) => c.id))
    const loadMap = {}
    needVendorById.forEach((id) => { loadMap[id] = true })
    setItemVendorCellLoadingById(loadMap)
    let cancelled = false
    async function run() {
      const nextById = {}
      for (const row of candidates) {
        if (cancelled) return
        if (hydratedMissingVendorIdsRef.current.has(row.id)) {
          if (needVendorById.has(row.id)) { setItemVendorCellLoadingById((prev) => { if (!prev[row.id]) return prev; const n = { ...prev }; delete n[row.id]; return n }) }
          continue
        }
        hydratedMissingVendorIdsRef.current.add(row.id)
        const instanceId = row.id
        const activityInstanceId = row.activityInstanceId || row?._activity_instance_id || ''
        const tryPaths = []
        if (typeof contractPaths.getInstancePath === 'function') {
          if (activityInstanceId) tryPaths.push(contractPaths.getInstancePath(instanceId, activityInstanceId))
          tryPaths.push(contractPaths.getInstancePath(instanceId))
        } else {
          if (activityInstanceId) { tryPaths.push(`/process/2/${contractPaths.accountId}/${contractPaths.processId}/${encodeURIComponent(String(instanceId))}/${encodeURIComponent(String(activityInstanceId))}?${appQ}`) }
          tryPaths.push(`/process/2/${contractPaths.accountId}/${contractPaths.processId}/${encodeURIComponent(String(instanceId))}?${appQ}`)
        }
        let rowPatch = null
        try {
          for (const path of tryPaths) {
            try {
              let response
              if (sdk?.api) {
                const resp = await sdk.api(path, { method: 'GET', headers: { Accept: 'application/json' } })
                response = resp?.data ?? resp ?? null
              } else {
                const res = await fetch(getApiBase() + path, { method: 'GET', credentials: 'include', headers: { Accept: 'application/json' } })
                if (!res.ok) continue
                response = await res.json()
              }
              if (!response) continue
              const payload = response?.Data ?? response?.data ?? response?.Item ?? response
              const mapped = mapPmMyItemsItem(payload, __ENTITY_CONFIG__, segment)
              if (!mapped) continue
              const patch = {}
              const v = String(mapped.vendor || '').trim()
              if (v && !String(row.vendor || '').trim()) patch.vendor = v
              if (mapped.valueDisplay && mapped.valueDisplay !== '—' && (!row.valueDisplay || row.valueDisplay === '—')) { patch.valueDisplay = mapped.valueDisplay }
              if (mapped.endDate && mapped.endDate !== '—' && (!row.endDate || row.endDate === '—')) { patch.endDate = mapped.endDate; if (mapped.endDateDisplay && mapped.endDateDisplay !== '—') patch.endDateDisplay = mapped.endDateDisplay }
              if (Object.keys(patch).length > 0) { rowPatch = patch; break }
            } catch { continue }
          }
        } finally {
          if (needVendorById.has(row.id)) { setItemVendorCellLoadingById((prev) => { if (!prev[row.id]) return prev; const n = { ...prev }; delete n[row.id]; return n }) }
        }
        if (rowPatch && Object.keys(rowPatch).length > 0) { nextById[row.id] = rowPatch }
      }
      if (cancelled || Object.keys(nextById).length === 0) return
      setItems((prev) => Array.isArray(prev) ? prev.map((x) => (nextById[x.id] ? { ...x, ...nextById[x.id] } : x)) : prev)
    }
    run()
    return () => { cancelled = true; setItemVendorCellLoadingById({}) }
  }, [items, contractPaths, kfInstance, statusFilter])

  useEffect(function fetchTasksForActivity() {
    if (usePtApis) return
    if (!contractPaths) return
    if (!currentActivityId) { setTasksFromApi([]); setTasksLoading(false); return }
    const kf = kfInstance
    let cancelled = false
    setTasksLoading(true)
    const path = `/process/2/${contractPaths.accountId}/${contractPaths.processId}/pending/${encodeURIComponent(String(currentActivityId))}?apply_preference=true&page_number=1&page_size=10&skip_aggregation=true&_application_id=${encodeURIComponent(contractPaths.applicationId)}`
    async function run() {
      try {
        let response
        if (kf?.api) {
          const resp = await kf.api(path, { method: 'GET', headers: { Accept: 'application/json' } })
          response = resp?.data ?? resp ?? null
        } else {
          const res = await fetch(getApiBase() + path, { method: 'GET', credentials: 'include', headers: { Accept: 'application/json' } })
          if (!res.ok) return
          response = await res.json()
        }
        if (cancelled) return
        const data = Array.isArray(response) ? response : response?.Data ?? response?.data ?? null
        const list = Array.isArray(data) ? data.map((row) => mapKfContractTaskToRow(row, '', __ENTITY_CONFIG__)).filter(Boolean) : []
        setTasksFromApi(list)
        if (!cancelled) {
          const active = Array.isArray(pendingActivities) ? pendingActivities.find((a) => a?._id === currentActivityId) : null
          setTotalTasksCount(active?.Count ?? (Array.isArray(list) ? list.length : 0))
        }
      } catch (e) { if (!cancelled) console.warn('Tasks fetch failed:', e?.message || e); setTasksFromApi(null) } 
      finally { if (!cancelled) setTasksLoading(false) }
    }
    run()
    return () => { cancelled = true }
  }, [usePtApis, sdkReady, watchParamsTick, contractPaths, kfInstance, currentActivityId, pendingActivities])

  useEffect(function hydrateExpandedItemDetails() {
    if (!expandedItemId || !contractPaths) return
    if (itemDetailsById[expandedItemId]) return
    const baseItem = Array.isArray(items) ? items.find((t) => t?.id === expandedItemId) : null
    if (!baseItem) return
    const instanceId = baseItem.id
    if (!instanceId) return
    const activityInstanceId = baseItem.activityInstanceId || baseItem._activity_instance_id || ''
    const segment = STATUS_TO_SEGMENT_CFG[statusFilter] || 'draft'
    const appQ = `_application_id=${encodeURIComponent(contractPaths.applicationId)}`
    const sdk = kfInstance
    let cancelled = false
    async function run() {
      try {
        const tryPaths = []
        if (typeof contractPaths.getInstancePath === 'function') {
          if (activityInstanceId) tryPaths.push(contractPaths.getInstancePath(instanceId, activityInstanceId))
          tryPaths.push(contractPaths.getInstancePath(instanceId))
        } else {
          if (activityInstanceId) { tryPaths.push(`/process/2/${contractPaths.accountId}/${contractPaths.processId}/${encodeURIComponent(String(instanceId))}/${encodeURIComponent(String(activityInstanceId))}?${appQ}`) }
          tryPaths.push(`/process/2/${contractPaths.accountId}/${contractPaths.processId}/${encodeURIComponent(String(instanceId))}?${appQ}`)
        }
        let response = null
        for (const path of tryPaths) {
          try {
            let resp
            if (sdk?.api) {
              const r = await sdk.api(path, { method: 'GET', headers: { Accept: 'application/json' } })
              resp = r?.data ?? r ?? null
            } else {
              const res = await fetch(getApiBase() + path, { method: 'GET', credentials: 'include', headers: { Accept: 'application/json' } })
              if (!res.ok) continue
              resp = await res.json()
            }
            if (resp && !cancelled) { response = resp; break }
          } catch { continue }
        }
        if (cancelled || !response) return
        const row = response?.Data ?? response?.data ?? response?.Item ?? response
        const payload = row && typeof row === 'object' && !Array.isArray(row) ? row : response
        const merged = mapPmMyItemsItem(payload, __ENTITY_CONFIG__, segment)
        if (!merged) return
        const slaDeadline =
          merged.slaDeadline !== '' && merged.slaDeadline != null ? merged.slaDeadline : baseItem.slaDeadline
        setItemDetailsById((prev) => ({ ...prev, [expandedItemId]: { ...baseItem, ...merged, slaDeadline } }))
      } catch (e) { if (!cancelled) console.warn('Contract item detail hydrate failed:', e?.message || e) }
    }
    run()
    return () => { cancelled = true }
  }, [expandedItemId, contractPaths, kfInstance, items, statusFilter, itemDetailsById])

  useEffect(function hydrateExpandedTaskDetails() {
    if (!expandedTaskId || !contractPaths) return
    if (taskDetailsById[expandedTaskId]) return
    const baseTask = (tasksFromApi || []).find((t) => t?.id === expandedTaskId)
    if (!baseTask) return
    if (baseTask.vendor && baseTask.valueDisplay && baseTask.valueDisplay !== '—' && baseTask.endDate && baseTask.endDate !== '—') { return }
    const instanceId = baseTask?._id || baseTask?.id
    const activityInstanceId = baseTask?.activityInstanceId || baseTask?._activity_instance_id
    if (!instanceId || !activityInstanceId) return
    let cancelled = false
    async function run() {
      try {
        const merged = await fetchContractTaskDetailMerged(contractPaths, kfInstance, baseTask, currentActivityId || '', __ENTITY_CONFIG__)
        if (cancelled || !merged) return
        const slaDeadline =
          merged.slaDeadline !== '' && merged.slaDeadline != null ? merged.slaDeadline : baseTask.slaDeadline
        setTaskDetailsById((prev) => ({ ...prev, [expandedTaskId]: { ...baseTask, ...merged, slaDeadline } }))
      } catch (e) { if (!cancelled) console.warn('Task detail hydrate failed:', e?.message || e) }
    }
    run()
    return () => { cancelled = true }
  }, [expandedTaskId, contractPaths, kfInstance, tasksFromApi, taskDetailsById, currentActivityId])

  const expandedContractId = expandedItemId || expandedTaskId

  useEffect(() => {
    if (!expandedContractId || !contractPaths) {
      setProgressLoadingId(null)
      return
    }
    if (Object.prototype.hasOwnProperty.call(progressByContractId, expandedContractId)) {
      setProgressLoadingId(null)
      return
    }
    if (progressFetchInFlightRef.current === expandedContractId) return

    let cancelled = false
    progressFetchInFlightRef.current = expandedContractId
    setProgressLoadingId(expandedContractId)

    async function run() {
      try {
        const response = await fetchContractProgressResponse(kfInstance, contractPaths, expandedContractId)
        if (!cancelled) {
          setProgressByContractId((prev) => ({ ...prev, [expandedContractId]: response }))
        }
      } catch (e) {
        console.warn('Contract progress fetch failed:', e?.message || e)
        if (!cancelled) {
          setProgressByContractId((prev) => ({ ...prev, [expandedContractId]: null }))
        }
      } finally {
        if (!cancelled) {
          setProgressLoadingId((cur) => (cur === expandedContractId ? null : cur))
        }
        if (progressFetchInFlightRef.current === expandedContractId) {
          progressFetchInFlightRef.current = null
        }
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [expandedContractId, contractPaths, kfInstance, progressByContractId])

  useEffect(function scrollAndFlashAccordion() {
    const targetId = scrollToAccordionId
    if (!targetId) return
    const domId = `contract-accordion-${targetId}`
    let cancelled = false
    const run = () => {
      if (cancelled) return
      const el = document.getElementById(domId)
      if (!el) {
        // Accordion may not be in DOM yet; retry next frame briefly.
        window.requestAnimationFrame(run)
        return
      }
      try {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      } catch {
        // ignore
      }
      setAccordionFlashId(targetId)
      window.setTimeout(() => {
        if (!cancelled) setAccordionFlashId((prev) => (prev === targetId ? null : prev))
      }, 1200)
      setScrollToAccordionId(null)
    }
    window.requestAnimationFrame(run)
    return () => { cancelled = true }
  }, [scrollToAccordionId, expandedItemId, expandedTaskId])

  useEffect(function prefetchMyTasksContractValues() {
    if (activeTab !== 'tasks') return
    if (!contractPaths || !kfInstance) return
    const list = tasksFromApi
    if (!Array.isArray(list) || list.length === 0) return
    let cancelled = false
    const run = async () => {
      await Promise.all(list.map(async (baseTask) => {
        if (cancelled) return
        const id = baseTask?.id
        if (!id) return
        if (baseTask.valueDisplay && baseTask.valueDisplay !== '—') return
        const instanceId = baseTask.id || baseTask._id
        const activityInstanceId = baseTask.activityInstanceId || baseTask._activity_instance_id
        if (!instanceId || !activityInstanceId) return
        if (taskValuePrefetchInFlightRef.current.has(id)) return
        taskValuePrefetchInFlightRef.current.add(id)
        try {
          const merged = await fetchContractTaskDetailMerged(contractPaths, kfInstance, baseTask, currentActivityId || '', __ENTITY_CONFIG__)
          if (cancelled || !merged) return
          setTaskDetailsById((prev) => {
            const existing = prev[id]
            if (existing?.valueDisplay && existing.valueDisplay !== '—') return prev
            const nextVal = merged.valueDisplay
            if (!nextVal || nextVal === '—') return prev
            return { ...prev, [id]: { ...baseTask, ...merged, ...existing } }
          })
        } finally { taskValuePrefetchInFlightRef.current.delete(id) }
      }))
    }
    void run()
    return () => { cancelled = true }
  }, [activeTab, contractPaths, kfInstance, tasksFromApi, currentActivityId])

  useEffect(function initAOS() { AOS.init({ duration: 600, once: true }) }, [])
  useEffect(function closePopoversOnClickOutside() {
    if (!filterPopoverOpen && !columnsPopoverOpen) return
    const handlePointerDown = (e) => {
      if (filterPopoverRef.current?.contains(e.target) || filterDropdownRef.current?.contains(e.target)) return
      if (columnsPopoverRef.current?.contains(e.target) || columnsDropdownRef.current?.contains(e.target)) return
      setFilterPopoverOpen(false); setColumnsPopoverOpen(false); setActiveDateField(null)
    }
    const handleEscape = (e) => { if (e.key !== 'Escape') return; setFilterPopoverOpen(false); setColumnsPopoverOpen(false); setActiveDateField(null) }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)
    return () => { document.removeEventListener('pointerdown', handlePointerDown); document.removeEventListener('keydown', handleEscape) }
  }, [filterPopoverOpen, columnsPopoverOpen])

  const itemList = Array.isArray(items) ? items : []
  const taskList = Array.isArray(tasksFromApi) ? tasksFromApi : []
  const contractUniverseForKpis = useMemo(() => {
    if (Array.isArray(adminContractRows) && adminContractRows.length) {
      return adminContractRows.map((c) => ({ ...c, id: c.id || c._id || '', rawItem: c.raw || c.rawItem }))
    }
    const seen = new Set()
    const out = []
    const pushUnique = (row) => { const key = String(row?.id || row?._id || '').trim(); if (!key || seen.has(key)) return; seen.add(key); out.push(row) }
    itemList.forEach(pushUnique)
    taskList.forEach(pushUnique)
    return out
  }, [adminContractRows, itemList, taskList])

  /** KPI cards: counts only for instances created by the logged-in user (header name / user fetch). */
  const contractRowsForKpis = useMemo(() => {
    if (!Array.isArray(contractUniverseForKpis)) return []
    const u = user
    const hasUser = u && (u._id || u.Name || u.FirstName)
    if (!hasUser) return contractUniverseForKpis
    return contractUniverseForKpis.filter((row) => rowCreatedByMatchesUser(row, u))
  }, [contractUniverseForKpis, user])
  
  const contractKpis = useMemo(() => {
    const today = new Date()
    let next30 = 0, next60 = 0, next90 = 0, expired = 0, active = 0, ndaMiss = 0, msaMiss = 0, sowMiss = 0
    const vendorKeysGlobal = new Set()
    if (Array.isArray(contractUniverseForKpis)) {
      contractUniverseForKpis.forEach((c) => {
        const vendorName = String(c?.vendor || '').trim()
        if (vendorName) vendorKeysGlobal.add(vendorName.toLowerCase())
      })
    }
    contractRowsForKpis.forEach((c) => {
      const endRaw = c?.endDate || c?.endDateDisplay || c?.rawItem?.End_Date || c?.rawItem?.EndDate || ''
      const endDate = parseDateSafe(endRaw)
      const status = String(formatStatusForDisplay(c?.status) || '').toLowerCase()
      const isRejectedLike = status.includes('rejected') || status.includes('withdrawn')
      const isRejectedOnly = status.includes('rejected')
      const isDraftLike = status.includes('draft')
      let isExpiredByDate = false
      if (endDate && !isRejectedOnly) {
        const diff = daysBetween(today, endDate)
        if (diff < 0) { expired += 1; isExpiredByDate = true } 
        else if (diff <= 30) next30 += 1
        else if (diff <= 60) next60 += 1
        else if (diff <= 90) next90 += 1
      }
      const statusExpired = status.includes('expired')
      const activeLike = !isRejectedLike && !isDraftLike && !statusExpired && !isExpiredByDate
      if (activeLike) active += 1
      if (!isRejectedOnly) {
        if (!isDocAvailable(c?.nda)) ndaMiss += 1
        if (!isDocAvailable(c?.msa)) msaMiss += 1
        if (!isDocAvailable(c?.sow)) sowMiss += 1
      }
    })
    const vendorsFromContracts = vendorKeysGlobal.size
    const vendors = vendorMasterRows.length > 0 ? vendorMasterRows.length : vendorTotalFromReport != null ? vendorTotalFromReport : vendorsFromContracts
    const expiringSoon = expiringWindow === '30' ? next30 : expiringWindow === '60' ? (next30 + next60) : (next30 + next60 + next90)
    return { total: contractRowsForKpis.length, active, expiringSoon, expired, ndaMiss, msaMiss, sowMiss, vendors, next30, next60, next90 }
  }, [contractRowsForKpis, contractUniverseForKpis, expiringWindow, vendorMasterRows.length, vendorTotalFromReport])
  
  const activityTabs = useMemo(() => { const list = Array.isArray(pendingActivities) ? pendingActivities : []; return list.filter((a) => a && a._id) }, [pendingActivities])

  function itemMatchesDateRange(item, from, to) {
    const d = item?.createdDate ? new Date(item.createdDate) : null
    if (!d || isNaN(d.getTime())) return false
    if (from) { const fromD = new Date(from); fromD.setHours(0,0,0,0); if (d < fromD) return false }
    if (to) { const toD = new Date(to); toD.setHours(23,59,59,999); if (d > toD) return false }
    return true
  }

  const filteredItems = useMemo(() => {
    let list = itemList
    if (statusFilter) { list = list.filter((item) => (formatStatusForDisplay(item?.status) || item?.status || '') === statusFilter) }
    if (filterFromDate || filterToDate) { list = list.filter((item) => itemMatchesDateRange(item, filterFromDate, filterToDate)) }
    if (!search.trim()) return list
    const q = search.toLowerCase()
    return list.filter((item) => (item.name && item.name.toLowerCase().includes(q)) || (item.vendor && item.vendor.toLowerCase().includes(q)) || (item.valueDisplay && item.valueDisplay.toLowerCase().includes(q)) || (item.contractType && item.contractType.toLowerCase().includes(q)) || (item.contractDescription && item.contractDescription.toLowerCase().includes(q)) || (item.contractRequestDisplay && item.contractRequestDisplay.toLowerCase().includes(q)) || (item.message && item.message.toLowerCase().includes(q)))
  }, [itemList, statusFilter, search, filterFromDate, filterToDate])

  const filteredTasks = useMemo(() => {
    let list = taskList
    if (filterFromDate || filterToDate) { list = list.filter((t) => itemMatchesDateRange(t, filterFromDate, filterToDate)) }
    if (!search.trim()) return list
    const q = search.toLowerCase()
    return list.filter((t) => (t.name && t.name.toLowerCase().includes(q)) || (t.vendor && t.vendor.toLowerCase().includes(q)) || (t.createdBy && t.createdBy.toLowerCase().includes(q)))
  }, [taskList, search, filterFromDate, filterToDate])

  const statusCounts = useMemo(() => {
    if (statusCountsFromApi) return statusCountsFromApi
    const counts = {}
    STATUS_OPTIONS_CFG.forEach((s) => { counts[s] = 0 })
    itemList.forEach((item) => {
      const s = formatStatusForDisplay(item.status) || item.status || STATUS_OPTIONS_CFG[0] || 'Draft'
      if (counts[s] !== undefined) counts[s] += 1
      else if (STATUS_OPTIONS_CFG[0]) counts[STATUS_OPTIONS_CFG[0]] = (counts[STATUS_OPTIONS_CFG[0]] || 0) + 1
    })
    return counts
  }, [statusCountsFromApi, itemList])

  const statusTabCounts = useMemo(() => {
    const c = statusCounts
    if (!c) return c
    if (itemsLoading) return c
    if (items === null) return c
    if (filterFromDate || filterToDate || search.trim()) return c
    return { ...c, [statusFilter]: items.length }
  }, [statusCounts, items, itemsLoading, statusFilter, filterFromDate, filterToDate, search])

  const itemsPaginated = filteredItems.slice((itemsPage - 1) * rowsPerPage, itemsPage * rowsPerPage)
  const tasksPaginated = filteredTasks.slice((tasksPage - 1) * rowsPerPage, tasksPage * rowsPerPage)
  const totalItemsPages = Math.max(1, Math.ceil(filteredItems.length / rowsPerPage))
  const totalTasksPages = Math.max(1, Math.ceil(filteredTasks.length / rowsPerPage))
  const showItemBulkCheckboxes = statusFilter === 'Draft'
  const itemsTableLeadingCols = showItemBulkCheckboxes ? 2 : 1
  const tasksTableLeadingCols = 1

  const toggleItemSelection = (id) => { setSelectedItemIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next }) }
  const selectAllItems = (checked) => { if (checked) setSelectedItemIds(new Set(itemsPaginated.map((i) => i.id))); else setSelectedItemIds(new Set()) }

  const handleDeleteSelectedDrafts = async () => {
    const ids = Array.from(selectedItemIds).filter(Boolean)
    if (ids.length === 0) return
    if (activeTab !== 'items' || statusFilter !== 'Draft') return
    if (!contractPaths) { window.alert('Kissflow paths are not ready yet. Please wait and try again.'); return }
    const confirmed = window.confirm(`Delete ${ids.length} selected draft record(s)? This cannot be undone.`)
    if (!confirmed) return
    const sdk = kfInstance
    setDeletingDrafts(true)
    try {
      const results = await Promise.allSettled(ids.map(async (id) => {
        const recordId = encodeURIComponent(String(id))
        const path = `/process/2/${contractPaths.accountId}/admin/${contractPaths.processId}/${recordId}`
        if (sdk?.api) { return sdk.api(path, { method: 'DELETE', headers: { Accept: 'application/json' } }) }
        const res = await fetch(getApiBase() + path, { method: 'DELETE', credentials: 'include', headers: { Accept: 'application/json' } })
        if (!res.ok) throw new Error(`Delete failed (${res.status})`)
        return true
      }))
      const successIds = []
      let failed = 0
      results.forEach((r, idx) => { if (r.status === 'fulfilled') successIds.push(ids[idx]); else failed += 1 })
      if (successIds.length > 0) {
        setItems((prev) => (Array.isArray(prev) ? prev.filter((row) => !successIds.includes(row.id)) : prev))
        setSelectedItemIds((prev) => { const next = new Set(prev); successIds.forEach((id) => next.delete(id)); return next })
        setStatusCountsFromApi((prev) => { if (!prev || typeof prev !== 'object') return prev; return { ...prev, Draft: Math.max(0, (prev.Draft || 0) - successIds.length) } })
      }
      if (failed > 0) { window.alert(`${successIds.length} draft(s) deleted, ${failed} failed.`) } 
      else { window.alert(`${successIds.length} draft(s) deleted successfully.`) }
    } catch (e) { console.warn('Bulk draft delete failed:', e?.message || e); window.alert('Delete failed. Please try again or contact support.') } 
    finally { setDeletingDrafts(false) }
  }

  const handleNewItem = async () => {
    const sdk = kfInstance ?? (typeof window !== 'undefined' ? window.kf : null)
    if (!sdk) {
      console.warn('New item: Kissflow SDK not available')
      return
    }
    try {
      // Tasks: POST draft → openPopup('Popup_bEJJgrdutd', { InstanceID, ActivityInstanceID })
      if (__ENTITY_CONFIG__?.createDraftOnNew && __ENTITY_CONFIG__?.kind === 'process') {
        await openPmNewItemPopup(sdk, __ENTITY_CONFIG__)
        setWatchParamsTick((t) => t + 1)
        return
      }
      const POPUP_ID = resolveEntityPopupId(__ENTITY_CONFIG__)
      const popupParams = { width: 960, height: 720, popupWidth: '960px', popupHeight: '720px' }
      const appId = contractPaths?.openPageAppId || __ENTITY_CONFIG__?.applicationIdFallback
      if (typeof sdk?.app?.page?.openPopup === 'function') {
        sdk.app.page.openPopup(POPUP_ID, popupParams)
      } else if (sdk?.navigation && typeof sdk.navigation.navigate === 'function') {
        sdk.navigation.navigate({ page: 'create' })
      } else if (sdk?.app?.openPage && appId) {
        sdk.app.openPage(appId)
      } else {
        console.info('New item – wire popup/navigation in Kissflow')
      }
    } catch (e) {
      console.warn('New item failed:', e?.message || e)
      sdk?.client?.showInfo?.(e?.message || 'Failed to create item.')
    }
  }

  const openContractPopup = (row) => {
    const kfLocal = kfInstance ?? (typeof window !== 'undefined' ? window.kf : null)
    const POPUP_ID = resolveEntityPopupId(__ENTITY_CONFIG__)
    const instanceId = row?.id || row?._id
    const activityInstanceId = row?.activityInstanceId || row?._activity_instance_id || ''
    const activityId = activityInstanceId || row?.activityId || currentActivityId || ''
    if (!kfLocal?.app?.page?.openPopup) { setSelectedContract(row); return }
    if (!instanceId || !activityId) {
      console.warn('View Details: missing required popup params', { instanceId, activityId, activityInstanceId, row })
      setSelectedContract(row)
      return
    }
    try {
      // Tasks popup expects InstanceID + ActivityInstanceID; other entities keep aliases too.
      const p = kfLocal.app.page.openPopup(
        POPUP_ID,
        buildPmPopupParams(__ENTITY_CONFIG__, instanceId, activityInstanceId || activityId),
      )
      if (p && typeof p.catch === 'function') {
        p.catch((e) => {
          console.warn('View Details popup failed:', e?.message || e)
          setSelectedContract(row)
        })
      }
    } catch (e) {
      console.warn('View Details popup failed:', e?.message || e)
      setSelectedContract(row)
    }
  }

  // KPI cards removed — keep empty to avoid unused-path churn in legacy helpers
  void contractKpis
  void createOverviewCardsForEntity

  return (
    <div className={vmsPageClass}>
      <div className={vmsPageInnerClass}>
        <div className="space-y-3 sm:space-y-4 lg:space-y-6">

        {/* Sticky header — same wash as ProjectDashboard / UserSpecificPT / EmployeeDashboard */}
        <section className={`${vmsHeaderShellClass()} relative overflow-hidden`} data-aos="fade-down">
          <div className="relative mx-auto flex max-w-[1800px] min-w-0 items-center justify-between gap-3 sm:gap-4">
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <div className={vmsAvatarClass()}>
                {(firstName || 'U').charAt(0)}
              </div>
              <div className="min-w-0 text-left">
                <h1 className="truncate text-base font-semibold leading-snug tracking-tight text-slate-800 sm:text-2xl">
                  {greeting}, <span className="font-semibold text-slate-900">{firstName}</span>
                </h1>
                <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500 sm:text-sm">
                  Logged in as <span className={vmsRoleAccentClass()}>{roleLabel}</span>
                  {L.entityPlural ? <span className="text-slate-400"> · {L.entityPlural}</span> : null}
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="flex justify-end px-0.5">
          <SatelliteOrbitMenu
            kfInstance={kfInstance}
            placement="inline"
            onCreated={() => setWatchParamsTick((t) => t + 1)}
          />
        </div>

        {/* Main list card */}
        <motion.div 
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className={vmsSectionShellClass()}
        >
          {/* Toolbar */}
          <div className={`flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 ${vmsSectionHeaderClass('brand')}`}>
            <div className="inline-flex gap-1 rounded-xl border border-slate-200 bg-white/95 p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setActiveTab('tasks')}
                className={vmsSegmentBtnClass(activeTab === 'tasks')}
              >
                My Tasks
                <span className="opacity-80">{totalTasksCount}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('items')}
                className={vmsSegmentBtnClass(activeTab === 'items')}
              >
                My Items
                <span className="opacity-80">{filteredItems.length}</span>
              </button>
            </div>

            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
              {activeTab === 'items' && statusFilter === 'Draft' && selectedItemIds.size > 0 && (
                <button
                  type="button"
                  onClick={handleDeleteSelectedDrafts}
                  disabled={deletingDrafts}
                  className={vmsDangerBtnClass()}
                >
                  <i className="ri-delete-bin-line"></i>
                  {deletingDrafts ? 'Deleting...' : `Delete (${selectedItemIds.size})`}
                </button>
              )}
              
              <button
                type="button"
                onClick={handleNewItem}
                className={vmsPrimaryBtnClass()}
              >
                <i className="ri-add-line"></i>
                {L.newButton}
              </button>

              <div className="relative" ref={filterPopoverRef}>
                <button
                  type="button"
                  onClick={() => { setFilterPopoverOpen(!filterPopoverOpen); setColumnsPopoverOpen(false); }}
                  aria-label="Open filters"
                  className={vmsIconBtnClass(filterPopoverOpen)}
                >
                  <i className="ri-filter-3-line text-sm"></i>
                </button>
                {filterPopoverOpen && filterAnchorRect && createPortal(
                  <div ref={filterDropdownRef} className="fixed z-[9999] max-h-[85vh] overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl" style={{ top: filterAnchorRect.top, left: filterAnchorRect.left, width: filterAnchorRect.width }}>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Date range</p>
                        <p className="text-xs text-slate-500 mt-0.5">{(formatIsoDateToDisplay(filterFromDate) || 'Any') + ' → ' + (formatIsoDateToDisplay(filterToDate) || 'Any')}</p>
                      </div>
                      <button
                        type="button"
                        aria-label="Close filters"
                        onClick={() => setFilterPopoverOpen(false)}
                        className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500"
                      >
                        <i className="ri-close-line text-lg" />
                      </button>
                    </div>
                    <div className="space-y-3">
                      <button onClick={() => openDatePicker('from')} className="min-h-[44px] w-full px-3 py-2 text-left text-sm border border-slate-200 rounded-xl bg-slate-50 hover:bg-white transition-all touch-manipulation">
                        {formatIsoDateToDisplay(filterFromDate) || 'From date'}
                      </button>
                      <button onClick={() => openDatePicker('to')} className="min-h-[44px] w-full px-3 py-2 text-left text-sm border border-slate-200 rounded-xl bg-slate-50 hover:bg-white transition-all touch-manipulation">
                        {formatIsoDateToDisplay(filterToDate) || 'To date'}
                      </button>
                      {activeDateField && (
                        <div className="border-t pt-3">
                          <div className="flex justify-between items-center mb-2">
                            <button type="button" aria-label="Previous month" onClick={() => setCalendarMonth(prev => startOfMonth(new Date(prev.getFullYear(), prev.getMonth() - 1)))} className="p-2 hover:bg-slate-100 rounded-xl">←</button>
                            <span className="font-medium text-slate-800">{calendarMonthLabel}</span>
                            <button type="button" aria-label="Next month" onClick={() => setCalendarMonth(prev => startOfMonth(new Date(prev.getFullYear(), prev.getMonth() + 1)))} className="p-2 hover:bg-slate-100 rounded-xl">→</button>
                          </div>
                          <div className="grid grid-cols-7 gap-1 text-center text-xs mb-1">
                            {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <span key={d} className="text-slate-400">{d}</span>)}
                          </div>
                          <div className="grid grid-cols-7 gap-1">
                            {calendarDays.map((dt, i) => {
                              if (!dt) return <span key={`e-${i}`} className="h-8" />
                              const iso = formatDateToIso(dt)
                              const isSelected = selectedIsoForCalendar === iso
                              return (
                                <button key={iso} type="button" onClick={() => selectCalendarDate(dt)} className={`h-9 rounded-xl text-sm transition-all ${isSelected ? 'bg-[#1E88E5] text-white shadow-sm' : 'hover:bg-slate-100 text-slate-700'}`}>
                                  {dt.getDate()}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 mt-4">
                      <button type="button" onClick={() => { setFilterFromDate(''); setFilterToDate(''); setFilterPopoverOpen(false); }} className={`flex-1 ${vmsSecondaryBtnClass()}`}>Clear</button>
                      <button type="button" onClick={() => setFilterPopoverOpen(false)} className={`flex-1 ${vmsPrimaryBtnClass()}`}>Apply</button>
                    </div>
                  </div>,
                  document.body
                )}
              </div>

              <div className="relative" ref={columnsPopoverRef}>
                <button
                  type="button"
                  onClick={() => { setColumnsPopoverOpen(!columnsPopoverOpen); setFilterPopoverOpen(false); }}
                  aria-label="Choose visible columns"
                  className={vmsIconBtnClass(columnsPopoverOpen)}
                >
                  <i className="ri-eye-line text-sm"></i>
                </button>
                {columnsPopoverOpen && columnsAnchorRect && createPortal(
                  <div ref={columnsDropdownRef} className="fixed z-[9999] max-h-[80vh] overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl" style={{ top: columnsAnchorRect.top, right: columnsAnchorRect.right, width: columnsAnchorRect.width }}>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <p className="text-[11px] font-semibold text-slate-600 uppercase tracking-wide">Visible columns</p>
                      <button type="button" aria-label="Close columns" onClick={() => setColumnsPopoverOpen(false)} className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500">
                        <i className="ri-close-line text-lg" />
                      </button>
                    </div>
                    <div className="space-y-1">
                      {(activeTab === 'items' ? ITEMS_COLUMNS_CFG : TASKS_COLUMNS_CFG).map(col => (
                        <label key={col.id} className="flex items-center gap-2 py-1 cursor-pointer">
                          <input type="checkbox" checked={activeTab === 'items' ? visibleColumnsItems[col.id] : visibleColumnsTasks[col.id]} onChange={() => {
                            if (activeTab === 'items') setVisibleColumnsItems(prev => ({ ...prev, [col.id]: !prev[col.id] }));
                            else setVisibleColumnsTasks(prev => ({ ...prev, [col.id]: !prev[col.id] }));
                          }} className="rounded border-slate-300 text-[#1E88E5]" />
                          <span className="text-sm text-slate-700">{col.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>,
                  document.body
                )}
              </div>

              <div className="relative order-last min-w-0 w-full basis-full sm:order-none sm:basis-auto sm:min-w-[200px] sm:flex-1">
                <i className="ri-search-line pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-slate-400"></i>
                <input
                  type="text"
                  placeholder={L.searchPlaceholder || "Search…"}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={vmsSearchInputClass()}
                />
                {search ? (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full text-slate-500 hover:bg-[#EFF6FF] transition-colors flex items-center justify-center"
                  >
                    <i className="ri-close-line text-lg" />
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {/* Status Filter Chips */}
          {activeTab === 'items' && (
            <>
              {/* Mobile: dropdown only */}
              <div className="border-b border-slate-200 bg-white px-3 py-2 sm:hidden">
                <label className="flex items-center justify-between gap-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Status</span>
                  <PtSelect
                    value={statusFilter}
                    onChange={(e) => { setStatusFilter(e.target.value); setItemsPage(1) }}
                    className="w-[220px] max-w-full"
                    aria-label="Filter by status"
                    options={STATUS_OPTIONS_CFG.map((status) => ({
                      value: status,
                      label: `${status} (${statusTabCounts[status] || 0})`,
                    }))}
                  />
                </label>
              </div>

              {/* Desktop/tablet: existing chips */}
              <div className="-mx-3 hidden flex-nowrap gap-1.5 overflow-x-auto border-b border-slate-100/90 bg-white/50 px-3 py-2.5 sm:mx-0 sm:flex sm:flex-wrap sm:px-4">
                {STATUS_OPTIONS_CFG.map(status => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => { setStatusFilter(status); setItemsPage(1); }}
                    className={vmsChipBtnClass(statusFilter === status)}
                  >
                    {status}
                    <span className="ml-1.5 opacity-80">{statusTabCounts[status] || 0}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Task Step Chips (same row style as status chips) */}
          {activeTab === 'tasks' && activityTabs.length > 0 && (
            <>
              {/* Mobile: dropdown only */}
              <div className="border-b border-slate-200 bg-white px-3 py-2 sm:hidden">
                <label className="flex items-center justify-between gap-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Task step</span>
                  <PtSelect
                    value={String(currentActivityId || activityTabs[0]?._id || '')}
                    onChange={(e) => {
                      const id = e.target.value
                      const activity = activityTabs.find((a) => String(a?._id) === String(id))
                      if (!activity?._id) return
                      setCurrentActivityId(activity._id)
                      setCurrentStepName(activity.StepName || (L.reviewStepFallback || 'Review'))
                      setTotalTasksCount(activity.Count ?? 0)
                      setTasksPage(1)
                    }}
                    className="w-[220px] max-w-full"
                    aria-label="Filter by task step"
                    options={activityTabs.map((activity) => ({
                      value: String(activity._id),
                      label: `${activity.StepName || 'Activity'} (${activity.Count ?? 0})`,
                    }))}
                  />
                </label>
              </div>

              {/* Desktop/tablet: existing chips */}
              <div className="-mx-3 hidden flex-nowrap gap-1.5 overflow-x-auto border-b border-slate-100/90 bg-white/50 px-3 py-2.5 sm:mx-0 sm:flex sm:flex-wrap sm:px-4">
                {activityTabs.map((activity) => (
                  <button
                    key={activity._id}
                    type="button"
                    onClick={() => {
                      setCurrentActivityId(activity._id)
                      setCurrentStepName(activity.StepName || (L.reviewStepFallback || 'Review'))
                      setTotalTasksCount(activity.Count ?? 0)
                      setTasksPage(1)
                    }}
                    className={vmsChipBtnClass(currentActivityId === activity._id)}
                  >
                    {activity.StepName || 'Activity'}
                    <span className="ml-1.5 opacity-80">{activity.Count ?? 0}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Mobile: stacked cards (< sm). Desktop: unchanged table from sm breakpoint. */}
          <div className="sm:hidden">
            <AnimatePresence mode="wait">
              {activeTab === 'items' ? (
                <motion.div
                  key="mob-items"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="divide-y divide-slate-200 border-t border-slate-200 bg-white"
                >
                  {itemsLoading && itemList.length === 0 ? (
                    <div className="space-y-2 p-3">
                      {Array.from({ length: Math.min(6, rowsPerPage) }).map((_, i) => (
                        <div key={i} className="animate-pulse rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                          <div className="mb-2 h-3 w-full max-w-[12rem] rounded bg-slate-200" />
                          <div className="h-3 w-full max-w-[8rem] rounded bg-slate-100" />
                        </div>
                      ))}
                    </div>
                  ) : itemsPaginated.length === 0 ? (
                    <TableEmptyState
                      title={(search || filterFromDate || filterToDate)
                        ? `No ${String(L.entityPlural || 'items').toLowerCase()} match your filters`
                        : (L.myItemsEmpty || `No ${String(L.entityPlural || 'items').toLowerCase()} found`)}
                      subtitle={search || filterFromDate || filterToDate ? 'Try clearing filters or broadening your search.' : `Create your first ${(L.entitySingular || 'item').toLowerCase()} to get started.`}
                      primaryActionLabel={L.newButton}
                      onPrimaryAction={handleNewItem}
                      secondaryActionLabel={(search || filterFromDate || filterToDate) ? 'Clear filters' : null}
                      onSecondaryAction={() => { setSearch(''); setFilterFromDate(''); setFilterToDate(''); setStatusFilter(STATUS_OPTIONS_CFG[0] || statusFilter); setItemsPage(1) }}
                    />
                  ) : (
                    itemsPaginated.map((item, idx) => {
                      const itemView = itemDetailsById[item.id] || item
                      return (
                        <div key={item.id} className={expandedItemId === item.id ? 'bg-blue-50/50' : ''}>
                          <div className="touch-manipulation px-3 py-3">
                            <div className="flex gap-2">
                              {showItemBulkCheckboxes && (
                                <div className="flex shrink-0 items-start pt-0.5" onClick={(e) => e.stopPropagation()}>
                                  <input type="checkbox" checked={selectedItemIds.has(item.id)} onChange={() => toggleItemSelection(item.id)} className="rounded border-slate-300" />
                                </div>
                              )}
                              <button
                                type="button"
                                aria-label={expandedItemId === item.id ? 'Collapse' : 'Expand'}
                                className={vmsExpandBtnClass(expandedItemId === item.id, true)}
                                onClick={() => { setExpandedItemId((prev) => (prev === item.id ? null : item.id)); setScrollToAccordionId(item.id) }}
                              >
                                <i className={`${expandedItemId === item.id ? 'ri-arrow-down-s-line' : 'ri-arrow-right-s-line'} text-lg`} />
                              </button>
                              <button
                                type="button"
                                className="min-w-0 flex-1 text-left"
                                onClick={() => { setExpandedItemId((prev) => (prev === item.id ? null : item.id)); setScrollToAccordionId(item.id) }}
                              >
                                <div className="mb-1 flex items-start justify-between gap-2">
                                  <p className="line-clamp-2 text-sm font-semibold text-slate-800">{item.name || '—'}</p>
                                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${getStatusBadgeClass(item.status)}`}>
                                    {formatStatusForDisplay(item.status)}
                                  </span>
                                </div>
                                <div className="text-xs text-slate-600">
                                  <ItemVendorNameCell item={item} vendorCellLoadingById={itemVendorCellLoadingById} />
                                </div>
                                <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1.5 text-[11px] text-slate-600">
                                  {visibleColumnsItems.contractCategory && (
                                    <div><dt className="text-[#7F8C8D]">Related</dt><dd className="font-medium text-[#2C3E50]">{item.contractType || '—'}</dd></div>
                                  )}
                                  {visibleColumnsItems.createdAt && (
                                    <div><dt className="text-slate-400">Created</dt><dd className="font-medium text-slate-700">{formatDateTime(item.createdDate)}</dd></div>
                                  )}
                                  {visibleColumnsItems.valueDisplay && (
                                    <div><dt className="text-[#7F8C8D]">Progress</dt><dd className="font-semibold text-[#2C3E50]">{item.valueDisplay || '—'}</dd></div>
                                  )}
                                  {visibleColumnsItems.sla && (
                                    <div className="col-span-2">
                                      <dt className="text-slate-400">SLA</dt>
                                      <dd className="mt-0.5">
                                        {(() => {
                                          const iv = itemDetailsById[item.id] || item
                                          const meta = getSlaMeta(item.id, iv.slaDeadline)
                                          return (
                                            <span className={`inline-flex px-2.5 py-1 text-[11px] font-semibold rounded-full border ${meta.pill}`} title={slaDeadlineTitle(iv.slaDeadline)}>
                                              {meta.label}
                                            </span>
                                          )
                                        })()}
                                      </dd>
                                    </div>
                                  )}
                                  {visibleColumnsItems.endDate && (
                                    <div><dt className="text-slate-400">End</dt><dd className="font-medium text-slate-700">{item.endDateDisplay || item.endDate || '—'}</dd></div>
                                  )}
                                </dl>
                              </button>
                            </div>
                          </div>
                          <AnimatePresence>
                            {expandedItemId === item.id && (
                              <div className="border-t border-slate-200 bg-slate-50/40">
                                <ElegantContractAccordion
                                  item={itemView}
                                  onViewDetails={() => openContractPopup(itemView)}
                                  onClose={() => setExpandedItemId(null)}
                                  flash={accordionFlashId === item.id}
                                  workflowSteps={
                                    Object.prototype.hasOwnProperty.call(progressByContractId, item.id)
                                      ? flattenProgressSteps(progressByContractId[item.id])
                                      : []
                                  }
                                  workflowLoading={
                                    progressLoadingId === item.id ||
                                    !Object.prototype.hasOwnProperty.call(progressByContractId, item.id)
                                  }
                                />
                              </div>
                            )}
                          </AnimatePresence>
                        </div>
                      )
                    })
                  )}
                </motion.div>
              ) : (
                <motion.div
                  key="mob-tasks"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="divide-y divide-slate-200 border-t border-slate-200 bg-white"
                >
                  {tasksLoading && tasksFromApi === null ? (
                    <div className="space-y-2 p-3">
                      {Array.from({ length: Math.min(6, rowsPerPage) }).map((_, i) => (
                        <div key={i} className="animate-pulse rounded-xl border border-slate-100 bg-slate-50/80 p-3">
                          <div className="mb-2 h-3 w-full max-w-[12rem] rounded bg-slate-200" />
                          <div className="h-3 w-full max-w-[8rem] rounded bg-slate-100" />
                        </div>
                      ))}
                    </div>
                  ) : tasksPaginated.length === 0 ? (
                    <TableEmptyState
                      title={L.myTasksEmpty || 'No pending tasks'}
                      subtitle={search ? 'Try clearing your search to see more tasks.' : 'You’re all caught up.'}
                      primaryActionLabel={L.newButton}
                      onPrimaryAction={handleNewItem}
                      secondaryActionLabel={search ? 'Clear search' : null}
                      onSecondaryAction={() => setSearch('')}
                    />
                  ) : (
                    tasksPaginated.map((task, idx) => {
                      const taskView = taskDetailsById[task.id] || task
                      return (
                        <div key={task.id} className={expandedTaskId === task.id ? 'bg-blue-50/50' : ''}>
                          <div className="touch-manipulation px-3 py-3">
                            <div className="flex gap-2">
                              <button
                                type="button"
                                aria-label={expandedTaskId === task.id ? 'Collapse' : 'Expand'}
                                className={vmsExpandBtnClass(expandedTaskId === task.id, true)}
                                onClick={() => { setExpandedTaskId((prev) => (prev === task.id ? null : task.id)); setScrollToAccordionId(task.id) }}
                              >
                                <i className={`${expandedTaskId === task.id ? 'ri-arrow-down-s-line' : 'ri-arrow-right-s-line'} text-lg`} />
                              </button>
                              <button
                                type="button"
                                className="min-w-0 flex-1 text-left"
                                onClick={() => { setExpandedTaskId((prev) => (prev === task.id ? null : task.id)); setScrollToAccordionId(task.id) }}
                              >
                                <div className="mb-1 flex items-start justify-between gap-2">
                                  <p className="line-clamp-2 text-sm font-semibold text-slate-800">{taskView.name || '—'}</p>
                                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${getStatusBadgeClass(taskView.status)}`}>
                                    {formatStatusForDisplay(taskView.status)}
                                  </span>
                                </div>
                                <p className="text-xs font-medium text-slate-600">{taskView.vendor || '—'}</p>
                                <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1.5 text-[11px] text-slate-600">
                                  {visibleColumnsTasks.contractCategory && (
                                    <div><dt className="text-[#7F8C8D]">Related</dt><dd className="font-medium text-[#2C3E50]">{taskView.contractType || '—'}</dd></div>
                                  )}
                                  {visibleColumnsTasks.createdAt && (
                                    <div><dt className="text-slate-400">Created</dt><dd className="font-medium text-slate-700">{formatDateTime(taskView.createdDate)}</dd></div>
                                  )}
                                  {visibleColumnsTasks.valueDisplay && (
                                    <div><dt className="text-[#7F8C8D]">Progress</dt><dd className="font-semibold text-[#2C3E50]">{taskView.valueDisplay || '—'}</dd></div>
                                  )}
                                  {visibleColumnsTasks.sla && (
                                    <div className="col-span-2">
                                      <dt className="text-slate-400">SLA</dt>
                                      <dd className="mt-0.5">
                                        {(() => {
                                          const meta = getSlaMeta(task.id, taskView.slaDeadline)
                                          return (
                                            <span className={`inline-flex px-2.5 py-1 text-[11px] font-semibold rounded-full border ${meta.pill}`} title={slaDeadlineTitle(taskView.slaDeadline)}>
                                              {meta.label}
                                            </span>
                                          )
                                        })()}
                                      </dd>
                                    </div>
                                  )}
                                  {visibleColumnsTasks.endDate && (
                                    <div><dt className="text-slate-400">End</dt><dd className="font-medium text-slate-700">{taskView.endDateDisplay || taskView.endDate || '—'}</dd></div>
                                  )}
                                </dl>
                              </button>
                            </div>
                          </div>
                          <AnimatePresence>
                            {expandedTaskId === task.id && (
                              <div className="border-t border-slate-200 bg-slate-50/40">
                                <ElegantContractAccordion
                                  item={taskView}
                                  onViewDetails={() => openContractPopup(taskView)}
                                  onClose={() => setExpandedTaskId(null)}
                                  flash={accordionFlashId === task.id}
                                  workflowSteps={
                                    Object.prototype.hasOwnProperty.call(progressByContractId, task.id)
                                      ? flattenProgressSteps(progressByContractId[task.id])
                                      : []
                                  }
                                  workflowLoading={
                                    progressLoadingId === task.id ||
                                    !Object.prototype.hasOwnProperty.call(progressByContractId, task.id)
                                  }
                                />
                              </div>
                            )}
                          </AnimatePresence>
                        </div>
                      )
                    })
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="hidden overflow-auto border border-slate-200/80 sm:block">
            <AnimatePresence mode="wait">
              {activeTab === 'items' ? (
                <motion.table
                  key="items-table"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="w-full text-sm"
                >
                  <thead className={vmsTableHeadClass()}>
                    <tr>
                      {showItemBulkCheckboxes && <th className={`${vmsTableHeadCellClass()} w-8`}><input type="checkbox" checked={itemsPaginated.length > 0 && itemsPaginated.every(i => selectedItemIds.has(i.id))} onChange={(e) => selectAllItems(e.target.checked)} className="rounded border-slate-300" /></th>}
                      <th className={`${vmsTableHeadCellClass()} w-8 px-2`}></th>
                      {ITEMS_COLUMNS_CFG.map(col => visibleColumnsItems[col.id] && (<th key={col.id} className={`${vmsTableHeadCellClass()} ${col.width}`}>{col.label}</th>))}
                    </tr>
                  </thead>
                  {itemsLoading && itemList.length === 0 ? (
                    <TableSkeleton cols={ITEMS_COLUMNS_CFG.filter((c) => visibleColumnsItems[c.id]).length} rows={Math.min(8, rowsPerPage)} leadingCols={itemsTableLeadingCols} />
                  ) : itemsPaginated.length === 0 ? (
                    <tbody>
                      <tr>
                        <td colSpan={itemsTableLeadingCols + ITEMS_COLUMNS_CFG.length} className="p-0">
                          <TableEmptyState
                            title={(search || filterFromDate || filterToDate)
                              ? `No ${String(L.entityPlural || 'items').toLowerCase()} match your filters`
                              : (L.myItemsEmpty || `No ${String(L.entityPlural || 'items').toLowerCase()} found`)}
                            subtitle={search || filterFromDate || filterToDate ? 'Try clearing filters or broadening your search.' : `Create your first ${(L.entitySingular || 'item').toLowerCase()} to get started.`}
                            primaryActionLabel={L.newButton}
                            onPrimaryAction={handleNewItem}
                            secondaryActionLabel={(search || filterFromDate || filterToDate) ? 'Clear filters' : null}
                            onSecondaryAction={() => { setSearch(''); setFilterFromDate(''); setFilterToDate(''); setStatusFilter(STATUS_OPTIONS_CFG[0] || statusFilter); setItemsPage(1) }}
                          />
                        </td>
                      </tr>
                    </tbody>
                  ) : (
                    <tbody className={`${vmsTableDivideClass()} divide-slate-200/80`}>
                      {itemsPaginated.map((item, idx) => {
                        const itemView = itemDetailsById[item.id] || item
                        return (
                          <React.Fragment key={item.id}>
                            <motion.tr
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: idx * 0.03 }}
                              className={`${vmsTableRowClass(expandedItemId === item.id)} ${expandedItemId === item.id ? 'shadow-[inset_3px_0_0_0_rgba(30,136,229,0.35)]' : ''}`}
                            >
                              {showItemBulkCheckboxes && (
                                <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                                  <input type="checkbox" checked={selectedItemIds.has(item.id)} onChange={() => toggleItemSelection(item.id)} className="rounded border-slate-300" />
                                </td>
                              )}
                              <td className="px-2 py-3 text-slate-400">
                                <button
                                  type="button"
                                  aria-label={expandedItemId === item.id ? 'Collapse row' : 'Expand row'}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setExpandedItemId((prev) => (prev === item.id ? null : item.id))
                                    setScrollToAccordionId(item.id)
                                  }}
                                  className={vmsExpandBtnClass(expandedItemId === item.id, true)}
                                >
                                  <i className={`${expandedItemId === item.id ? 'ri-arrow-down-s-line' : 'ri-arrow-right-s-line'} text-base`} />
                                </button>
                              </td>
                              {visibleColumnsItems.vendor && (
                                <td
                                  className={`px-3 py-3 ${expandedItemId === item.id ? 'text-slate-900' : ''}`}
                                  onClick={() => {
                                    setExpandedItemId((prev) => (prev === item.id ? null : item.id))
                                    setScrollToAccordionId(item.id)
                                  }}
                                >
                                  <button
                                    type="button"
                                    className="text-left w-full hover:underline underline-offset-4 decoration-slate-300"
                                  >
                                    <ItemVendorNameCell item={item} vendorCellLoadingById={itemVendorCellLoadingById} />
                                  </button>
                                </td>
                              )}
                              {visibleColumnsItems.contractCategory && <td className="px-3 py-3 text-slate-600">{item.contractType || '—'}</td>}
                              {visibleColumnsItems.createdAt && <td className="px-3 py-3 text-slate-500 text-xs">{formatDateTime(item.createdDate)}</td>}
                              {visibleColumnsItems.valueDisplay && <td className="px-3 py-3 font-semibold text-slate-700">{item.valueDisplay || '—'}</td>}
                              {visibleColumnsItems.status && (
                                <td className="px-3 py-3">
                                  <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusBadgeClass(item.status)}`}>
                                    {formatStatusForDisplay(item.status)}
                                  </span>
                                </td>
                              )}
                              {visibleColumnsItems.sla && (
                                <td className="px-3 py-3 whitespace-nowrap">
                                  {(() => {
                                    const meta = getSlaMeta(item.id, itemView.slaDeadline)
                                    return (
                                      <span
                                        className={`inline-flex px-2.5 py-1 text-[11px] font-semibold rounded-full border ${meta.pill}`}
                                        title={slaDeadlineTitle(itemView.slaDeadline)}
                                      >
                                        {meta.label}
                                      </span>
                                    )
                                  })()}
                                </td>
                              )}
                              {visibleColumnsItems.endDate && <td className="px-3 py-3 text-slate-500">{item.endDateDisplay || item.endDate || '—'}</td>}
                            </motion.tr>
                            <AnimatePresence>
                              {expandedItemId === item.id && (
                                <tr><td colSpan={itemsTableLeadingCols + ITEMS_COLUMNS_CFG.length} className="p-0">
                                  <ElegantContractAccordion
                                  item={itemView}
                                  onViewDetails={() => openContractPopup(itemView)}
                                  onClose={() => setExpandedItemId(null)}
                                  flash={accordionFlashId === item.id}
                                  workflowSteps={
                                    Object.prototype.hasOwnProperty.call(progressByContractId, item.id)
                                      ? flattenProgressSteps(progressByContractId[item.id])
                                      : []
                                  }
                                  workflowLoading={
                                    progressLoadingId === item.id ||
                                    !Object.prototype.hasOwnProperty.call(progressByContractId, item.id)
                                  }
                                />
                                </td></tr>
                              )}
                            </AnimatePresence>
                          </React.Fragment>
                        )
                      })}
                    </tbody>
                  )}
                </motion.table>
              ) : (
                <motion.table
                  key="tasks-table"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="w-full text-sm"
                >
                  <thead className={vmsTableHeadClass()}>
                    <tr>
                      <th className={`${vmsTableHeadCellClass()} w-8 px-2`}></th>
                      {TASKS_COLUMNS_CFG.map(col => visibleColumnsTasks[col.id] && (<th key={col.id} className={`${vmsTableHeadCellClass()} ${col.width}`}>{col.label}</th>))}
                    </tr>
                  </thead>
                  {tasksLoading && tasksFromApi === null ? (
                    <TableSkeleton cols={TASKS_COLUMNS_CFG.filter((c) => visibleColumnsTasks[c.id]).length} rows={Math.min(8, rowsPerPage)} leadingCols={tasksTableLeadingCols} />
                  ) : tasksPaginated.length === 0 ? (
                    <tbody>
                      <tr>
                        <td colSpan={tasksTableLeadingCols + TASKS_COLUMNS_CFG.length} className="p-0">
                          <TableEmptyState
                            title={L.myTasksEmpty || 'No pending tasks'}
                            subtitle={search ? 'Try clearing your search to see more tasks.' : 'You’re all caught up.'}
                            primaryActionLabel={L.newButton}
                            onPrimaryAction={handleNewItem}
                            secondaryActionLabel={search ? 'Clear search' : null}
                            onSecondaryAction={() => setSearch('')}
                          />
                        </td>
                      </tr>
                    </tbody>
                  ) : (
                    <tbody className={`${vmsTableDivideClass()} divide-slate-200/80`}>
                      {tasksPaginated.map((task, idx) => {
                        const taskView = taskDetailsById[task.id] || task
                        return (
                          <React.Fragment key={task.id}>
                            <motion.tr
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: idx * 0.03 }}
                              className={`${vmsTableRowClass(expandedTaskId === task.id)} ${expandedTaskId === task.id ? 'shadow-[inset_3px_0_0_0_rgba(30,136,229,0.35)]' : ''}`}
                            >
                              <td className="px-2 py-3 text-slate-400">
                                <button
                                  type="button"
                                  aria-label={expandedTaskId === task.id ? 'Collapse row' : 'Expand row'}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setExpandedTaskId((prev) => (prev === task.id ? null : task.id))
                                    setScrollToAccordionId(task.id)
                                  }}
                                  className={vmsExpandBtnClass(expandedTaskId === task.id, true)}
                                >
                                  <i className={`${expandedTaskId === task.id ? 'ri-arrow-down-s-line' : 'ri-arrow-right-s-line'} text-base`} />
                                </button>
                              </td>
                              {visibleColumnsTasks.vendor && (
                                <td
                                  className={`px-3 py-3 font-medium ${expandedTaskId === task.id ? 'text-slate-900' : 'text-slate-700'}`}
                                  onClick={() => {
                                    setExpandedTaskId((prev) => (prev === task.id ? null : task.id))
                                    setScrollToAccordionId(task.id)
                                  }}
                                >
                                  <button
                                    type="button"
                                    className="text-left w-full hover:underline underline-offset-4 decoration-slate-300"
                                  >
                                    {taskView.vendor || '—'}
                                  </button>
                                </td>
                              )}
                              {visibleColumnsTasks.contractCategory && <td className="px-3 py-3 text-slate-600">{taskView.contractType || '—'}</td>}
                              {visibleColumnsTasks.createdAt && <td className="px-3 py-3 text-slate-500 text-xs">{formatDateTime(taskView.createdDate)}</td>}
                              {visibleColumnsTasks.valueDisplay && <td className="px-3 py-3 font-semibold text-slate-700">{taskView.valueDisplay || '—'}</td>}
                              {visibleColumnsTasks.status && (
                                <td className="px-3 py-3">
                                  <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusBadgeClass(taskView.status)}`}>
                                    {formatStatusForDisplay(taskView.status)}
                                  </span>
                                </td>
                              )}
                              {visibleColumnsTasks.sla && (
                                <td className="px-3 py-3 whitespace-nowrap">
                                  {(() => {
                                    const meta = getSlaMeta(task.id, taskView.slaDeadline)
                                    return (
                                      <span
                                        className={`inline-flex px-2.5 py-1 text-[11px] font-semibold rounded-full border ${meta.pill}`}
                                        title={slaDeadlineTitle(taskView.slaDeadline)}
                                      >
                                        {meta.label}
                                      </span>
                                    )
                                  })()}
                                </td>
                              )}
                              {visibleColumnsTasks.endDate && <td className="px-3 py-3 text-slate-500">{taskView.endDateDisplay || taskView.endDate || '—'}</td>}
                            </motion.tr>
                            <AnimatePresence>
                              {expandedTaskId === task.id && (
                                <tr><td colSpan={tasksTableLeadingCols + TASKS_COLUMNS_CFG.length} className="p-0">
                                  <ElegantContractAccordion
                                  item={taskView}
                                  onViewDetails={() => openContractPopup(taskView)}
                                  onClose={() => setExpandedTaskId(null)}
                                  flash={accordionFlashId === task.id}
                                  workflowSteps={
                                    Object.prototype.hasOwnProperty.call(progressByContractId, task.id)
                                      ? flattenProgressSteps(progressByContractId[task.id])
                                      : []
                                  }
                                  workflowLoading={
                                    progressLoadingId === task.id ||
                                    !Object.prototype.hasOwnProperty.call(progressByContractId, task.id)
                                  }
                                />
                                </td></tr>
                              )}
                            </AnimatePresence>
                          </React.Fragment>
                        )
                      })}
                    </tbody>
                  )}
                </motion.table>
              )}
            </AnimatePresence>
          </div>

          {/* Pagination */}
          <div className={vmsPaginationBarClass()}>
            <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-start">
              <span className="text-xs text-slate-500">Rows per page:</span>
              <PtSelect
                value={String(rowsPerPage)}
                onChange={(e) => { setRowsPerPage(Number(e.target.value)); setItemsPage(1); setTasksPage(1); }}
                className="w-[4.5rem]"
                aria-label="Rows per page"
                options={[5, 10, 25, 50].map((n) => ({ value: String(n), label: String(n) }))}
              />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500">
                {activeTab === 'items' 
                  ? `${(itemsPage - 1) * rowsPerPage + 1}-${Math.min(itemsPage * rowsPerPage, filteredItems.length)} of ${filteredItems.length}`
                  : `${(tasksPage - 1) * rowsPerPage + 1}-${Math.min(tasksPage * rowsPerPage, filteredTasks.length)} of ${filteredTasks.length}`}
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => activeTab === 'items' ? setItemsPage(p => Math.max(1, p-1)) : setTasksPage(p => Math.max(1, p-1))}
                  disabled={activeTab === 'items' ? itemsPage <= 1 : tasksPage <= 1}
                  className={vmsPaginationBtnClass(false)}
                  aria-label="Previous page"
                >
                  <i className="ri-arrow-left-s-line"></i>
                </button>
                <button
                  type="button"
                  onClick={() => activeTab === 'items' ? setItemsPage(p => Math.min(totalItemsPages, p+1)) : setTasksPage(p => Math.min(totalTasksPages, p+1))}
                  disabled={activeTab === 'items' ? itemsPage >= totalItemsPages : tasksPage >= totalTasksPages}
                  className={vmsPaginationBtnClass(false)}
                  aria-label="Next page"
                >
                  <i className="ri-arrow-right-s-line"></i>
                </button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Modal */}
        <AnimatePresence>
          {selectedContract && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm sm:p-4"
              onClick={() => setSelectedContract(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                className="bg-white rounded-2xl max-w-md w-full max-h-[80vh] overflow-y-auto shadow-2xl"
                onClick={e => e.stopPropagation()}
              >
                <div className="sticky top-0 bg-white border-b border-slate-200 px-5 py-4 flex justify-between items-center">
                  <h3 className="font-bold text-slate-800">{L.entitySingular || 'Item'} Details</h3>
                  <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={() => setSelectedContract(null)} className="p-1 hover:bg-slate-100 rounded-lg transition-all">
                    <i className="ri-close-line text-xl text-slate-500"></i>
                  </motion.button>
                </div>
                <div className="p-5 space-y-4">
                  <div><label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{L.entitySingular || 'Name'}</label><p className="font-medium text-slate-800 mt-0.5">{selectedContract.name || '—'}</p></div>
                  <div><label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{ITEMS_COLUMNS_CFG.find((c) => c.id === 'vendor')?.label || 'Owner'}</label><p className="text-slate-700 mt-0.5">{selectedContract.vendor || '—'}</p></div>
                  <div><label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{ITEMS_COLUMNS_CFG.find((c) => c.id === 'valueDisplay')?.label || 'Progress'}</label><p className="font-semibold text-slate-800 mt-0.5">{selectedContract.valueDisplay || '—'}</p></div>
                  <div><label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</label><div className="mt-1"><span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadgeClass(selectedContract.status)}`}>{selectedContract.status}</span></div></div>
                  {selectedContract.message && <div><label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Notes</label><p className="text-sm text-slate-600 mt-0.5">{selectedContract.message}</p></div>}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </div>

      {/* Add custom animation keyframes */}
      <style jsx>{`
        @keyframes shine {
          0% { transform: translateX(-100%) rotate(12deg); }
          100% { transform: translateX(200%) rotate(12deg); }
        }
        .animate-shine {
          animation: shine 0.8s ease-in-out;
        }
      `}</style>
    </div>
  )
  }
}


/** @deprecated use createPmMyItemsPro(entityConfig) via entity wrappers */
export default createPmMyItemsPro
