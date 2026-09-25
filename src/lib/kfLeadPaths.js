/** Kissflow API path builders for Vindview Sales Management / Lead Tracker. */

import { resolveKissflowAccountId } from './kfRuntime.js';

export const LEAD_ACCOUNT_ID = 'AcCMptp3yqcn';
export const LEAD_PROCESS_ID = 'Vindview_Sales_Management_A00';
export const LEAD_APPLICATION_ID = 'Lead_Trcaker_A00';

export const STATUS_SEGMENTS = {
  Draft: 'draft',
  'In progress': 'inprogress',
  Completed: 'completed',
  Withdrawn: 'withdrawn',
  Rejected: 'rejected',
};

export function resolveKfApplicationId(kfInstance) {
  const fromSdk = String(kfInstance?.app?._id || kfInstance?.application?._id || '').trim();
  if (fromSdk) return fromSdk;

  if (typeof window !== 'undefined') {
    try {
      const href = window.location.href || '';
      const match = href.match(/_application_id=([^&]+)/i);
      if (match?.[1]) return decodeURIComponent(match[1]);
    } catch {
      // ignore
    }
  }
  return LEAD_APPLICATION_ID;
}

export function buildLeadProcessApiPaths(kfInstance) {
  const accountId = resolveKissflowAccountId(kfInstance, LEAD_ACCOUNT_ID);
  const processId = LEAD_PROCESS_ID;
  const applicationId = resolveKfApplicationId(kfInstance);
  const appQuery = `_application_id=${encodeURIComponent(applicationId)}`;

  return {
    accountId,
    processId,
    applicationId,
    appQuery,
    statusCountPath: `/process/2/${accountId}/${processId}/myitems/status/count?${appQuery}`,
    userPathPrefix: `/user/2/${accountId}/`,
    userPathSuffix: `?${appQuery}`,
    myItemsPath(segment, pageNumber = 1, pageSize = 50) {
      return `/process/2/${accountId}/${processId}/myitems/${segment}?apply_preference=true&page_number=${pageNumber}&page_size=${pageSize}&skip_aggregation=true&${appQuery}`;
    },
    pendingActivityCountPath(activityId) {
      return `/process/2/${accountId}/${processId}/pending/${encodeURIComponent(activityId)}/count?apply_preference=false&skip_aggregation=true&${appQuery}`;
    },
    pendingActivityItemsPath(activityId, pageNumber = 1, pageSize = 50) {
      return `/process/2/${accountId}/${processId}/pending/${encodeURIComponent(activityId)}?apply_preference=true&page_number=${pageNumber}&page_size=${pageSize}&skip_aggregation=true&${appQuery}`;
    },
  };
}

export function buildLeadAdminApiPaths(kfInstance) {
  const accountId = resolveKissflowAccountId(kfInstance, LEAD_ACCOUNT_ID);
  const processId = LEAD_PROCESS_ID;
  const applicationId = resolveKfApplicationId(kfInstance);
  const appQuery = `_application_id=${encodeURIComponent(applicationId)}`;

  return {
    accountId,
    processId,
    applicationId,
    getLeadItemsPath(pageNumber = 1, pageSize = 100000) {
      return `/process/2/${accountId}/${processId}/item?page_number=${pageNumber}&page_size=${pageSize}&apply_preference=1&${appQuery}`;
    },
    getLeadDetailPath(itemId) {
      return `/process/2/${accountId}/${processId}/${itemId}?${appQuery}`;
    },
    getLeadDetailWithActivityPath(instanceId, activityInstanceId) {
      return `/process/2/${accountId}/${processId}/${encodeURIComponent(instanceId)}/${encodeURIComponent(activityInstanceId)}?${appQuery}`;
    },
    getLeadActivityPath(itemId) {
      return `/process/2/${accountId}/${processId}/${itemId}/activity?${appQuery}`;
    },
  };
}
