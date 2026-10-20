import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { partnerApi } from '../../utils/partnerApi';
import {
  PartnerLayout, AnimatedNumber, LoadingBlock, ErrorBlock, EmptyState, rupees, titleCase, timeAgo, initials, prettyDate,
} from '../../components/Partner/PartnerUI';

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const STAT_CARDS = [
  { key: 'revenue', label: 'Total revenue', icon: 'fa fa-wallet', tone: 'teal', format: rupees, sub: (s) => `${rupees(s.busRevenue)} buses · ${rupees(s.tourRevenue)} tours` },
  { key: 'bookings', label: 'Bookings', icon: 'fa fa-ticket-alt', tone: 'violet', sub: (s) => `${s.busBookings} bus · ${s.tourBookings} tour` },
  { key: 'seatsSold', label: 'Seats sold', icon: 'fa fa-couch', tone: 'amber', sub: (s) => `${s.travellers} tour traveller${s.travellers === 1 ? '' : 's'}` },
  { key: 'upcomingTrips', label: 'Upcoming trips', icon: 'fa fa-route', tone: 'rose', sub: () => 'Bus bookings yet to travel' },
];

// Bar chart of the last 14 days; bars grow in on load and show a tooltip on hover.
const METRICS = {
  bookings: { label: 'Bookings', total: (n) => `${n} booking${n === 1 ? '' : 's'}`, tip: (n) => `${n} booking${n === 1 ? '' : 's'}` },
  revenue: { label: 'Revenue', total: (n) => `${rupees(n)} earned`, tip: (n) => rupees(n) },
  signups: { label: 'Sign-ups', total: (n) => `${n} new traveller${n === 1 ? '' : 's'}`, tip: (n) => `${n} sign-up${n === 1 ? '' : 's'}` },
};

export const ActivityChart = ({ daily, metrics = ['bookings', 'revenue'] }) => {
  const [metric, setMetric] = useState(metrics[0]);
  const max = Math.max(1, ...daily.map((d) => d[metric]));
  const total = daily.reduce((s, d) => s + d[metric], 0);
  return (
    <section className="pt-card pt-chart-card">
      <div className="pt-card-head">
        <div>
          <h2>Last 14 days</h2>
          <p>{METRICS[metric].total(total)}</p>
        </div>
        <div className="pt-toggle">
          {metrics.map((k) => (
            <button type="button" key={k} className={metric === k ? 'active' : ''} onClick={() => setMetric(k)}>{METRICS[k].label}</button>
          ))}
        </div>
      </div>
      <div className="pt-bars" key={metric}>
        {daily.map((d, i) => {
          const day = new Date(d.date);
          const isToday = i === daily.length - 1;
          return (
            <div className="pt-bar" key={d.date}>
              <div className="pt-bar-track">
                <div
                  className={`pt-bar-fill${d[metric] ? '' : ' pt-bar-fill--zero'}`}
                  style={{ height: `${Math.max(4, (d[metric] / max) * 100)}%`, animationDelay: `${i * 35}ms` }}
                />
                <span className="pt-bar-tip">
                  <b>{METRICS[metric].tip(d[metric])}</b>
                  {day.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                </span>
              </div>
              <small className={isToday ? 'today' : ''}>{isToday ? 'Today' : day.getDate()}</small>
            </div>
          );
        })}
      </div>
    </section>
  );
};

// Bus vs tour revenue as a donut drawn with conic-gradient.
export const RevenueSplit = ({ stats }) => {
  const total = stats.busRevenue + stats.tourRevenue;
  const busPct = total ? Math.round((stats.busRevenue / total) * 100) : 0;
  return (
    <section className="pt-card pt-split">
      <div className="pt-card-head"><div><h2>Revenue split</h2><p>Where your earnings come from</p></div></div>
      <div className="pt-donut-wrap">
        <div className="pt-donut" style={{ '--pct': total ? busPct : 0 }}>
          <div><strong>{total ? `${busPct}%` : '—'}</strong><small>from buses</small></div>
        </div>
        <ul className="pt-legend">
          <li><span className="dot dot--bus" /> Buses <b>{rupees(stats.busRevenue)}</b></li>
          <li><span className="dot dot--tour" /> Tours <b>{rupees(stats.tourRevenue)}</b></li>
        </ul>
      </div>
    </section>
  );
};

const PartnerDashboard = () => {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = () => {
    setError('');
    partnerApi.dashboard().then(setData).catch((e) => setError(e.message));
  };
  useEffect(load, []);

  const stats = useMemo(() => data && { ...data.stats, bookings: data.stats.busBookings + data.stats.tourBookings }, [data]);
  const name = data?.agent.agentName || 'Partner';
  const topMax = Math.max(1, ...(data?.topRoutes || []).map((r) => r.revenue));

  return (
    <PartnerLayout
      title={`${greeting()}, ${name.split(' ')[0]}`}
      subtitle={new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      actions={(
        <>
          <Link to="/agent/addbus" className="pt-btn pt-btn--ghost"><i className="fa fa-plus" /> Add bus</Link>
          <Link to="/agent/addtour" className="pt-btn pt-btn--primary"><i className="fa fa-plus" /> Add tour</Link>
        </>
      )}
    >
      {error && <ErrorBlock message={error} onRetry={load} />}
      {!data && !error && <LoadingBlock rows={4} />}
      {data && (
        <>
          <section className="pt-hero">
            <div className="pt-hero-glow" />
            <div className="pt-hero-text">
              <span className="pt-pill"><i className="fa fa-check-circle" /> Approved partner</span>
              <h2>{name}</h2>
              <p>
                You run <b>{data.stats.buses}</b> bus{data.stats.buses === 1 ? '' : 'es'} on <b>{data.stats.routes}</b> route{data.stats.routes === 1 ? '' : 's'} and
                {' '}<b>{data.stats.tours}</b> curated tour{data.stats.tours === 1 ? '' : 's'}.
              </p>
            </div>
            <div className="pt-hero-quick">
              <Link to="/agent/allbuses"><i className="fa fa-bus" /><b>{data.stats.buses}</b><small>Buses</small></Link>
              <Link to="/agent/allbuses"><i className="fa fa-road" /><b>{data.stats.routes}</b><small>Routes</small></Link>
              <Link to="/agent/alltours"><i className="fa fa-map-marked-alt" /><b>{data.stats.tours}</b><small>Tours</small></Link>
            </div>
            <i className="fa fa-bus pt-hero-bus" />
          </section>

          {data.toursMissingPlaces.length > 0 && (
            <div className="pt-alert">
              <i className="fa fa-lightbulb" />
              <div>
                <b>{data.toursMissingPlaces.length} tour{data.toursMissingPlaces.length > 1 ? 's have' : ' has'} no places yet.</b>
                {' '}Travellers see an empty itinerary for {data.toursMissingPlaces.map((t) => t.tname).join(', ')}.
              </div>
              <Link to={`/agent/opentour/${data.toursMissingPlaces[0]._id}`} className="pt-btn pt-btn--small">Add places</Link>
            </div>
          )}

          <div className="pt-stats">
            {STAT_CARDS.map((c, i) => (
              <div className={`pt-stat pt-stat--${c.tone}`} key={c.key} style={{ animationDelay: `${i * 80}ms` }}>
                <div className="pt-stat-icon"><i className={c.icon} /></div>
                <span>{c.label}</span>
                <strong><AnimatedNumber value={stats[c.key]} format={c.format} /></strong>
                <small>{c.sub(stats)}</small>
              </div>
            ))}
          </div>

          <div className="pt-grid-2">
            <ActivityChart daily={data.daily} />
            <RevenueSplit stats={data.stats} />
          </div>

          <div className="pt-grid-2 pt-grid-2--even">
            <section className="pt-card">
              <div className="pt-card-head"><div><h2>Recent bookings</h2><p>Latest across your buses and tours</p></div></div>
              {data.recent.length === 0 ? (
                <EmptyState icon="fa fa-inbox" title="No bookings yet" text="New bookings will show up here as soon as travellers book." />
              ) : (
                <ul className="pt-feed">
                  {data.recent.map((r, i) => (
                    <li key={r._id} style={{ animationDelay: `${i * 60}ms` }}>
                      <Link to={r.kind === 'bus' ? `/agent/buses/${r.refId}/bookings` : `/agent/tours/${r.refId}/bookings`}>
                        <span className={`pt-avatar pt-avatar--${r.kind}`}>{initials(r.who)}</span>
                        <div>
                          <b>{r.who}</b>
                          <small><i className={r.kind === 'bus' ? 'fa fa-bus' : 'fa fa-map-marked-alt'} /> {titleCase(r.title)} · {r.detail}{r.travelDate && ` · ${prettyDate(r.travelDate, { day: 'numeric', month: 'short' })}`}</small>
                        </div>
                        <div className="pt-feed-side">
                          <b>{rupees(r.amount)}</b>
                          <small>{timeAgo(r.bookedAt)}</small>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="pt-card">
              <div className="pt-card-head"><div><h2>Top routes</h2><p>By revenue</p></div><Link to="/agent/allbuses" className="pt-link">All buses <i className="fa fa-arrow-right" /></Link></div>
              {data.topRoutes.length === 0 ? (
                <EmptyState icon="fa fa-road" title="No route data yet" text="Your best routes will be ranked here once seats are booked." />
              ) : (
                <ol className="pt-routes">
                  {data.topRoutes.map((r, i) => (
                    <li key={r.route}>
                      <div className="pt-routes-row">
                        <span className="pt-rank">{i + 1}</span>
                        <b>{titleCase(r.route)}</b>
                        <span>{rupees(r.revenue)}</span>
                      </div>
                      <div className="pt-progress"><div style={{ width: `${(r.revenue / topMax) * 100}%`, animationDelay: `${i * 100}ms` }} /></div>
                      <small>{r.bookings} booking{r.bookings === 1 ? '' : 's'} · {r.seats} seat{r.seats === 1 ? '' : 's'}</small>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        </>
      )}
    </PartnerLayout>
  );
};

export default PartnerDashboard;
