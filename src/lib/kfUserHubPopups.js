/**
 * Kissflow popup open helpers — User Hub only.
 * UserHubProjectsProject:  Popup_Xrl9X_fXTJ (CaseID)
 * UserHubTasksProject:     Popup_8POjXW0UE8 (ActivityID, InstanceID) — tasks
 * UserHubTasksProject:     Popup_WbcLURdUXx (ActivityID, InstanceID) — nested subtasks (tasks page only)
 * UserHubSubTasksProject:  Popup_djVrj_A4yG (ActivityID, InstanceID) — Sub_Task_Process_A00
 *
 * Optional `options.onClosed` runs when openPopup's promise settles (if Kissflow resolves it).
 * Prefer page-level `context.watchParams` for reliable post-action refresh — openPopup often never resolves.
 */

import { createPmProcessDraft } from './kfPmMyItemsCreate.js';
import { SUBTASKS_ENTITY } from './pmMyItemsEntities.js';
import { requestOpenProjectDetails } from './pmProjectDetails.js';
import { requestOpenTaskDetails } from './pmTaskDetails.js';
import { requestOpenSubtaskDetails } from './pmSubtaskDetails.js';
import { taskRowToFormDefaults, subtaskRowToFormDefaults } from './pmFormDefaults.js';

const USER_HUB_POPUP_IDS = {
  project: 'Popup_Xrl9X_fXTJ',
  task: 'Popup_8POjXW0UE8',
  /** UserHubTasksProject nested subtask create / open only. */
  subtask: 'Popup_WbcLURdUXx',
  /** UserHubSubTasksProject — Sub_Task_Process_A00 item form. */
  subtaskProcess: 'Popup_djVrj_A4yG',
};

const POPUP_SIZE = {
  width: 960,
  height: 720,
  popupWidth: '960px',
  popupHeight: '720px',
};

function resolveKfSdk(kfInstance) {
  return kfInstance ?? (typeof window !== 'undefined' ? window.kf : null);
}

function attachPopupClose(promise, onClosed) {
  if (!onClosed || !promise || typeof promise.then !== 'function') return;
  const run = () => {
    try {
      onClosed();
    } catch (err) {
      console.warn('UserHub popup onClosed failed:', err);
    }
  };
  if (typeof promise.finally === 'function') {
    promise.finally(run);
    return;
  }
  promise.then(run, run);
}

/** Case item id for project popup (CaseID param). */
export function resolveUserHubProjectCaseId(row) {
  const raw = row?.raw ?? row ?? {};
  return String(
    raw?._id
      ?? raw?._item_id
      ?? row?.CaseID
      ?? row?.caseId
      ?? row?.InstanceID
      ?? row?.id
      ?? '',
  ).trim();
}

/** Task popup ids — ActivityID + InstanceID. */
export function resolveUserHubTaskPopupIds(row) {
  const raw = row?.raw ?? row ?? {};
  const instanceId =
    raw?._id
    ?? raw?.Instance_ID
    ?? row?.InstanceID
    ?? row?.InstanceId
    ?? row?.instanceId
    ?? row?._id
    ?? row?.id
    ?? '';
  const activityInstance =
    raw?._activity_instance_id
    ?? raw?.Activity_Instance_ID
    ?? raw?.ActivityInstanceID
    ?? row?.ActivityID
    ?? row?.ActivityId
    ?? row?.activityId
    ?? row?._activity_instance_id
    ?? '';
  const activityId = Array.isArray(activityInstance) ? (activityInstance[0] ?? '') : activityInstance;
  return {
    instanceId: String(instanceId || '').trim(),
    activityId: String(activityId || '').trim(),
  };
}

export function openUserHubProjectPopup(kfInstance, row, options = {}) {
  const sdk = resolveKfSdk(kfInstance);
  const caseId = resolveUserHubProjectCaseId(row);
  if (typeof sdk?.app?.page?.openPopup !== 'function') {
    console.warn('UserHub project popup: openPopup not available');
    return false;
  }
  if (!caseId) {
    sdk?.client?.showInfo?.('Missing CaseID for this project.');
    return false;
  }
  try {
    const p = sdk.app.page.openPopup(USER_HUB_POPUP_IDS.project, {
      CaseID: caseId,
      ...POPUP_SIZE,
    });
    attachPopupClose(p, options.onClosed);
    if (p && typeof p.catch === 'function') {
      p.catch((err) => console.warn('UserHub project popup failed:', err));
    }
    return true;
  } catch (err) {
    console.warn('UserHub project popup threw', err);
    return false;
  }
}

/** Open project create popup (no row params). */
export function openUserHubProjectCreatePopup(kfInstance, options = {}) {
  const sdk = resolveKfSdk(kfInstance);
  if (typeof sdk?.app?.page?.openPopup !== 'function') {
    requestOpenProjectDetails();
    return true;
  }
  try {
    const p = sdk.app.page.openPopup(USER_HUB_POPUP_IDS.project, { ...POPUP_SIZE });
    attachPopupClose(p, options.onClosed);
    if (p && typeof p.catch === 'function') {
      p.catch((err) => console.warn('UserHub project create popup failed:', err));
    }
    return true;
  } catch (err) {
    console.warn('UserHub project create popup threw', err);
    return false;
  }
}

/** Open task create popup (no row params). */
export function openUserHubTaskCreatePopup(kfInstance, options = {}) {
  const sdk = resolveKfSdk(kfInstance);
  if (typeof sdk?.app?.page?.openPopup !== 'function') {
    requestOpenTaskDetails();
    return true;
  }
  try {
    const p = sdk.app.page.openPopup(USER_HUB_POPUP_IDS.task, { ...POPUP_SIZE });
    attachPopupClose(p, options.onClosed);
    if (p && typeof p.catch === 'function') {
      p.catch((err) => console.warn('UserHub task create popup failed:', err));
    }
    return true;
  } catch (err) {
    console.warn('UserHub task create popup threw', err);
    return false;
  }
}

export function openUserHubTaskPopup(kfInstance, row, options = {}) {
  const sdk = resolveKfSdk(kfInstance);
  const { instanceId, activityId } = resolveUserHubTaskPopupIds(row);
  if (typeof sdk?.app?.page?.openPopup !== 'function') {
    requestOpenTaskDetails(taskRowToFormDefaults(row));
    return true;
  }
  if (!instanceId || !activityId) {
    requestOpenTaskDetails(taskRowToFormDefaults(row));
    return true;
  }
  try {
    const p = sdk.app.page.openPopup(USER_HUB_POPUP_IDS.task, {
      InstanceID: instanceId,
      ActivityID: activityId,
      ...POPUP_SIZE,
    });
    attachPopupClose(p, options.onClosed);
    if (p && typeof p.catch === 'function') {
      p.catch((err) => console.warn('UserHub task popup failed:', err));
    }
    return true;
  } catch (err) {
    console.warn('UserHub task popup threw', err);
    return false;
  }
}

/** Subtask popup ids — same ActivityID + InstanceID shape as tasks. */
export function resolveUserHubSubtaskPopupIds(row) {
  return resolveUserHubTaskPopupIds(row);
}

/**
 * UserHubTasksProject only — open/create subtask form via Popup_WbcLURdUXx.
 * Pass a row or `{ InstanceID, ActivityID }` (e.g. after createSubtaskInstance).
 */
export function openUserHubSubtaskPopup(kfInstance, row, options = {}) {
  const sdk = resolveKfSdk(kfInstance);
  const { instanceId, activityId } = resolveUserHubSubtaskPopupIds(row);
  if (typeof sdk?.app?.page?.openPopup !== 'function') {
    requestOpenSubtaskDetails(subtaskRowToFormDefaults(row));
    return true;
  }
  if (!instanceId || !activityId) {
    requestOpenSubtaskDetails(subtaskRowToFormDefaults(row));
    return true;
  }
  try {
    const p = sdk.app.page.openPopup(USER_HUB_POPUP_IDS.subtask, {
      InstanceID: instanceId,
      ActivityID: activityId,
      ...POPUP_SIZE,
    });
    attachPopupClose(p, options.onClosed);
    if (p && typeof p.catch === 'function') {
      p.catch((err) => console.warn('UserHub subtask popup failed:', err));
    }
    return true;
  } catch (err) {
    console.warn('UserHub subtask popup threw', err);
    return false;
  }
}

/** Resolve InstanceID + ActivityID for UserHubSubTasksProject (Popup_djVrj_A4yG). */
export function resolveUserHubSubtaskProcessPopupIds(row) {
  const raw = row?.raw ?? row ?? {};
  const instanceId =
    raw?._id ?? row?.InstanceID ?? row?.InstanceId ?? row?.instanceId ?? row?.id ?? '';
  const activityInstance =
    raw?._activity_instance_id
    ?? row?.ActivityID
    ?? row?.ActivityId
    ?? row?.activityId
    ?? row?.ActivityInstanceID
    ?? '';
  const activityId = Array.isArray(activityInstance) ? (activityInstance[0] ?? '') : activityInstance;
  return {
    instanceId: String(instanceId || '').trim(),
    activityId: String(activityId || '').trim(),
  };
}

/**
 * UserHubSubTasksProject — open existing Sub_Task_Process_A00 item (Popup_djVrj_A4yG).
 * Params: ActivityID, InstanceID.
 * Optional `options.popupId` overrides the default popup (e.g. UserSpecificPT My Work).
 */
export function openUserHubSubtaskProcessPopup(kfInstance, row, options = {}) {
  const sdk = resolveKfSdk(kfInstance);
  const { instanceId, activityId } = resolveUserHubSubtaskProcessPopupIds(row);
  const popupId = String(options.popupId || USER_HUB_POPUP_IDS.subtaskProcess).trim();
  if (typeof sdk?.app?.page?.openPopup !== 'function') {
    requestOpenSubtaskDetails(subtaskRowToFormDefaults(row));
    return true;
  }
  if (!instanceId || !activityId) {
    requestOpenSubtaskDetails(subtaskRowToFormDefaults(row));
    return true;
  }
  try {
    const p = sdk.app.page.openPopup(popupId, {
      InstanceID: instanceId,
      ActivityID: activityId,
      ...POPUP_SIZE,
    });
    attachPopupClose(p, options.onClosed);
    if (p && typeof p.catch === 'function') {
      p.catch((err) => console.warn('UserHub subtask process popup failed:', err));
    }
    return true;
  } catch (err) {
    console.warn('UserHub subtask process popup threw', err);
    return false;
  }
}

/**
 * UserHubSubTasksProject — create draft then open subtask popup with ActivityID + InstanceID.
 * Optional `options.popupId` overrides the default Popup_djVrj_A4yG.
 */
export async function openUserHubSubtaskProcessCreatePopup(kfInstance, options = {}) {
  const sdk = resolveKfSdk(kfInstance);
  const popupId = String(options.popupId || USER_HUB_POPUP_IDS.subtaskProcess).trim();
  if (!sdk) {
    console.warn('UserHub subtask create: Kissflow SDK not available');
    return false;
  }
  if (typeof sdk?.app?.page?.openPopup !== 'function') {
    requestOpenSubtaskDetails();
    return true;
  }
  try {
    const created = await createPmProcessDraft(sdk, SUBTASKS_ENTITY, SUBTASKS_ENTITY.createDraftBody || {});
    if (created?.webhookOnly) {
      sdk?.client?.showInfo?.('Subtask sent to the Kissflow integration.');
      return true;
    }
    const p = sdk.app.page.openPopup(popupId, {
      InstanceID: created.instanceId,
      ActivityID: created.activityInstanceId,
      ...POPUP_SIZE,
    });
    attachPopupClose(p, options.onClosed);
    if (p && typeof p.catch === 'function') {
      p.catch((err) => console.warn('UserHub subtask create popup failed:', err));
    }
    return Boolean(created?.instanceId);
  } catch (err) {
    console.warn('UserHub subtask create failed:', err?.message || err);
    sdk?.client?.showInfo?.(err?.message || 'Failed to create subtask.');
    return false;
  }
}
