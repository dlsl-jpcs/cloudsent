import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import './GlideSelect.css';

// Adapted from React Bits Glide Select by David Haz. See THIRD_PARTY_NOTICES.md.
// Keeps its gliding highlight and pop animation, with inline SVG icons and a
// viewport-aware portal so menus aren't clipped by the expandable search panel.
export interface GlideSelectOption {
  value: string;
  label: string;
  color?: string;
  disabled?: boolean;
}

interface GlideSelectProps {
  options: GlideSelectOption[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

function menuPosition(trigger: HTMLButtonElement, count: number) {
  const rect = trigger.getBoundingClientRect();
  const below = window.innerHeight - rect.bottom - 16;
  const above = rect.top - 16;
  const desiredHeight = Math.min(count * 44 + 12, 280);
  const side = below < desiredHeight && above > below ? 'top' : 'bottom';
  const maxHeight = Math.max(44, Math.min(280, side === 'top' ? above : below));
  const width = Math.max(0, Math.min(rect.width || 180, window.innerWidth - 16));
  return {
    left: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
    top: side === 'top' ? Math.max(8, rect.top - Math.min(desiredHeight, maxHeight) - 8) : rect.bottom + 8,
    width, maxHeight, side,
  };
}

export default function GlideSelect({ options, value, onChange, ariaLabel, placeholder = 'Select…', disabled = false, className = '' }: GlideSelectProps) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const typeahead = useRef({ text: '', time: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 180, maxHeight: 280, side: 'bottom' });
  const selected = options.findIndex((option) => option.value === value);
  const unavailable = disabled || !options.some((option) => !option.disabled);
  const expanded = open && !unavailable;
  const highlighted = options[active] && !options[active].disabled ? active : -1;

  const show = () => {
    if (unavailable) return;
    // Place the portal correctly on its first frame, before exposing its options.
    if (triggerRef.current) setPosition(menuPosition(triggerRef.current, options.length));
    setActive(selected >= 0 && !options[selected].disabled ? selected : options.findIndex((option) => !option.disabled));
    setOpen(true);
  };
  const pick = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    if (option.value !== value) onChange(option.value);
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  };

  useLayoutEffect(() => {
    if (!expanded) return;
    const update = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      if (trigger.closest('[inert], [aria-hidden="true"], [hidden]')) { setOpen(false); return; }
      const rect = trigger.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) { setOpen(false); return; }
      setPosition(menuPosition(trigger, options.length));
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    // The menu lives outside the panel, so explicitly close it if that panel hides.
    const observer = new MutationObserver(update);
    let ancestor = triggerRef.current?.parentElement;
    while (ancestor && ancestor !== document.body) {
      observer.observe(ancestor, { attributes: true, attributeFilter: ['inert', 'aria-hidden', 'hidden'] });
      ancestor = ancestor.parentElement;
    }
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      observer.disconnect();
    };
  }, [expanded, options.length]);

  useEffect(() => {
    if (!expanded) return;
    const closeOutside = (event: Event) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside, true);
    document.addEventListener('focusin', closeOutside);
    return () => {
      document.removeEventListener('pointerdown', closeOutside, true);
      document.removeEventListener('focusin', closeOutside);
    };
  }, [expanded]);

  useLayoutEffect(() => {
    // Scroll only the menu, not the page underneath the fixed-position portal.
    const menu = menuRef.current;
    if (!expanded || !menu) return;
    const top = active * 44 + 5;
    const bottom = top + 44;
    if (top < menu.scrollTop) menu.scrollTop = top;
    else if (bottom > menu.scrollTop + menu.clientHeight) menu.scrollTop = bottom - menu.clientHeight;
  }, [active, expanded]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (unavailable) return;
    const key = event.key;
    if (key === 'Escape' && expanded) {
      event.preventDefault(); event.stopPropagation(); setOpen(false); return;
    }
    if (key === 'Tab') { setOpen(false); return; }
    if (['Enter', ' ', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(key)) {
      event.preventDefault();
      if (!expanded) { show(); return; }
      if (key === 'Enter' || key === ' ') { pick(active); return; }
      const direction = key === 'ArrowUp' || key === 'End' ? -1 : 1;
      let index = key === 'Home' ? 0 : key === 'End' ? options.length - 1 : active + direction;
      while (index >= 0 && index < options.length && options[index].disabled) index += direction;
      if (index >= 0 && index < options.length) setActive(index);
    } else if (key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
      event.preventDefault();
      if (!expanded) show();
      const now = Date.now();
      const previous = now - typeahead.current.time < 700 ? typeahead.current.text : '';
      const text = previous === key.toLowerCase() ? previous : previous + key.toLowerCase();
      typeahead.current = { text, time: now };
      for (let offset = 1; offset <= options.length; offset++) {
        const index = ((expanded ? active : selected) + offset + options.length) % options.length;
        if (!options[index].disabled && options[index].label.toLowerCase().startsWith(text)) { setActive(index); break; }
      }
    }
  };

  return <div className={`glide-select ${className}`}>
    <button ref={triggerRef} type="button" className="glide-select__trigger" role="combobox"
      aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={expanded} aria-controls={expanded ? `${id}-list` : undefined}
      aria-activedescendant={expanded && highlighted >= 0 ? `${id}-${highlighted}` : undefined} disabled={unavailable}
      onClick={() => expanded ? setOpen(false) : show()} onKeyDown={onKeyDown}>
      {options[selected]?.color && <span className="glide-select__swatch" style={{ background: options[selected].color }} aria-hidden="true" />}
      <span className="glide-select__label">{options[selected]?.label ?? placeholder}</span>
      <svg className="glide-select__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m7 10 5 5 5-5" /></svg>
    </button>
    {expanded && createPortal(<div ref={menuRef} className="glide-select__menu" data-side={position.side}
      style={{ left: position.left, top: position.top, width: position.width, maxHeight: position.maxHeight }}>
      <div id={`${id}-list`} role="listbox" aria-label={ariaLabel} className="glide-select__list">
        <span className="glide-select__pill" aria-hidden="true" style={{ transform: `translateY(${Math.max(0, highlighted) * 44}px)`, opacity: highlighted >= 0 ? 1 : 0 }} />
        {options.map((option, index) => <div key={option.value}
          id={`${id}-${index}`} role="option" aria-selected={index === selected} aria-disabled={option.disabled || undefined}
          className="glide-select__option" onPointerEnter={() => { if (!option.disabled) setActive(index); }}
          onPointerDown={(event) => { if (event.pointerType === 'mouse') event.preventDefault(); }} onClick={() => pick(index)}>
          {option.color && <span className="glide-select__swatch" style={{ background: option.color }} aria-hidden="true" />}
          <span className="glide-select__label">{option.label}</span>
          {index === selected && <svg className="glide-select__check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m5 12 4 4 10-10" /></svg>}
        </div>)}
      </div>
    </div>, document.body)}
  </div>;
}
