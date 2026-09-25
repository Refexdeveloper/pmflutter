# Project Management Tracker — pages and current flow

This is the **current** flow of the React app in this repo (`src/App.jsx`).
It is the Project Management Tracker component for Kissflow app `Project_Management_Tracker_A00`.

Read this before changing Assigned / Created, login, or list APIs.

Task / Subtask REST (create, update, submit, complete, assignment): [task-subtask-api-integration.md](./task-subtask-api-integration.md).

---

## 1. How the app starts

```
npm run dev  →  http://localhost:3000/
         or
Kissflow page embeds the same bundle (iframe / app builder)
```

`src/main.jsx` mounts `<SDKWrapper>` → `<App />`.

`App` always wraps:

1. `PmTrackerChrome` — tab chrome after identity is ready (Employee vs Project Manager)
2. `PmRoleShell` — which dashboard body to show
3. Hidden hosts for local create forms: Task / Subtask / Project details

Two run modes:

| Mode | How you know | Who Kissflow APIs run as |
|---|---|---|
| **Inside Kissflow** | SDK initializes; `sdkFailed` is false | The **signed-in Kissflow user** (`kf.api` session) |
| **Local Vite** | SDK fails; access keys + User Master login | **User Master login email** for Assigned / Created reports; access keys only authenticate the GET |

Local Vite uses `.env`:

- Development: `development-refexgroup.kissflow.com` / account `AcCMptp3yqcn`
- Live fallback: `refexgroup.kissflow.com` / account `AcCMptlq60zH`

Create webhook is public (no access-key header): `VITE_PM_CREATE_WEBHOOK_URL` → integration `createtask_A00`.

---

## 2. Login and identity (local only)

On localhost you are **not** inside Kissflow, so `NonKissflowIdentityGate` appears first.

Flow:

1. Search **User Master** (Refex One), not a hardcoded person.
2. Pick an email → continue as **Employee** or **Project Manager**.
3. That person is stored as `kf.user` (synthetic). Email shows in the header.
4. Switch user clears session and returns to the gate.

This login email drives **Assigned / Created** on Tasks and SubTasks:

- Assigned → Kissflow report `$assignee_email={login email}` (assignee field is `externalemail` when `Assigned_To` is missing)
- Created → Kissflow report `$requester_email={login email}`

If the report fails, the admin item list is filtered by the same emails. My Items / Pending (access-key owner) are **not** used for those tabs.

---

## 3. Role → which pages you see

`resolvePmRoleKey()` (`src/lib/pmRoles.js`) maps the user to:

- `employee` (default)
- `pm` (Project Manager / admin / CTO-style titles)

### Employee chrome (`PmTrackerChrome`)

Tabs stay mounted after first visit (no remount storm):

| Tab | Screen | File |
|---|---|---|
| **Projects** | Your projects dashboard | `UserHubProjectsPage.jsx` → `ProjectDashboardPage.jsx` |
| **Tasks** | Assigned / Created process tasks | `UserHubTasksPage.jsx` |
| **SubTasks** | Assigned / Created process subtasks | `UserHubSubTasksPage.jsx` |

### Project Manager chrome

| Tab | Screen | File |
|---|---|---|
| **Home** | My Work / My Team (projects, tasks, subtasks) | `UserSpecificPT.jsx` |
| **Create** | Satellite create (project / task / subtask) | `kfSatelliteCreate.js` |
| **Admin Tasks** | All-admin task list | `AdminTasks.jsx` |

Inside a real Kissflow page, `PmRoleShell` usually stays on the **embedded** component for that page (`UserDashboardProject` / employee / PM page the builder already chose). Local Vite uses the chrome above.

---

## 4. Employee — Projects

**What you see**

- Welcome: greeting + login email
- KPI cards (total / active / completed / delayed, RAG)
- Project table: name, owner, dates, progress, RAG, status
- Filters: company, function, period, search
- **Create project**

**How data loads**

- Kissflow **case** `Project_Management_A01`
- List: `GET /case/2/{account}/Project_Management_A01/list`
- Scoped to the login user when they are owner / steward / have tasks on the project (`scopeToCurrentUser`)

**Open / create**

- Open row → local project details **or** Kissflow popup `Popup_Xrl9X_fXTJ` (CaseID) if `kf.context.openPopup` exists
- Local create → `ProjectDetailsForm` → one webhook JSON with `source: "project"`

**Local Vite note:** project list often comes from the **live** tenant via Vite GET rewrite, because development GETs used to 401. Development keys that work (current `.env`) can read development case list directly.

---

## 5. Employee — Tasks (Assigned / Created)

**What you see**

Toolbar (`UserHubTaskToolbar`):

1. **Tasks Assigned to me** (default)
   - **Open** / **Closed** — client filter on the login-email assigned report
2. **Tasks Created by Me**
   - Status chips: **Draft** (default) / In progress / Completed / Withdrawn / Rejected
   - Drafts can be multi-selected and deleted

Plus insights cards and a task table. Create task button.

**Who is “me”**

The **person who logged in** (User Master email on localhost, Kissflow user email in iframe).

**APIs** (`src/lib/kfEmployeeTasksReport.js`)  
Process: `Project_Sub_Task_A01` · App: `Project_Management_Tracker_A00`

| UI | Kissflow API |
|---|---|
| Assigned | `GET /process-report/2/AcCMptp3yqcn/Project_Sub_Task_A01/pm_external_report_A00?$assignee_email={login email}` |
| Created | same report with `$requester_email={login email}` |
| Fallback | admin `Project_Sub_Task_A01/item` filtered by `externalemail` / requester email |

One page (50 rows) of the **active** chip only. Counts are cached briefly.

**Open / create**

- Open row → local task form **or** popup `Popup_8POjXW0UE8` (InstanceID + ActivityID)
- Nested subtask from a task → popup `Popup_WbcLURdUXx`
- After popup close, `context.watchParams` refreshes the list
- Local create → `TaskDetailsForm` → webhook `source: "task"`

**Assignee on create (local form)**

1. Picker list = User Master (UUID / `iam:` — not Kissflow).
2. Selected **email** is looked up on Kissflow `GET /user/2/{account}/?q={email}`.
3. Exact email + `_id` like `Us…` + Active User → send user object on `Assigned_To`.
4. Search succeeded, no match → **Not in Kissflow** → user field is `null`.
5. Lookup failed (401 / 429 / CORS) → **Couldn’t verify Kissflow** — do not treat as missing.

Also send dynamic `Assignee_Name` / `Assignee_Email` / `Assignee_Email_Extracted` and requester fields from the **login user**, never a hardcoded person.

---

## 6. Employee — SubTasks (Assigned / Created)

Same ownership model as Tasks. File: `UserHubSubTasksPage.jsx` + `kfEmployeeSubtasksReport.js`.

Process: `Sub_Task_Process_A00`.

| UI | Kissflow API |
|---|---|
| Assigned | `GET .../pm_subtask_A00?$assignee_email={login email}` |
| Created | `GET .../pm_subtask_A00?$requester_email={login email}` |
| Fallback | admin `Sub_Task_Process_A00/item` filtered by `externalemail` / requester email |

Default: **Assigned → Open**. Created default chip: **Draft**.

Extra on this page: period filter, search, pagination, create subtask.

**Open / create**

- Open → local form **or** popup `Popup_djVrj_A4yG`
- Local create → `SubtaskDetailsForm` → webhook `source: "subtask"`
- Same Kissflow-user vs `null` assignee rule as tasks (`Assignee_1` / `AssignedTo`)

**My Team mode** (PM dashboard only): this page can be embedded with manager-scoped rows instead of myitems/pending.

**Report assignee on *reads*** (if a process-report row is shown): `Assigned_To` / `Assignee_1` is often missing. Display/match assignee via `externalemail` (also `Assignee_Email_Extracted`). Do not invent a Kissflow user object from that email.

Employee report URLs (used inside Kissflow Employee_Tasks / when reports are authorized):

- Tasks: `GET /process-report/2/AcCMptp3yqcn/Project_Sub_Task_A01/pm_external_report_A00?$assignee_email=` or `$requester_email=`
- Subtasks: `GET /process-report/2/AcCMptp3yqcn/Sub_Task_Process_A00/pm_subtask_A00` (same query)

Hub Tasks / SubTasks pages **use those reports** for Assigned / Created, queried with the login email.

---

## 7. Project Manager — Home (`UserSpecificPT`)

**Scope**

- **My Work** — this manager’s own projects / tasks / subtasks
- **My Team** — reportees via Kissflow team reports (`My_Team_A04` tasks, `My_Team_A05` projects, plus subtask team loaders)

**Mode:** Projects · Tasks · SubTasks

Tasks in My Work reuse the same hub Assigned / Created APIs as the employee Tasks tab.

Create uses satellite menu / popups, not a change to Assigned-Created rules.

---

## 8. Project Manager — Admin Tasks

`AdminTasks.jsx` loads **admin** item lists (all process tasks the key/session can see), not “my” pending.

- `GET /process/2/{account}/admin/Project_Sub_Task_A01/item`
- Optional admin report enrich

This is an operations list, not Assigned / Created.

---

## 9. Create flow (one webhook)

Local forms (when Kissflow `openPopup` is missing) all POST the **same** webhook URL.

JSON shape:

```json
{
  "source": "project" | "task" | "subtask",
  "project": { ... } | null,
  "task": { ... } | null,
  "subtask": { ... } | null
}
```

Only the matching bucket is filled. User fields that are not Kissflow users are `null` on `Assigned_To` / `Assignee_1` / owner fields. Text emails still go in `Assignee_Email` / `externalemail`-style fields.

Inside Kissflow, create usually: **draft item → openPopup** (no webhook).

---

## 10. End-to-end user journeys

### A. Employee on localhost

```
Open localhost
  → User Master login (pick email + Employee)
  → Projects tab (case list, scoped to that email when owner/steward)
  → Tasks tab
       Assigned / Open  = login email on $assignee_email / externalemail
       Created / Draft  = login email on $requester_email
  → SubTasks tab (same pattern, Sub_Task_Process_A00)
  → Create *  = local form → webhook createtask_A00
```

### B. Employee inside Kissflow (Employee_Tasks_A01 / hub page)

```
Kissflow session user
  → same tabs
  → Assigned / Created = THAT user's pending / myitems
  → Create / open = Kissflow popups
```

### C. Project Manager

```
Home (My Work | My Team) + Admin Tasks
  → My Team uses team reports, not the employee email split
```

---

## 11. Tenants and why an API 401s

| Tenant | Host | Account |
|---|---|---|
| Development | `development-refexgroup.kissflow.com` | `AcCMptp3yqcn` |
| Live | `refexgroup.kissflow.com` | `AcCMptlq60zH` |

- Development key in `.env` (`VITE_KF_ACCESS_KEY_ID`) must be allowed on the development app, or **all** `/kf-dev` calls return `401 KISSFLOW_ERROR_00014`.
- Live keys are used for `/kf-live` and for most local GET rewrites (so localhost can still list data if development is 401).
- Process reports `pm_external_report_A00` / `pm_subtask_A00` are **not** rewritten to live in Vite; they need a working development key or a Kissflow session.

After changing `.env`, restart `npm run dev` and hard-refresh the browser.

---

## 12. File map

| Area | Files |
|---|---|
| Boot / identity | `src/main.jsx`, `src/sdk/wrapper.jsx`, `src/components/NonKissflowIdentityGate.jsx` |
| Chrome / roles | `src/PmTrackerChrome.jsx`, `src/PmRoleShell.jsx`, `src/lib/pmRoles.js` |
| Projects | `src/UserHubProjectsPage.jsx`, `src/ProjectDashboardPage.jsx` |
| Tasks | `src/UserHubTasksPage.jsx`, `src/lib/kfPmTaskProcessItems.js` |
| SubTasks | `src/UserHubSubTasksPage.jsx`, `src/lib/kfPmSubtaskProcessItems.js` |
| PM home / admin | `src/UserSpecificPT.jsx`, `src/AdminTasks.jsx` |
| Paths | `src/lib/kfPmMyItemsPaths.js`, `src/lib/pmMyItemsEntities.js` |
| Create webhook | `src/lib/pmCreateWebhook.js`, `src/lib/pmCreatePayload.js` |
| Assignee | `src/lib/kfUserLookup.js`, `src/lib/kfUserField.js`, `src/components/AssigneeStatusTags.jsx` |
| Local forms | `src/components/TaskDetailsForm.jsx`, `SubtaskDetailsForm.jsx`, `ProjectDetailsForm.jsx` |
| Popups | `src/lib/kfUserHubPopups.js` |
| Keys / proxy | `src/lib/kfAccessKeys.js`, `vite.config.ts`, `.env` |

---

## 13. Rules that must stay

1. **Assigned / Created on Tasks and SubTasks** = login email on `$assignee_email` / `$requester_email` (assignee on report rows is `externalemail`).
2. **User Master** is the people picker. Those IDs are not Kissflow user ids.
3. **Create assignee:** lookup by selected email → Kissflow user object or `null`. Failed lookup ≠ “not in Kissflow”.
4. **Report rows:** assignee is `externalemail` when `Assigned_To` is missing.
5. **Never hardcode** a person (including Aravind) as assignee or requester.
