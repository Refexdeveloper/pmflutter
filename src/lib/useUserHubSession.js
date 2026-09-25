import { useContext, useEffect, useMemo, useState } from 'react';
import { KissflowSDKContext } from '../sdk/context.jsx';
import { getApiBase } from '../apiBase.js';
import { buildPmProcessApiPaths } from './kfPmMyItemsPaths.js';
import { TASKS_ENTITY } from './pmMyItemsEntities.js';
import { useTimeGreeting } from './useTimeGreeting.js';

function stringifyKfRole(abc) {
  if (!abc) return '';
  if (typeof abc === 'string') return abc.trim();
  if (Array.isArray(abc)) {
    for (const x of abc) {
      const s = stringifyKfRole(x);
      if (s) return s;
    }
    return '';
  }
  if (typeof abc === 'object') {
    const n = abc.Name ?? abc.name ?? abc._name ?? abc.Title ?? abc.title ?? abc.Role ?? abc.role ?? '';
    return String(n || '').trim();
  }
  return '';
}

function normalizeHubUser(u, prev = null) {
  if (!u) return prev;
  return {
    ...(prev || {}),
    _id: prev?._id || u._id,
    Name: prev?.Name || u.Name,
    FirstName: prev?.FirstName || u.FirstName || (u.Name && String(u.Name).split(' ')[0]) || 'User',
    Email: u.Email || u.email || prev?.Email || '',
    Role: prev?.Role || u.Role || u.Roles?.[0],
  };
}

/** Shared logged-in user session for User Hub pages. */
export function useUserHubSession() {
  const { kf: kfFromContext, sdkReady } = useContext(KissflowSDKContext);
  const kfInstance = kfFromContext ?? (typeof window !== 'undefined' ? window.kf : null);
  const taskPaths = useMemo(() => buildPmProcessApiPaths(kfInstance, TASKS_ENTITY), [kfInstance]);
  const greeting = useTimeGreeting();

  const [user, setUser] = useState(null);
  const [roleName, setRoleName] = useState('');

  useEffect(() => {
    const u = kfInstance?.user;
    if (!u) return;
    setUser((prev) => normalizeHubUser(u, prev));
    const abc = u.Role || kfInstance?.context?.user?.Role || u.Roles?.[0] || kfInstance?.context?.user?.Roles?.[0] || null;
    const resolved = String(abc?.Name || stringifyKfRole(abc) || '').trim();
    if (resolved) setRoleName(resolved);
  }, [kfInstance]);

  useEffect(() => {
    if (!taskPaths) return;
    const kf = kfInstance;
    const userId = kf?.user?._id || kf?.context?.user?._id;
    if (kf?.user?.Email || kf?.user?.email || !userId) return undefined;

    const path = taskPaths.userPathPrefix + userId + taskPaths.userPathSuffix;
    let cancelled = false;
    async function run() {
      try {
        let response;
        if (kf?.api) {
          const resp = await kf.api(path, { method: 'GET', headers: { Accept: 'application/json' } });
          response = resp?.data ?? resp ?? null;
        } else {
          const res = await fetch(getApiBase() + path, {
            method: 'GET',
            credentials: 'include',
            headers: { Accept: 'application/json' },
          });
          if (!res.ok) return;
          response = await res.json();
        }
        if (!cancelled && response && (response._id || response.Name)) setUser(response);
      } catch (e) {
        if (!cancelled) console.warn('UserHub user fetch failed:', e?.message || e);
      }
    }
    run();
    return () => { cancelled = true; };
  }, [sdkReady, taskPaths, kfInstance]);

  const scopeUser = useMemo(() => {
    if (user?._id || user?.Name) return user;
    const u = kfInstance?.user;
    if (!u) return null;
    return normalizeHubUser(u);
  }, [user, kfInstance]);

  const loginEmail = String(
    scopeUser?.Email || scopeUser?.email || kfInstance?.user?.Email || kfInstance?.user?.email || '',
  )
    .trim()
    .toLowerCase();

  const firstName = user?.FirstName || user?.Name?.split(' ')[0] || kfInstance?.user?.FirstName || 'User';
  const displayRole =
    roleName
    || user?.Role?.Name?.trim()
    || kfInstance?.user?._user_type
    || kfInstance?.user?.Groups?.[0]?.Name
    || kfInstance?.user?.Roles?.[0]?.Name
    || 'User';

  return {
    kfInstance,
    scopeUser,
    loginEmail,
    firstName,
    displayRole,
    greeting,
  };
}
