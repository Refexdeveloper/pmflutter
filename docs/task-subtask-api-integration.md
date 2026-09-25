# Task and Subtask API Integration

This document describes **only what the current React app implements**, then lists **recommended** work for the local / PM External flow. Existing behavior is verified from source. Do not treat recommendations as live APIs.

Related page flow: [app-pages-and-flow.md](./app-pages-and-flow.md).

---

## 1. Task API overview

Kissflow process: **`Project_Sub_Task_A01`** (display name in errors: Project Task).

| Operation | How this app does it |
|---|---|
| Create | `POST /process/2/{account}/Project_Sub_Task_A01` empty draft, **or** public webhook `createtask_A00`. Local Vite uses the webhook. |
| Update / edit | `PUT /process/2/{account}/Project_Sub_Task_A01/{instanceId}/{activityId}?_application_id=Project_Management_Tracker_A00` with `{ _id, …fields }`. Falls back to admin PUT. |
| Submit (workflow) | `POST …/{instanceId}/{activityId}/submit?_application_id=Project_Management_Tracker_A00`. Same path shape as IT Service (`kfITServiceDashboard.js`). Used after REST create and when status is Completed. |
| Complete | PUT `Task_Status: "Completed"`, then the submit path above when Kissflow allows it. |
| List (Employee / External) | `GET /process-report/2/AcCMptp3yqcn/Project_Sub_Task_A01/pm_external_report_A00` with `$assignee_email` or `$requester_email`. |
| List (admin) | `GET /process/2/{account}/admin/Project_Sub_Task_A01/item` |
| Details | `GET /process/2/{account}/admin/Project_Sub_Task_A01/{instanceId}` and `/progress` |
| Assign / reassign | No dedicated API. Create/update send `Assigned_To` (Kissflow user object or `null`). |
| Delete drafts | `DELETE /process/2/{account}/admin/Project_Sub_Task_A01/{instanceId}` |

There is **no** PM-specific `/complete` URL in this repo.

---

## 2. Subtask API overview

Kissflow process: **`Sub_Task_Process_A00`**.

Same lifecycle as tasks. Differences verified in code:

| Topic | Subtask |
|---|---|
| Create draft | `POST /process/2/{account}/Sub_Task_Process_A00?_application_id=Project_Management_A01` |
| Webhook | Same `createtask_A00` URL; JSON `source: "subtask"` |
| Update | Same PUT / admin PUT pattern, process id `Sub_Task_Process_A00` |
| Submit / complete | Same `/submit` path; complete sets `TStatus: "Completed"` |
| List (Employee) | `GET /process-report/2/AcCMptp3yqcn/Sub_Task_Process_A00/pm_subtask_A00` |
| Assignee field | `Assignee_1` (object or `null`). List assignee is `externalemail` when the object is missing. |
| Status field | `TStatus` (not `Task_Status`) |
| Dropdowns | No process dropdown API. Priorities are `High` / `Medium` / `Low` in `SubtaskDetailsForm.jsx`. |

---

## 3. Task lifecycle

```
UI (TaskDetailsForm / Kissflow popup)
  → resolveKissflowUserField (User Master email → /user/2)
  → create / update / complete helpers (kfPmMyItemsCreate.js)
  → webhook or process REST
  → notifyTaskDetailsSaved
  → UserHubTasksPage refreshes employee reports
```

| Stage | Existing behavior | Local / External app |
|---|---|---|
| **Create** | Local: webhook only (`source: "task"`). Embedded: empty POST draft, then popup. | After REST draft + ids: PUT fields, then POST `/submit` (`finalizePmProcessCreate`). Webhook create has no instance id — submit is skipped. |
| **Update** | PUT instance+activity, then admin PUT. Body is process fields only (`sanitizeProcessUpdateFields`). | Same. Tenant is located (dev vs live) before PUT. |
| **Submit** | IT Service already POSTs `/submit`. PM tasks did not call it until this integration. | After REST create, submit Start/current activity. Failures that mean “not in queue” do not fail the save. |
| **Complete** | Previously only `Task_Status` on PUT, or Kissflow popup. | If the form status is Completed: PUT `Task_Status: Completed` then `/submit`. |

Workflow steps seen on progress GET (example item): `Start` → `Open` → `Completed`.

Form `Task_Status` values from dropdown fallback: **`Open`**, **`Completed`**.

My Items tabs (alternate UI, not Employee hub): `Draft`, `In progress`, `Completed`, `Withdrawn`, `Rejected`.

---

## 4. Subtask lifecycle

Same stages. Form status field is `TStatus`. Employee hub uses `fetchEmployeeSubtasksByScope`. After save, `UserHubSubTasksPage` listens for `pm-subtask-details-saved`.

---

## 5. API endpoint table

Account IDs from code: **dev `AcCMptp3yqcn`**, **live `AcCMptlq60zH`**.

App query: reports and process update/submit use **`Project_Management_Tracker_A00`**. Create draft uses **`Project_Management_A01`** (`TASKS_ENTITY.applicationIdFallback`).

| Method | Path | Auth | Used for |
|---|---|---|---|
| POST | `/process/2/{account}/{process}?_application_id=Project_Management_A01` | Session or access keys | Empty draft create |
| POST | `/integration/2/{account}/webhook/{token}` | **None** (public) | Create via `createtask_A00` |
| PUT | `/process/2/{account}/{process}/{instance}/{activity}?_application_id=Project_Management_Tracker_A00` | Session or keys | Update / assign |
| PUT | `/process/2/{account}/admin/{process}/{instance}?_application_id=Project_Management_Tracker_A00` | Keys (fallback) | Update when activity PUT is not in queue |
| POST | `/process/2/{account}/{process}/{instance}/{activity}/submit?_application_id=Project_Management_Tracker_A00` | Session or keys | Submit / complete step |
| GET | `/process/2/{account}/{process}/{instance}/progress?_application_id=Project_Management_Tracker_A00` | Keys | Current `_activity_instance_id` |
| GET | `/process/2/{account}/admin/{process}/{instance}?_application_id=Project_Management_Tracker_A00` | Keys | Details / locate tenant |
| GET | `/process/2/{account}/admin/{process}/item?page_number=&page_size=500&apply_preference=0` | Session or keys | Admin list fallback |
| GET | `/process-report/2/AcCMptp3yqcn/Project_Sub_Task_A01/pm_external_report_A00?$assignee_email=&$requester_email=&_application_id=Project_Management_Tracker_A00&page_number=1&page_size=500` | Dev keys via `/kf-dev` | Task Assigned / Created |
| GET | `/process-report/2/AcCMptp3yqcn/Sub_Task_Process_A00/pm_subtask_A00?…` (same query) | Dev keys via `/kf-dev` | Subtask Assigned / Created |
| GET | `/user/2/AcCMptlq60zH/?user_type=User&active_user=true&q={email}` | Live keys via `/kf-live` | Kissflow assignee lookup |
| DELETE | `/process/2/{account}/admin/{process}/{instance}` | Session or keys | Draft delete |
| GET | `/process/2/{account}/{process}/myitems/{segment}` | Session | My Items Pro (not Employee hub lists) |
| GET | `/process/2/{account}/{process}/pending/{activity}` | Session | Assigned open (module exists; hub uses reports) |

Local Vite: same-origin `/kf-dev` and `/kf-live` proxies inject `X-Access-Key-Id` and `X-Access-Key-Secret`. Browser-direct kissflow.com is not used (CORS).

---

## 6. Request payload examples

### Create webhook (`source: "task"`)

Verified from `buildPmCreateWebhookJson` + `sanitizeCreateFields('task')`.

```json
{
  "source": "task",
  "project": null,
  "task": {
    "Sub_Task_Name": "Daily UAT",
    "Task_Priority": "High",
    "Start_Date": "2026-09-23",
    "End_Date": "2026-09-30",
    "Task_Status": "Open",
    "Task_Detail": "Refex one uat testing for all app on daily basis",
    "Assigned_To": {
      "_id": "UsDTb7E7dFmW",
      "Kind": "User",
      "Name": "Aravind",
      "Email": "aravind.srinivasan@refex.co.in"
    },
    "AssignedTo": {
      "_id": "UsDTb7E7dFmW",
      "Kind": "User",
      "Name": "Aravind",
      "Email": "aravind.srinivasan@refex.co.in"
    },
    "Assignee_Name": "Aravind",
    "Assignee_Email": "aravind.srinivasan@refex.co.in",
    "Assignee_Email_Extracted": "aravind.srinivasan@refex.co.in",
    "Requester Email": "login.user@refex.co.in",
    "Requester_Email": "login.user@refex.co.in",
    "Created_by_flat_field_email": "login.user@refex.co.in"
  },
  "subtask": null
}
```

If the assignee is **not** a Kissflow user, `Assigned_To` and `AssignedTo` are **`null`**. Text email fields still go on the webhook.

### Process update (task) — do **not** send webhook-only fields

Kissflow error if `Assignee_Name` is sent: *The field Assignee_Name does not exist in the flow Project Task.*

```json
{
  "_id": "PkEESn73Hi4r",
  "Sub_Task_Name": "test 3",
  "Task_Priority": "High",
  "Start_Date": "2026-09-23",
  "End_Date": "2026-09-30",
  "Task_Status": "Open",
  "Task_Detail": "Updated detail",
  "Assigned_To": {
    "_id": "UsDTb7E7dFmW",
    "Kind": "User",
    "Name": "Aravind",
    "Email": "aravind.srinivasan@refex.co.in"
  },
  "Is_Dependent_on_another_Task": false
}
```

External assignee: `"Assigned_To": null`.

### Process submit

```json
{ "_id": "PkEESn73Hi4r" }
```

`POST /process/2/{account}/Project_Sub_Task_A01/{instanceId}/{activityId}/submit?_application_id=Project_Management_Tracker_A00`

### Create webhook (`source: "subtask"`)

```json
{
  "source": "subtask",
  "project": null,
  "task": null,
  "subtask": {
    "Sub_task_Name": "Prep checklist",
    "Sub_task_Priority": "Medium",
    "TStatus": "Open",
    "Start_Date": "2026-09-23",
    "End_Date": "2026-09-25",
    "Assignee_1": null,
    "Assignee_Name": "External Person",
    "Assignee_Email": "external@example.com",
    "Assignee_Email_Extracted": "external@example.com",
    "Task_ID_Hidden": "Task-048",
    "Dependent_ON": false
  }
}
```

---

## 7. Response examples

### Process create / admin GET (fields actually used)

```json
{
  "_id": "PkEESn73Hi4r",
  "_activity_instance_id": "PkEESn7Mv4Xn",
  "_status": "InProgress",
  "Task_Status": "Open",
  "Sub_Task_Name": "test 3"
}
```

`parseProcessCreateIds` reads `_id` and `_activity_instance_id`.

### Progress GET

```json
{
  "_id": "PkEESn73Hi4r",
  "_status": "InProgress",
  "Steps": [
    { "Name": "Start", "Status": "Completed", "_activity_instance_id": "PkEESn7JrAis" },
    { "Name": "Open", "Status": "InProgress", "_activity_instance_id": "PkEESn7Mv4Xn" },
    { "Name": "Completed", "Status": "NotStarted" }
  ]
}
```

The InProgress step’s `_activity_instance_id` is used when the report omits `Activity_Instance_ID`.

### Employee task report

Payload is `Columns` + `Data`. Row keys are often `Column_*`. Hydration maps `FieldId` values. Assignee for matching is **`externalemail`**, not a synthesized `Assigned_To`.

### Errors seen in this project

| Code / message | Meaning in this app |
|---|---|
| `KISSFLOW_ERROR_01015` — item could not be located within Project Task | Wrong tenant (live vs development) |
| `KISSFLOW_ERROR_00137` — Resource not found | Activity PUT/submit not in this key’s queue |
| `KISSFLOW_ERROR_050201` — moved out of your queue | Activity is not assigned to the access-key user |
| Field does not exist in the flow Project Task | Webhook-only field (e.g. `Assignee_Name`) sent on process PUT |
| `KISSFLOW_ERROR_00014` / 401 | Access key rejected |
| `KISSFLOW_ERROR_15009` / 429 | Rate limit |

---

## 8. Status / workflow mapping

| Layer | Task | Subtask |
|---|---|---|
| Form field | `Task_Status`: `Open`, `Completed` (`kfTaskFormDropdownFallbacks.json`) | `TStatus`: `Open`, `Completed` |
| Workflow `_status` | e.g. `InProgress` | same |
| Hub Assigned Open / Closed | Closed if status matches `complete\|closed\|done\|withdrawn\|rejected\|cancelled` (`pmHubLoginLists.js`) | same |
| My Items segments | `draft`, `inprogress`, `completed`, `withdrawn`, `rejected` | same |
| Completed helper | `isTaskCompleted` / `isProcessCompleteStatus`: `complete\|closed\|done` | `isSubtaskCompleted` |

---

## 9. Authentication requirements

| Call | Auth |
|---|---|
| Employee reports (`pm_external_report_A00`, `pm_subtask_A00`) | Development access keys (`/kf-dev`). Not rewritten to live. |
| Live user directory | Live access keys (`/kf-live`), account `AcCMptlq60zH` |
| Process PUT / submit on localhost | Keys for the tenant that **owns the instance** |
| Process mutate inside Kissflow | `kf.api` session first (`preferSessionAuth: true`) |
| Create webhook | **No** `X-Access-Key-*` headers |

Assigned / Created lists always filter by **User Master login email**, not the access-key owner.

---

## 10. Error handling

| Situation | Code behavior |
|---|---|
| Dev create 401 | Fall back to webhook (`createPmProcessDraft`) |
| Report GET fails | Fall back to admin item list + email filter |
| Activity PUT 404 / not in queue / not located | Admin PUT |
| Item not on live | Locate via admin GET on development, then PUT there |
| Submit not in queue | Return `{ ok: false }`; save still succeeds |
| User lookup 401 / 429 | Status **Couldn’t verify Kissflow** — not cached as missing |
| User lookup success, no `Us…` match | **Not in Kissflow**; user field `null` |
| Webhook 429 on localhost | `{ _rateLimited: true }`; required create still throws if HTTP fails otherwise |

---

## 11. Assignment logic

1. Picker list is **User Master** (Refex One). Those `_id`s are UUID / `iam:` — never sent as Kissflow `Assigned_To`.
2. Take the **selected email**.
3. `GET /user/2/{live account}/?user_type=User&active_user=true&q={email}` and require an **exact email** match.
4. Valid Kissflow user: `_id` `/^Us[A-Za-z0-9_]+$/`, `Kind: User`, `Status: Active`.
5. If found → `{ _id, Kind: "User", Name, Email }` on `Assigned_To` (task) or `Assignee_1` (subtask).
6. If search succeeds with no match → **Not in Kissflow** → send **`null`**.
7. If lookup fails → **Couldn’t verify Kissflow**. Do not cache as missing.

Code: `src/lib/kfUserLookup.js`, `src/lib/kfUserField.js`, `src/components/AssigneeStatusTags.jsx`.

---

## 12. External user handling

“External” in this repo means two things:

1. **Local / PM External app** — not embedded in Kissflow. Identity is User Master (`NonKissflowIdentityGate`, `pm_external_identity`). Lists use login email on `pm_external_report_A00` / `pm_subtask_A00`.
2. **Assignee not in Kissflow directory** — user field is `null`; webhook still gets `Assignee_Name` / `Assignee_Email` / `Assignee_Email_Extracted`. Process PUT does **not** send those text fields (they are not on the flow).

| Surface | Kissflow user | Not in Kissflow |
|---|---|---|
| Create (webhook) | User object | `null` + email text fields |
| Update (process PUT) | `Assigned_To` / `Assignee_1` object | `null` only |
| Submit / complete | Needs a queue / permission; often fails for access-key user | Status can still be set via admin PUT; `/submit` may return `{ ok: false }` |
| Notifications | Kissflow native (not implemented in this React app) | Not implemented here |
| Permissions | Kissflow process ACL | External people are not Kissflow actors |
| Dashboard / reports | `$assignee_email` matches `externalemail` | Same — email match, not `Assigned_To` |

---

## 13. Important Kissflow dependencies

- Processes: `Project_Sub_Task_A01`, `Sub_Task_Process_A00`
- Reports: `pm_external_report_A00`, `pm_subtask_A00`
- App: `Project_Management_Tracker_A00` (lists/update/submit) vs `Project_Management_A01` (draft create)
- Webhook integration: `createtask_A00` (token in `pmCreateWebhook.js` / `VITE_PM_CREATE_WEBHOOK_URL`)
- Popups (embedded only): task `Popup_bEJJgrdutd`, subtask `Popup_QTJQAyhxOR` / hub popups in `kfUserHubPopups.js`
- Instance id (`Pk…`) and activity instance id (`Pk…`) come from the report row or `/progress`
- Vite must not send a development `Pk` to the live account (that is `KISSFLOW_ERROR_01015`)

---

## 14. Existing source file references

| Area | Files |
|---|---|
| Create / update / submit / complete | `src/lib/kfPmMyItemsCreate.js` |
| Payload sanitize | `src/lib/pmCreatePayload.js` |
| Webhook | `src/lib/pmCreateWebhook.js` |
| Employee task report | `src/lib/kfEmployeeTasksReport.js` |
| Employee subtask report | `src/lib/kfEmployeeSubtasksReport.js` |
| Report core | `src/lib/kfEmployeeReportCore.js` |
| User lookup / fields | `src/lib/kfUserLookup.js`, `src/lib/kfUserField.js` |
| Forms | `src/components/TaskDetailsForm.jsx`, `src/components/SubtaskDetailsForm.jsx` |
| Hosts | `src/components/TaskDetailsHost.jsx`, `src/components/SubtaskDetailsHost.jsx` |
| Employee hub | `src/UserHubTasksPage.jsx`, `src/UserHubSubTasksPage.jsx` |
| Identity | `src/lib/iamIdentity.js`, `src/components/NonKissflowIdentityGate.jsx` |
| Runtime / proxies | `src/lib/kfRuntime.js`, `vite.config.ts` |
| Submit path precedent | `src/lib/kfITServiceDashboard.js` (`instanceSubmitPath`) |
| Postman | `postman/PM-Kissflow.postman_collection.json` |

---

## 15. Recommendations for PM External App integration

**Existing (do not regress)**

- Login-email reports for Assigned / Created
- Live directory lookup before assignment
- `null` user field for non-Kissflow people
- Process PUT without webhook-only fields
- Locate tenant before update

**Added in this integration (local forms)**

- `finalizePmProcessCreate` — PUT + `/submit` after REST draft
- `completePmProcessItem` — `Task_Status` / `TStatus` = `Completed` + `/submit`
- Subtask update uses the same tenant-locate PUT as tasks
- Hub list refresh on form save
- `fetchEmployeeDashboardSubtasks` (same shape as `fetchEmployeeDashboardTasks`)

**Still limited (do not pretend these work)**

- Webhook create does not return a reliable instance/activity id, so Create → Submit cannot run as REST after webhook-only create
- Access keys often cannot `/submit` another person’s queue; admin PUT still updates fields
- No push notifications or Kissflow ACL for people who are not Kissflow users
- Embedded Kissflow still prefers native popups for workflow actions

---

## Testing checklist

**Task**

1. Local login as a User Master person.
2. Create a task assigned to a Kissflow user (`Us…` object on webhook).
3. Create a task assigned to a non-Kissflow email (`Assigned_To: null`).
4. Open a development report row and Update (must not hit live `01015`).
5. Change `Task_Status` to Completed and Update (PUT then `/submit` if allowed).
6. Assigned / Created chips still follow **login email**.
7. `Assignee_Name` must not appear on process PUT.

**Subtask**

1. Create with Kissflow assignee and with external assignee (`Assignee_1: null`).
2. Update fields; complete via Status = Completed.
3. Parent `Task_ID_Hidden` preserved.
4. Hub Assigned / Created refresh after save.

**Regression**

- Embedded Kissflow popups still open when SDK is present.
- IT Service submit is unchanged.
- Project create webhook still uses `source: "project"`.
