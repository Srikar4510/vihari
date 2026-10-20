import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { signOutPartner } from '../../utils/partnerApi';
import { imageUrl } from '../../utils/imageUrl';
import '../CSS/Partner.css';

// ---------- Formatting ----------

export const rupees = (n) => `₹${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
export const titleCase = (s = '') => s.replace(/\b\w/g, (c) => c.toUpperCase());
export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
export const timeAgo = (when) => {
  const s = Math.max(1, Math.floor((Date.now() - new Date(when)) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} d ago`;
  return new Date(when).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};
export const prettyDate = (iso, opts = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) => {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', opts);
};
export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// Animated number that eases from 0 (or the previous value) to `value`.
export const AnimatedNumber = ({ value, format = (n) => Math.round(n).toLocaleString('en-IN'), duration = 1200 }) => {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    let frame;
    const start = performance.now();
    const a = from.current;
    const tick = (t) => {
      const p = Math.min((t - start) / duration, 1);
      const v = a + (value - a) * (1 - Math.pow(1 - p, 3));
      setShown(v);
      if (p < 1) frame = requestAnimationFrame(tick);
      else from.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);
  return <>{format(shown)}</>;
};

// ---------- Toasts and confirm dialog ----------

const UIContext = createContext({ toast: () => {}, confirm: async () => false });
export const usePartnerUI = () => useContext(UIContext);

const ConfirmDialog = ({ options, onAnswer }) => {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onAnswer(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onAnswer]);
  return (
    <Modal onClose={() => onAnswer(false)} small>
      <div className={`pt-confirm${options.danger ? ' pt-confirm--danger' : ''}`}>
        <div className="pt-confirm-icon"><i className={options.icon || (options.danger ? 'fa fa-trash-alt' : 'fa fa-question')} /></div>
        <h3>{options.title}</h3>
        {options.text && <p>{options.text}</p>}
        <div className="pt-confirm-actions">
          <button type="button" className="pt-btn pt-btn--ghost" onClick={() => onAnswer(false)}>Cancel</button>
          <button type="button" className={`pt-btn ${options.danger ? 'pt-btn--danger' : 'pt-btn--primary'}`} onClick={() => onAnswer(true)} autoFocus>
            {options.confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export const Modal = ({ children, onClose, small, title }) => {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);
  return createPortal(
    <div className="pt-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} role="presentation">
      <div className={`pt-modal${small ? ' pt-modal--small' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        {title && (
          <div className="pt-modal-head">
            <h3>{title}</h3>
            <button type="button" onClick={onClose} aria-label="Close"><i className="fa fa-times" /></button>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
};

// ---------- Layout ----------

// The same shell runs the partner portal and the admin console. Pages ask usePortal() for
// the right links, so shared screens (buses, tours, places, bookings) work in both.
const PORTALS = {
  partner: {
    label: 'Partner',
    home: '/agent/agentHome',
    login: '/agentLogin',
    icon: 'fa fa-bus',
    nav: [
      { to: '/agent/agentHome', icon: 'fa fa-chart-pie', label: 'Dashboard' },
      { to: '/agent/allbuses', icon: 'fa fa-bus', label: 'Buses', also: ['/agent/addbus', '/agent/editbus', '/agent/buses'] },
      { to: '/agent/alltours', icon: 'fa fa-map-marked-alt', label: 'Tours', also: ['/agent/addtour', '/agent/edittour', '/agent/opentour', '/agent/tours'] },
      { to: '/agent/agentProfile', icon: 'fa fa-id-badge', label: 'Profile' },
    ],
    paths: {
      buses: '/agent/allbuses', addBus: '/agent/addbus', editBus: (id) => `/agent/editbus/${id}`, busBookings: (id) => `/agent/buses/${id}/bookings`,
      tours: '/agent/alltours', addTour: '/agent/addtour', editTour: (id) => `/agent/edittour/${id}`, tourPlaces: (id) => `/agent/opentour/${id}`, tourBookings: (id) => `/agent/tours/${id}/bookings`,
    },
  },
  admin: {
    label: 'Admin',
    home: '/admindb/adminhome',
    login: '/admin/login',
    icon: 'fa fa-user-shield',
    nav: [
      { to: '/admindb/adminhome', icon: 'fa fa-chart-pie', label: 'Overview' },
      { to: '/admindb/allusers', icon: 'fa fa-users', label: 'Travellers' },
      { to: '/admindb/allagents', icon: 'fa fa-handshake', label: 'Partners' },
      { to: '/admindb/allbuses', icon: 'fa fa-bus', label: 'Buses', also: ['/admindb/editbus', '/admindb/buses'] },
      { to: '/admindb/alltours', icon: 'fa fa-map-marked-alt', label: 'Tours', also: ['/admindb/edittour', '/admindb/opentour', '/admindb/tours'] },
      { to: '/admindb/announcements', icon: 'fa fa-bullhorn', label: 'Announcements' },
    ],
    // Admins manage existing buses and tours; new ones are added by partners.
    paths: {
      buses: '/admindb/allbuses', addBus: null, editBus: (id) => `/admindb/editbus/${id}`, busBookings: (id) => `/admindb/buses/${id}/bookings`,
      tours: '/admindb/alltours', addTour: null, editTour: (id) => `/admindb/edittour/${id}`, tourPlaces: (id) => `/admindb/opentour/${id}`, tourBookings: (id) => `/admindb/tours/${id}/bookings`,
    },
  },
};

const PortalContext = createContext(PORTALS.partner);
export const usePortal = () => {
  const portal = useContext(PortalContext);
  return { ...portal, kind: portal === PORTALS.admin ? 'admin' : 'partner', isAdmin: portal === PORTALS.admin };
};

// Toasts and the confirm dialog for every partner page. Wraps each partner route in App.js.
export const PartnerProvider = ({ children, kind = 'partner' }) => {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);

  const toast = useCallback((text, kind = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);
  const confirm = useCallback((options) => new Promise((resolve) => setConfirmState({ options, resolve })), []);

  return (
    <PortalContext.Provider value={PORTALS[kind]}>
    <UIContext.Provider value={{ toast, confirm }}>
      {children}
      {createPortal(
        <div className="pt-toasts" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`pt-toast pt-toast--${t.kind}`}>
              <i className={t.kind === 'error' ? 'fa fa-exclamation-circle' : 'fa fa-check-circle'} /> {t.text}
            </div>
          ))}
        </div>,
        document.body,
      )}
      {confirmState && (
        <ConfirmDialog
          options={confirmState.options}
          onAnswer={(yes) => { confirmState.resolve(yes); setConfirmState(null); }}
        />
      )}
    </UIContext.Provider>
    </PortalContext.Provider>
  );
};

export const PartnerLayout = ({ title, subtitle, actions, back, children }) => {
  const navigate = useNavigate();
  const { confirm } = usePartnerUI();
  const portal = usePortal();
  const [menuOpen, setMenuOpen] = useState(false);
  const path = useLocation().pathname.toLowerCase();

  useEffect(() => {
    document.title = title ? `${title} · Vihari ${portal.label}` : `Vihari ${portal.label}`;
    return () => { document.title = 'Vihari'; };
  }, [title, portal.label]);

  const signOut = async () => {
    if (!(await confirm({ title: 'Sign out?', text: portal.isAdmin ? 'You will need to log in again to use the admin console.' : 'You will need to log in again to manage your buses and tours.', confirmLabel: 'Sign out', icon: 'fa fa-sign-out-alt' }))) return;
    signOutPartner();
    navigate(portal.login);
  };

  return (
    <div className={`pt-shell pt-shell--${portal.kind}${menuOpen ? ' pt-shell--menu' : ''}`}>
        <aside className="pt-side">
          <Link to={portal.home} className="pt-brand">
            <span className="pt-brand-mark"><i className={portal.icon} /></span>
            <span>Vihari<small>{portal.label}</small></span>
          </Link>
          <nav>
            {portal.nav.map((n) => {
              const active = path === n.to.toLowerCase() || (n.also || []).some((p) => path.startsWith(p.toLowerCase()));
              return (
                <NavLink key={n.to} to={n.to} className={() => (active ? 'active' : '')} onClick={() => setMenuOpen(false)}>
                  <i className={n.icon} /> {n.label}
                </NavLink>
              );
            })}
          </nav>
          <div className="pt-side-foot">
            <Link to="/" className="pt-side-link"><i className="fa fa-globe-asia" /> View website</Link>
            <button type="button" className="pt-side-link" onClick={signOut}><i className="fa fa-sign-out-alt" /> Sign out</button>
          </div>
        </aside>
        <div className="pt-scrim" onClick={() => setMenuOpen(false)} role="presentation" />

        <main className="pt-main">
          <div className="pt-topbar">
            <button type="button" className="pt-burger" onClick={() => setMenuOpen(true)} aria-label="Open menu"><i className="fa fa-bars" /></button>
            <span className="pt-topbar-brand">Vihari <small>{portal.label}</small></span>
          </div>
          <header className="pt-header">
            <div>
              {back && <Link to={back.to} className="pt-back"><i className="fa fa-arrow-left" /> {back.label}</Link>}
              <h1>{title}</h1>
              {subtitle && <p>{subtitle}</p>}
            </div>
            {actions && <div className="pt-header-actions">{actions}</div>}
          </header>
          <div className="pt-content">{children}</div>
        </main>
    </div>
  );
};

// ---------- Small building blocks ----------

export const EmptyState = ({ icon, title, text, action }) => (
  <div className="pt-empty">
    <div className="pt-empty-icon"><i className={icon} /></div>
    <h3>{title}</h3>
    {text && <p>{text}</p>}
    {action}
  </div>
);

export const LoadingBlock = ({ rows = 3 }) => (
  <div className="pt-skeletons">
    {Array.from({ length: rows }, (_, i) => <div key={i} className="pt-skeleton" style={{ animationDelay: `${i * 0.1}s` }} />)}
  </div>
);

export const ErrorBlock = ({ message, onRetry }) => (
  <EmptyState
    icon="fa fa-plug"
    title="Couldn't load this page"
    text={message}
    action={onRetry && <button type="button" className="pt-btn pt-btn--primary" onClick={onRetry}><i className="fa fa-redo" /> Try again</button>}
  />
);

const MAX_PHOTO_MB = 10;

// Photo field with drag and drop and an instant preview. `current` is the stored image path.
export const PhotoPicker = ({ file, current, onChange, label = 'Photo', aspect = '16 / 9', required }) => {
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!file) { setPreview(null); return undefined; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pick = (f) => {
    if (!f) return;
    if (!['image/jpeg', 'image/png'].includes(f.type)) { setError('Use a JPG or PNG image'); return; }
    if (f.size > MAX_PHOTO_MB * 1024 * 1024) { setError(`Photos must be under ${MAX_PHOTO_MB} MB`); return; }
    setError('');
    onChange(f);
  };
  const shown = preview || (current ? imageUrl(current) : null);

  return (
    <div className="pt-field">
      <span className="pt-label">{label}{required && !current && <em>*</em>}</span>
      <button
        type="button"
        className={`pt-photo${drag ? ' pt-photo--drag' : ''}${shown ? ' pt-photo--filled' : ''}`}
        style={{ aspectRatio: aspect }}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]); }}
      >
        {shown && <img src={shown} alt="" />}
        <span className="pt-photo-hint">
          <i className="fa fa-cloud-upload-alt" />
          <b>{shown ? 'Change photo' : 'Drop a photo or click to upload'}</b>
          <small>JPG or PNG, up to {MAX_PHOTO_MB} MB</small>
        </span>
      </button>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg" hidden onChange={(e) => { pick(e.target.files[0]); e.target.value = ''; }} />
      {error && <span className="pt-field-error">{error}</span>}
    </div>
  );
};

// `group` renders a div instead of a label, for custom controls with their own buttons
// (a label would forward clicks inside a popover to the first button and close it).
export const Field = ({ label, hint, error, children, required, group }) => {
  const Tag = group ? 'div' : 'label';
  return (
    <Tag className="pt-field" {...(group ? { role: 'group', 'aria-label': label } : {})}>
      <span className="pt-label">{label}{required && <em>*</em>}</span>
      {children}
      {error ? <span className="pt-field-error">{error}</span> : hint && <span className="pt-field-hint">{hint}</span>}
    </Tag>
  );
};

// Downloads rows as a CSV file (used for passenger lists).
export const downloadCsv = (filename, rows) => {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = rows.map((r) => r.map(esc).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
