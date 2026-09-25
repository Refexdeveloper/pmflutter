/** VMS dashboard presentation tokens — brand accent #0086c9 family */

/** Brand cyan-blue palette */
export const VMS_BRAND = {
  DEFAULT: '#0086c9',
  dark: '#0070a8',
  darker: '#005a85',
  light: '#36a3d9',
  muted: '#e0f4fc',
  soft: '#f0f9ff',
  border: '#bae6fd',
  borderStrong: '#7dd3fc',
}

export const vmsPageClass =
  'min-h-screen overflow-hidden bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 px-3 pb-4 pt-1 md:px-4 md:pb-6 md:pt-2'

export const vmsPageInnerClass = 'mx-auto max-w-[1500px] min-w-0'

export function vmsSectionShellClass(extra = '') {
  return [
    'overflow-hidden rounded-2xl border border-white/80 bg-white/95',
    'shadow-lg shadow-[#0086c9]/[0.06] backdrop-blur-sm lg:rounded-3xl',
    extra,
  ]
    .filter(Boolean)
    .join(' ')
}

export function vmsSectionHeaderClass(accent = 'brand') {
  const map = {
    brand: 'bg-gradient-to-r from-white via-[#f0f9ff] to-[#e0f4fc]/60',
    brandAlt: 'bg-gradient-to-r from-white via-[#e0f4fc]/50 to-[#f0f9ff]',
    slate: 'bg-gradient-to-r from-white to-slate-50/90',
    rose: 'bg-gradient-to-r from-rose-50/35 via-white to-orange-50/20',
  }
  return `border-b border-slate-100/90 px-3 py-3 sm:px-5 sm:py-4 ${map[accent] || map.brand}`
}

export function vmsSectionTitleClass() {
  return 'text-base md:text-xl font-semibold tracking-tight text-slate-800'
}

export function vmsSectionSubtitleClass() {
  return 'mt-0.5 text-xs sm:text-sm text-slate-500'
}

export function vmsSearchInputClass() {
  return [
    'w-full min-h-[44px] md:min-h-[38px] rounded-full border border-slate-200/90 bg-white',
    'pl-10 pr-10 py-2.5 md:py-2 text-sm md:text-xs text-slate-800 shadow-sm',
    'placeholder:text-slate-400 touch-manipulation transition-all',
    'focus:outline-none focus:ring-2 focus:ring-[#0086c9]/20 focus:border-[#7dd3fc]',
  ].join(' ')
}

export function vmsGhostBtnClass() {
  return 'min-h-[44px] md:min-h-[36px] rounded-full border border-slate-200 bg-white px-3 text-sm md:text-xs font-semibold text-slate-700 shadow-sm hover:bg-[#f0f9ff] hover:border-[#bae6fd] transition-colors whitespace-nowrap touch-manipulation inline-flex items-center justify-center gap-1.5'
}

export function vmsPrimaryBtnClass() {
  return 'min-h-[44px] md:min-h-[36px] inline-flex items-center justify-center gap-1.5 rounded-full bg-[#0086c9] px-4 text-sm md:text-xs font-semibold text-white shadow-md shadow-[#0086c9]/20 hover:bg-[#0070a8] transition-colors touch-manipulation whitespace-nowrap disabled:opacity-50'
}

export function vmsSecondaryBtnClass() {
  return 'min-h-[44px] md:min-h-[36px] inline-flex items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 text-sm md:text-xs font-semibold text-slate-700 shadow-sm hover:bg-[#f0f9ff] hover:border-[#bae6fd] transition-colors touch-manipulation whitespace-nowrap'
}

export function vmsDangerBtnClass() {
  return 'min-h-[44px] md:min-h-[36px] inline-flex items-center justify-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 text-sm md:text-xs font-semibold text-rose-600 hover:bg-rose-100 transition-colors touch-manipulation whitespace-nowrap disabled:opacity-50'
}

export function vmsIconBtnClass(active = false) {
  return active
    ? 'h-9 w-9 inline-flex shrink-0 items-center justify-center rounded-full border border-[#bae6fd] bg-[#e0f4fc] text-[#0070a8] transition-colors touch-manipulation'
    : 'h-9 w-9 inline-flex shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-[#f0f9ff] hover:border-[#bae6fd] transition-colors touch-manipulation'
}

export function vmsSegmentBtnClass(active = false) {
  return active
    ? 'min-h-[36px] px-3.5 rounded-full text-xs font-semibold bg-[#0086c9] text-white shadow-md shadow-[#0086c9]/20 transition-colors touch-manipulation inline-flex items-center justify-center gap-1'
    : 'min-h-[36px] px-3.5 rounded-full text-xs font-semibold text-slate-600 hover:bg-[#f0f9ff] transition-colors touch-manipulation inline-flex items-center justify-center gap-1'
}

export function vmsChipBtnClass(active = false) {
  return active
    ? 'min-h-[32px] px-3 py-1 rounded-full text-xs font-semibold bg-[#0086c9] text-white shadow-sm transition-colors touch-manipulation'
    : 'min-h-[32px] px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 hover:bg-[#f0f9ff] hover:text-[#0070a8] transition-colors touch-manipulation'
}

export function vmsSelectClass() {
  return 'min-h-[36px] rounded-full border border-slate-200/90 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0086c9]/20 focus:border-[#7dd3fc] touch-manipulation'
}

export function vmsTableHeadClass() {
  return 'bg-[#EEF1F8] border-b border-[#DDE3EF] text-[11px] font-semibold uppercase tracking-wider text-[#5B6478]'
}

export function vmsTableHeadCellClass() {
  return 'px-3 py-3 text-left'
}

export function vmsTableRowClass(expanded = false) {
  return expanded
    ? 'bg-[#0086c9]/[0.06] transition-colors'
    : 'hover:bg-slate-50/90 transition-colors'
}

export function vmsTableDivideClass() {
  return 'divide-y divide-slate-100/90'
}

export function vmsExpandBtnClass(expanded = false, compact = false) {
  const size = compact ? 'h-8 w-8 rounded-lg' : 'h-10 w-10 rounded-xl'
  return expanded
    ? `${size} flex shrink-0 items-center justify-center bg-[#0086c9] text-white shadow-md shadow-[#0086c9]/25 transition-colors touch-manipulation`
    : `${size} flex shrink-0 items-center justify-center bg-[#e0f4fc] text-[#0070a8] border border-[#bae6fd] hover:bg-[#bae6fd] transition-colors touch-manipulation`
}

export function vmsMobileCardClass(expanded = false) {
  return expanded
    ? 'rounded-2xl border border-[#bae6fd] bg-white p-3 w-full min-w-0 shadow-md ring-1 ring-[#e0f4fc]'
    : 'rounded-2xl border border-slate-200/80 bg-white/95 p-3 w-full min-w-0 shadow-sm hover:shadow-md transition-shadow'
}

export function vmsPaginationBarClass() {
  return 'mt-3 border-t border-slate-100/90 bg-[#F8FAFD] px-3 py-3 sm:px-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm rounded-b-2xl lg:rounded-b-3xl'
}

export function vmsPaginationBtnClass(active = false) {
  return active
    ? 'h-9 w-9 inline-flex items-center justify-center rounded-full text-xs font-semibold bg-[#0086c9] text-white shadow-md shadow-[#0086c9]/20'
    : 'h-9 w-9 inline-flex items-center justify-center rounded-full text-xs font-semibold border border-slate-200 bg-white text-slate-600 hover:bg-[#f0f9ff] hover:border-[#bae6fd] disabled:opacity-40 transition-colors'
}

export function vmsVendorRowClass(selected = false) {
  return selected
    ? 'cursor-pointer bg-[#0086c9]/10 ring-1 ring-inset ring-[#bae6fd] transition-colors'
    : 'cursor-pointer hover:bg-slate-50/80 transition-colors'
}

export function vmsVendorMobileCardClass(selected = false) {
  return selected
    ? 'w-full text-left rounded-2xl border border-[#7dd3fc] bg-[#e0f4fc]/50 p-3 ring-1 ring-[#bae6fd] shadow-sm touch-manipulation min-w-0'
    : 'w-full text-left rounded-2xl border border-slate-200/80 bg-white p-3 hover:border-[#bae6fd] hover:shadow-sm transition-all touch-manipulation min-w-0'
}

export function vmsAccordionShellClass() {
  return 'rounded-xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-[#f0f9ff]/40 shadow-sm'
}

export function vmsWorkflowStepClass() {
  return 'relative flex items-start gap-3 rounded-xl border border-slate-200/70 bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]'
}

export function vmsHeaderShellClass() {
  return 'mb-3 sm:mb-4 rounded-2xl border border-white/70 bg-white/75 px-3 py-3 sm:px-4 sm:py-3.5 shadow-sm shadow-[#0086c9]/[0.04] backdrop-blur-md lg:rounded-3xl'
}

export function vmsAvatarClass() {
  return 'h-11 w-11 rounded-2xl bg-gradient-to-br from-[#0086c9] via-[#0070a8] to-[#005a85] flex items-center justify-center text-white text-sm font-bold shadow-md shadow-[#0086c9]/25 ring-2 ring-white/80'
}

export function vmsRoleAccentClass() {
  return 'font-semibold text-[#0070a8]'
}

export function vmsBrandTextClass() {
  return 'text-[#0086c9]'
}

export function vmsBrandTextMutedClass() {
  return 'text-[#0086c9]/80'
}

export function vmsBrandIconWrapClass() {
  return 'inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#e0f4fc] text-[#0070a8]'
}

export function vmsBrandProgressBarClass() {
  return 'h-full rounded-full bg-gradient-to-r from-[#0086c9] to-[#36a3d9]'
}

export function vmsChartPanelClass() {
  return vmsSectionShellClass()
}

/** KPI card accent using brand cyan-blue */
export function vmsBrandKpiAccent() {
  return {
    borderClass: 'border border-[#bae6fd]',
    washClass: 'bg-gradient-to-br from-white from-[14%] via-white via-[48%] to-[#e0f4fc]/60',
    radialWash: 'bg-[radial-gradient(155%_118%_at_88%_88%,rgba(0,134,201,0.18)_0%,transparent_72%)]',
    iconGradient: 'from-[#0086c9] to-[#0070a8]',
    valueClass: 'text-[#0086c9]',
    watermarkColor: 'text-[#0086c9]',
  }
}

/** KPI card accent — lighter brand shade */
export function vmsBrandKpiAccentLight() {
  return {
    borderClass: 'border border-[#7dd3fc]/70',
    washClass: 'bg-gradient-to-br from-white from-[14%] via-white via-[48%] to-[#f0f9ff]',
    radialWash: 'bg-[radial-gradient(155%_118%_at_88%_88%,rgba(54,163,217,0.16)_0%,transparent_72%)]',
    iconGradient: 'from-[#36a3d9] to-[#0086c9]',
    valueClass: 'text-[#36a3d9]',
    watermarkColor: 'text-[#36a3d9]',
  }
}
