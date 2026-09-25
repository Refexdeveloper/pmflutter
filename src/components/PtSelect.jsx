import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  attachMenuWheelGuard,
  isScrollEventInsideEl,
  scrollChildIntoList,
  PORTAL_MENU_Z_INDEX,
} from '../lib/portalMenuGuards.js';

/**
 * Modern Project Tracker select — styled open menu (native <select> cannot).
 * Drop-in friendly: onChange receives { target: { value } } like a native select.
 *
 * @param {{ value: string, label?: string }} [options[].]
 */

const DEFAULT_TRIGGER =
  'relative h-9 min-h-[36px] w-full rounded-xl border border-slate-200/90 bg-white px-3 pr-8 text-left text-xs font-medium text-slate-700 shadow-sm outline-none transition hover:border-slate-300 focus:border-[#1E88E5] focus:ring-2 focus:ring-[#1E88E5]/20';

function normalizeOptions(options = []) {
  return (Array.isArray(options) ? options : [])
    .map((opt) => {
      if (opt == null) return null;
      if (typeof opt === 'string' || typeof opt === 'number') {
        const v = String(opt);
        return { value: v, label: v };
      }
      const value = String(opt.value ?? '');
      const label = String(opt.label ?? opt.value ?? '');
      return { value, label, disabled: Boolean(opt.disabled) };
    })
    .filter(Boolean);
}

export default function PtSelect({
  value = '',
  onChange,
  onValueChange,
  options = [],
  placeholder = 'Select…',
  className = '',
  triggerClassName = '',
  menuClassName = '',
  disabled = false,
  leadingIcon = null,
  'aria-label': ariaLabel,
  id,
}) {
  const listId = useId();
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const listRef = useRef(null);
  const pointerInsideListRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const [menuStyle, setMenuStyle] = useState(null);

  const items = useMemo(() => normalizeOptions(options), [options]);
  const selected = items.find((o) => o.value === String(value)) || null;
  const displayLabel = selected?.label || placeholder;

  const emit = useCallback(
    (next) => {
      onValueChange?.(next);
      onChange?.({ target: { value: next } });
    },
    [onChange, onValueChange],
  );

  const close = useCallback(() => {
    pointerInsideListRef.current = false;
    setOpen(false);
    setHighlight(-1);
  }, []);

  const updateMenuPosition = useCallback(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const spaceBelow = Math.max(120, viewportH - Math.min(rect.bottom, viewportH) - 12);
    const spaceAbove = Math.max(120, Math.max(rect.top, 0) - 12);
    const preferUp = spaceBelow < 220 && spaceAbove > spaceBelow;
    const maxH = Math.min(280, preferUp ? spaceAbove : spaceBelow);
    setMenuStyle({
      position: 'fixed',
      left: Math.min(Math.max(8, rect.left), Math.max(8, window.innerWidth - Math.max(rect.width, 160) - 8)),
      width: Math.max(rect.width, 160),
      top: preferUp ? undefined : Math.min(viewportH - maxH - 8, Math.max(8, rect.bottom + 6)),
      bottom: preferUp ? Math.min(viewportH - 8, Math.max(8, viewportH - rect.top + 6)) : undefined,
      maxHeight: Math.max(120, maxH),
      zIndex: PORTAL_MENU_Z_INDEX,
    });
  }, []);

  const openMenu = useCallback(() => {
    if (disabled) return;
    updateMenuPosition();
    const idx = Math.max(
      0,
      items.findIndex((o) => o.value === String(value) && !o.disabled),
    );
    setHighlight(idx);
    setOpen(true);
  }, [disabled, items, value, updateMenuPosition]);

  const toggle = useCallback(() => {
    if (open) close();
    else openMenu();
  }, [open, close, openMenu]);

  const pick = useCallback(
    (opt) => {
      if (!opt || opt.disabled) return;
      emit(opt.value);
      close();
      buttonRef.current?.focus();
    },
    [emit, close],
  );

  useEffect(() => {
    if (!open) return undefined;

    const onDoc = (e) => {
      const t = e.target;
      if (rootRef.current?.contains(t) || listRef.current?.contains(t)) return;
      close();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        buttonRef.current?.focus();
      }
    };
    const onReposition = (e) => {
      if (e?.type === 'scroll' && isScrollEventInsideEl(e, listRef.current, pointerInsideListRef)) {
        return;
      }
      updateMenuPosition();
    };

    document.addEventListener('pointerdown', onDoc);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      document.removeEventListener('pointerdown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open, close, updateMenuPosition]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    return attachMenuWheelGuard(listRef.current);
  }, [open, menuStyle]);

  useEffect(() => {
    if (!open || highlight < 0) return;
    const list = listRef.current;
    const el = list?.querySelector(`[data-pt-opt="${highlight}"]`);
    scrollChildIntoList(list, el);
  }, [open, highlight]);

  const onButtonKeyDown = (e) => {
    if (disabled) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) openMenu();
      else {
        setHighlight((h) => {
          let next = h;
          for (let i = 0; i < items.length; i += 1) {
            next = (next + 1) % items.length;
            if (!items[next]?.disabled) return next;
          }
          return h;
        });
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) openMenu();
      else {
        setHighlight((h) => {
          let next = h;
          for (let i = 0; i < items.length; i += 1) {
            next = (next - 1 + items.length) % items.length;
            if (!items[next]?.disabled) return next;
          }
          return h;
        });
      }
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!open) openMenu();
      else if (items[highlight]) pick(items[highlight]);
    }
  };

  const onListKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => {
        let next = h;
        for (let i = 0; i < items.length; i += 1) {
          next = (next + 1) % items.length;
          if (!items[next]?.disabled) return next;
        }
        return h;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => {
        let next = h;
        for (let i = 0; i < items.length; i += 1) {
          next = (next - 1 + items.length) % items.length;
          if (!items[next]?.disabled) return next;
        }
        return h;
      });
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      pick(items[highlight]);
    } else if (e.key === 'Home') {
      e.preventDefault();
      const first = items.findIndex((o) => !o.disabled);
      if (first >= 0) setHighlight(first);
    } else if (e.key === 'End') {
      e.preventDefault();
      for (let i = items.length - 1; i >= 0; i -= 1) {
        if (!items[i].disabled) {
          setHighlight(i);
          break;
        }
      }
    }
  };

  const hasLeading = Boolean(leadingIcon);
  const triggerPad = hasLeading ? 'pl-8' : 'pl-3';

  return (
    <div ref={rootRef} className={`relative inline-flex min-w-0 ${className}`}>
      {hasLeading ? (
        <i
          className={`${leadingIcon} pointer-events-none absolute left-2.5 top-1/2 z-[1] -translate-y-1/2 text-sm text-[#1E88E5]`}
          aria-hidden
        />
      ) : null}
      <button
        ref={buttonRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        onClick={toggle}
        onKeyDown={onButtonKeyDown}
        className={`${DEFAULT_TRIGGER} ${triggerPad} ${
          open ? 'border-[#1E88E5] ring-2 ring-[#1E88E5]/20' : ''
        } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${triggerClassName}`}
      >
        <span className={`block truncate ${selected ? 'text-slate-700' : 'text-slate-400'}`}>
          {displayLabel}
        </span>
        <i
          className={`ri-arrow-down-s-line pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-base text-slate-400 transition-transform ${
            open ? 'rotate-180' : ''
          }`}
          aria-hidden
        />
      </button>

      {open && menuStyle && typeof document !== 'undefined'
        ? createPortal(
            <ul
              ref={listRef}
              id={listId}
              role="listbox"
              tabIndex={-1}
              aria-activedescendant={highlight >= 0 ? `${listId}-opt-${highlight}` : undefined}
              onKeyDown={onListKeyDown}
              onPointerEnter={() => {
                pointerInsideListRef.current = true;
              }}
              onPointerLeave={() => {
                pointerInsideListRef.current = false;
              }}
              style={menuStyle}
              className={`overflow-auto overscroll-contain rounded-xl border border-slate-200/90 bg-white py-1 shadow-xl shadow-slate-300/40 outline-none ring-1 ring-slate-100 ${menuClassName}`}
            >
              {items.length === 0 ? (
                <li className="px-3 py-2.5 text-xs text-slate-400">No options</li>
              ) : (
                items.map((opt, idx) => {
                  const isSelected = opt.value === String(value);
                  const isActive = idx === highlight;
                  return (
                    <li
                      key={`${opt.value}::${idx}`}
                      id={`${listId}-opt-${idx}`}
                      data-pt-opt={idx}
                      role="option"
                      aria-selected={isSelected}
                      aria-disabled={opt.disabled || undefined}
                      onMouseEnter={() => !opt.disabled && setHighlight(idx)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pick(opt)}
                      className={`mx-1 flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs transition ${
                        opt.disabled
                          ? 'cursor-not-allowed text-slate-300'
                          : isSelected
                            ? 'bg-[#E8F0FE] font-semibold text-[#1E88E5]'
                            : isActive
                              ? 'bg-slate-50 text-slate-800'
                              : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="min-w-0 truncate">{opt.label}</span>
                      {isSelected ? (
                        <i className="ri-check-line shrink-0 text-sm text-[#1E88E5]" aria-hidden />
                      ) : null}
                    </li>
                  );
                })
              )}
            </ul>,
            document.body,
          )
        : null}
    </div>
  );
}
