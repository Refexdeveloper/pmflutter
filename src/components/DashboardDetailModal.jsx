import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toInitials } from '../lib/kfProjectDashboard.js';
import { requestOpenTaskDetails } from '../lib/pmTaskDetails.js';
import { requestOpenSubtaskDetails } from '../lib/pmSubtaskDetails.js';
import { taskRowToFormDefaults, subtaskRowToFormDefaults } from '../lib/pmFormDefaults.js';

function formatProjectRef(displayId, rowId) {
  const raw = String(displayId ?? rowId ?? '').trim();
  if (!raw) return 'Task-NA';
  if (raw.startsWith('Task-')) return raw;
  return raw;
}

function StatusBadge({ status }) {
  const v = String(status || '').trim();
  const sLower = v.toLowerCase();
  const cfg =
    sLower === 'completed' || sLower === 'closed' || sLower === 'done'
      ? { bg: 'bg-green-50', text: 'text-[#43A047]', dot: 'bg-[#43A047]' }
      : sLower.includes('progress') || sLower.includes('review')
        ? { bg: 'bg-blue-50', text: 'text-[#1E88E5]', dot: 'bg-[#1E88E5]' }
        : sLower.includes('hold') || sLower.includes('blocked')
          ? { bg: 'bg-orange-50', text: 'text-[#FB8C00]', dot: 'bg-[#FB8C00]' }
          : { bg: 'bg-gray-100', text: 'text-[#7F8C8D]', dot: 'bg-gray-400' };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-0.5 text-[10px] font-semibold sm:px-2.5 sm:py-1 sm:text-xs ${cfg.bg} ${cfg.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {v || '—'}
    </span>
  );
}

function RagPill({ rag }) {
  if (rag === 'Red') {
    return <span className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1 text-xs font-semibold text-[#E53935]">Critical</span>;
  }
  if (rag === 'Amber') {
    return <span className="inline-flex items-center gap-1 rounded-lg bg-orange-50 px-2.5 py-1 text-xs font-semibold text-[#FB8C00]">At Risk</span>;
  }
  return <span className="inline-flex items-center gap-1 rounded-lg bg-green-50 px-2.5 py-1 text-xs font-semibold text-[#43A047]">On Track</span>;
}

function displayFieldValue(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'object') {
    return String(value.Name || value.name || value.Value || value.value || value.Project_ID || value._id || '').trim();
  }
  return String(value).trim();
}

function stripHtmlToText(html) {
  if (!html) return '';
  return String(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function resolveAttachmentList(raw) {
  const candidates = [
    raw?.Supporting_Document,
    raw?.Supporting_Documents,
    raw?.Attachment,
    raw?.Attachments,
    raw?.Documents,
  ];
  for (const c of candidates) {
    if (!c) continue;
    if (Array.isArray(c)) return c.filter(Boolean);
    return [c];
  }
  return [];
}

function resolveTaskFormFields(row) {
  const r = row?.raw ?? {};
  const projectRef = r?.Project_ID || r?.Project_Lookup || r?.Project_Details || r?.Datelookup || {};
  const projectBusinessId =
    displayFieldValue(projectRef?.Project_ID) ||
    displayFieldValue(r?.Project_ID_Details) ||
    displayFieldValue(row?.projectRef) ||
    displayFieldValue(row?.projectId) ||
    '';
  const projectName =
    displayFieldValue(row?.projectName) ||
    displayFieldValue(projectRef?.Project_Name) ||
    displayFieldValue(projectRef?.Name) ||
    '';
  const itemId =
    displayFieldValue(projectRef?.Item_Id) ||
    displayFieldValue(projectRef?.Item_ID) ||
    displayFieldValue(projectRef?._item_id) ||
    displayFieldValue(row?.projectId) ||
    projectBusinessId;
  const detailRaw = r?.Task_Detail || r?.Description || r?.Notes || r?.Task_Details || '';

  return {
    taskId:
      displayFieldValue(row?.taskId) ||
      displayFieldValue(r?.Subtaxk_id) ||
      displayFieldValue(r?.Task_ID_Formulated) ||
      displayFieldValue(row?.id) ||
      '—',
    projectBusinessId: projectBusinessId || '—',
    projectName: projectName || '—',
    itemId: itemId || '—',
    taskType: displayFieldValue(row?.taskType || r?.Task_Type || r?.Task_type || r?.Type) || '—',
    taskName: displayFieldValue(row?.taskName || r?.Sub_Task_Name || r?.Name) || '—',
    entity: displayFieldValue(row?.entity || r?.Entity || r?.Entity_1) || '—',
    functions: displayFieldValue(row?.functions || r?.Functions || r?.Function || r?.Department) || '—',
    startDate: displayFieldValue(row?.startDate) || '—',
    endDate: displayFieldValue(row?.endDate) || '—',
    assignedTo:
      displayFieldValue(row?.assignedTo || r?.Assigned_To || r?.externalemail || row?.assignedToEmail) || '—',
    priority: displayFieldValue(row?.priority || r?.Task_Priority || r?.Priority) || '—',
    status: displayFieldValue(row?.status || r?.Task_Status || r?._status) || '—',
    detailText: stripHtmlToText(detailRaw) || '',
    documents: resolveAttachmentList(r),
    fromName: displayFieldValue(r?._created_by) || '',
  };
}

function DetailLabel({ children }) {
  return (
    <p className="mb-0.5 text-[11px] font-medium leading-none text-slate-500">
      {children}
    </p>
  );
}

function DetailValue({ children, highlight = false, className = '' }) {
  const empty = children == null || children === '' || children === '—';
  return (
    <p
      className={`text-[13px] font-medium leading-snug text-slate-700 sm:text-sm ${
        highlight ? 'text-[#E53935]' : empty ? 'text-slate-400' : ''
      } ${className}`}
    >
      {empty ? '—' : children}
    </p>
  );
}

/** Compact read-only field — form-like size + clear contrast on tinted section bodies */
function DetailTile({ label, children, highlight = false, className = '' }) {
  return (
    <div
      className={`rounded-lg border px-2.5 py-1.5 sm:px-3 sm:py-2 ${
        highlight
          ? 'border-red-200/90 bg-red-50'
          : 'border-slate-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]'
      } ${className}`}
    >
      <DetailLabel>{label}</DetailLabel>
      {children}
    </div>
  );
}

function DetailSectionCard({ title, icon, accent = 'blue', children }) {
  const accents = {
    blue: {
      head: 'from-white to-blue-50/50',
      body: 'bg-[#F1F5FB]',
    },
    indigo: {
      head: 'from-white to-indigo-50/50',
      body: 'bg-[#F3F2FB]',
    },
    rose: {
      head: 'from-white to-rose-50/60',
      body: 'bg-[#FBF1F3]',
    },
  };
  const a = accents[accent] || accents.blue;
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm shadow-slate-200/50">
      <div className={`flex items-center gap-2 border-b border-slate-100 bg-gradient-to-r px-3.5 py-2.5 sm:px-4 ${a.head}`}>
        {icon ? <i className={`${icon} text-sm text-[#1E88E5]`} aria-hidden /> : null}
        <h3 className="text-[13px] font-medium text-slate-700 sm:text-sm">{title}</h3>
      </div>
      <div className={`p-3 sm:p-3.5 ${a.body}`}>{children}</div>
    </div>
  );
}

function formatTaskIdRef(value) {
  if (value == null || value === '') return '—';
  if (typeof value === 'object' && !Array.isArray(value)) {
    const name = displayFieldValue(value.Sub_Task_Name || value.Sub_task_Name);
    const businessId = displayFieldValue(value.Subtaxk_id);
    if (name && name !== '—' && businessId && businessId !== '—') return `${name} (${businessId})`;
    if (name && name !== '—') return name;
    if (businessId && businessId !== '—') return businessId;
    return displayFieldValue(value.Name) || '—';
  }
  return displayFieldValue(value) || '—';
}

function formatUserRef(value) {
  if (Array.isArray(value)) {
    const names = value.map((v) => displayFieldValue(v)).filter((n) => n && n !== '—');
    return names.length ? names.join(', ') : '—';
  }
  return displayFieldValue(value) || '—';
}

function formatDateTimeValue(value) {
  if (value == null || value === '') return '—';
  const s = String(value).trim();
  if (!s) return '—';
  // Prefer date-only display for ISO datetimes / YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
    }
    return s.slice(0, 10);
  }
  return s;
}

/** My Team subtask popup — Name, created, assignee, parent, dates, summary, status, priority. */
function resolveSubtaskFormFields(row) {
  const r = row?.raw ?? row ?? {};
  const taskIdRef = r?.Task_ID ?? null;
  const parentName =
    (taskIdRef && typeof taskIdRef === 'object'
      ? displayFieldValue(taskIdRef.Sub_Task_Name || taskIdRef.Sub_task_Name)
      : '') || '—';
  const parentId =
    (taskIdRef && typeof taskIdRef === 'object'
      ? displayFieldValue(taskIdRef.Subtaxk_id)
      : '') ||
    displayFieldValue(r?.Task_ID_Hidden) ||
    '—';

  return {
    name:
      displayFieldValue(r?.Name) ||
      displayFieldValue(r?.Sub_task_Name) ||
      displayFieldValue(row?.taskName) ||
      '—',
    createdAt: formatDateTimeValue(r?._created_at),
    currentAssignedTo:
      formatUserRef(r?._current_assigned_to) ||
      formatUserRef(r?.Assignee_1) ||
      displayFieldValue(r?.externalemail) ||
      displayFieldValue(row?.assignedToEmail) ||
      displayFieldValue(row?.assignedTo) ||
      '—',
    parentTaskName: parentName,
    parentTaskId: parentId,
    parentTaskDisplay: formatTaskIdRef(taskIdRef),
    startDate: formatDateTimeValue(r?.Start_Date || row?.startDate),
    endDate: formatDateTimeValue(r?.End_Date || row?.endDate),
    summary:
      displayFieldValue(r?.SubTask_Summary) ||
      displayFieldValue(row?.summary) ||
      '—',
    status: displayFieldValue(r?.TStatus) || displayFieldValue(row?.status) || '—',
    priority:
      displayFieldValue(r?.Sub_task_Priority) ||
      displayFieldValue(r?.Sub_Task_Priority) ||
      displayFieldValue(row?.priority) ||
      '—',
  };
}

function TaskDetailFormView({ row, viewerName = 'User', isSubtask = false }) {
  if (isSubtask) {
    const f = resolveSubtaskFormFields(row);
    return (
      <div className="space-y-3 sm:space-y-3.5">
        <div className="flex flex-wrap items-start justify-between gap-2.5 rounded-2xl border border-slate-200/70 bg-white px-3.5 py-3 shadow-sm sm:px-4">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
              Subtask details
            </p>
            <h2 id="dash-detail-title" className="mt-0.5 text-lg font-semibold tracking-tight text-slate-800 sm:text-xl">
              {f.name !== '—' ? f.name : 'Subtask'}
            </h2>
            {f.parentTaskDisplay !== '—' ? (
              <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
                Parent · {f.parentTaskDisplay}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge status={f.status} />
            {f.priority !== '—' ? (
              <span className="inline-flex items-center rounded-lg bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-[#1E88E5]">
                {f.priority}
              </span>
            ) : null}
          </div>
        </div>

        <DetailSectionCard title="Details" icon="ri-node-tree" accent="blue">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <DetailTile label="Name" className="sm:col-span-2">
              <DetailValue>{f.name}</DetailValue>
            </DetailTile>
            <DetailTile label="Status">
              <StatusBadge status={f.status} />
            </DetailTile>
            <DetailTile label="Priority">
              <DetailValue>{f.priority}</DetailValue>
            </DetailTile>
            <DetailTile label="Assigned to">
              <div className="flex items-center gap-1.5">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1E88E5] text-[9px] font-bold text-white">
                  {toInitials(f.currentAssignedTo)}
                </div>
                <DetailValue>{f.currentAssignedTo}</DetailValue>
              </div>
            </DetailTile>
            <DetailTile label="Created">
              <DetailValue>{f.createdAt}</DetailValue>
            </DetailTile>
            <DetailTile label="Parent task" className="sm:col-span-2">
              <DetailValue>{f.parentTaskName}</DetailValue>
            </DetailTile>
            <DetailTile label="Parent task ID">
              <DetailValue className="font-mono text-[12px] sm:text-[13px]">{f.parentTaskId}</DetailValue>
            </DetailTile>
            <DetailTile label="Start date">
              <DetailValue>{f.startDate}</DetailValue>
            </DetailTile>
            <DetailTile label="End date">
              <DetailValue>{f.endDate}</DetailValue>
            </DetailTile>
            <DetailTile label="Sub-Task Summary" className="sm:col-span-2 lg:col-span-3">
              <DetailValue className="whitespace-pre-wrap">{f.summary}</DetailValue>
            </DetailTile>
          </div>
        </DetailSectionCard>
      </div>
    );
  }

  const f = resolveTaskFormFields(row);
  const from = f.fromName || viewerName || 'User';
  const docNames = (f.documents || [])
    .map((d) => displayFieldValue(d?.Name || d?.name || d?.filename || d?.FileName || d) || '')
    .filter(Boolean);
  const revisionHistory = Array.isArray(row?.revisionHistory) ? row.revisionHistory : [];
  const hasRevision = Boolean(row?.hasRevision && row?.revisedEndDate);
  const revisionEntries = hasRevision ? revisionHistory.slice(1) : [];
  const revisedCount = Number(row?.revisedCount) || revisionEntries.length;

  return (
    <div className="space-y-3 sm:space-y-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2.5 rounded-2xl border border-slate-200/70 bg-white px-3.5 py-3 shadow-sm sm:px-4">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
            Task details
          </p>
          <h2 id="dash-detail-title" className="mt-0.5 text-lg font-semibold tracking-tight text-slate-800 sm:text-xl">
            {f.taskName !== '—' ? f.taskName : 'Project Task'}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
            From {from}
            {f.projectName !== '—' ? ` · ${f.projectName}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={f.status} />
          {f.priority && f.priority !== '—' ? (
            <span className="inline-flex items-center rounded-lg bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-[#1E88E5]">
              {f.priority}
            </span>
          ) : null}
        </div>
      </div>

      <DetailSectionCard title="Overview" icon="ri-information-line" accent="blue">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <DetailTile label="Task ID">
            <DetailValue className="font-mono text-[12px] sm:text-[13px]">{f.taskId}</DetailValue>
          </DetailTile>
          <DetailTile label="Task type">
            <DetailValue>{f.taskType}</DetailValue>
          </DetailTile>
          <DetailTile label="Entity">
            <DetailValue>{f.entity}</DetailValue>
          </DetailTile>
          <DetailTile label="Functions">
            <DetailValue>{f.functions}</DetailValue>
          </DetailTile>
          <DetailTile label="Assigned to">
            <div className="flex items-center gap-1.5">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1E88E5] text-[9px] font-bold text-white">
                {toInitials(f.assignedTo)}
              </div>
              <DetailValue>{f.assignedTo}</DetailValue>
            </div>
          </DetailTile>
          <DetailTile label="Status">
            <StatusBadge status={f.status} />
          </DetailTile>
        </div>
      </DetailSectionCard>

      <DetailSectionCard title="Project context" icon="ri-folder-3-line" accent="indigo">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <DetailTile label="Project ID">
            <DetailValue className="font-mono text-[12px] sm:text-[13px]">{f.projectBusinessId}</DetailValue>
          </DetailTile>
          <DetailTile label="Project name">
            <DetailValue>{f.projectName}</DetailValue>
          </DetailTile>
          <DetailTile label="Item ID">
            <DetailValue className="font-mono text-[12px] sm:text-[13px]">{f.itemId}</DetailValue>
          </DetailTile>
        </div>
      </DetailSectionCard>

      <DetailSectionCard title="Schedule" icon="ri-calendar-schedule-line" accent="blue">
        <div className={`grid grid-cols-1 gap-2 sm:grid-cols-2 ${hasRevision ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
          <DetailTile label="Start date">
            <DetailValue>{f.startDate}</DetailValue>
          </DetailTile>
          <DetailTile label={hasRevision ? 'Previous end date' : 'End date'} highlight={!hasRevision && (f.status === 'Overdue' || Number(row?.delayDays) > 0)}>
            <DetailValue highlight={!hasRevision && (f.status === 'Overdue' || Number(row?.delayDays) > 0)}>
              {hasRevision
                ? (row?.previousEndDate || row?.originalEndDate || f.endDate)
                : f.endDate}
            </DetailValue>
          </DetailTile>
          {hasRevision ? (
            <DetailTile label="Latest revised end date" highlight>
              <DetailValue highlight>{row.revisedEndDate}</DetailValue>
            </DetailTile>
          ) : null}
          <DetailTile label="Delay" highlight={Number(row?.delayDays) > 0}>
            <DetailValue highlight={Number(row?.delayDays) > 0}>
              {Number(row?.delayDays) > 0 ? `+${row.delayDays} days` : 'On time'}
            </DetailValue>
          </DetailTile>
        </div>
      </DetailSectionCard>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <DetailSectionCard title="Task detail" icon="ri-file-text-line" accent="indigo">
          <div className="min-h-[4.5rem] whitespace-pre-wrap rounded-lg border border-slate-200/90 bg-white px-3 py-2 text-[13px] font-normal leading-relaxed text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            {f.detailText || <span className="text-slate-400">No details provided</span>}
          </div>
        </DetailSectionCard>
        <DetailSectionCard title="Supporting documents" icon="ri-attachment-2" accent="blue">
          {docNames.length > 0 ? (
            <ul className="space-y-1.5">
              {docNames.map((name) => (
                <li
                  key={name}
                  className="flex items-center gap-2 rounded-lg border border-slate-200/90 bg-white px-2.5 py-1.5 text-[13px] font-normal text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                >
                  <i className="ri-file-line text-sm text-[#1E88E5]" aria-hidden />
                  <span className="truncate">{name}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex min-h-[4.5rem] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white/70 px-3 text-[13px] text-slate-400">
              No documents attached
            </div>
          )}
        </DetailSectionCard>
      </div>

      {revisionEntries.length > 0 ? (
        <DetailSectionCard
          title={`Revision history (${revisedCount})`}
          icon="ri-history-line"
          accent="rose"
        >
          <div className="space-y-1.5">
            {revisionEntries.map((rev, idx) => (
              <div
                key={rev.key || `${rev.date}-${idx}`}
                className="rounded-lg border border-slate-200/90 bg-white px-2.5 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[12px] text-slate-600">
                    Updated on: <span className="font-medium text-slate-800">{rev.date || '—'}</span>
                  </p>
                  <p className="text-[11px] text-slate-500">{rev.revisedBy || 'System'}</p>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-slate-600">
                  <p>
                    Previous end date:{' '}
                    <span className="font-medium text-slate-500 line-through">{rev.previousEndDate || '—'}</span>
                  </p>
                  <i className="ri-arrow-right-line text-[11px] text-[#FB8C00]" aria-hidden />
                  <p>
                    Updated end date:{' '}
                    <span className="font-semibold text-[#FB8C00]">{rev.newEndDate || '—'}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </DetailSectionCard>
      ) : null}
    </div>
  );
}

function DelayRevisionDetailView({ row }) {
  const revisionHistory = Array.isArray(row?.revisionHistory) ? row.revisionHistory : [];
  const progress = Number(row?.progress || 0);
  const progressColor = progress >= 70 ? '#43A047' : progress >= 40 ? '#FB8C00' : '#E53935';
  const delayed = Number(row?.delayDays) > 0;

  return (
    <div className="space-y-3 sm:space-y-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2.5 rounded-2xl border border-slate-200/70 bg-white px-3.5 py-3 shadow-sm sm:px-4">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
            Delay &amp; revision
          </p>
          <h2 id="dash-detail-title" className="mt-0.5 text-lg font-semibold tracking-tight text-slate-800 sm:text-xl">
            {row?.name || 'Project details'}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
            {formatProjectRef(row?.displayId, row?.id)}
            {row?.owner ? ` · ${row.owner}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <RagPill rag={row?.rag} />
          {row?.status ? <StatusBadge status={row.status} /> : null}
        </div>
      </div>

      <DetailSectionCard title="Timeline impact" icon="ri-time-line" accent="rose">
        <div className={`grid grid-cols-1 gap-2 sm:grid-cols-2 ${row?.hasRevision || row?.revisedEndDate ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
          <DetailTile label={row?.hasRevision || row?.revisedEndDate ? 'Previous End Date' : 'End Date'}>
            <DetailValue>{row?.previousEndDate || '—'}</DetailValue>
          </DetailTile>
          {row?.hasRevision || row?.revisedEndDate ? (
            <DetailTile label="Latest Revised End Date" highlight>
              <DetailValue highlight>{row.revisedEndDate}</DetailValue>
            </DetailTile>
          ) : null}
          <DetailTile label="Delay" highlight={delayed}>
            <DetailValue highlight={delayed}>
              {delayed ? `+${row.delayDays} days` : 'No delay'}
            </DetailValue>
          </DetailTile>
          <DetailTile label="Revisions">
            <DetailValue>
              {Number(row?.revisedCount) > 0
                ? `${row.revisedCount} revision${row.revisedCount > 1 ? 's' : ''}`
                : 'No revisions'}
            </DetailValue>
          </DetailTile>
        </div>
      </DetailSectionCard>

      <DetailSectionCard title="Project overview" icon="ri-folder-3-line" accent="blue">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <DetailTile label="Project ID">
            <DetailValue className="font-mono text-[12px] sm:text-[13px]">{row?.displayId || row?.id || '—'}</DetailValue>
          </DetailTile>
          <DetailTile label="Owner">
            <div className="flex items-center gap-1.5">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#1E88E5] text-[9px] font-bold text-white">
                {row?.ownerAvatar || toInitials(row?.owner)}
              </div>
              <DetailValue>{row?.owner || '—'}</DetailValue>
            </div>
          </DetailTile>
          <DetailTile label="Entity">
            <DetailValue>{row?.entity || '—'}</DetailValue>
          </DetailTile>
          <DetailTile label="Department">
            <DetailValue>{row?.department || '—'}</DetailValue>
          </DetailTile>
          <DetailTile label="Category">
            <DetailValue>{row?.lineOfBusiness || '—'}</DetailValue>
          </DetailTile>
          <DetailTile label="Priority">
            <DetailValue>{row?.priority || '—'}</DetailValue>
          </DetailTile>
          <DetailTile label="Start date">
            <DetailValue>{row?.startDate || '—'}</DetailValue>
          </DetailTile>
          <DetailTile label="Risk">
            <DetailValue>{row?.risk || row?.rag || '—'}</DetailValue>
          </DetailTile>
          <DetailTile label="Status">
            <StatusBadge status={row?.status} />
          </DetailTile>
        </div>

        <div className="mt-2.5 rounded-lg border border-slate-200/90 bg-white px-3 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="mb-1.5 flex items-center justify-between text-[11px] font-medium text-slate-600 sm:text-xs">
            <span>Progress</span>
            <span style={{ color: progressColor }}>{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${Math.max(0, Math.min(100, progress))}%`, backgroundColor: progressColor }}
            />
          </div>
        </div>
      </DetailSectionCard>

      {row?.hasRevision && revisionHistory.length > 1 ? (
        <DetailSectionCard title={`Revision history (${row.revisedCount || revisionHistory.length - 1})`} icon="ri-history-line" accent="rose">
          <div className="space-y-1.5">
            {revisionHistory.slice(1).map((rev, idx) => (
              <div
                key={rev.key || `${rev.date}-${idx}`}
                className="rounded-lg border border-slate-200/90 bg-white px-2.5 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[12px] text-slate-600">
                    Updated on: <span className="font-medium text-slate-800">{rev.date || '—'}</span>
                  </p>
                  <p className="text-[11px] text-slate-500">{rev.revisedBy || 'System'}</p>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-slate-600">
                  <p>
                    Previous end date:{' '}
                    <span className="font-medium text-slate-500 line-through">{rev.previousEndDate || '—'}</span>
                  </p>
                  <i className="ri-arrow-right-line text-[11px] text-[#FB8C00]" aria-hidden />
                  <p>
                    Updated end date:{' '}
                    <span className="font-semibold text-[#FB8C00]">{rev.newEndDate || '—'}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        </DetailSectionCard>
      ) : null}
    </div>
  );
}

/** In-app detail modal — compact fields + themed contrast. */
export default function DashboardDetailModal({ detail, onClose, viewerName = 'User' }) {
  useEffect(() => {
    if (!detail) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [detail, onClose]);

  if (typeof document === 'undefined') return null;

  const type = detail?.type || 'project';
  const isTask = type === 'task';
  const isSubtask = type === 'subtask';
  const isTaskLike = isTask || isSubtask;
  const row = detail?.row;

  return createPortal(
    <AnimatePresence>
      {detail && row ? (
        <motion.div
          key={`dash-detail-${type}-${row.id}`}
          className="fixed inset-0 z-[200] overflow-hidden bg-slate-900/40 backdrop-blur-[2px]"
          onClick={onClose}
          role="presentation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div
            className="flex h-full min-h-0 items-stretch justify-center p-0 sm:items-center sm:p-4 lg:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              className="flex h-full max-h-[100vh] w-full max-w-5xl flex-col overflow-hidden border border-slate-200/80 bg-[#F7F9FC] shadow-2xl shadow-slate-300/50 sm:h-auto sm:max-h-[92vh] sm:rounded-2xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="dash-detail-title"
              initial={{ opacity: 0, scale: 0.96, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 12 }}
              transition={{ type: 'spring', stiffness: 280, damping: 26 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 bg-gradient-to-r from-white to-blue-50/40 px-4 py-2.5 sm:px-5">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  {isTaskLike ? (isSubtask ? 'Subtask' : 'Task') : 'Project'}
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-800"
                  aria-label="Close details"
                >
                  <i className="ri-close-line text-lg" aria-hidden />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-3.5 sm:px-5 sm:py-4">
                {isTaskLike ? (
                  <TaskDetailFormView row={row} viewerName={viewerName} isSubtask={isSubtask} />
                ) : (
                  <DelayRevisionDetailView row={row} />
                )}
              </div>

              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-200/80 bg-white px-4 py-2.5 sm:px-5">
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  Close
                </button>
                {isTaskLike ? (
                  <button
                    type="button"
                    onClick={() => {
                      onClose?.();
                      if (isSubtask) requestOpenSubtaskDetails(subtaskRowToFormDefaults(row));
                      else requestOpenTaskDetails(taskRowToFormDefaults(row));
                    }}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl bg-[#1E88E5] px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-[#1565C0]"
                  >
                    <i className="ri-edit-line" aria-hidden />
                    {isSubtask ? 'Update subtask' : 'Update task'}
                  </button>
                ) : null}
              </div>
            </motion.div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

