import { useEffect, useLayoutEffect, useRef, useState } from 'react';

// Shared popover behaviour: closes on outside click and Escape.
const usePopover = () => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return { open, setOpen, ref };
};

// Scrolls the selected option of each column into view when the popover opens.
const useScrollSelected = (open, containerRef) => {
  useLayoutEffect(() => {
    if (!open || !containerRef.current) return;
    containerRef.current.querySelectorAll('.pk-col').forEach((col) => {
      const sel = col.querySelector('.selected');
      if (sel) col.scrollTop = sel.offsetTop - col.clientHeight / 2 + sel.clientHeight / 2;
    });
  }, [open, containerRef]);
};

// ---------- Dropdown ----------

// Styled replacement for <select>. options: [{ value, label, icon? }].
export const Dropdown = ({ value, options, onChange, placeholder = 'Select', ariaLabel, icon }) => {
  const { open, setOpen, ref } = usePopover();
  const [active, setActive] = useState(-1);
  const listRef = useRef(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (open) setActive(Math.max(0, options.findIndex((o) => o.value === value)));
  }, [open, options, value]);

  useEffect(() => {
    if (!open || active < 0) return;
    listRef.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const choose = (o) => { onChange(o.value); setOpen(false); };

  const onKeyDown = (e) => {
    if (!open && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); setOpen(true); return; }
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(options.length - 1, i + 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    if (e.key === 'End') { e.preventDefault(); setActive(options.length - 1); }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (options[active]) choose(options[active]); }
    if (e.key === 'Tab') setOpen(false);
  };

  return (
    <div className={`pk${open ? ' pk--open' : ''}`} ref={ref}>
      <button type="button" className="pk-trigger" onClick={() => setOpen((o) => !o)} onKeyDown={onKeyDown} aria-haspopup="listbox" aria-expanded={open} aria-label={ariaLabel}>
        {icon && <i className={`${icon} pk-lead`} />}
        <span className={selected ? '' : 'pk-placeholder'}>{selected ? selected.label : placeholder}</span>
        <i className="fa fa-chevron-down pk-caret" />
      </button>
      {open && (
        <ul className="pk-pop pk-list" role="listbox" ref={listRef} aria-label={ariaLabel}>
          {options.map((o, i) => (
            <li
              key={String(o.value)}
              role="option"
              aria-selected={o.value === value}
              className={`${o.value === value ? 'selected' : ''}${i === active ? ' active' : ''}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => { e.preventDefault(); choose(o); }}
            >
              {o.icon && <i className={o.icon} />}
              <span>{o.label}</span>
              {o.value === value && <i className="fa fa-check pk-check" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ---------- Time picker ----------

const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const pad = (n) => String(n).padStart(2, '0');
const QUICK_TIMES = [['06:00', 'Early'], ['09:00', 'Morning'], ['14:00', 'Afternoon'], ['18:30', 'Evening'], ['21:00', 'Night'], ['23:00', 'Late']];

const parse24 = (v) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v || '');
  return m ? { h: Number(m[1]), m: Number(m[2]) } : null;
};
export const label12 = (v) => {
  const t = parse24(v);
  if (!t) return '';
  return `${((t.h + 11) % 12) + 1}:${pad(t.m)} ${t.h >= 12 ? 'PM' : 'AM'}`;
};

// value / onChange use "HH:MM" (24-hour); shows hours, every minute and AM/PM columns.
export const TimePicker = ({ value, onChange, placeholder = 'Select time', ariaLabel = 'Time' }) => {
  const { open, setOpen, ref } = usePopover();
  const popRef = useRef(null);
  useScrollSelected(open, popRef);
  const t = parse24(value) || { h: -1, m: -1 };
  const h12 = t.h < 0 ? -1 : ((t.h + 11) % 12) + 1;
  const pm = t.h >= 12;

  const set = ({ hour = h12 < 0 ? 9 : h12, minute = t.m < 0 ? 0 : t.m, isPm = t.h < 0 ? false : pm }) => {
    const h = (hour % 12) + (isPm ? 12 : 0);
    onChange(`${pad(h)}:${pad(minute)}`);
  };

  return (
    <div className={`pk${open ? ' pk--open' : ''}`} ref={ref}>
      <button type="button" className="pk-trigger" onClick={() => setOpen((o) => !o)} aria-haspopup="dialog" aria-expanded={open} aria-label={ariaLabel}>
        <i className="far fa-clock pk-lead" />
        <span className={value ? '' : 'pk-placeholder'}>{value ? label12(value) : placeholder}</span>
        <i className="fa fa-chevron-down pk-caret" />
      </button>
      {open && (
        <div className="pk-pop pk-panel" ref={popRef} role="dialog" aria-label={ariaLabel}>
          <div className="pk-quick">
            {QUICK_TIMES.map(([v, l]) => (
              <button type="button" key={v} className={value === v ? 'selected' : ''} onClick={() => onChange(v)}>
                <b>{label12(v)}</b><small>{l}</small>
              </button>
            ))}
          </div>
          <div className="pk-cols">
            <div className="pk-col-wrap"><small>Hour</small>
              <div className="pk-col">
                {HOURS_12.map((h) => <button type="button" key={h} className={h === h12 ? 'selected' : ''} onClick={() => set({ hour: h })}>{h}</button>)}
              </div>
            </div>
            <div className="pk-col-wrap"><small>Minute</small>
              <div className="pk-col">
                {MINUTES.map((m) => <button type="button" key={m} className={m === t.m ? 'selected' : ''} onClick={() => set({ minute: m })}>{pad(m)}</button>)}
              </div>
            </div>
            <div className="pk-col-wrap pk-col-wrap--ampm"><small>&nbsp;</small>
              <div className="pk-ampm">
                {['AM', 'PM'].map((p) => <button type="button" key={p} className={t.h >= 0 && (p === 'PM') === pm ? 'selected' : ''} onClick={() => set({ isPm: p === 'PM' })}>{p}</button>)}
              </div>
            </div>
          </div>
          <div className="pk-foot">
            <span>{value ? label12(value) : 'No time selected'}</span>
            <button type="button" className="pk-done" onClick={() => setOpen(false)}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
};

// ---------- Duration picker ----------

const DUR_HOURS = Array.from({ length: 49 }, (_, i) => i);
const QUICK_DURATIONS = [60, 150, 240, 360, 480, 600, 720, 900];
export const durationLabel = (min) => {
  if (!min) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return [h ? `${h} h` : '', m ? `${m} min` : ''].filter(Boolean).join(' ');
};

// value / onChange are total minutes (15 min to 48 h).
export const DurationPicker = ({ value, onChange, placeholder = 'Select duration', ariaLabel = 'Duration' }) => {
  const { open, setOpen, ref } = usePopover();
  const popRef = useRef(null);
  useScrollSelected(open, popRef);
  const total = Number(value) || 0;
  const h = total ? Math.floor(total / 60) : -1;
  const m = total ? total % 60 : -1;

  const set = (hours, minutes) => onChange(Math.min(48 * 60, hours * 60 + minutes));

  return (
    <div className={`pk${open ? ' pk--open' : ''}`} ref={ref}>
      <button type="button" className="pk-trigger" onClick={() => setOpen((o) => !o)} aria-haspopup="dialog" aria-expanded={open} aria-label={ariaLabel}>
        <i className="fa fa-hourglass-half pk-lead" />
        <span className={total ? '' : 'pk-placeholder'}>{total ? durationLabel(total) : placeholder}</span>
        <i className="fa fa-chevron-down pk-caret" />
      </button>
      {open && (
        <div className="pk-pop pk-panel" ref={popRef} role="dialog" aria-label={ariaLabel}>
          <div className="pk-quick">
            {QUICK_DURATIONS.map((d) => (
              <button type="button" key={d} className={total === d ? 'selected' : ''} onClick={() => onChange(d)}>
                <b>{durationLabel(d)}</b>
              </button>
            ))}
          </div>
          <div className="pk-cols">
            <div className="pk-col-wrap"><small>Hours</small>
              <div className="pk-col">
                {DUR_HOURS.map((x) => <button type="button" key={x} className={x === h ? 'selected' : ''} onClick={() => set(x, m < 0 ? 0 : m)}>{x}</button>)}
              </div>
            </div>
            <div className="pk-col-wrap"><small>Minutes</small>
              <div className="pk-col">
                {MINUTES.map((x) => <button type="button" key={x} className={x === m ? 'selected' : ''} onClick={() => set(h < 0 ? 0 : h, x)}>{pad(x)}</button>)}
              </div>
            </div>
          </div>
          <div className="pk-foot">
            <span>{total ? (total < 15 ? 'Minimum is 15 minutes' : durationLabel(total)) : 'No duration selected'}</span>
            <button type="button" className="pk-done" onClick={() => setOpen(false)}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
};
