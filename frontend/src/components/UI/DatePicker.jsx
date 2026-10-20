import { useEffect, useMemo, useRef, useState } from 'react';
import '../CSS/DatePicker.css';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// Dates are YYYY-MM-DD strings in local time (toISOString would shift them to UTC).
export const toISODate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const fromISODate = (s) => {
  const [y, m, d] = (s || '').split('-').map(Number);
  return y ? new Date(y, m - 1, d) : null;
};
export const todayISO = () => toISODate(new Date());
export const formatDate = (s, opts = { weekday: 'short', day: 'numeric', month: 'short' }) =>
  (fromISODate(s) ? fromISODate(s).toLocaleDateString('en-IN', opts) : '');

const addDays = (s, n) => {
  const d = fromISODate(s);
  d.setDate(d.getDate() + n);
  return toISODate(d);
};

const DatePicker = ({ value, onChange, min = todayISO(), placeholder = 'Select date', name = 'date' }) => {
  const [open, setOpen] = useState(false);
  const initial = fromISODate(value) || fromISODate(min);
  const [view, setView] = useState({ year: initial.getFullYear(), month: initial.getMonth() });
  const [direction, setDirection] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  useEffect(() => {
    const d = fromISODate(value);
    if (d) setView({ year: d.getFullYear(), month: d.getMonth() });
  }, [value]);

  const days = useMemo(() => {
    const first = new Date(view.year, view.month, 1);
    const cells = Array(first.getDay()).fill(null);
    const count = new Date(view.year, view.month + 1, 0).getDate();
    for (let d = 1; d <= count; d++) cells.push(toISODate(new Date(view.year, view.month, d)));
    return cells;
  }, [view]);

  const minDate = fromISODate(min);
  const canGoBack = view.year > minDate.getFullYear() || (view.year === minDate.getFullYear() && view.month > minDate.getMonth());

  const shiftMonth = (n) => {
    setDirection(n);
    setView((v) => {
      const d = new Date(v.year, v.month + n, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const pick = (iso) => {
    onChange({ target: { name, value: iso } });
    setOpen(false);
  };

  const today = todayISO();
  const monthLabel = new Date(view.year, view.month, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  return (
    <div className="date-picker" ref={ref}>
      <button type="button" className={`date-picker-input${open ? ' open' : ''}`} onClick={() => setOpen(!open)} aria-haspopup="dialog" aria-expanded={open}>
        <i className="far fa-calendar-alt" />
        <span className={value ? '' : 'dp-placeholder'}>{value ? formatDate(value) : placeholder}</span>
      </button>

      {open && (
        <div className="date-picker-pop" role="dialog" aria-label="Choose travel date">
          <div className="date-picker-quick">
            {[['Today', today], ['Tomorrow', addDays(today, 1)], ['In 2 days', addDays(today, 2)]].map(([label, iso]) => (
              <button type="button" key={label} className={value === iso ? 'active' : ''} onClick={() => pick(iso)}>
                {label}<small>{formatDate(iso, { day: 'numeric', month: 'short' })}</small>
              </button>
            ))}
          </div>

          <div className="date-picker-head">
            <button type="button" onClick={() => shiftMonth(-1)} disabled={!canGoBack} aria-label="Previous month"><i className="fa fa-chevron-left" /></button>
            <strong key={monthLabel} className={direction >= 0 ? 'slide-next' : 'slide-prev'}>{monthLabel}</strong>
            <button type="button" onClick={() => shiftMonth(1)} aria-label="Next month"><i className="fa fa-chevron-right" /></button>
          </div>

          <div className="date-picker-grid">
            {WEEKDAYS.map((w) => <span key={w} className="weekday">{w}</span>)}
          </div>
          <div key={`${view.year}-${view.month}`} className={`date-picker-grid days ${direction >= 0 ? 'slide-next' : 'slide-prev'}`}>
            {days.map((iso, i) => (iso ? (
              <button
                type="button"
                key={iso}
                disabled={iso < min}
                className={[iso === value && 'selected', iso === today && 'today'].filter(Boolean).join(' ')}
                onClick={() => pick(iso)}
              >
                {Number(iso.slice(8))}
              </button>
            ) : <span key={`pad-${i}`} />))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DatePicker;
