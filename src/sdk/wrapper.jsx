import KFSDK from '@kissflow/lowcode-client-sdk'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { KissflowSDKContext } from './context.jsx'
import {
  buildKissflowAccessKeyHeaders,
  getTenantAccessKeys,
  KF_ACCESS_KEY_ID,
  KF_ACCESS_KEY_SECRET,
} from '../lib/kfAccessKeys.js'
import {
  resolveKissflowApiOrigin,
  decorateKissflowHttpError,
  isLocalVitePreview,
  shouldUseLocalLiveReads,
  localLiveReadUrl,
  localLiveReadHeaders,
} from '../lib/kfRuntime.js'
import {
  clearPmIdentity,
  persistPmIdentity,
  resolveExternalIdentity,
  syntheticKissflowUser,
} from '../lib/iamIdentity.js'
import { lookupKissflowUserByEmail, lookupKissflowUserById } from '../lib/kfUserLookup.js'
import { persistDirectorySession } from '../lib/directorySession.js'
import { labelForPmRole, resolvePmRoleKey } from '../lib/pmRoles.js'
import { KF_PM_TRACKER_APP_ID, KF_PM_TRACKER_APP_NAME } from '../lib/kfPmApp.js'
import NonKissflowIdentityGate from '../components/NonKissflowIdentityGate.jsx'
import Toast from '../components/base/Toast.jsx'
import TaskDetailsHost from '../components/TaskDetailsHost.jsx'
import SubtaskDetailsHost from '../components/SubtaskDetailsHost.jsx'
import ProjectDetailsHost from '../components/ProjectDetailsHost.jsx'

let kf

const VAR_PREFIX = 'pm:kf-var:'

function emitPmToast(message, type = 'info') {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('pm-toast', { detail: { message, type } }))
}

function createLocalPreviewKf() {
  const tenant = getTenantAccessKeys(null)
  if (!tenant.defaultAccountId) {
    return null
  }

  const variableStore = {}

  return {
    account: { _id: tenant.defaultAccountId },
    user: null,
    context: {},
    client: {
      showInfo: (message) => emitPmToast(String(message || ''), 'info'),
      showError: (message) => emitPmToast(String(message || ''), 'error'),
    },
    app: {
      _id: KF_PM_TRACKER_APP_ID,
      Name: KF_PM_TRACKER_APP_NAME,
      getVariable: async (name) => {
        const key = String(name || '')
        if (variableStore[key] != null) return variableStore[key]
        try {
          return sessionStorage.getItem(`${VAR_PREFIX}${key}`)
        } catch {
          return null
        }
      },
      setVariable: async (name, value) => {
        const key = String(name || '')
        variableStore[key] = value
        try {
          sessionStorage.setItem(`${VAR_PREFIX}${key}`, typeof value === 'string' ? value : JSON.stringify(value))
        } catch {
          /* ignore */
        }
      },
      page: {},
    },
    api: async (path, options = {}) => {
      const method = options.method || 'GET'
      const employeeReport =
        String(path || '').includes('pm_external_report_A00') ||
        String(path || '').includes('pm_subtask_A00')
      const useLiveRead = method === 'GET' && shouldUseLocalLiveReads() && !employeeReport
      const useDevReport = method === 'GET' && employeeReport && isLocalVitePreview()
      const headers = {
        ...(useDevReport
          ? buildKissflowAccessKeyHeaders(KF_ACCESS_KEY_ID, KF_ACCESS_KEY_SECRET)
          : useLiveRead
            ? localLiveReadHeaders()
            : buildKissflowAccessKeyHeaders(tenant.accessKeyId, tenant.accessKeySecret, null)),
        ...(options.headers || {}),
      }
      const origin = useLiveRead || useDevReport ? '' : resolveKissflowApiOrigin(null)
      const url = useDevReport
        ? `/kf-dev${String(path || '').startsWith('/') ? path : `/${path}`}`
        : useLiveRead
          ? localLiveReadUrl(path)
          : `${origin}${path}`
      const res = await fetch(url, {
        method,
        credentials: 'omit',
        headers,
        body: options.body,
        signal: options.signal || AbortSignal.timeout(25000),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw decorateKissflowHttpError(res, data)
      }
      return { data }
    },
  }
}

function cloneKf(instance) {
  if (!instance) return instance
  return { ...instance, user: instance.user, app: instance.app, client: instance.client, account: instance.account }
}

async function attachIdentity(previewKf, identity) {
  if (!previewKf || !identity?.email) {
    return { kf: previewKf, isNonKissflowUser: true, identitySource: identity?.source || 'manual' }
  }

  let kfUser = null
  try {
    if (identity.kissflowUserId && !isLocalVitePreview()) {
      kfUser = await lookupKissflowUserById(previewKf, identity.kissflowUserId, { retries: 0 })
    }
    if (!kfUser) {
      kfUser = await lookupKissflowUserByEmail(previewKf, identity.email, {
        retries: 0,
        allowWhenPaused: true,
      })
    }
  } catch (err) {
    console.warn('Kissflow identity lookup failed:', err?.message || err)
  }

  const isNonKissflowUser = !kfUser
  const user = kfUser || syntheticKissflowUser(identity)
  const roleKey = resolvePmRoleKey(
    { _pm_role: identity.pmRole, Role: identity.title, ...user },
    'employee',
  )
  user._pm_role = roleKey
  user._user_type = labelForPmRole(roleKey)
  user.Role = { Name: labelForPmRole(roleKey) }
  user.Roles = [{ Name: labelForPmRole(roleKey) }]
  previewKf.user = user
  return {
    kf: cloneKf(previewKf),
    isNonKissflowUser,
    identitySource: kfUser ? 'kissflow-lookup' : identity.source || 'iam',
  }
}

export function SDKWrapper(props) {
  const [kfInstance, setKfInstance] = useState(null)
  const [sdkFailed, setSdkFailed] = useState(false)
  const [identityReady, setIdentityReady] = useState(false)
  const [isNonKissflowUser, setIsNonKissflowUser] = useState(false)
  const [identitySource, setIdentitySource] = useState(null)
  const [bootError, setBootError] = useState('')
  const [booting, setBooting] = useState(true)
  const [toasts, setToasts] = useState([])

  const pushToast = useCallback((message, type = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    setToasts((prev) => [...prev, { id, message, type }])
  }, [])

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  useEffect(() => {
    const onToast = (event) => {
      const message = event?.detail?.message
      if (!message) return
      pushToast(message, event.detail.type || 'info')
    }
    window.addEventListener('pm-toast', onToast)
    return () => window.removeEventListener('pm-toast', onToast)
  }, [pushToast])

  const applyBound = useCallback((bound, failed) => {
    window.kf = kf = bound.kf
    setKfInstance(bound.kf)
    setIsNonKissflowUser(Boolean(bound.isNonKissflowUser))
    setIdentitySource(bound.identitySource)
    setSdkFailed(failed)
    setIdentityReady(Boolean(bound.kf?.user?.Email))
  }, [])

  const continueWithIdentity = useCallback(async (rawIdentity) => {
    const identity = persistPmIdentity(rawIdentity)
    if (!identity) throw new Error('Email is required')
    const previewKf = kfInstance || createLocalPreviewKf()
    if (!previewKf) {
      throw new Error('Kissflow account is not configured.')
    }
    const bound = await attachIdentity(previewKf, identity)
    applyBound(bound, true)
    if (rawIdentity?.source === 'user-master') {
      pushToast(`Signed in from User Master as ${identity.name}.`, 'info')
    } else if (bound.isNonKissflowUser) {
      pushToast('Continuing as a non-Kissflow user. Projects and tasks are matched by your email.', 'info')
    }
  }, [applyBound, kfInstance, pushToast])

  const switchExternalIdentity = useCallback(() => {
    clearPmIdentity()
    persistDirectorySession('')
    if (kf) kf.user = null
    setIdentityReady(false)
    setIsNonKissflowUser(false)
    setIdentitySource(null)
    setSdkFailed(true)
  }, [])

  const applyPmWorkspaceRole = useCallback((roleKey) => {
    const key = resolvePmRoleKey({ _pm_role: roleKey }, 'employee')
    const label = labelForPmRole(key)
    if (!kf) return
    const email = String(kf.user?.Email || kf.user?.email || '').trim()
    if (email) {
      persistPmIdentity({
        email,
        name: kf.user?.Name || '',
        title: label,
        pmRole: key,
        kissflowUserId: kf.user?._external ? '' : kf.user?._id,
        source: 'manual',
      })
    }
    kf.user = {
      ...(kf.user || {}),
      Role: { Name: label },
      Roles: [{ Name: label }],
      _pm_role: key,
      _user_type: label,
    }
    setKfInstance(cloneKf(kf))
  }, [])

  useEffect(() => {
    let cancelled = false

    async function boot() {
      setBooting(true)
      const existing = typeof window !== 'undefined' ? window.kf : null
      const looksLikeRealSdk = Boolean(existing?.user?.Email && existing?.app?.page?.openPopup)

      if (looksLikeRealSdk) {
        kf = existing
        if (!cancelled) {
          setKfInstance(existing)
          setSdkFailed(false)
          setIsNonKissflowUser(false)
          setIdentitySource('kissflow-sdk')
          setIdentityReady(true)
          setBooting(false)
        }
        return
      }

      try {
        const sdk = await Promise.race([
          KFSDK.initialize(),
          new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Kissflow SDK init timeout')), 2500)
          }),
        ])
        if (cancelled) return
        if (isLocalVitePreview() && !String(sdk?.user?.Email || '').trim()) {
          throw new Error('Local preview has no Kissflow user')
        }
        window.kf = kf = sdk
        setKfInstance(sdk)
        setSdkFailed(false)
        setIsNonKissflowUser(false)
        setIdentitySource('kissflow-sdk')
        setIdentityReady(Boolean(sdk?.user?.Email))
        setBooting(false)
        return
      } catch (err) {
        console.warn('SDK not available (standalone / non-Kissflow mode):', err?.message || err)
      }

      const previewKf = createLocalPreviewKf()
      if (!previewKf) {
        if (!cancelled) {
          setSdkFailed(true)
          setBootError('Kissflow access keys are not configured. Add them to .env to run outside Kissflow.')
          setIdentityReady(false)
          setBooting(false)
        }
        return
      }

      try {
        const identity = await resolveExternalIdentity()
        if (cancelled) return
        if (!identity) {
          window.kf = kf = previewKf
          setKfInstance(previewKf)
          setSdkFailed(true)
          setIdentityReady(false)
          setBooting(false)
          return
        }
        const bound = await attachIdentity(previewKf, identity)
        if (!cancelled) {
          applyBound(bound, true)
          setBooting(false)
        }
      } catch (err) {
        if (!cancelled) {
          window.kf = kf = previewKf
          setKfInstance(previewKf)
          setSdkFailed(true)
          setBootError(err?.message || 'Could not resolve user identity')
          setIdentityReady(false)
          setBooting(false)
        }
      }
    }

    boot()
    return () => {
      cancelled = true
    }
  }, [applyBound])

  const contextValue = useMemo(
    () => ({
      kf: kfInstance,
      sdkReady: Boolean(kfInstance && identityReady),
      sdkFailed,
      isNonKissflowUser,
      identityReady,
      identitySource,
      switchExternalIdentity,
      applyPmWorkspaceRole,
    }),
    [kfInstance, sdkFailed, isNonKissflowUser, identityReady, identitySource, switchExternalIdentity, applyPmWorkspaceRole],
  )

  const showGate = !booting && sdkFailed && !identityReady

  return (
    <KissflowSDKContext.Provider value={contextValue}>
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
      {booting ? (
        <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-slate-500">
          <i className="ri-loader-4-line mr-2 animate-spin" aria-hidden />
          Starting Project Management…
        </div>
      ) : showGate ? (
        <NonKissflowIdentityGate onContinue={continueWithIdentity} error={bootError} />
      ) : (
        <>
          {sdkFailed && (
            <div
              className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-2 px-4 py-2 text-center text-xs ${
                isNonKissflowUser
                  ? 'bg-sky-50 text-sky-900'
                  : 'bg-amber-50 text-amber-900'
              }`}
              data-testid="pm-standalone-banner"
            >
              <span className="max-w-full">
                {identitySource === 'user-master' || kfInstance?.user?._identity_source === 'user-master'
                  ? 'Signed in from Refex One User Master.'
                  : isNonKissflowUser
                    ? 'Non-Kissflow user — Project Management is running like ITSM in-app mode. Items are matched by your work email.'
                    : 'Standalone mode — connected with access keys (not inside a Kissflow page).'}
                {kfInstance?.user?.Email ? ` Signed in as ${kfInstance.user.Email}.` : ''}
              </span>
              <span className="inline-flex min-h-8 items-center font-semibold" data-testid="pm-role-label">
                {labelForPmRole(resolvePmRoleKey(kfInstance?.user, 'employee'))}
              </span>
              <button
                type="button"
                onClick={switchExternalIdentity}
                className="inline-flex min-h-8 items-center px-2 font-semibold underline-offset-2 hover:underline"
              >
                Switch user
              </button>
            </div>
          )}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            {props.children}
          </div>
          <TaskDetailsHost />
          <ProjectDetailsHost />
          <SubtaskDetailsHost />
        </>
      )}
      <Toast toasts={toasts} onRemove={removeToast} />
      </div>
    </KissflowSDKContext.Provider>
  )
}
export { kf }

