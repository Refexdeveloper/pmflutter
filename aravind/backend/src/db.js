import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(ROOT, '..', 'data')
mkdirSync(DATA_DIR, { recursive: true })

export const db = new DatabaseSync(join(DATA_DIR, 'pm_tracker.db'))

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    first_name TEXT,
    email TEXT UNIQUE,
    role TEXT NOT NULL DEFAULT 'Employee'
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    display_id TEXT,
    name TEXT NOT NULL,
    owner TEXT,
    owner_email TEXT,
    owner_avatar TEXT,
    business_owner TEXT,
    sponsor TEXT,
    company_name TEXT,
    line_of_business TEXT,
    function_type TEXT,
    department TEXT,
    priority TEXT,
    start_date TEXT,
    end_date TEXT,
    original_end_date TEXT,
    revised_end_date TEXT,
    progress INTEGER DEFAULT 0,
    rag TEXT,
    health TEXT,
    status TEXT,
    delay_days INTEGER DEFAULT 0,
    delay TEXT,
    created_at TEXT,
    description TEXT
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    business_id TEXT,
    name TEXT NOT NULL,
    status TEXT,
    priority TEXT,
    assignee TEXT,
    assignee_avatar TEXT,
    start_date TEXT,
    end_date TEXT,
    company_name TEXT,
    line_of_business TEXT,
    project_id TEXT,
    project_name TEXT,
    delay_days INTEGER DEFAULT 0,
    delay TEXT,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS subtasks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT,
    priority TEXT,
    assignee TEXT,
    parent_task_id TEXT,
    parent_task_name TEXT,
    project_id TEXT,
    project_name TEXT,
    start_date TEXT,
    end_date TEXT,
    created_at TEXT
  );
`)

function taskRag(status, delayDays) {
  const s = String(status || '').toLowerCase()
  if ((delayDays || 0) > 0 || s.includes('overdue')) return 'Red'
  if (s.includes('complete') || s.includes('closed') || s.includes('done')) return 'Green'
  return 'Amber'
}

export function rowToProject(row) {
  if (!row) return null
  return {
    id: row.id,
    displayId: row.display_id,
    name: row.name,
    owner: row.owner,
    ownerEmail: row.owner_email,
    ownerAvatar: row.owner_avatar,
    businessOwner: row.business_owner,
    sponsor: row.sponsor,
    companyName: row.company_name,
    lineOfBusiness: row.line_of_business,
    functionType: row.function_type,
    department: row.department,
    priority: row.priority,
    startDate: row.start_date,
    end: row.end_date,
    endDate: row.end_date,
    originalEndDate: row.original_end_date,
    revisedEndDate: row.revised_end_date,
    progress: row.progress,
    rag: row.rag,
    health: row.health,
    status: row.status,
    delayDays: row.delay_days,
    delay: row.delay,
    createdAt: row.created_at,
    description: row.description,
    totalTasks: 0,
    completedTasks: 0,
  }
}

export function rowToTask(row) {
  if (!row) return null
  const delayDays = row.delay_days || 0
  return {
    id: row.id,
    businessId: row.business_id,
    taskId: row.business_id,
    taskBusinessId: row.business_id,
    name: row.name,
    taskName: row.name,
    status: row.status,
    priority: row.priority,
    assignee: row.assignee,
    assignedTo: row.assignee,
    assigneeAvatar: row.assignee_avatar,
    startDate: row.start_date,
    endDate: row.end_date,
    companyName: row.company_name,
    lineOfBusiness: row.line_of_business,
    projectId: row.project_id,
    projectName: row.project_name,
    delayDays,
    delay: row.delay,
    createdAt: row.created_at,
    rag: taskRag(row.status, delayDays),
  }
}

export function rowToSubtask(row) {
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    taskName: row.name,
    status: row.status,
    priority: row.priority,
    assignee: row.assignee,
    assignedTo: row.assignee,
    parentTaskId: row.parent_task_id,
    parentTaskName: row.parent_task_name,
    parentTaskBusinessId: row.parent_task_id,
    projectId: row.project_id,
    projectName: row.project_name,
    startDate: row.start_date,
    endDate: row.end_date,
    due: row.end_date,
    createdAt: row.created_at,
  }
}
