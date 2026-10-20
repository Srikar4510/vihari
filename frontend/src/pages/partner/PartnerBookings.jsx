import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { partnerApi } from '../../utils/partnerApi';
import { imageUrl } from '../../utils/imageUrl';
import {
  PartnerLayout, LoadingBlock, ErrorBlock, EmptyState, AnimatedNumber, downloadCsv, rupees, titleCase, prettyDate, todayISO, initials, timeAgo, usePortal,
} from '../../components/Partner/PartnerUI';

const GENDER_ICONS = { Male: 'fa fa-mars', Female: 'fa fa-venus', Other: 'fa fa-genderless' };

const Contact = ({ contact }) => (
  <div className="pt-contact">
    <span className="pt-avatar">{initials(contact.name)}</span>
    <div>
      <b>{contact.name}</b>
      <small>
        {contact.email && <a href={`mailto:${contact.email}`}><i className="fa fa-envelope" /> {contact.email}</a>}
        {contact.mobile && <a href={`tel:${contact.mobile}`}><i className="fa fa-phone" /> {contact.mobile}</a>}
      </small>
    </div>
  </div>
);

// Passenger list for one bus (kind="bus") or the bookings of one tour (kind="tour").
const PartnerBookings = ({ kind }) => {
  const { id } = useParams();
  const isBus = kind === 'bus';
  const { paths, isAdmin } = usePortal();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [when, setWhen] = useState('upcoming');
  const [query, setQuery] = useState('');

  const load = () => {
    setError('');
    (isBus ? partnerApi.busBookings(id) : partnerApi.tourBookings(id)).then(setData).catch((e) => setError(e.message));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [id, kind]);

  const today = todayISO();
  const list = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.bookings
      .filter((b) => !isBus || (when === 'upcoming' ? b.date >= today : b.date < today))
      .filter((b) => !q || [b.contact.name, b.contact.email, b.contact.mobile, ...(b.passengers || []).map((p) => `${p.name} ${p.seat}`)]
        .join(' ').toLowerCase().includes(q))
      .sort((a, b) => (isBus && when === 'upcoming' ? a.date.localeCompare(b.date) : 0));
  }, [data, query, when, isBus, today]);

  // Group bus bookings by travel date.
  const groups = useMemo(() => {
    if (!isBus) return [{ key: 'all', items: list }];
    const map = new Map();
    list.forEach((b) => { if (!map.has(b.date)) map.set(b.date, []); map.get(b.date).push(b); });
    return [...map.entries()].map(([key, items]) => ({ key, items }));
  }, [list, isBus]);

  const summary = useMemo(() => {
    if (!data) return null;
    const all = data.bookings;
    return {
      bookings: all.length,
      people: isBus ? all.reduce((s, b) => s + b.passengers.length, 0) : all.reduce((s, b) => s + b.travellers, 0),
      revenue: all.reduce((s, b) => s + b.amount, 0),
      upcoming: isBus ? all.filter((b) => b.date >= today).length : null,
    };
  }, [data, isBus, today]);

  const exportCsv = () => {
    const rows = isBus
      ? [['Travel date', 'Seat', 'Passenger', 'Age', 'Gender', 'Booked by', 'Email', 'Mobile', 'Booking ID', 'Amount']]
        .concat(list.flatMap((b) => b.passengers.map((p) => [b.date, p.seat, p.name, p.age, p.gender, b.contact.name, b.contact.email, b.contact.mobile, String(b._id).slice(-8).toUpperCase(), b.amount])))
      : [['Booked on', 'Booked by', 'Email', 'Mobile', 'Travellers', 'Booking ID', 'Amount']]
        .concat(list.map((b) => [new Date(b.bookedAt).toISOString().slice(0, 10), b.contact.name, b.contact.email, b.contact.mobile, b.travellers, String(b._id).slice(-8).toUpperCase(), b.amount]));
    const name = isBus ? `${data.bus.srcname}-${data.bus.destname}-${when}` : data.tour.tname;
    downloadCsv(`vihari-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-bookings.csv`, rows);
  };

  const subject = data && (isBus ? data.bus : data.tour);
  const title = !subject ? 'Bookings' : isBus
    ? `${titleCase(subject.srcname)} → ${titleCase(subject.destname)}`
    : subject.tname;

  return (
    <PartnerLayout
      title={title}
      subtitle={subject && (isBus ? `${subject.trname} · ${subject.btype} · departs ${subject.deptime}` : `${subject.duration || 'Tour'} · ${rupees(subject.tprice)} per person`)}
      back={isBus ? { to: paths.buses, label: isAdmin ? 'All buses' : 'Your buses' } : { to: paths.tours, label: isAdmin ? 'All tours' : 'Your tours' }}
      actions={data && data.bookings.length > 0 && (
        <button type="button" className="pt-btn pt-btn--ghost" onClick={exportCsv} disabled={!list.length}>
          <i className="fa fa-file-csv" /> Export CSV
        </button>
      )}
    >
      {error && <ErrorBlock message={error} onRetry={load} />}
      {!data && !error && <LoadingBlock rows={3} />}
      {data && (
        <>
          <div className="pt-summary">
            {subject && <img src={imageUrl(isBus ? subject.Imageurl : subject.DispImageurl)} alt="" />}
            <div><small>Bookings</small><b><AnimatedNumber value={summary.bookings} /></b></div>
            <div><small>{isBus ? 'Passengers' : 'Travellers'}</small><b><AnimatedNumber value={summary.people} /></b></div>
            <div><small>Revenue</small><b><AnimatedNumber value={summary.revenue} format={rupees} /></b></div>
            {isBus && <div><small>Upcoming</small><b><AnimatedNumber value={summary.upcoming} /></b></div>}
          </div>

          {data.bookings.length === 0 ? (
            <EmptyState icon="fa fa-users" title="No bookings yet" text={isBus ? 'Passengers will appear here as soon as someone books a seat on this bus.' : 'Bookings for this tour will appear here.'} />
          ) : (
            <>
              <div className="pt-toolbar">
                {isBus && (
                  <div className="pt-toggle">
                    {['upcoming', 'past'].map((w) => (
                      <button type="button" key={w} className={when === w ? 'active' : ''} onClick={() => setWhen(w)}>
                        {w === 'upcoming' ? 'Upcoming' : 'Past'}
                      </button>
                    ))}
                  </div>
                )}
                <div className="pt-search">
                  <i className="fa fa-search" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={isBus ? 'Search passenger, seat or phone' : 'Search name, email or phone'} aria-label="Search bookings" />
                </div>
              </div>

              {list.length === 0 && <EmptyState icon="fa fa-calendar" title={query ? 'No matches' : `No ${when} trips`} text={query ? 'Try another name or seat.' : 'Nothing to show here right now.'} />}

              {groups.map((g) => (
                <section key={g.key} className="pt-booking-group">
                  {isBus && (
                    <h3 className="pt-date-head">
                      <i className="far fa-calendar" /> {prettyDate(g.key)}
                      {g.key === today && <span className="pt-chip pt-chip--live"><span className="live-dot" /> Today</span>}
                      <small>{g.items.reduce((s, b) => s + b.passengers.length, 0)} passengers</small>
                    </h3>
                  )}
                  <div className="pt-bookings">
                    {g.items.map((b, i) => (
                      <article className="pt-booking" key={b._id} style={{ animationDelay: `${i * 50}ms` }}>
                        <div className="pt-booking-head">
                          <Contact contact={b.contact} />
                          <div className="pt-booking-side">
                            <b>{rupees(b.amount)}</b>
                            <small>#{String(b._id).slice(-8).toUpperCase()} · {timeAgo(b.bookedAt)}</small>
                          </div>
                        </div>
                        {isBus ? (
                          <div className="pt-passengers">
                            {b.passengers.map((p) => (
                              <div key={p.seat} className="pt-passenger">
                                <span className="pt-seat">{p.seat}</span>
                                <b>{p.name}</b>
                                <small>{p.age} yrs · <i className={GENDER_ICONS[p.gender] || 'fa fa-user'} /> {p.gender}</small>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="pt-booking-note"><i className="fa fa-users" /> {b.travellers} traveller{b.travellers > 1 ? 's' : ''} · booked {new Date(b.bookedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                        )}
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </>
          )}
        </>
      )}
    </PartnerLayout>
  );
};

export default PartnerBookings;
