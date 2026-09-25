/** Map list rows into in-app create/update form defaults. */

function ymd(value) {
  const text = String(value || '').trim()
  if (!text || text === '—' || text === '-') return ''
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : ''
}

function displayText(value) {
  if (value == null || value === '') return ''
  if (typeof value === 'object') {
    return String(value.Name || value.name || value.Email || value.email || '').trim()
  }
  const text = String(value).trim()
  return !text || text === '—' ? '' : text
}

function personLabel(name, email) {
  const n = displayText(name)
  const e = displayText(email)
  if (n && e) return `${n} (${e})`
  return n || e
}

function firstPkId(...values) {
  for (const value of values) {
    const text = String(Array.isArray(value) ? value[0] : value || '').trim()
    if (/^Pk[A-Za-z0-9]+$/.test(text)) return text
  }
  return ''
}

function instanceIdOf(row) {
  const raw = row?.raw ?? {}
  return firstPkId(
    row?.InstanceID,
    row?.instanceId,
    raw?._id,
    raw?._item_id,
    raw?.Instance_ID,
    raw?.InstanceID,
    row?._id,
    row?.id,
  )
}

function activityIdOf(row) {
  const raw = row?.raw ?? {}
  return firstPkId(
    row?.ActivityID,
    row?.activityId,
    row?.ActivityInstanceID,
    row?._activity_instance_id,
    raw?._activity_instance_id,
    raw?.Activity_Instance_ID,
    raw?.ActivityInstanceID,
    raw?.ActivityID,
    raw?.activityInstanceId,
  )
}

export function taskRowToFormDefaults(row) {
  if (!row || typeof row !== 'object') return { mode: 'update' }
  const raw = row.raw && typeof row.raw === 'object' ? row.raw : {}
  const assignedTo = personLabel(
    row.assignedTo || row.assignee || raw.Assigned_To,
    row.assignedToEmail || raw.externalemail || raw.Assigned_To?.Email,
  )
  const status = displayText(row.status || raw.Task_Status || raw._status)
  return {
    mode: 'update',
    instanceId: instanceIdOf(row),
    activityId: activityIdOf(row),
    accountId: displayText(row.kfAccountId || raw.kfAccountId),
    taskName: displayText(row.taskName || row.name || raw.Sub_Task_Name || raw.Name),
    priority: displayText(row.priority || raw.Task_Priority),
    projectName: displayText(row.projectName || row.project || raw.Project_Name) || 'Individual Task',
    projectId: displayText(row.projectId || raw.Project_ID_Hidden),
    taskType: displayText(row.taskType || raw.Task_type || raw.Task_Type || raw.task_type),
    entity: displayText(row.entity || raw.Entity),
    functions: displayText(row.functions || raw.Functions || raw.Function_Type),
    startDate: ymd(row.startDate || row.start || raw.Start_Date),
    endDate: ymd(row.endDate || row.end || raw.End_Date),
    assignedTo,
    status: status && status !== '—' ? status : 'Open',
    detail: displayText(raw.Task_Detail || row.detail),
    comments: displayText(raw.Comments || raw.comments || row.comments || row.Comments),
    row,
  }
}

export function subtaskRowToFormDefaults(row) {
  if (!row || typeof row !== 'object') return { mode: 'update' }
  const raw = row.raw && typeof row.raw === 'object' ? row.raw : {}
  const assignee = personLabel(
    row.assignedTo || row.assignee || raw.Assignee_1,
    row.assignedToEmail || raw.externalemail || raw.Assignee_1?.Email,
  )
  const priority = displayText(row.priority || raw.Sub_task_Priority)
  return {
    mode: 'update',
    instanceId: instanceIdOf(row),
    activityId: activityIdOf(row),
    accountId: displayText(row.kfAccountId || raw.kfAccountId),
    name: displayText(
      row.subtaskName || row.taskName || row.name || raw.Sub_task_Name || raw.Name,
    ),
    priority: ['High', 'Medium', 'Low'].includes(priority) ? priority : '',
    assignee,
    startDate: ymd(row.startDate || row.start || raw.Start_Date),
    endDate: ymd(row.endDate || row.end || raw.End_Date),
    summary: displayText(row.summary || raw.SubTask_Summary),
    taskId: displayText(
      row.parentTaskBusinessId ||
        row.parentTaskId ||
        row.taskId ||
        raw.Task_ID_Hidden,
    ),
    dependent: Boolean(raw.Dependent_ON),
    chooseSubtask: displayText(raw.Choose_Subtask),
    status: displayText(row.status || raw.TStatus) || 'Open',
    comments: displayText(raw.Comments || raw.comments || row.comments || row.Comments),
    row,
  }
}
