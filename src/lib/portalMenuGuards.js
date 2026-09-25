/**
 * Shared guards for fixed portal dropdowns (table filters, PtSelect, date pickers).
 * Prevents parent/table scroll-chaining from dismissing or fighting the open menu.
 */

/** Must stay above MobileFilterSheet (z-10000) so menus are usable inside filter sheets. */
export const PORTAL_MENU_Z_INDEX = 11050;

export function isScrollEventInsideEl(e, el, pointerInsideRef) {
  if (!el) return false;
  if (pointerInsideRef?.current) return true;
  const t = e?.target;
  if (t && (t === el || (typeof el.contains === 'function' && el.contains(t)))) return true;
  const path = typeof e?.composedPath === 'function' ? e.composedPath() : [];
  return Array.isArray(path) && path.includes(el);
}

/** Non-passive wheel handler: keep delta on the menu and block scroll chaining. */
export function attachMenuWheelGuard(el) {
  if (!el) return () => {};
  const onWheel = (e) => {
    e.stopPropagation();

    const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
    let scrollEl = null;
    for (const node of path) {
      if (!(node instanceof HTMLElement)) continue;
      if (!el.contains(node) && node !== el) continue;
      const style = window.getComputedStyle(node);
      const canY =
        (style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflow === 'auto' || style.overflow === 'scroll') &&
        node.scrollHeight > node.clientHeight + 1;
      if (canY) {
        scrollEl = node;
        break;
      }
    }
    if (!scrollEl && el.scrollHeight > el.clientHeight + 1) scrollEl = el;

    e.preventDefault();
    if (scrollEl) scrollEl.scrollTop += e.deltaY;
  };
  el.addEventListener('wheel', onWheel, { passive: false });
  return () => el.removeEventListener('wheel', onWheel);
}

/** Scroll list item into view without calling Element.scrollIntoView (avoids scrolling ancestors). */
export function scrollChildIntoList(listEl, childEl) {
  if (!listEl || !childEl) return;
  const listRect = listEl.getBoundingClientRect();
  const childRect = childEl.getBoundingClientRect();
  if (childRect.bottom > listRect.bottom) {
    listEl.scrollTop += childRect.bottom - listRect.bottom;
  } else if (childRect.top < listRect.top) {
    listEl.scrollTop -= listRect.top - childRect.top;
  }
}
