import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../utils/partnerApi';
import { ActivityChart, RevenueSplit } from '../partner/PartnerDashboard';
import {
  PartnerLayout, AnimatedNumber, LoadingBlock, ErrorBlock, EmptyState, usePartnerUI, rupees, titleCase, timeAgo, initials, prettyDate,
} from '../../components/Partner/PartnerUI';

const STAT_CARDS = [
  { key: 'revenue', label: 'Platform revenue', icon: 'fa fa-wallet', tone: 'teal', format: rupees, sub: (s) => `${rupees(s.busRevenue)} buses · ${rupees(s.tourRevenue)} tours`, to: '/admindb/allbuses' },
  { key: 'bookings', label: 'Bookings', icon: 'fa fa-ticket-alt', tone: 'violet', sub: (s) => `${s.busBookings} bus · ${s.tourBookings} tour · ${s.upcomingTrips} upcoming`, to: '/admindb/allbuses' },
  { key: 'users', label: 'Travellers', icon: 'fa fa-users', tone: 'amber', sub: (s) => `${s.newUsers} joined this week`, to: '/admindb/allusers' },
  { key: 'partners', label: 'Active partners', icon: 'fa fa-handshake', tone: 'rose', sub: (s) => `${s.pendingPartners} pending · ${s.blockedPartners} blocked`, to: '/admindb/allagents' },
];

const AdminDashboard = () => {
  const { toast } = usePartnerUI();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [admin, setAdmin] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = () => {
    setError('');
    adminApi.dashboard().then(setData).catch((e) => setError(e.message));
  };
  useEffect(() => {
    load();
    adminApi.me().then((r) => setAdmin(r)).catch(() => {});
  }, []);

  const approve = async (agent) => {
    setBusy(agent._id);
    try {
      const r = await adminApi.approveAgent(agent._id);
      toast(`${agent.agentName} approved${r.emailSent ? ' and notified by email' : ''}`);
      load();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(null);
    }
  };

  const stats = data && { ...data.stats, bookings: data.stats.busBookings + data.stats.tourBookings };
  const topMax = Math.max(1, ...(data?.topPartners || []).map((p) => p.revenue));
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <PartnerLayout
      title={`${hello}${admin ? `, ${admin.admin.firstName}` : ''}`}
      subtitle="Here is what is happening across Vihari today."
      actions={(
        <>
          <Link to="/admindb/announcements" className="pt-btn pt-btn--ghost"><i className="fa fa-bullhorn" /> Announce</Link>
          <Link to="/admindb/allagents" className="pt-btn pt-btn--primary"><i className="fa fa-handshake" /> Review partners</Link>
        </>
      )}
    >
      {error && <ErrorBlock message={error} onRetry={load} />}
      {!data && !error && <LoadingBlock rows={4} />}
      {data && (
        <>
          <section className="pt-hero pt-hero--admin">
            <div className="pt-hero-glow" />
            <div className="pt-hero-text">
              <span className="pt-pill"><i className="fa fa-user-shield" /> Admin console</span>
              <h2>Vihari at a glance</h2>
              <p>
                <b>{data.stats.buses}</b> buses on <b>{data.stats.routes}</b> routes and <b>{data.stats.tours}</b> tours,
                run by <b>{data.stats.partners}</b> partner{data.stats.partners === 1 ? '' : 's'}.
              </p>
            </div>
            <div className="pt-hero-quick">
              <Link to="/admindb/allbuses"><i className="fa fa-bus" /><b>{data.stats.buses}</b><small>Buses</small></Link>
              <Link to="/admindb/alltours"><i className="fa fa-map-marked-alt" /><b>{data.stats.tours}</b><small>Tours</small></Link>
              <Link to="/admindb/allagents"><i className="fa fa-hourglass-half" /><b>{data.stats.pendingPartners}</b><small>Pending</small></Link>
            </div>
            <i className="fa fa-globe-asia pt-hero-bus" />
          </section>

          {admin && !admin.mailConfigured && (
            <div className="pt-alert">
              <i className="fa fa-envelope" />
              <div><b>Email is not set up.</b> Partner approvals still work, but nobody gets notified and announcements can't be sent. Add <code>MAIL_USER</code> and <code>MAIL_PASS</code> to <code>backend/.env</code>.</div>
            </div>
          )}

          <div className="pt-stats">
            {STAT_CARDS.map((c, i) => (
              <Link to={c.to} className={`pt-stat pt-stat--${c.tone}`} key={c.key} style={{ animationDelay: `${i * 80}ms` }}>
                <div className="pt-stat-icon"><i className={c.icon} /></div>
                <span>{c.label}</span>
                <strong><AnimatedNumber value={stats[c.key]} format={c.format} /></strong>
                <small>{c.sub(stats)}</small>
              </Link>
            ))}
          </div>

          {data.pending.length > 0 && (
            <section className="pt-card pt-pending">
              <div className="pt-card-head">
                <div><h2><span className="pt-dot-pulse" /> Partner applications waiting</h2><p>Approve them so they can start listing buses and tours.</p></div>
                <Link to="/admindb/allagents" className="pt-link">All partners <i className="fa fa-arrow-right" /></Link>
              </div>
              <ul className="pt-pending-list">
                {data.pending.map((a, i) => (
                  <li key={a._id} style={{ animationDelay: `${i * 60}ms` }}>
                    <span className="pt-avatar pt-avatar--tour">{initials(a.agentName)}</span>
                    <div><b>{a.agentName}</b><small>{a.email} · applied {timeAgo(a.createdAt)}</small></div>
                    {a.hasDocument && (
                      <button type="button" className="pt-btn pt-btn--ghost pt-btn--small" onClick={() => adminApi.openDocument(a._id).catch((e) => toast(e.message, 'error'))}>
                        <i className="fa fa-file-alt" /> Document
                      </button>
                    )}
                    <button type="button" className="pt-btn pt-btn--primary pt-btn--small" disabled={busy === a._id} onClick={() => approve(a)}>
                      <i className="fa fa-check" /> Approve
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="pt-grid-2">
            <ActivityChart daily={data.daily} metrics={['bookings', 'revenue', 'signups']} />
            <RevenueSplit stats={data.stats} />
          </div>

          <div className="pt-grid-2 pt-grid-2--even">
            <section className="pt-card">
              <div className="pt-card-head"><div><h2>Latest bookings</h2><p>Across all partners</p></div></div>
              {data.recent.length === 0 ? (
                <EmptyState icon="fa fa-inbox" title="No bookings yet" text="Bookings from travellers will appear here." />
              ) : (
                <ul className="pt-feed">
                  {data.recent.map((r, i) => (
                    <li key={r._id} style={{ animationDelay: `${i * 60}ms` }}>
                      <Link to={r.kind === 'bus' ? `/admindb/buses/${r.refId}/bookings` : `/admindb/tours/${r.refId}/bookings`}>
                        <span className={`pt-avatar pt-avatar--${r.kind}`}>{initials(r.who)}</span>
                        <div>
                          <b>{r.who}</b>
                          <small>
                            <i className={r.kind === 'bus' ? 'fa fa-bus' : 'fa fa-map-marked-alt'} /> {titleCase(r.title)} · {r.detail}
                            {r.travelDate && ` · ${prettyDate(r.travelDate, { day: 'numeric', month: 'short' })}`}
                            {r.partner && ` · ${r.partner}`}
                          </small>
                        </div>
                        <div className="pt-feed-side"><b>{rupees(r.amount)}</b><small>{timeAgo(r.bookedAt)}</small></div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="pt-card">
              <div className="pt-card-head"><div><h2>Top partners</h2><p>By revenue</p></div><Link to="/admindb/allagents" className="pt-link">Partners <i className="fa fa-arrow-right" /></Link></div>
              {data.topPartners.length === 0 ? (
                <EmptyState icon="fa fa-handshake" title="No partner revenue yet" text="Partners will be ranked here once travellers book." />
              ) : (
                <ol className="pt-routes">
                  {data.topPartners.map((p, i) => (
                    <li key={p._id}>
                      <div className="pt-routes-row"><span className="pt-rank">{i + 1}</span><b>{p.agentName}</b><span>{rupees(p.revenue)}</span></div>
                      <div className="pt-progress"><div style={{ width: `${(p.revenue / topMax) * 100}%`, animationDelay: `${i * 100}ms` }} /></div>
                      <small>{p.bookings} booking{p.bookings === 1 ? '' : 's'}</small>
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

export default AdminDashboard;
