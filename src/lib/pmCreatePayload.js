/**
 * Kissflow create payloads — only real field ids, with types the flows accept.
 */

import { kissflowUserFromPerson, toKissflowUserField } from './kfUserField.js'

export function toKissflowDate(value) {
  const text = String(value || '').trim()
  if (!text) return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text
  const dmy = text.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/)
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`
  const parsed = new Date(text)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

export function toKissflowBool(value) {
  if (typeof value === 'boolean') return value
  const text = String(value || '').trim().toLowerCase()
  if (!text) return false
  return text === 'yes' || text === 'true' || text === '1'
}

const TASK_KEYS = new Set([
  '_id',
  'Sub_Task_Name',
  'Task_Priority',
  'Start_Date',
  'End_Date',
  'Task_Status',
  'Task_type',
  'Task_Detail',
  'Project',
  'Project_Name',
  'Entity',
  'Functions',
  'Function_Type',
  'Is_Dependent_on_another_Task',
  'Dependent_On',
  'Assigned_To',
  'AssignedTo',
  'Assignee_Name',
  'Assignee_Email',
  'Assignee_Email_Extracted',
  'Requester Email',
  'Requester_Email',
  'Requester_Name',
  'Created_by_flat_field_email',
  'Project_ID_Hidden',
  'Supporting_Document_Names',
  'Comments',
])

const SUBTASK_KEYS = new Set([
  'Sub_task_Name',
  'Sub_task_Priority',
  'TStatus',
  'SubTask_Summary',
  'Start_Date',
  'End_Date',
  'Dependent_ON',
  'Choose_Subtask',
  'Task_ID_Hidden',
  'Assignee_1',
  'Assignee',
  'Assignee_Name',
  'Assignee_Email',
  'Assignee_Email_Extracted',
  'Requester Email',
  'Requester_Email',
  'Requester_Name',
  'Created_by_flat_field_email',
  'ProjectName',
  'Comments',
])

const PROJECT_KEYS = new Set([
  'Name',
  'Project_Name',
  'Company_Name',
  'Project_Type',
  'Project_Category',
  'Priority_1',
  'Start_Date',
  'End_Date',
  'Risk',
  'Risk_Mitigation_Details',
  'Business_Owner',
  'Sponsor',
  'Project_Owner',
  'Project_Manager',
  'COS_Owner',
  'TCOEfforts',
  'Governance_Frequency',
  'Vendor_Name',
  'Tech_Stack',
  'CB_Analysis_Document_Available',
  'AI_Usage',
  'BRD_Available_1',
  'Process_Document_1',
  'Suuport_Available',
  'Reports_Available',
  'Integrated_with_Tally',
  'Integrated_with_SAP',
  'Integrated_with_Power_BI',
  'Assignee_Name',
  'Assignee_Email',
  'Assignee_Email_Extracted',
  'Requester Email',
  'Requester_Email',
  'Requester_Name',
  'Created_by_flat_field_email',
  'AssignedTo',
])

function pick(fields, keys) {
  const out = {}
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(fields, key)) continue
    const value = fields[key]
    if (value === undefined || value === null || value === '') continue
    out[key] = value
  }
  return out
}

const WEBHOOK_ONLY_KEYS = new Set([
  'Assignee_Name',
  'Assignee_Email',
  'Assignee_Email_Extracted',
  'Requester Email',
  'Requester_Name',
  'AssignedTo',
  'Secondary_Assignee_Name',
  'Secondary_Assignee_Email',
])

const PROCESS_SUBTASK_KEYS = new Set([
  '_id',
  'Sub_task_Name',
  'Sub_task_Priority',
  'TStatus',
  'Start_Date',
  'End_Date',
  'Dependent_ON',
  'Choose_Subtask',
  'Task_ID_Hidden',
  'Assignee_1',
  'SubTask_Summary',
  'Comments',
])

const PROCESS_TASK_KEYS = new Set([
  '_id',
  'Sub_Task_Name',
  'Task_Priority',
  'Start_Date',
  'End_Date',
  'Task_Status',
  'Task_type',
  'Task_Detail',
  'Project',
  'Entity',
  'Functions',
  'Function_Type',
  'Is_Dependent_on_another_Task',
  'Dependent_On',
  'Assigned_To',
  'Requester_Email',
  'Created_by_flat_field_email',
  'Project_ID_Hidden',
  'Comments',
])

export function sanitizeCreateFields(source, fields = {}) {
  const src = String(source || '').trim().toLowerCase()
  const raw = fields && typeof fields === 'object' ? { ...fields } : {}

  if (raw.Is_Dependent != null && raw.Dependent_ON == null) {
    raw.Dependent_ON = toKissflowBool(raw.Is_Dependent)
  }
  if (raw.Is_Dependent != null && raw.Is_Dependent_on_another_Task == null) {
    raw.Is_Dependent_on_another_Task = toKissflowBool(raw.Is_Dependent)
  }
  if (raw.Start_Date) raw.Start_Date = toKissflowDate(raw.Start_Date) || raw.Start_Date
  if (raw.End_Date) raw.End_Date = toKissflowDate(raw.End_Date) || raw.End_Date

  const assignee = kissflowUserFromPerson(raw.Assigned_To || raw.Assignee_1)

  if (src === 'task') {
    return {
      ...pick(raw, TASK_KEYS),
      Assigned_To: toKissflowUserField(raw.Assigned_To || raw.AssignedTo) || null,
      AssignedTo: toKissflowUserField(raw.AssignedTo || raw.Assigned_To) || null,
      Is_Dependent_on_another_Task: toKissflowBool(raw.Is_Dependent_on_another_Task),
    }
  }

  if (src === 'subtask') {
    const subAssignee = toKissflowUserField(assignee)
    return {
      ...pick(raw, SUBTASK_KEYS),
      Assignee_1: subAssignee || null,
      ...(assignee?.Name || assignee?.Email
        ? { Assignee: assignee.Name || assignee.Email }
        : {}),
      Dependent_ON: toKissflowBool(raw.Dependent_ON),
    }
  }

  if (src === 'project') {
    return {
      ...pick(raw, PROJECT_KEYS),
      Business_Owner: toKissflowUserField(raw.Business_Owner) || null,
      AssignedTo: toKissflowUserField(raw.AssignedTo || raw.Business_Owner) || null,
      Sponsor: toKissflowUserField(raw.Sponsor) || null,
      Project_Owner: toKissflowUserField(raw.Project_Owner) || null,
      Project_Manager: toKissflowUserField(raw.Project_Manager) || null,
      COS_Owner: toKissflowUserField(raw.COS_Owner) || null,
    }
  }

  return pick(raw, new Set(Object.keys(raw)))
}

/** Process PUT — only fields that exist on the Kissflow flow. */
export function sanitizeProcessUpdateFields(source, fields = {}) {
  const src = String(source || '').trim().toLowerCase()
  const cleaned = sanitizeCreateFields(src, fields)
  for (const key of WEBHOOK_ONLY_KEYS) delete cleaned[key]
  if (src === 'task') {
    return {
      ...pick(cleaned, PROCESS_TASK_KEYS),
      Assigned_To: toKissflowUserField(cleaned.Assigned_To) || null,
      Is_Dependent_on_another_Task: toKissflowBool(cleaned.Is_Dependent_on_another_Task),
    }
  }
  if (src === 'subtask') {
    return {
      ...pick(cleaned, PROCESS_SUBTASK_KEYS),
      Assignee_1: toKissflowUserField(cleaned.Assignee_1) || null,
      Dependent_ON: toKissflowBool(cleaned.Dependent_ON),
    }
  }
  return cleaned
}
