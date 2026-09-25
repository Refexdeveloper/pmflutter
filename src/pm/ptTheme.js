/**
 * Project Tracker My Items theme — shared with:
 * ProjectDashboardPage, UserSpecificPT, EmployeeDashboardProject
 *
 * Uniform control height: h-9 (36px)
 * Primary accent: #1E88E5 (ProjectDashboard)
 */

export const PT_BRAND = {
  DEFAULT: '#1E88E5',
  indigo: '#2B5AED',
  dark: '#1565C0',
  text: '#2C3E50',
  muted: '#7F8C8D',
  soft: '#edf1ff',
  border: '#E2E8F0',
}

/** Exact page background used by ProjectDashboard / UserSpecificPT / EmployeeDashboard */
export const vmsPageClass =
  'min-h-screen overflow-x-hidden bg-gradient-to-b from-[#edf1ff] via-[#f6f8ff] to-[#f2ecff] px-2 pb-6 pt-2 sm:px-6 sm:pb-6 sm:pt-3'

export const vmsPageInnerClass = 'mx-auto max-w-[1800px] min-w-0'

export function vmsSectionShellClass(extra = '') {
  return [
    'overflow-hidden rounded-2xl border border-white/80 bg-white/95',
    'shadow-lg shadow-slate-200/40 backdrop-blur-sm lg:rounded-3xl',
    extra,
  ]
    .filter(Boolean)
    .join(' ')
}

export function vmsSectionHeaderClass(accent = 'brand') {
  const map = {
    brand: 'bg-gradient-to-r from-white to-blue-50/40',
    brandAlt: 'bg-gradient-to-r from-white to-indigo-50/40',
    slate: 'bg-gradient-to-r from-white to-slate-50/90',
    rose: 'bg-gradient-to-r from-rose-50/60 to-white',
  }
  return `border-b border-slate-100 px-3 py-3 sm:px-5 sm:py-4 ${map[accent] || map.brand}`
}

export function vmsSectionTitleClass() {
  return 'text-sm font-semibold text-slate-800 sm:text-base'
}

export function vmsSectionSubtitleClass() {
  return 'mt-0.5 text-[11px] text-slate-500 sm:text-xs'
}

export function vmsSearchInputClass() {
  return [
    'w-full h-9 min-h-[36px] rounded-xl border border-slate-200 bg-white',
    'pl-8 pr-3 text-xs text-[#2C3E50] shadow-sm',
    'placeholder:text-[#7F8C8D] outline-none transition',
    'focus:border-[#1E88E5] focus:ring-2 focus:ring-[#1E88E5]/15',
  ].join(' ')
}

export function vmsGhostBtnClass() {
  return 'h-9 min-h-[36px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm hover:bg-blue-50/60 hover:border-slate-300 transition-colors whitespace-nowrap'
}

export function vmsPrimaryBtnClass() {
  return 'h-9 min-h-[36px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#1E88E5] px-3.5 text-xs font-semibold text-white shadow-sm hover:bg-[#1565C0] transition-colors whitespace-nowrap disabled:opacity-50'
}

export function vmsSecondaryBtnClass() {
  return 'h-9 min-h-[36px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors whitespace-nowrap'
}

export function vmsDangerBtnClass() {
  return 'h-9 min-h-[36px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-600 hover:bg-rose-100 transition-colors whitespace-nowrap disabled:opacity-50'
}

export function vmsIconBtnClass(active = false) {
  return active
    ? 'h-9 w-9 inline-flex shrink-0 items-center justify-center rounded-xl border border-[#1E88E5]/35 bg-[#E8F0FE] text-[#1E88E5] transition-colors'
    : 'h-9 w-9 inline-flex shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#7F8C8D] shadow-sm hover:bg-slate-50 hover:text-slate-700 transition-colors'
}

export function vmsSegmentBtnClass(active = false) {
  return active
    ? 'h-9 min-h-[36px] px-3.5 rounded-xl text-xs font-semibold bg-[#1E88E5] text-white shadow-sm transition-all inline-flex items-center justify-center gap-1.5'
    : 'h-9 min-h-[36px] px-3.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-all inline-flex items-center justify-center gap-1.5'
}

export function vmsChipBtnClass(active = false) {
  return active
    ? 'h-9 min-h-[36px] px-3.5 rounded-xl text-xs font-semibold bg-[#1E88E5] text-white shadow-sm transition-colors inline-flex items-center justify-center gap-1'
    : 'h-9 min-h-[36px] px-3.5 rounded-xl text-xs font-semibold bg-white text-slate-600 border border-slate-200 hover:bg-[#E8F0FE] hover:text-[#1E88E5] hover:border-[#1E88E5]/30 transition-colors inline-flex items-center justify-center gap-1'
}

export function vmsSelectClass() {
  return 'h-9 min-h-[36px] cursor-pointer rounded-xl border border-slate-200 bg-white px-2.5 text-[11px] font-medium text-slate-700 shadow-sm outline-none focus:border-[#1E88E5] sm:text-xs'
}

export function vmsTableHeadClass() {
  return 'bg-[#EEF1F8] border-b border-[#DDE3EF] text-[11px] font-semibold uppercase tracking-wider text-[#5B6478]'
}

export function vmsTableHeadCellClass() {
  return 'px-3 py-3 text-left text-[#7F8C8D]'
}

export function vmsTableRowClass(expanded = false) {
  return expanded
    ? 'bg-blue-50/50 transition-colors'
    : 'hover:bg-slate-50/90 transition-colors'
}

export function vmsTableDivideClass() {
  return 'divide-y divide-slate-100/90'
}

export function vmsExpandBtnClass(expanded = false, compact = false) {
  const size = compact ? 'h-8 w-8 rounded-lg' : 'h-9 w-9 rounded-xl'
  return expanded
    ? `${size} flex shrink-0 items-center justify-center bg-[#1E88E5] text-white shadow-sm transition-colors`
    : `${size} flex shrink-0 items-center justify-center bg-blue-50 text-[#1E88E5] border border-slate-200 hover:bg-blue-100 transition-colors`
}

export function vmsMobileCardClass(expanded = false) {
  return expanded
    ? 'rounded-2xl border border-[#1E88E5]/30 bg-white p-3 w-full min-w-0 shadow-md ring-1 ring-blue-50'
    : 'rounded-2xl border border-slate-200/80 bg-white/95 p-3 w-full min-w-0 shadow-sm hover:shadow-md transition-shadow'
}

export function vmsPaginationBarClass() {
  return 'mt-0 border-t border-slate-100 bg-slate-50/80 px-3 py-3 sm:px-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm'
}

export function vmsPaginationBtnClass(active = false) {
  return active
    ? 'h-9 w-9 inline-flex items-center justify-center rounded-xl text-xs font-semibold bg-[#1E88E5] text-white shadow-sm'
    : 'h-9 w-9 inline-flex items-center justify-center rounded-xl text-xs font-semibold border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors'
}

export function vmsVendorRowClass(selected = false) {
  return selected
    ? 'cursor-pointer bg-blue-50/70 ring-1 ring-inset ring-[#1E88E5]/20 transition-colors'
    : 'cursor-pointer hover:bg-slate-50/80 transition-colors'
}

export function vmsVendorMobileCardClass(selected = false) {
  return selected
    ? 'w-full text-left rounded-2xl border border-[#1E88E5]/35 bg-blue-50/50 p-3 shadow-sm min-w-0'
    : 'w-full text-left rounded-2xl border border-slate-200/80 bg-white p-3 hover:border-slate-300 hover:shadow-sm transition-all min-w-0'
}

export function vmsAccordionShellClass() {
  return 'rounded-xl border border-slate-200/80 bg-white shadow-sm'
}

export function vmsWorkflowStepClass() {
  return 'relative flex items-start gap-3 rounded-xl border border-slate-200/70 bg-white px-3 py-2.5 shadow-sm'
}

export function vmsHeaderShellClass() {
  return [
    'sticky top-0 z-30 -mx-2 mb-3 overflow-visible border-b border-white/50',
    'bg-gradient-to-b from-[#edf1ff]/92 to-[#eef2ff]/88',
    'px-2 pb-2.5 pt-2 shadow-[0_8px_30px_-18px_rgba(30,41,59,0.2)] backdrop-blur-md',
    'sm:-mx-6 sm:mb-5 sm:px-6 sm:pb-4 sm:pt-3',
  ].join(' ')
}

export function vmsAvatarClass() {
  return 'h-10 w-10 rounded-xl bg-[#1E88E5] flex items-center justify-center text-white text-sm font-bold shadow-[0_8px_20px_-4px_rgba(30,136,229,0.45)] ring-2 ring-white sm:h-12 sm:w-12 sm:rounded-2xl'
}

export function vmsRoleAccentClass() {
  return 'font-semibold text-slate-600'
}

export function vmsBrandTextClass() {
  return 'text-[#1E88E5]'
}

export function vmsBrandTextMutedClass() {
  return 'text-[#1E88E5]/80'
}

export function vmsBrandIconWrapClass() {
  return 'inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#E8F0FE] text-[#1E88E5]'
}

export function vmsBrandProgressBarClass() {
  return 'h-full rounded-full bg-gradient-to-r from-[#1E88E5] to-[#2B5AED]'
}

export function vmsChartPanelClass() {
  return vmsSectionShellClass()
}

export function vmsBrandKpiAccent() {
  return {
    borderClass: 'border border-slate-200/88',
    washClass: 'bg-gradient-to-br from-sky-50/92 via-white to-indigo-50/72',
    radialWash: '',
    iconGradient: 'from-[#2B5AED] to-indigo-600',
    valueClass: 'text-[#2B5AED]',
    watermarkColor: 'text-[#2B5AED]',
  }
}

export function vmsBrandKpiAccentLight() {
  return vmsBrandKpiAccent()
}
