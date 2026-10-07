import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const kfHeaders = [
  { key: 'Accept', value: 'application/json' },
  { key: 'Content-Type', value: 'application/json' },
  { key: 'X-Access-Key-Id', value: '{{kf_access_key_id}}' },
  { key: 'X-Access-Key-Secret', value: '{{kf_access_key_secret}}' },
]

const assignee = {
  _id: 'UsDTb7E7dFmW',
  Kind: 'User',
  Name: '{{user_name}}',
  Email: '{{user_email}}',
}

function url(path, query = []) {
  const qs = query.length ? `?${query.map(([k, v]) => `${k}=${v}`).join('&')}` : ''
  return `{{kf_origin}}${path}${qs}`
}

function get(name, path, query = []) {
  return {
    name,
    request: {
      method: 'GET',
      header: kfHeaders,
      url: url(path, query),
    },
  }
}

function send(name, method, path, body, headers = kfHeaders) {
  const item = {
    name,
    request: {
      method,
      header: headers,
      url: url(path),
    },
  }
  if (body !== undefined) {
    item.request.body = {
      mode: 'raw',
      raw: JSON.stringify(body, null, 2),
      options: { raw: { language: 'json' } },
    }
  }
  return item
}

const appQ = [['_application_id', '{{app_id}}']]
const pageQ = [
  ['page_number', '{{page_number}}'],
  ['page_size', '{{page_size}}'],
]
const adminItemQ = [
  ...pageQ,
  ['apply_preference', '0'],
]
const adminItemPrefQ = [
  ...pageQ,
  ['apply_preference', '1'],
]

const webhookHeaders = [
  { key: 'Accept', value: 'application/json' },
  { key: 'Content-Type', value: 'application/json' },
]

const webhookTask = {
  source: 'task',
  project: null,
  task: {
    Sub_Task_Name: 'Postman Task',
    Task_Priority: 'High',
    Start_Date: '2026-09-16',
    End_Date: '2026-09-30',
    Task_type: 'Development',
    Task_Status: 'Open',
    Is_Dependent_on_another_Task: false,
    Assigned_To: assignee,
    Assignee_Name: assignee.Name,
    Assignee_Email: assignee.Email,
    Submitted_At: '2026-09-16T10:00:00.000Z',
  },
  subtask: null,
}

const webhookSubtask = {
  source: 'subtask',
  project: null,
  task: null,
  subtask: {
    Sub_task_Name: 'Postman Subtask',
    Sub_task_Priority: 'Medium',
    TStatus: 'Open',
    Start_Date: '2026-09-16',
    End_Date: '2026-09-30',
    Dependent_ON: false,
    Assignee_1: assignee,
    Assignee: assignee.Name,
    Task_ID_Hidden: 'Task-PRJ-001',
    Submitted_At: '2026-09-16T10:00:00.000Z',
  },
}

const webhookProject = {
  source: 'project',
  project: {
    Project_Name: 'Postman Project',
    Name: 'Postman Project',
    Project_Status: 'Planning',
    Priority_1: 'High',
    Start_Date: '2026-09-16',
    End_Date: '2026-12-31',
    Business_Owner: assignee,
    Submitted_At: '2026-09-16T10:00:00.000Z',
  },
  task: null,
  subtask: null,
}

const collection = {
  info: {
    name: 'PM Kissflow APIs',
    description:
      'Complete Kissflow calls used by Project Management Tracker.\nImport this collection + PM-Kissflow.dev (or .live) environment.\n\nWebhook create has NO access-key headers.\nREST GETs/POSTs/PUTs use X-Access-Key-Id / X-Access-Key-Secret.\nDevelopment REST often returns 401 with these keys; webhook is the create path.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  item: [
    {
      name: '1. Users',
      item: [
        get('Search users by email', '/user/2/{{kf_account}}/', [
          ['page_number', '1'],
          ['page_size', '50'],
          ['user_type', 'User'],
          ['active_user', 'true'],
          ['q', '{{user_email}}'],
        ]),
        get('User by id', '/user/2/{{kf_account}}/{{user_id}}'),
        get('Active users page', '/user/2/{{kf_account}}/', [
          ['page_number', '1'],
          ['page_size', '100'],
          ['user_type', 'User'],
          ['active_user', 'true'],
        ]),
      ],
    },
    {
      name: '2. Projects (case Project_Management_A01)',
      item: [
        get('Project fields', '/case/2/{{kf_account}}/{{case_id}}/fields'),
        get('Project list (page)', '/case/2/{{kf_account}}/{{case_id}}/list', pageQ),
        get(
          'Project view list fallback',
          '/case/2/{{kf_account}}/{{case_id}}/view/Project_Management_A01_all/list/items',
          [
            ['page_number', '{{page_number}}'],
            ['page_size', '100'],
          ],
        ),
        get('Project item by id', '/case/2/{{kf_account}}/{{case_id}}/{{instance_id}}'),
        get('Project item activity', '/case/2/{{kf_account}}/{{case_id}}/{{instance_id}}/activity'),
        send('Create project draft', 'POST', '/case/2/{{kf_account}}/{{case_id}}', {
          Project_Name: 'Postman Project',
          Name: 'Postman Project',
          Project_Status: 'Planning',
          Business_Owner: assignee,
        }),
      ],
    },
    {
      name: '3. Tasks (process Project_Sub_Task_A01)',
      item: [
        get(
          'Admin task list apply_preference=0',
          '/process/2/{{kf_account}}/admin/{{task_process_id}}/item',
          adminItemQ,
        ),
        get(
          'Admin task list apply_preference=1',
          '/process/2/{{kf_account}}/admin/{{task_process_id}}/item',
          adminItemPrefQ,
        ),
        get('Admin task item', '/process/2/{{kf_account}}/admin/{{task_process_id}}/{{instance_id}}', appQ),
        get(
          'Task instance + activity',
          '/process/2/{{kf_account}}/{{task_process_id}}/{{instance_id}}/{{activity_id}}',
          appQ,
        ),
        get('Task instance', '/process/2/{{kf_account}}/{{task_process_id}}/{{instance_id}}', appQ),
        get('Task progress', '/process/2/{{kf_account}}/{{task_process_id}}/{{instance_id}}/progress'),
        get('My items status count', '/process/2/{{kf_account}}/{{task_process_id}}/myitems/status/count', appQ),
        get('My items inprogress', '/process/2/{{kf_account}}/{{task_process_id}}/myitems/inprogress', [
          ...appQ,
          ['apply_preference', 'true'],
          ['page_number', '1'],
          ['page_size', '50'],
          ['skip_aggregation', 'true'],
        ]),
        get('Pending activity count', '/process/2/{{kf_account}}/{{task_process_id}}/pending/activity/count', appQ),
        get('Participated activity count', '/process/2/{{kf_account}}/{{task_process_id}}/participated/activity/count', appQ),
        get(
          'Admin tasks report count',
          '/process-report/2/{{kf_account}}/{{task_process_id}}/Live_Sub_Task_Task_Wise_A00/count',
        ),
        get(
          'Admin tasks report item',
          '/process-report/2/{{kf_account}}/{{task_process_id}}/Live_Sub_Task_Task_Wise_A00/{{instance_id}}',
        ),
        send('Create task draft (often 401 on development)', 'POST', '/process/2/{{kf_account}}/{{task_process_id}}?_application_id={{app_id}}', {}),
        send(
          'Update task (PUT)',
          'PUT',
          '/process/2/{{kf_account}}/{{task_process_id}}/{{instance_id}}/{{activity_id}}',
          {
            Sub_Task_Name: 'Postman Task Updated',
            Task_Priority: 'High',
            Start_Date: '2026-09-16',
            End_Date: '2026-09-30',
            Assigned_To: assignee,
          },
        ),
      ],
    },
    {
      name: '4. Subtasks (process Sub_Task_Process_A00)',
      item: [
        get(
          'Admin subtask list apply_preference=0',
          '/process/2/{{kf_account}}/admin/{{subtask_process_id}}/item',
          adminItemQ,
        ),
        get(
          'Admin subtask item',
          '/process/2/{{kf_account}}/admin/{{subtask_process_id}}/{{instance_id}}',
          appQ,
        ),
        get(
          'Subtask instance + activity',
          '/process/2/{{kf_account}}/{{subtask_process_id}}/{{instance_id}}/{{activity_id}}',
          appQ,
        ),
        send(
          'Create subtask draft (often 401 on development)',
          'POST',
          '/process/2/{{kf_account}}/{{subtask_process_id}}?_application_id={{app_id}}',
          {},
        ),
        send(
          'Update subtask (PUT)',
          'PUT',
          '/process/2/{{kf_account}}/{{subtask_process_id}}/{{instance_id}}/{{activity_id}}',
          {
            Sub_task_Name: 'Postman Subtask Updated',
            Sub_task_Priority: 'Medium',
            TStatus: 'Open',
            Start_Date: '2026-09-16',
            End_Date: '2026-09-30',
            Dependent_ON: false,
            Assignee_1: assignee,
          },
        ),
      ],
    },
    {
      name: '5. My Team reports',
      item: [
        get(
          'My Team projects',
          '/case-report/2/{{kf_account}}/{{case_id}}/My_Team_A05',
          [
            ['apply_preference', '1'],
            ['page_number', '1'],
            ['page_size', '1000'],
            ['$final_l1_manager_email', '{{user_email}}'],
            ['$final_l2_manager_email', '{{user_email}}'],
          ],
        ),
        get(
          'My Team tasks',
          '/process-report/2/{{kf_account}}/{{task_process_id}}/My_Team_A04',
          [
            ['apply_preference', '1'],
            ['page_number', '1'],
            ['page_size', '1000'],
            ['$final_l1_manager_email', '{{user_email}}'],
            ['$final_l2_manager_email', '{{user_email}}'],
          ],
        ),
        get(
          'My Team subtasks',
          '/process-report/2/{{kf_account}}/{{subtask_process_id}}/MyTeam_A00',
          [
            ['apply_preference', '1'],
            ['page_number', '1'],
            ['page_size', '1000'],
            ['$final_l1_manager_email', '{{user_email}}'],
            ['$final_l2_manager_email', '{{user_email}}'],
          ],
        ),
      ],
    },
    {
      name: '6. Create webhook (no access key)',
      description:
        'Public integration webhook. Do not send X-Access-Key headers. Nested source + project/task/subtask buckets.',
      item: [
        send(
          'Create TASK via webhook',
          'POST',
          '/integration/2/{{kf_account}}/webhook/{{webhook_token}}',
          webhookTask,
          webhookHeaders,
        ),
        send(
          'Create SUBTASK via webhook',
          'POST',
          '/integration/2/{{kf_account}}/webhook/{{webhook_token}}',
          webhookSubtask,
          webhookHeaders,
        ),
        send(
          'Create PROJECT via webhook',
          'POST',
          '/integration/2/{{kf_account}}/webhook/{{webhook_token}}',
          webhookProject,
          webhookHeaders,
        ),
      ],
    },
    {
      name: '7. User Master (not Kissflow)',
      item: [
        {
          name: 'List User Master',
          request: {
            method: 'GET',
            header: [
              { key: 'Accept', value: 'application/json' },
              { key: 'Authorization', value: 'Bearer {{user_master_token}}' },
            ],
            url: '{{user_master_url}}',
          },
        },
      ],
    },
  ],
  variable: [
    { key: 'kf_origin', value: 'https://development-refexgroup.kissflow.com' },
    { key: 'kf_account', value: 'AcCMptp3yqcn' },
    { key: 'kf_access_key_id', value: '' },
    { key: 'kf_access_key_secret', value: '' },
    { key: 'app_id', value: 'Project_Management_A01' },
    { key: 'case_id', value: 'Project_Management_A01' },
    { key: 'task_process_id', value: 'Project_Sub_Task_A01' },
    { key: 'subtask_process_id', value: 'Sub_Task_Process_A00' },
    { key: 'page_number', value: '1' },
    { key: 'page_size', value: '500' },
    { key: 'instance_id', value: '' },
    { key: 'activity_id', value: '' },
    { key: 'user_id', value: '' },
    { key: 'user_name', value: '' },
    { key: 'user_email', value: '' },
    { key: 'webhook_token', value: '' },
    { key: 'user_master_url', value: 'https://refexone.com/api/v1/user-master' },
    { key: 'user_master_token', value: '' },
  ],
}

const out = join(__dirname, 'PM-Kissflow.postman_collection.json')
writeFileSync(out, JSON.stringify(collection, null, 2))
console.log('Wrote', out)
