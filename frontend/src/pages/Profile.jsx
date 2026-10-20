import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Navbar from '../components/UI/Navbar';
import Footer from '../components/UI/Footer';
import CountUp from '../components/UI/CountUp';
import TripModal from '../components/UI/TripModal';
import { formatDate } from '../components/UI/DatePicker';
import { imageUrl } from '../utils/imageUrl';
import { downloadTourPdf } from '../utils/ticketPdf';
import { tripDateTime, timeLeft, shortCountdown, useNow } from '../utils/time';
import { getProfile, updateProfile, getTrips, getTours, getTravellers, addTraveller, updateTraveller, deleteTraveller } from '../utils/account';
import '../components/CSS/BusResults.css';
import '../components/CSS/Profile.css';

const TABS = [
  { key: 'trips', label: 'My trips', icon: 'fa fa-bus' },
  { key: 'tours', label: 'My tours', icon: 'fa fa-map-marked-alt' },
  { key: 'travellers', label: 'Saved travellers', icon: 'fa fa-users' },
  { key: 'account', label: 'Account', icon: 'fa fa-user-cog' },
];
const GENDERS = ['Male', 'Female', 'Other'];
const GENDER_ICONS = { Male: 'fa fa-mars', Female: 'fa fa-venus', Other: 'fa fa-genderless' };
const EMPTY_TRAVELLER = { name: '', age: '', gender: '' };

const titleCase = (s = '') => s.replace(/\b\w/g, (c) => c.toUpperCase());
const initials = (u) => `${u?.firstName?.[0] || ''}${u?.lastName?.[0] || ''}`.toUpperCase() || '?';

const Profile = () => {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'trips';
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({ trips: 0, tours: 0, travellers: 0 });
  const [trips, setTrips] = useState(null);
  const [tours, setTours] = useState(null);
  const [travellers, setTravellers] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getProfile().then((r) => { setUser(r.user); setStats(r.stats); }).catch((e) => setError(e.message));
    getTrips().then((r) => setTrips(r.trips)).catch(() => setTrips([]));
    getTours().then((r) => setTours(r.tours)).catch(() => setTours([]));
    getTravellers().then((r) => setTravellers(r.travellers)).catch(() => setTravellers([]));
  }, []);

  const setTab = (key) => setParams({ tab: key }, { replace: true });
  const onTravellersChange = (list) => {
    setTravellers(list);
    setStats((s) => ({ ...s, travellers: list.length }));
  };

  return (
    <>
      <Navbar />
      <div className="profile-page">
        <section className="profile-hero">
          <div className="profile-hero-inner">
            <div className="profile-avatar">{initials(user)}</div>
            <div className="profile-id">
              <h1>{user ? `${user.firstName} ${user.lastName}` : 'Loading…'}</h1>
              {user && (
                <p>
                  <i className="fa fa-envelope" /> {user.email}
                  {user.createdAt && <span> · Member since {formatDate(user.createdAt.slice(0, 10), { month: 'long', year: 'numeric' })}</span>}
                </p>
              )}
            </div>
            <div className="profile-stats">
              {[['trips', 'Bus trips'], ['tours', 'Tours'], ['travellers', 'Saved travellers']].map(([k, label]) => (
                <button type="button" key={k} onClick={() => setTab(k)}>
                  <strong><CountUp value={stats[k]} /></strong>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <div className="container profile-body">
          {error && <div className="bus-error">{error}</div>}

          <div className="profile-tabs" role="tablist">
            <span className="profile-tabs-indicator" style={{ transform: `translateX(${TABS.findIndex((t) => t.key === tab) * 100}%)` }} />
            {TABS.map((t) => (
              <button type="button" role="tab" key={t.key} aria-selected={tab === t.key} className={tab === t.key ? 'active' : ''} onClick={() => setTab(t.key)}>
                <i className={t.icon} /> <span>{t.label}</span>
              </button>
            ))}
          </div>

          <div className="profile-panel" key={tab}>
            {tab === 'trips' && <TripsTab trips={trips} />}
            {tab === 'tours' && <ToursTab tours={tours} user={user} />}
            {tab === 'travellers' && <TravellersTab travellers={travellers} onChange={onTravellersChange} />}
            {tab === 'account' && user && <AccountTab user={user} onSaved={setUser} />}
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
};

const Empty = ({ icon, title, text, to, cta }) => (
  <div className="profile-empty">
    <div className="profile-empty-icon"><i className={icon} /></div>
    <h3>{title}</h3>
    <p>{text}</p>
    {to && <Link to={to} className="btn-continue">{cta} <i className="fa fa-arrow-right" /></Link>}
  </div>
);

// A trip is upcoming until its departure time has passed.
const departsAt = (t) => tripDateTime(t.date, t.bus?.deptime) || new Date(`${t.date}T23:59`);

const TripsTab = ({ trips }) => {
  const [when, setWhen] = useState('upcoming');
  const [open, setOpen] = useState(null);
  const now = useNow(30000);
  const isUpcoming = (t) => departsAt(t) > now;
  const list = useMemo(() => (trips || [])
    .filter((t) => (when === 'upcoming' ? isUpcoming(t) : !isUpcoming(t)))
    .sort((a, b) => (when === 'upcoming' ? departsAt(a) - departsAt(b) : departsAt(b) - departsAt(a))),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [trips, when, now]);

  if (!trips) return <div className="profile-loading"><span className="bus-spinner" /> Loading your trips…</div>;

  return (
    <>
      <div className="profile-subtabs">
        {['upcoming', 'past'].map((w) => (
          <button type="button" key={w} className={when === w ? 'active' : ''} onClick={() => setWhen(w)}>
            {w === 'upcoming' ? 'Upcoming' : 'Past'} <small>{trips.filter((t) => (w === 'upcoming' ? isUpcoming(t) : !isUpcoming(t))).length}</small>
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <Empty
          icon="fa fa-bus-alt"
          title={when === 'upcoming' ? 'No upcoming trips' : 'No past trips yet'}
          text={when === 'upcoming' ? 'Your next bus journey will show up here.' : 'Trips you have taken will show up here.'}
          to="/" cta="Search buses"
        />
      ) : list.map((t, i) => {
        const left = timeLeft(departsAt(t), now);
        return (
          <article
            className="trip-card"
            key={t._id}
            style={{ animationDelay: `${i * 70}ms` }}
            role="button"
            tabIndex={0}
            onClick={() => setOpen(t)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setOpen(t))}
            aria-label={`View booking ${t._id.slice(-8).toUpperCase()}`}
          >
            <div className="trip-date">
              <strong>{formatDate(t.date, { day: 'numeric' })}</strong>
              <span>{formatDate(t.date, { month: 'short' })}</span>
              <small>{formatDate(t.date, { weekday: 'short' })}</small>
            </div>
            <div className="trip-main">
              <div className="trip-route">
                <div><strong>{t.bus?.deptime}</strong><span>{titleCase(t.bus?.srcname)}</span></div>
                <div className="bus-card-line"><span className="bus-card-duration">{t.bus?.durtime}</span><div className="bus-card-track"><i className="fa fa-bus" /></div></div>
                <div className="text-end"><strong>{t.bus?.arrtime}</strong><span>{titleCase(t.bus?.destname)}</span></div>
              </div>
              <div className="trip-meta">
                <span><i className="fa fa-bus" /> {t.bus?.trname || 'Bus no longer listed'}</span>
                {t.bus?.btype && <span className="bus-type">{t.bus.btype}</span>}
                <span className="trip-seats">{t.tickets.map((p) => <b key={p.seat}>{p.seat}</b>)}</span>
              </div>
              <div className="trip-passengers">
                {t.tickets.map((p) => <span key={p.seat}><i className={GENDER_ICONS[p.gender] || 'fa fa-user'} /> {p.name}, {p.age}</span>)}
              </div>
            </div>
            <div className="trip-price">
              {left && <span className={`trip-countdown-chip${left.days === 0 && left.hours < 3 ? ' soon' : ''}`}><i className="far fa-clock" /> Departs in {shortCountdown(left)}</span>}
              {t.amount != null && <strong>₹{t.amount.toLocaleString('en-IN')}</strong>}
              <small>ID {t._id.slice(-8).toUpperCase()}</small>
              <span className="trip-view">View details <i className="fa fa-chevron-right" /></span>
            </div>
          </article>
        );
      })}
      {open && <TripModal trip={open} onClose={() => setOpen(null)} />}
    </>
  );
};

const ToursTab = ({ tours, user }) => {
  const [downloading, setDownloading] = useState(null);
  const download = async (b) => {
    setDownloading(b._id);
    try {
      await downloadTourPdf(b, b.tour, { name: user ? `${user.firstName} ${user.lastName}` : '', email: user?.email, mobile: user?.mobile });
    } finally {
      setDownloading(null);
    }
  };
  if (!tours) return <div className="profile-loading"><span className="bus-spinner" /> Loading your tours…</div>;
  if (tours.length === 0) {
    return <Empty icon="fa fa-map-marked-alt" title="No tours booked yet" text="Curated city tours with stays and sightseeing included." to="/tours" cta="Explore tours" />;
  }
  return (
    <div className="tour-bookings">
      {tours.map((b, i) => (
        <article className="tour-booking" key={b._id} style={{ animationDelay: `${i * 70}ms` }}>
          {b.tour && <img src={imageUrl(b.tour.DispImageurl)} alt={b.tour.tname} loading="lazy" />}
          <div>
            <h3>{b.tour?.tname || 'Tour no longer listed'}</h3>
            <p><i className="fa fa-users" /> {b.travellers} traveller{b.travellers > 1 ? 's' : ''}{b.tour?.duration && <> · <i className="far fa-clock" /> {b.tour.duration}</>}</p>
            <p className="tour-booking-date">Booked on {formatDate(b.bookedAt.slice(0, 10), { day: 'numeric', month: 'short', year: 'numeric' })}</p>
          </div>
          <div className="tour-booking-side">
            <strong>₹{b.price.toLocaleString('en-IN')}</strong>
            {b.tour && <Link to={`/tourplaces/${b.tour._id}`}>View itinerary <i className="fa fa-arrow-right" /></Link>}
            {b.tour && (
              <button type="button" className="tour-booking-pdf" onClick={() => download(b)} disabled={downloading === b._id}>
                <i className="fa fa-file-download" /> {downloading === b._id ? 'Preparing…' : 'Download PDF'}
              </button>
            )}
          </div>
        </article>
      ))}
    </div>
  );
};

const TravellerForm = ({ initial = EMPTY_TRAVELLER, onSave, onCancel, saving }) => {
  const [form, setForm] = useState({ ...initial, age: String(initial.age || '') });
  return (
    <form className="traveller-form" onSubmit={(e) => { e.preventDefault(); onSave(form); }}>
      <input required autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" aria-label="Full name" />
      <input required type="number" min={1} max={120} value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} placeholder="Age" aria-label="Age" />
      <div className="gender-toggle">
        {GENDERS.map((g) => (
          <button type="button" key={g} className={form.gender === g ? 'active' : ''} onClick={() => setForm({ ...form, gender: g })}>
            <i className={GENDER_ICONS[g]} /> {g}
          </button>
        ))}
      </div>
      <div className="traveller-form-actions">
        <button type="button" className="btn-outline" onClick={onCancel}>Cancel</button>
        <button className="btn-continue" disabled={saving || !form.gender}>{saving ? 'Saving…' : 'Save'}</button>
      </div>
    </form>
  );
};

const TravellersTab = ({ travellers, onChange }) => {
  const [editing, setEditing] = useState(null); // traveller id, 'new' or null
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!travellers) return <div className="profile-loading"><span className="bus-spinner" /> Loading travellers…</div>;

  const save = async (form) => {
    setSaving(true);
    setError('');
    try {
      const data = { name: form.name, age: Number(form.age), gender: form.gender };
      const r = editing === 'new' ? await addTraveller(data) : await updateTraveller(editing, data);
      onChange(r.travellers);
      setEditing(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (t) => {
    if (!window.confirm(`Remove ${t.name} from saved travellers?`)) return;
    try {
      const r = await deleteTraveller(t._id);
      onChange(r.travellers);
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <>
      <p className="profile-intro">Save the people you often travel with. You can add them to a booking in one tap on the passenger details page.</p>
      {error && <div className="checkout-error">{error}</div>}
      <div className="traveller-grid">
        {travellers.map((t, i) => (editing === t._id ? (
          <div className="traveller-card editing" key={t._id}>
            <TravellerForm initial={t} onSave={save} onCancel={() => setEditing(null)} saving={saving} />
          </div>
        ) : (
          <div className="traveller-card" key={t._id} style={{ animationDelay: `${i * 60}ms` }}>
            <div className={`traveller-avatar traveller-avatar--${t.gender.toLowerCase()}`}>{t.name[0]?.toUpperCase()}</div>
            <div className="traveller-info">
              <strong>{t.name}</strong>
              <span><i className={GENDER_ICONS[t.gender]} /> {t.gender} · {t.age} yrs</span>
            </div>
            <div className="traveller-actions">
              <button type="button" onClick={() => setEditing(t._id)} aria-label={`Edit ${t.name}`}><i className="fa fa-pen" /></button>
              <button type="button" onClick={() => remove(t)} aria-label={`Remove ${t.name}`} className="danger"><i className="fa fa-trash-alt" /></button>
            </div>
          </div>
        )))}
        {editing === 'new' ? (
          <div className="traveller-card editing">
            <TravellerForm onSave={save} onCancel={() => setEditing(null)} saving={saving} />
          </div>
        ) : (
          <button type="button" className="traveller-card traveller-add" onClick={() => setEditing('new')}>
            <i className="fa fa-user-plus" />
            <span>Add traveller</span>
          </button>
        )}
      </div>
    </>
  );
};

const AccountTab = ({ user, onSaved }) => {
  const [form, setForm] = useState({ firstName: user.firstName, lastName: user.lastName, mobile: user.mobile });
  const [status, setStatus] = useState({ saving: false, message: '', error: '' });

  const save = async (e) => {
    e.preventDefault();
    setStatus({ saving: true, message: '', error: '' });
    try {
      const r = await updateProfile(form);
      onSaved(r.user);
      setStatus({ saving: false, message: 'Profile updated', error: '' });
    } catch (err) {
      setStatus({ saving: false, message: '', error: err.message });
    }
  };

  return (
    <form className="account-form" onSubmit={save}>
      <div className="checkout-row">
        <label>First name<input required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} /></label>
        <label>Last name<input required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} /></label>
      </div>
      <div className="checkout-row">
        <label>Email<input value={user.email} disabled title="Email is your login and can't be changed" /></label>
        <label>Mobile number<input required pattern="[0-9]{10}" title="10-digit mobile number" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} /></label>
      </div>
      {status.error && <div className="checkout-error">{status.error}</div>}
      {status.message && <div className="account-saved"><i className="fa fa-check-circle" /> {status.message}</div>}
      <button className="btn-continue account-save" disabled={status.saving}>{status.saving ? 'Saving…' : 'Save changes'}</button>
    </form>
  );
};

export default Profile;
