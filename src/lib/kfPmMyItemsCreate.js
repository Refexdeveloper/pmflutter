/**
 * Create a Kissflow process draft, then open popup with InstanceID / ActivityInstanceID.
 * Same pattern as ProjectDashboardPage createTaskInstance → openPopup.
 */

import { kfMutateJson, kfGetJson, resolveKissflowAccountId, isAuthError, isLocalVitePreview } from './kfRuntime.js'
import {
  getTenantAccessKeys,
  KF_DEV_ACCOUNT_ID,
  KF_ACCESS_KEY_ID,
  KF_ACCESS_KEY_SECRET,
  KF_LIVE_ACCOUNT_ID,
  KF_LIVE_ACCESS_KEY_ID,
  KF_LIVE_ACCESS_KEY_SECRET,
  buildKissflowAccessKeyHeaders,
} from './kfAccessKeys.js'
import { KF_PM_TRACKER_APP_ID } from './kfPmApp.js'
import { resolvePmPopupId } from './kfPmMyItemsPaths.js'
import { sourceFromEntity, submitPmCreateWebhook } from './pmCreateWebhook.js'
import { sanitizeCreateFields, sanitizeProcessUpdateFields } from './pmCreatePayload.js'
import { rememberCreatedFromWebhook } from './pmLocalCreated.js'

function unwrapKfCreateResponse(resp) {
  const layer1 = resp?.data ?? resp ?? {}
  const layer2 = layer1?.data ?? layer1
  return layer2 && typeof layer2 === 'object' ? layer2 : layer1
}

export function parseProcessCreateIds(resp) {
  const data = unwrapKfCreateResponse(resp)
  const instanceId = String(data?._id || '').trim()
  const activityRaw = data?._activity_instance_id ?? data?.activityInstanceId ?? data?.ActivityInstanceID
  const activityInstanceId = Array.isArray(activityRaw)
    ? String(activityRaw[0] || '').trim()
    : String(activityRaw || '').trim()
  return { instanceId, activityInstanceId, raw: data }
}

function draftBodyForApi(body) {
  if (!body || typeof body !== 'object') return {}
  const out = {}
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined || value === null || value === '') continue
    out[key] = value
  }
  return out
}

/** POST process draft; on 401 (dev keys) create via the public webhook instead. */
export async function createPmProcessDraft(kfInstance, entity, body = {}) {
  if (!entity?.processId) throw new Error('Missing processId for draft create')
  const accountId = resolveKissflowAccountId(kfInstance, entity.accountFallback)
  if (!accountId) throw new Error('Kissflow account not ready')

  const appId = String(entity.applicationIdFallback || 'Project_Management_A01').trim()
  const path =
    `/process/2/${accountId}/${entity.processId}` +
    (appId ? `?_application_id=${encodeURIComponent(appId)}` : '')

  const tenant = getTenantAccessKeys(kfInstance)
  const useWebhookOnly = tenant.tenant === 'dev' && isLocalVitePreview()

  let created = { instanceId: '', activityInstanceId: '', raw: null, webhookOnly: false }

  if (!useWebhookOnly) {
    try {
      const raw = await kfMutateJson(kfInstance, path, {
        method: 'POST',
        body: {},
        preferSessionAuth: true,
      })
      const parsed = parseProcessCreateIds(raw)
      if (parsed.raw?.status === 'error' || parsed.raw?.error_code) {
        throw new Error(parsed.raw.en_message || parsed.raw.message || 'Kissflow create failed')
      }
      if (!parsed.instanceId) {
        throw new Error(`${entity.labels?.entitySingular || 'Item'} create API did not return an id`)
      }
      created = { ...parsed, webhookOnly: false }
    } catch (error) {
      if (!isAuthError(error)) throw error
      created.webhookOnly = true
    }
  } else {
    created.webhookOnly = true
  }

  const source = sourceFromEntity(entity) || 'task'
  const fields = sanitizeCreateFields(source, body)

  if (!created.webhookOnly) {
    rememberCreatedFromWebhook(source, { fields, created })
    return created
  }

  const webhook = await submitPmCreateWebhook(kfInstance, source, {
    fields,
    created,
    required: true,
  })

  if (!webhook) {
    const label = entity?.labels?.entitySingular || 'item'
    throw new Error(`Could not create the ${String(label).toLowerCase()} on the development webhook.`)
  }

  const result = { ...created, raw: created.raw || webhook }
  rememberCreatedFromWebhook(source, { fields, created: result })
  return result
}

/**
 * PUT /process/2/{account}/{process}/{instanceId}/{activityId}?_application_id=Project_Management_Tracker_A00
 * Instance ID and activity instance ID come from the report/list row.
 * Body always includes `_id` (same as Kissflow's update sample).
 */
export function buildProcessItemUpdatePath(accountId, processId, instanceId, activityInstanceId, applicationId = KF_PM_TRACKER_APP_ID) {
  const account = String(accountId || '').trim()
  const process = String(processId || '').trim()
  const id = encodeURIComponent(String(instanceId || '').trim())
  const activity = encodeURIComponent(String(activityInstanceId || '').trim())
  const app = encodeURIComponent(String(applicationId || KF_PM_TRACKER_APP_ID).trim())
  return `/process/2/${account}/${process}/${id}/${activity}?_application_id=${app}`
}

export function processUpdateBody(instanceId, fields = {}) {
  return {
    _id: String(instanceId || '').trim(),
    ...draftBodyForApi(fields),
  }
}

function buildAdminProcessItemUpdatePath(accountId, processId, instanceId, applicationId = KF_PM_TRACKER_APP_ID) {
  const account = String(accountId || '').trim()
  const process = String(processId || '').trim()
  const id = encodeURIComponent(String(instanceId || '').trim())
  const app = encodeURIComponent(String(applicationId || KF_PM_TRACKER_APP_ID).trim())
  return `/process/2/${account}/admin/${process}/${id}?_application_id=${app}`
}

export function buildAdminProcessItemCompletePath(accountId, processId, instanceId, applicationId = KF_PM_TRACKER_APP_ID) {
  const account = String(accountId || '').trim()
  const process = String(processId || '').trim()
  const id = encodeURIComponent(String(instanceId || '').trim())
  const app = encodeURIComponent(String(applicationId || KF_PM_TRACKER_APP_ID).trim())
  return `/process/2/${account}/admin/${process}/${id}/complete?_application_id=${app}`
}

function buildProcessProgressPath(accountId, processId, instanceId, applicationId = KF_PM_TRACKER_APP_ID) {
  const account = String(accountId || '').trim()
  const process = String(processId || '').trim()
  const id = encodeURIComponent(String(instanceId || '').trim())
  const app = encodeURIComponent(String(applicationId || KF_PM_TRACKER_APP_ID).trim())
  return `/process/2/${account}/${process}/${id}/progress?_application_id=${app}`
}

function currentProgressStep(payload) {
  const steps = Array.isArray(payload?.Steps) ? payload.Steps : []
  return (
    steps.find((step) => {
      const status = String(step?.Status || step?._status || '').toLowerCase()
      return status === 'inprogress' || status === 'in progress'
    }) || steps.find((step) => step?._activity_instance_id) || null
  )
}

function activityIdFromProgress(payload) {
  const step = currentProgressStep(payload)
  const raw = step?._activity_instance_id || ''
  return String(Array.isArray(raw) ? raw[0] : raw || '').trim()
}

function isAppRoleAssignee(value) {
  const people = Array.isArray(value) ? value : value ? [value] : []
  return people.some((person) => {
    const kind = String(person?.Kind || person?.kind || '').toLowerCase()
    const id = String(person?._id || '').trim()
    return kind === 'approle' || /^Ro[A-Za-z0-9]+$/.test(id)
  })
}

async function putJsonThroughProxy(proxyPrefix, path, body, keyId, keySecret) {
  const res = await fetch(`${proxyPrefix}${path}`, {
    method: 'PUT',
    credentials: 'omit',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...buildKissflowAccessKeyHeaders(keyId, keySecret),
    },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data?.en_message || data?.message || `HTTP ${res.status}`)
  }
  if (data?.status === 'error' || data?.error_code) {
    throw new Error(data.en_message || data.message || 'Kissflow update failed')
  }
  return data
}

async function getJsonThroughProxy(proxyPrefix, path, keyId, keySecret) {
  const res = await fetch(`${proxyPrefix}${path}`, {
    method: 'GET',
    credentials: 'omit',
    headers: {
      Accept: 'application/json',
      ...buildKissflowAccessKeyHeaders(keyId, keySecret),
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data?.en_message || data?.message || `HTTP ${res.status}`)
  }
  return data
}

async function loadProcessProgress(proxyPrefix, accountId, processId, instanceId, keyId, keySecret) {
  return getJsonThroughProxy(
    proxyPrefix,
    buildProcessProgressPath(accountId, processId, instanceId),
    keyId,
    keySecret,
  )
}

async function resolveActivityInstanceId(
  proxyPrefix,
  accountId,
  processId,
  instanceId,
  knownActivityId,
  keyId,
  keySecret,
  preferCurrent = false,
) {
  if (!preferCurrent) {
    const known = String(knownActivityId || '').trim()
    if (known) return known
  }
  try {
    const payload = await loadProcessProgress(proxyPrefix, accountId, processId, instanceId, keyId, keySecret)
    return activityIdFromProgress(payload) || String(knownActivityId || '').trim()
  } catch {
    return String(knownActivityId || '').trim()
  }
}

function localProcessTenants() {
  return [
    {
      name: 'dev',
      proxy: '/kf-dev',
      accountId: KF_DEV_ACCOUNT_ID,
      keyId: KF_ACCESS_KEY_ID,
      keySecret: KF_ACCESS_KEY_SECRET,
    },
    {
      name: 'live',
      proxy: '/kf-live',
      accountId: KF_LIVE_ACCOUNT_ID,
      keyId: KF_LIVE_ACCESS_KEY_ID,
      keySecret: KF_LIVE_ACCESS_KEY_SECRET,
    },
  ].filter((tenant) => tenant.accountId && tenant.keyId && tenant.keySecret)
}

function orderProcessTenants(preferredAccountId) {
  const tenants = localProcessTenants()
  const preferred = String(preferredAccountId || '').trim()
  if (!preferred) return tenants
  return [...tenants].sort((a, b) => Number(b.accountId === preferred) - Number(a.accountId === preferred))
}

async function tenantHasProcessItem(tenant, processId, instanceId) {
  try {
    const data = await getJsonThroughProxy(
      tenant.proxy,
      `/process/2/${tenant.accountId}/admin/${processId}/${encodeURIComponent(instanceId)}?_application_id=${encodeURIComponent(KF_PM_TRACKER_APP_ID)}`,
      tenant.keyId,
      tenant.keySecret,
    )
    const foundId = String(data?._id || data?.data?._id || '').trim()
    return foundId === String(instanceId || '').trim() || Boolean(data?._status || data?.Task_Status)
  } catch {
    return false
  }
}

async function locateProcessTenant(processId, instanceId, preferredAccountId) {
  const tenants = orderProcessTenants(preferredAccountId)
  for (const tenant of tenants) {
    if (await tenantHasProcessItem(tenant, processId, instanceId)) return tenant
  }
  return null
}

export function processItemText(item, ...keys) {
  if (!item || typeof item !== 'object') return ''
  for (const key of keys) {
    const value = item[key]
    if (value == null || value === '') continue
    const text =
      typeof value === 'object'
        ? String(value.Name || value.name || value.Value || value.value || '').trim()
        : String(value).trim()
    if (text && text !== '—') return text
  }
  return ''
}

export function processItemComments(item) {
  return processItemText(item, 'Comments', 'comments', 'Comment')
}

/** GET admin process item — same path as update. Report lists often omit Comments. */
export async function loadPmProcessItem(kfInstance, entity, ids = {}) {
  const instanceId = String(ids.instanceId || ids.InstanceID || ids._id || '').trim()
  if (!instanceId || !entity?.processId) return null
  const preferredAccountId = String(ids.accountId || ids.kfAccountId || '').trim()

  if (isLocalVitePreview()) {
    const tenant =
      (await locateProcessTenant(entity.processId, instanceId, preferredAccountId || KF_DEV_ACCOUNT_ID)) ||
      orderProcessTenants(preferredAccountId || KF_DEV_ACCOUNT_ID)[0]
    if (!tenant) return null
    const raw = await getJsonThroughProxy(
      tenant.proxy,
      buildAdminProcessItemUpdatePath(tenant.accountId, entity.processId, instanceId),
      tenant.keyId,
      tenant.keySecret,
    )
    return unwrapKfCreateResponse(raw)
  }

  const accountId = resolveKissflowAccountId(kfInstance, entity.accountFallback)
  if (!accountId) return null
  const raw = await kfGetJson(
    kfInstance,
    buildAdminProcessItemUpdatePath(accountId, entity.processId, instanceId),
    { allowWhenPaused: true },
  )
  return unwrapKfCreateResponse(raw)
}

async function putProcessItemThroughProxy(proxyPrefix, accountId, processId, instanceId, activityId, fields, keyId, keySecret) {
  const body = processUpdateBody(instanceId, fields)
  // Local access keys are not in the Open/BOT queue. Activity PUT is 404 / 050201.
  // Save fields on the admin item; submit is a separate step when the queue allows it.
  return putJsonThroughProxy(
    proxyPrefix,
    buildAdminProcessItemUpdatePath(accountId, processId, instanceId),
    body,
    keyId,
    keySecret,
  )
}

/** Update an existing process item, or create when no instance id is present. */
export async function savePmProcessItem(kfInstance, entity, body = {}, ids = {}) {
  const instanceId = String(ids.instanceId || ids.InstanceID || ids._id || '').trim()
  if (!instanceId) return createPmProcessDraft(kfInstance, entity, body)

  const source = sourceFromEntity(entity) || 'task'
  const fields = sanitizeProcessUpdateFields(source, body)
  const activityId = String(
    ids.activityInstanceId || ids.activityId || ids.ActivityID || ids._activity_instance_id || '',
  ).trim()
  const preferredAccountId = String(ids.accountId || ids.kfAccountId || '').trim()

  let parsedRaw = null

  if (isLocalVitePreview()) {
    const tenant =
      (await locateProcessTenant(entity.processId, instanceId, preferredAccountId || KF_DEV_ACCOUNT_ID)) ||
      orderProcessTenants(preferredAccountId || KF_DEV_ACCOUNT_ID)[0]
    if (!tenant) throw new Error('Kissflow account not ready')
    parsedRaw = unwrapKfCreateResponse(
      await putProcessItemThroughProxy(
        tenant.proxy,
        tenant.accountId,
        entity.processId,
        instanceId,
        activityId,
        fields,
        tenant.keyId,
        tenant.keySecret,
      ),
    )
  } else {
    const accountId = resolveKissflowAccountId(kfInstance, entity.accountFallback)
    if (!accountId) throw new Error('Kissflow account not ready')
    const updateBody = processUpdateBody(instanceId, fields)
    const tryPut = async (path) => {
      const raw = await kfMutateJson(kfInstance, path, {
        method: 'PUT',
        body: updateBody,
        preferSessionAuth: true,
      })
      const parsed = unwrapKfCreateResponse(raw)
      if (parsed?.status === 'error' || parsed?.error_code) {
        throw new Error(parsed.en_message || parsed.message || 'Kissflow update failed')
      }
      return parsed
    }
    try {
      if (!activityId) throw new Error('missing activity')
      parsedRaw = await tryPut(
        buildProcessItemUpdatePath(accountId, entity.processId, instanceId, activityId, KF_PM_TRACKER_APP_ID),
      )
    } catch {
      parsedRaw = await tryPut(
        buildAdminProcessItemUpdatePath(accountId, entity.processId, instanceId, KF_PM_TRACKER_APP_ID),
      )
    }
  }

  const updated = {
    instanceId,
    activityInstanceId: activityId,
    raw: parsedRaw,
    webhookOnly: false,
  }
  rememberCreatedFromWebhook(source, { fields, created: updated })
  return updated
}

export function buildProcessItemSubmitPath(accountId, processId, instanceId, activityInstanceId, applicationId = KF_PM_TRACKER_APP_ID, comment = '') {
  const account = String(accountId || '').trim()
  const process = String(processId || '').trim()
  const id = encodeURIComponent(String(instanceId || '').trim())
  const activity = encodeURIComponent(String(activityInstanceId || '').trim())
  const app = encodeURIComponent(String(applicationId || KF_PM_TRACKER_APP_ID).trim())
  const note = String(comment || '').trim()
  const extra = note ? `&_comments=${encodeURIComponent(note)}` : ''
  return `/process/2/${account}/${process}/${id}/${activity}/submit?_application_id=${app}${extra}`
}

export function isProcessCompleteStatus(value) {
  return /complete|closed|done/i.test(String(value || ''))
}

async function postJsonThroughProxy(proxyPrefix, path, body, keyId, keySecret) {
  const res = await fetch(`${proxyPrefix}${path}`, {
    method: 'POST',
    credentials: 'omit',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...buildKissflowAccessKeyHeaders(keyId, keySecret),
    },
    body: JSON.stringify(body ?? {}),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data?.en_message || data?.message || `HTTP ${res.status}`)
  }
  if (data?.status === 'error' || data?.error_code) {
    throw new Error(data.en_message || data.message || 'Kissflow submit failed')
  }
  return data
}

/**
 * Same Kissflow process submit used by IT Service (`.../{instance}/{activity}/submit`).
 * Does not invent a new API. Queue/permission failures are returned, not thrown.
 */
function processSubmitBody(instanceId, comment = '') {
  const text = String(comment || '').trim()
  return {
    _id: String(instanceId || '').trim(),
    ...(text ? { _comments: text } : {}),
  }
}

export async function submitPmProcessItem(kfInstance, entity, ids = {}) {
  const instanceId = String(ids.instanceId || ids.InstanceID || ids._id || '').trim()
  if (!instanceId || !entity?.processId) return { ok: false, reason: 'missing-ids' }

  const preferredAccountId = String(ids.accountId || ids.kfAccountId || '').trim()
  const comment = String(ids.comment || ids._comments || '').trim()
  let activityId = String(
    ids.activityInstanceId || ids.activityId || ids.ActivityID || ids._activity_instance_id || '',
  ).trim()
  const submitBody = processSubmitBody(instanceId, comment)

  try {
    if (isLocalVitePreview()) {
      const tenant =
        (await locateProcessTenant(entity.processId, instanceId, preferredAccountId || KF_DEV_ACCOUNT_ID)) ||
        orderProcessTenants(preferredAccountId || KF_DEV_ACCOUNT_ID)[0]
      if (!tenant) return { ok: false, reason: 'no-tenant' }
      let progress = null
      try {
        progress = await loadProcessProgress(
          tenant.proxy,
          tenant.accountId,
          entity.processId,
          instanceId,
          tenant.keyId,
          tenant.keySecret,
        )
      } catch {
        progress = null
      }
      const step = currentProgressStep(progress)
      activityId = activityIdFromProgress(progress) || activityId
      if (isAppRoleAssignee(step?.AssignedTo || step?.Assigned_To || progress?._current_assigned_to)) {
        return { ok: false, reason: 'assigned-to-bot', instanceId, activityInstanceId: activityId, skippedRole: true }
      }
      if (!activityId) return { ok: false, reason: 'missing-activity' }
      const raw = await postJsonThroughProxy(
        tenant.proxy,
        buildProcessItemSubmitPath(tenant.accountId, entity.processId, instanceId, activityId, KF_PM_TRACKER_APP_ID, comment),
        submitBody,
        tenant.keyId,
        tenant.keySecret,
      )
      return { ok: true, instanceId, activityInstanceId: activityId, raw }
    }

    const accountId = resolveKissflowAccountId(kfInstance, entity.accountFallback)
    if (!accountId) return { ok: false, reason: 'no-account' }
    if (!activityId) return { ok: false, reason: 'missing-activity' }
    const raw = await kfMutateJson(kfInstance, buildProcessItemSubmitPath(accountId, entity.processId, instanceId, activityId, KF_PM_TRACKER_APP_ID, comment), {
      method: 'POST',
      body: submitBody,
      preferSessionAuth: true,
    })
    const parsed = unwrapKfCreateResponse(raw)
    if (parsed?.status === 'error' || parsed?.error_code) {
      throw new Error(parsed.en_message || parsed.message || 'Kissflow submit failed')
    }
    return { ok: true, instanceId, activityInstanceId: activityId, raw: parsed }
  } catch (error) {
    const message = String(error?.message || '')
    if (/404|not found|out of your queue|could not be located|01015|050201|00137|authorized/i.test(message)) {
      return { ok: false, reason: message, instanceId, activityInstanceId: activityId }
    }
    return { ok: false, reason: message, instanceId, activityInstanceId: activityId }
  }
}

/** After REST draft create: write fields, then submit Start so the item leaves Draft. */
export async function finalizePmProcessCreate(kfInstance, entity, body = {}, created = {}) {
  if (!created?.instanceId || created.webhookOnly) return created
  const saved = await savePmProcessItem(kfInstance, entity, body, {
    instanceId: created.instanceId,
    activityId: created.activityInstanceId,
    accountId: created.accountId,
  })
  const submitted = await submitPmProcessItem(kfInstance, entity, {
    instanceId: saved.instanceId,
    activityId: saved.activityInstanceId || created.activityInstanceId,
    accountId: created.accountId,
  })
  return { ...saved, submitted: submitted.ok, submit: submitted }
}

/**
 * Admin complete — used when Open is assigned to BOT and activity /submit returns 050201.
 * POST /process/2/{account}/admin/{process}/{instance}/complete
 */
async function adminCompletePmProcessItem(kfInstance, entity, ids = {}) {
  const instanceId = String(ids.instanceId || ids.InstanceID || ids._id || '').trim()
  if (!instanceId || !entity?.processId) return { ok: false, reason: 'missing-ids' }
  const preferredAccountId = String(ids.accountId || ids.kfAccountId || '').trim()
  const comment = String(ids.comment || ids._comments || '').trim()
  const body = processSubmitBody(instanceId, comment)

  try {
    if (isLocalVitePreview()) {
      const tenant =
        (await locateProcessTenant(entity.processId, instanceId, preferredAccountId || KF_DEV_ACCOUNT_ID)) ||
        orderProcessTenants(preferredAccountId || KF_DEV_ACCOUNT_ID)[0]
      if (!tenant) return { ok: false, reason: 'no-tenant' }
      const raw = await postJsonThroughProxy(
        tenant.proxy,
        buildAdminProcessItemCompletePath(tenant.accountId, entity.processId, instanceId),
        body,
        tenant.keyId,
        tenant.keySecret,
      )
      return { ok: true, instanceId, raw, adminCompleted: true }
    }

    const accountId = resolveKissflowAccountId(kfInstance, entity.accountFallback)
    if (!accountId) return { ok: false, reason: 'no-account' }
    const raw = await kfMutateJson(
      kfInstance,
      buildAdminProcessItemCompletePath(accountId, entity.processId, instanceId),
      { method: 'POST', body, preferSessionAuth: true },
    )
    const parsed = unwrapKfCreateResponse(raw)
    if (parsed?.status === 'error' || parsed?.error_code) {
      throw new Error(parsed.en_message || parsed.message || 'Kissflow admin complete failed')
    }
    return { ok: true, instanceId, raw: parsed, adminCompleted: true }
  } catch (error) {
    return { ok: false, reason: String(error?.message || 'admin complete failed'), instanceId }
  }
}

/** PUT status + comments, then submit Open — or admin-complete when Open is with BOT. */
export async function completePmProcessItem(kfInstance, entity, body = {}, ids = {}) {
  const comment = String(ids.comment || ids._comments || body._comments || '').trim()
  if (!comment) {
    throw new Error('Comments are required to move this item to Completed in Kissflow.')
  }
  const source = sourceFromEntity(entity) || 'task'
  const statusField = source === 'subtask' ? 'TStatus' : 'Task_Status'
  const saved = await savePmProcessItem(
    kfInstance,
    entity,
    { ...body, [statusField]: 'Completed', Comments: comment },
    ids,
  )
  const submitIds = {
    instanceId: saved.instanceId,
    activityId: saved.activityInstanceId || ids.activityId || ids.activityInstanceId,
    accountId: ids.accountId,
    comment,
  }
  const submitted = await submitPmProcessItem(kfInstance, entity, submitIds)
  if (submitted.ok) {
    return { ...saved, submitted: true, submit: submitted }
  }

  const adminCompleted = await adminCompletePmProcessItem(kfInstance, entity, submitIds)
  if (adminCompleted.ok) {
    return { ...saved, submitted: true, submit: adminCompleted, adminCompleted: true }
  }

  if (!submitted.skippedRole && !/out of your queue|050201/i.test(String(submitted.reason || ''))) {
    throw new Error(
      submitted.reason ||
        adminCompleted.reason ||
        'Kissflow did not move this item to Completed. Comments are required on the Open step.',
    )
  }
  throw new Error(
    adminCompleted.reason ||
      submitted.reason ||
      'Kissflow did not move this item to Completed. The Open step is with BOT and admin complete failed.',
  )
}

/** POST /case/2/{account}/{caseId} → { instanceId } */
export async function createPmCaseDraft(kfInstance, entity, body = {}) {
  if (!entity?.caseId) throw new Error('Missing caseId for case create')
  const accountId = resolveKissflowAccountId(kfInstance, entity.accountFallback)
  if (!accountId) throw new Error('Kissflow account not ready')

  const tenant = getTenantAccessKeys(kfInstance)
  const useWebhookOnly = tenant.tenant === 'dev' && isLocalVitePreview()
  const fields = sanitizeCreateFields('project', body)
  let created = { instanceId: '', raw: null, webhookOnly: false }

  if (!useWebhookOnly) {
    try {
      const path = `/case/2/${accountId}/${entity.caseId}`
      const raw = await kfMutateJson(kfInstance, path, {
        method: 'POST',
        body: draftBodyForApi(fields),
        preferSessionAuth: true,
      })

      const parsedRaw = unwrapKfCreateResponse(raw)
      const instanceId = String(parsedRaw?._id || parsedRaw?._item_id || '').trim()

      if (parsedRaw?.status === 'error' || parsedRaw?.error_code) {
        throw new Error(parsedRaw.en_message || parsedRaw.message || 'Kissflow create failed')
      }
      if (!instanceId) {
        throw new Error(`${entity.labels?.entitySingular || 'Project'} create API did not return an id`)
      }
      created = { instanceId, raw: parsedRaw, webhookOnly: false }
    } catch (error) {
      if (!isAuthError(error)) throw error
      created.webhookOnly = true
    }
  } else {
    created.webhookOnly = true
  }

  if (!created.webhookOnly) {
    rememberCreatedFromWebhook('project', { fields, created })
    return created
  }

  const webhook = await submitPmCreateWebhook(kfInstance, 'project', {
    fields,
    created,
    required: true,
  })
  if (!webhook) {
    throw new Error('Could not create the project on the development webhook.')
  }

  const result = { ...created, raw: created.raw || webhook }
  rememberCreatedFromWebhook('project', { fields, created: result })
  return result
}

/** Row open / view details — InstanceID + ActivityInstanceID (+ size). */
export function buildPmPopupParams(entity, instanceId, activityInstanceId, extra = {}) {
  const instanceKey = entity?.popupParamKeys?.instanceId || 'InstanceID'
  const activityKey = entity?.popupParamKeys?.activityInstanceId || 'ActivityInstanceID'
  const id = String(instanceId || '').trim()
  const aid = String(activityInstanceId || '').trim()
  return {
    [instanceKey]: id,
    [activityKey]: aid,
    InstanceID: id,
    ActivityInstanceID: aid,
    width: 960,
    height: 720,
    popupWidth: '960px',
    popupHeight: '720px',
    ...extra,
  }
}

/**
 * New Task / New Subtask button:
 * 1) POST draft on entity.processId
 * 2) openPopup(entity.popupId, { InstanceID, ActivityInstanceID })
 *    — Tasks: Popup_bEJJgrdutd · Subtasks: Popup_QTJQAyhxOR
 */
function draftBodyForUser(_kfInstance, entity) {
  return { ...(entity?.createDraftBody || {}) }
}

export async function openPmNewItemPopup(kfInstance, entity) {
  const popupId = resolvePmPopupId(entity)
  if (!popupId) throw new Error('Missing popup id')
  if (entity?.kind !== 'process' || !entity?.processId) {
    throw new Error('openPmNewItemPopup requires a process entity')
  }

  const created = await createPmProcessDraft(kfInstance, entity, draftBodyForUser(kfInstance, entity))
  const canPopup = typeof kfInstance?.app?.page?.openPopup === 'function'

  // Non-Kissflow / standalone: still create the draft (ITSM webhook pattern).
  if (!canPopup) {
    const label = entity?.labels?.entitySingular || 'Item'
    kfInstance?.client?.showInfo?.(
      `${label} draft created${created.instanceId ? ` (${created.instanceId})` : ''}. Open it in Kissflow if you need the full form.`,
    )
    return { ...created, popupId: null, localOnly: true }
  }

  const instanceKey = entity?.popupParamKeys?.instanceId || 'InstanceID'
  const activityKey = entity?.popupParamKeys?.activityInstanceId || 'ActivityInstanceID'
  const params = {
    [instanceKey]: created.instanceId,
    [activityKey]: created.activityInstanceId,
  }

  const p = kfInstance.app.page.openPopup(popupId, params)
  // Fire-and-forget: awaiting hangs after popup close in some Kissflow hosts.
  if (p && typeof p.catch === 'function') {
    p.catch((err) => console.warn('openPmNewItemPopup failed:', err))
  }
  return { ...created, popupId }
}
