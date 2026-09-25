/**
 * Shared India FY / calendar year + period filters for portfolio dashboards.
 * FY = 1 Apr → 31 Mar (e.g. FY 2025-26).
 */

export function parseFilterDate(dateLike) {
  if (!dateLike) return null;
  const cleaned = String(dateLike).replace(/\s+[A-Za-z_/]+$/, '');
  const d = new Date(cleaned);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** India business FY key e.g. "2025-26". */
export function getIndiaFyKey(dateLike) {
  const d = parseFilterDate(dateLike);
  if (!d) return null;
  const year = d.getFullYear();
  const month = d.getMonth(); // 0–11; Apr = 3
  const startYear = month >= 3 ? year : year - 1;
  const endShort = String((startYear + 1) % 100).padStart(2, '0');
  return `${startYear}-${endShort}`;
}

export function parseIndiaFyKey(fyKey) {
  const m = String(fyKey || '').match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const startYear = Number(m[1]);
  return Number.isFinite(startYear) ? startYear : null;
}

export function getCalendarYear(dateLike) {
  const d = parseFilterDate(dateLike);
  return d ? d.getFullYear() : null;
}

export function getRowCreatedDate(row) {
  return (
    row?.createdAt ||
    row?._created_at ||
    row?.raw?._created_at ||
    row?.raw?.Created_at ||
    null
  );
}

export function buildCreatedYearOptions(rows, getCreated = getRowCreatedDate) {
  const fyKeys = new Set();
  const cyKeys = new Set();
  const now = new Date();
  fyKeys.add(getIndiaFyKey(now));
  cyKeys.add(String(now.getFullYear()));

  for (const row of rows || []) {
    const created = getCreated(row);
    const fy = getIndiaFyKey(created);
    const cy = getCalendarYear(created);
    if (fy) fyKeys.add(fy);
    if (cy) cyKeys.add(String(cy));
  }

  const fyOptions = Array.from(fyKeys)
    .filter(Boolean)
    .sort((a, b) => (parseIndiaFyKey(b) || 0) - (parseIndiaFyKey(a) || 0))
    .map((key) => ({ value: `fy:${key}`, label: `FY ${key}` }));

  const cyOptions = Array.from(cyKeys)
    .filter(Boolean)
    .sort((a, b) => Number(b) - Number(a))
    .map((year) => ({ value: `cy:${year}`, label: `Calendar ${year}` }));

  return [...fyOptions, ...cyOptions];
}

export function getCreatedPeriodOptions(createdYear) {
  if (!createdYear) return [];
  const isFy = String(createdYear).startsWith('fy:');

  const halves = isFy
    ? [
        { value: 'H1', label: 'H1 (Apr–Sep)' },
        { value: 'H2', label: 'H2 (Oct–Mar)' },
      ]
    : [
        { value: 'H1', label: 'H1 (Jan–Jun)' },
        { value: 'H2', label: 'H2 (Jul–Dec)' },
      ];

  const quarters = isFy
    ? [
        { value: 'Q1', label: 'Q1 (Apr–Jun)' },
        { value: 'Q2', label: 'Q2 (Jul–Sep)' },
        { value: 'Q3', label: 'Q3 (Oct–Dec)' },
        { value: 'Q4', label: 'Q4 (Jan–Mar)' },
      ]
    : [
        { value: 'Q1', label: 'Q1 (Jan–Mar)' },
        { value: 'Q2', label: 'Q2 (Apr–Jun)' },
        { value: 'Q3', label: 'Q3 (Jul–Sep)' },
        { value: 'Q4', label: 'Q4 (Oct–Dec)' },
      ];

  const months = isFy
    ? [
        { value: 'M04', label: 'April' },
        { value: 'M05', label: 'May' },
        { value: 'M06', label: 'June' },
        { value: 'M07', label: 'July' },
        { value: 'M08', label: 'August' },
        { value: 'M09', label: 'September' },
        { value: 'M10', label: 'October' },
        { value: 'M11', label: 'November' },
        { value: 'M12', label: 'December' },
        { value: 'M01', label: 'January' },
        { value: 'M02', label: 'February' },
        { value: 'M03', label: 'March' },
      ]
    : [
        { value: 'M01', label: 'January' },
        { value: 'M02', label: 'February' },
        { value: 'M03', label: 'March' },
        { value: 'M04', label: 'April' },
        { value: 'M05', label: 'May' },
        { value: 'M06', label: 'June' },
        { value: 'M07', label: 'July' },
        { value: 'M08', label: 'August' },
        { value: 'M09', label: 'September' },
        { value: 'M10', label: 'October' },
        { value: 'M11', label: 'November' },
        { value: 'M12', label: 'December' },
      ];

  return [
    { value: '', label: 'Full year' },
    ...halves,
    ...quarters,
    ...months,
  ];
}

export function resolveCreatedDateRange(createdYear, createdPeriod) {
  if (!createdYear) return null;
  const raw = String(createdYear);
  const period = String(createdPeriod || '').trim();

  if (raw.startsWith('fy:')) {
    const startYear = parseIndiaFyKey(raw.slice(3));
    if (startYear == null) return null;
    const endYear = startYear + 1;

    if (!period || period === 'FULL') {
      return { from: new Date(startYear, 3, 1), to: new Date(endYear, 2, 31, 23, 59, 59, 999) };
    }
    if (period === 'H1') return { from: new Date(startYear, 3, 1), to: new Date(startYear, 8, 30, 23, 59, 59, 999) };
    if (period === 'H2') return { from: new Date(startYear, 9, 1), to: new Date(endYear, 2, 31, 23, 59, 59, 999) };
    if (period === 'Q1') return { from: new Date(startYear, 3, 1), to: new Date(startYear, 5, 30, 23, 59, 59, 999) };
    if (period === 'Q2') return { from: new Date(startYear, 6, 1), to: new Date(startYear, 8, 30, 23, 59, 59, 999) };
    if (period === 'Q3') return { from: new Date(startYear, 9, 1), to: new Date(startYear, 11, 31, 23, 59, 59, 999) };
    if (period === 'Q4') return { from: new Date(endYear, 0, 1), to: new Date(endYear, 2, 31, 23, 59, 59, 999) };

    const monthMatch = period.match(/^M(\d{2})$/);
    if (monthMatch) {
      const monthNum = Number(monthMatch[1]);
      const year = monthNum >= 4 ? startYear : endYear;
      const monthIndex = monthNum - 1;
      return {
        from: new Date(year, monthIndex, 1),
        to: new Date(year, monthIndex + 1, 0, 23, 59, 59, 999),
      };
    }
    return { from: new Date(startYear, 3, 1), to: new Date(endYear, 2, 31, 23, 59, 59, 999) };
  }

  if (raw.startsWith('cy:')) {
    const year = Number(raw.slice(3));
    if (!Number.isFinite(year)) return null;

    if (!period || period === 'FULL') {
      return { from: new Date(year, 0, 1), to: new Date(year, 11, 31, 23, 59, 59, 999) };
    }
    if (period === 'H1') return { from: new Date(year, 0, 1), to: new Date(year, 5, 30, 23, 59, 59, 999) };
    if (period === 'H2') return { from: new Date(year, 6, 1), to: new Date(year, 11, 31, 23, 59, 59, 999) };
    if (period === 'Q1') return { from: new Date(year, 0, 1), to: new Date(year, 2, 31, 23, 59, 59, 999) };
    if (period === 'Q2') return { from: new Date(year, 3, 1), to: new Date(year, 5, 30, 23, 59, 59, 999) };
    if (period === 'Q3') return { from: new Date(year, 6, 1), to: new Date(year, 8, 30, 23, 59, 59, 999) };
    if (period === 'Q4') return { from: new Date(year, 9, 1), to: new Date(year, 11, 31, 23, 59, 59, 999) };

    const monthMatch = period.match(/^M(\d{2})$/);
    if (monthMatch) {
      const monthIndex = Number(monthMatch[1]) - 1;
      return {
        from: new Date(year, monthIndex, 1),
        to: new Date(year, monthIndex + 1, 0, 23, 59, 59, 999),
      };
    }
    return { from: new Date(year, 0, 1), to: new Date(year, 11, 31, 23, 59, 59, 999) };
  }

  return null;
}

export function matchesCreatedDateRange(row, range, getCreated = getRowCreatedDate) {
  if (!range) return true;
  const created = parseFilterDate(getCreated(row));
  if (!created) return false;
  const t = created.getTime();
  return t >= range.from.getTime() && t <= range.to.getTime();
}
