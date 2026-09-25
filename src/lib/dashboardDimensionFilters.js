/**
 * Shared Company / Business Functions / Function Type portfolio filters
 * (same semantics as ProjectDashboardPage dimension filters).
 */

export const IT_BUSINESS_FUNCTION = 'Information Technology';

export function normalizeDimensionField(value, fallback = 'N/A') {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') {
    const name = String(value.Name || value.name || value.label || '').trim();
    return name || fallback;
  }
  const text = String(value).trim();
  return text || fallback;
}

export function normalizeDimensionValue(value) {
  const text = normalizeDimensionField(value, '');
  if (!text || text === 'N/A' || text === '—') return '';
  return text;
}

export function isInformationTechnologyCategory(value) {
  return normalizeDimensionValue(value) === normalizeDimensionValue(IT_BUSINESS_FUNCTION);
}

export function collectUniqueDimensionValues(rows, field) {
  const values = new Set();
  for (const row of rows || []) {
    const normalized = normalizeDimensionValue(row?.[field]);
    if (normalized) values.add(normalized);
  }
  return Array.from(values).sort((a, b) => a.localeCompare(b));
}

export function hasActivePortfolioDimensionFilters(filters) {
  return Boolean(
    filters?.company ||
      filters?.lineOfBusiness ||
      filters?.functionType,
  );
}

/** Match a project/task row against Company / Business Functions / Function Type. */
export function rowMatchesPortfolioDimensions(row, filters) {
  if (!hasActivePortfolioDimensionFilters(filters)) return true;
  if (filters.company && normalizeDimensionValue(row?.companyName) !== filters.company) {
    return false;
  }
  if (
    filters.lineOfBusiness &&
    normalizeDimensionValue(row?.lineOfBusiness || row?.category) !== filters.lineOfBusiness
  ) {
    return false;
  }
  if (filters.functionType && normalizeDimensionValue(row?.functionType) !== filters.functionType) {
    return false;
  }
  return true;
}

/**
 * Tasks: match own company/LOB fields when present; otherwise require a link
 * to a project that already passed the same dimension filters.
 */
export function taskMatchesPortfolioDimensions(task, filters, dimensionProjects = []) {
  if (!hasActivePortfolioDimensionFilters(filters)) return true;

  const synthetic = {
    companyName: task?.companyName,
    lineOfBusiness: task?.lineOfBusiness || task?.category,
    functionType: task?.functionType,
  };
  const hasOwnDims = Boolean(
    normalizeDimensionValue(synthetic.companyName) ||
      normalizeDimensionValue(synthetic.lineOfBusiness) ||
      normalizeDimensionValue(synthetic.functionType),
  );
  if (hasOwnDims) {
    return rowMatchesPortfolioDimensions(synthetic, filters);
  }

  if (!Array.isArray(dimensionProjects) || dimensionProjects.length === 0) return false;

  const projectIds = new Set(
    dimensionProjects.flatMap((p) => {
      const ids = [p?.id, p?.projectId, ...(Array.isArray(p?.projectIds) ? p.projectIds : [])];
      return ids.map((x) => String(x || '').trim()).filter(Boolean);
    }),
  );
  const projectNames = new Set(
    dimensionProjects.map((p) => String(p?.name || '').trim()).filter(Boolean),
  );

  const tid = String(task?.projectId || '').trim();
  if (tid && projectIds.has(tid)) return true;
  if (Array.isArray(task?.projectIds)) {
    if (task.projectIds.some((id) => projectIds.has(String(id || '').trim()))) return true;
  }
  const tname = String(task?.project || task?.projectName || '').trim();
  if (tname && projectNames.has(tname)) return true;
  return false;
}
