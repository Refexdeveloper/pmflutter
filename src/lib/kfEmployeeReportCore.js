import { kfGetJson, fetchKissflowDevJson, isLocalVitePreview } from './kfRuntime.js'

export function normalizeReportEmail(value) {
  if (value == null || value === '') return ''
  if (typeof value === 'string' || typeof value === 'number') {
    const text = String(value).trim().toLowerCase()
    return text.includes('@') ? text : ''
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = normalizeReportEmail(item)
      if (hit) return hit
    }
    return ''
  }
  if (typeof value === 'object') {
    for (const key of ['Email', 'email', 'Value', 'value', 'Name', 'name']) {
      const hit = normalizeReportEmail(value[key])
      if (hit) return hit
    }
  }
  return ''
}

export function reportFieldText(value) {
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim()
  }
  if (Array.isArray(value)) {
    return value.map(reportFieldText).filter(Boolean).join(', ')
  }
  if (typeof value === 'object') {
    return String(value.Name ?? value.name ?? value.Value ?? value.value ?? value.Email ?? value.email ?? '').trim()
  }
  return String(value).trim()
}

export function buildReportFieldMaps(columns) {
  const fieldToColumnId = {}
  const columnIdToField = {}
  for (const col of columns || []) {
    if (col?.FieldId && col?.Id) {
      fieldToColumnId[col.FieldId] = col.Id
      columnIdToField[col.Id] = col.FieldId
    }
  }
  return { fieldToColumnId, columnIdToField }
}

export function readReportRowField(row, fieldId, fieldToColumnId, columnIdToField) {
  const colId = fieldToColumnId[fieldId]
  if (colId && row[colId] != null) return row[colId]
  if (row[fieldId] != null) return row[fieldId]
  for (const [cid, fid] of Object.entries(columnIdToField)) {
    if (fid === fieldId && row[cid] != null) return row[cid]
  }
  return null
}

export function normalizeReportPayload(raw) {
  if (!raw || typeof raw !== 'object') return { Columns: [], Data: [] }
  const layers = [raw, raw.data, raw.payload, raw.result, raw.response]
  for (const layer of layers) {
    if (!layer || typeof layer !== 'object' || Array.isArray(layer)) continue
    const columns = Array.isArray(layer.Columns) ? layer.Columns : []
    const data = Array.isArray(layer.Data) ? layer.Data : Array.isArray(layer.data) ? layer.data : null
    if (columns.length || data) {
      return { Columns: columns, Data: Array.isArray(data) ? data : [] }
    }
  }
  if (Array.isArray(raw) && raw.length && typeof raw[0] === 'object') {
    return { Columns: [], Data: raw }
  }
  return { Columns: [], Data: [] }
}

export function unwrapKfApiPayload(resp) {
  if (!resp || typeof resp !== 'object') return resp
  if (Array.isArray(resp.Columns) || Array.isArray(resp.Data)) return resp
  if (resp.data && typeof resp.data === 'object' && !Array.isArray(resp.data)) return resp.data
  return resp
}

export function reportPayloadFailed(payload) {
  if (payload == null) return true
  if (typeof payload !== 'object') return false
  const code = String(payload.error_code || payload.errorCode || payload._id || '')
  const message = String(payload.en_message || payload.message || payload.error || '')
  if (payload.status === 'error' || code || /KISSFLOW_ERROR|not authorized|00014/i.test(`${code} ${message}`)) {
    return true
  }
  return false
}

export async function fetchEmployeeReportPayload(kfInstance, path) {
  if (kfInstance?.api && !isLocalVitePreview()) {
    const payload = unwrapKfApiPayload(
      await kfInstance.api(path, { method: 'GET', headers: { Accept: 'application/json' } }),
    )
    if (reportPayloadFailed(payload)) {
      throw new Error(payload?.en_message || payload?.message || 'Employee report failed')
    }
    return payload
  }
  try {
    const payload = await fetchKissflowDevJson(path, { retries: 1 })
    if (reportPayloadFailed(payload)) {
      throw new Error(payload?.en_message || payload?.message || 'Employee report failed')
    }
    return payload
  } catch (firstError) {
    try {
      if (kfInstance?.api) {
        const payload = unwrapKfApiPayload(
          await kfInstance.api(path, { method: 'GET', headers: { Accept: 'application/json' } }),
        )
        if (reportPayloadFailed(payload)) throw firstError
        return payload
      }
      return kfGetJson(kfInstance, path, { allowWhenPaused: true, retries: 1 })
    } catch {
      throw firstError
    }
  }
}

export async function fetchReportPages(kfInstance, { buildPath, pageSize = 500, maxPages = 20 }) {
  const columns = []
  const rows = []
  for (let page = 1; page <= maxPages; page += 1) {
    const path = buildPath(page)
    const payload = await fetchEmployeeReportPayload(kfInstance, path)
    if (reportPayloadFailed(payload)) {
      throw new Error(payload?.en_message || payload?.message || 'Employee report failed')
    }
    const normalized = normalizeReportPayload(payload)
    if (normalized.Columns.length && !columns.length) columns.push(...normalized.Columns)
    const batch = Array.isArray(normalized.Data) ? normalized.Data : []
    rows.push(...batch)
    if (batch.length < pageSize) break
  }
  return { columns, rows }
}
