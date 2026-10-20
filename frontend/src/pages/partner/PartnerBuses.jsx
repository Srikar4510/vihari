import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { partnerApi } from '../../utils/partnerApi';
import { imageUrl } from '../../utils/imageUrl';
import { Dropdown } from '../../components/Partner/Pickers';
import {
  PartnerLayout, LoadingBlock, ErrorBlock, EmptyState, usePartnerUI, rupees, titleCase, usePortal,
} from '../../components/Partner/PartnerUI';

const PAGE = 18;
const SORTS = {
  route: { label: 'Route', fn: (a, b) => `${a.srcname}${a.destname}`.localeCompare(`${b.srcname}${b.destname}`) },
  bookings: { label: 'Most booked', fn: (a, b) => b.bookings - a.bookings || b.revenue - a.revenue },
  priceLow: { label: 'Lowest fare', fn: (a, b) => a.tktprice - b.tktprice },
  priceHigh: { label: 'Highest fare', fn: (a, b) => b.tktprice - a.tktprice },
};

const BusCard = ({ bus, index, onDelete }) => {
  const { paths, isAdmin } = usePortal();
  return (
  <article className="pt-bus" style={{ animationDelay: `${(index % PAGE) * 40}ms` }}>
    <div className="pt-bus-media">
      <img src={imageUrl(bus.Imageurl)} alt="" loading="lazy" />
      <span className="pt-chip pt-chip--dark">{bus.btype}</span>
      {bus.upcoming > 0 && <span className="pt-chip pt-chip--live"><span className="live-dot" /> {bus.upcoming} upcoming</span>}
    </div>
    <div className="pt-bus-body">
      <div className="pt-bus-route">
        <div><b>{titleCase(bus.srcname)}</b><small>{bus.deptime}</small></div>
        <div className="pt-bus-line"><i className="fa fa-bus" /><small>{bus.durtime}</small></div>
        <div className="text-end"><b>{titleCase(bus.destname)}</b><small>{bus.arrtime}</small></div>
      </div>
      <div className="pt-bus-meta">
        <span><i className="fa fa-building" /> {bus.trname}{isAdmin && bus.agent?.agentName && <em className="pt-owner"> · {bus.agent.agentName}</em>}</span>
        <strong>{rupees(bus.tktprice)}<small>/seat</small></strong>
      </div>
      <div className="pt-bus-stats">
        <span><b>{bus.bookings}</b> bookings</span>
        <span><b>{bus.seatsSold}</b> seats sold</span>
        <span><b>{rupees(bus.revenue)}</b> earned</span>
      </div>
      <div className="pt-actions">
        <Link to={paths.busBookings(bus._id)} className="pt-btn pt-btn--soft pt-btn--small"><i className="fa fa-users" /> Passengers</Link>
        <Link to={paths.editBus(bus._id)} className="pt-btn pt-btn--ghost pt-btn--small"><i className="fa fa-pen" /> Edit</Link>
        <button type="button" className="pt-icon-btn pt-icon-btn--danger" onClick={() => onDelete(bus)} aria-label="Delete bus" title="Delete bus">
          <i className="fa fa-trash-alt" />
        </button>
      </div>
    </div>
  </article>
  );
};

const PartnerBuses = () => {
  const { toast, confirm } = usePartnerUI();
  const { paths, isAdmin } = usePortal();
  const [buses, setBuses] = useState(null);
  const [types, setTypes] = useState([]);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const [sort, setSort] = useState('route');
  const [shown, setShown] = useState(PAGE);

  const load = () => {
    setError('');
    partnerApi.buses().then((r) => { setBuses(r.buses); setTypes(r.busTypes); }).catch((e) => setError(e.message));
  };
  useEffect(load, []);
  useEffect(() => setShown(PAGE), [query, type, sort]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (buses || [])
      .filter((b) => !type || b.btype === type)
      .filter((b) => !q || `${b.srcname} ${b.destname} ${b.trname}`.toLowerCase().includes(q)
        || `${b.srcname} to ${b.destname}`.includes(q))
      .sort(SORTS[sort].fn);
  }, [buses, query, type, sort]);

  const remove = async (bus) => {
    const ok = await confirm({
      danger: true,
      title: 'Delete this bus?',
      text: `${bus.trname}, ${titleCase(bus.srcname)} → ${titleCase(bus.destname)} at ${bus.deptime}. Travellers will no longer be able to book it.`,
      confirmLabel: 'Delete bus',
    });
    if (!ok) return;
    try {
      await partnerApi.deleteBus(bus._id);
      setBuses((list) => list.filter((b) => b._id !== bus._id));
      toast('Bus deleted');
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const routes = buses ? new Set(buses.map((b) => `${b.srcname}|${b.destname}`)).size : 0;

  return (
    <PartnerLayout
      title={isAdmin ? 'All buses' : 'Your buses'}
      subtitle={buses ? `${buses.length} buses on ${routes} routes` : 'Loading…'}
      actions={paths.addBus && <Link to={paths.addBus} className="pt-btn pt-btn--primary"><i className="fa fa-plus" /> Add bus</Link>}
    >
      {error && <ErrorBlock message={error} onRetry={load} />}
      {!buses && !error && <LoadingBlock rows={3} />}
      {buses && buses.length === 0 && (
        <EmptyState
          icon="fa fa-bus"
          title="No buses yet"
          text="Add your first bus with its route, timings and fare. It goes live for travellers right away."
          action={paths.addBus && <Link to={paths.addBus} className="pt-btn pt-btn--primary"><i className="fa fa-plus" /> Add your first bus</Link>}
        />
      )}
      {buses && buses.length > 0 && (
        <>
          <div className="pt-toolbar">
            <div className="pt-search">
              <i className="fa fa-search" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search city, route or operator" aria-label="Search buses" />
              {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search"><i className="fa fa-times" /></button>}
            </div>
            <div className="pt-filter">
              <Dropdown
                value={type}
                onChange={setType}
                ariaLabel="Bus type"
                icon="fa fa-filter"
                options={[{ value: '', label: 'All bus types' }, ...types.map((t) => ({
                  value: t,
                  label: t,
                  icon: /sleeper/i.test(t) && /seater/i.test(t) ? 'fa fa-layer-group' : /sleeper/i.test(t) ? 'fa fa-bed' : 'fa fa-chair',
                }))]}
              />
            </div>
            <div className="pt-toggle">
              {Object.entries(SORTS).map(([k, s]) => (
                <button type="button" key={k} className={sort === k ? 'active' : ''} onClick={() => setSort(k)}>{s.label}</button>
              ))}
            </div>
          </div>
          {list.length === 0 ? (
            <EmptyState icon="fa fa-search" title="No buses match" text="Try another city or clear the filters." action={<button type="button" className="pt-btn pt-btn--ghost" onClick={() => { setQuery(''); setType(''); }}>Clear filters</button>} />
          ) : (
            <>
              <p className="pt-count">Showing {Math.min(shown, list.length)} of {list.length}</p>
              <div className="pt-bus-grid">
                {list.slice(0, shown).map((b, i) => <BusCard key={b._id} bus={b} index={i} onDelete={remove} />)}
              </div>
              {shown < list.length && (
                <div className="pt-more">
                  <button type="button" className="pt-btn pt-btn--ghost" onClick={() => setShown((n) => n + PAGE)}>
                    Show more <i className="fa fa-chevron-down" />
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </PartnerLayout>
  );
};

export default PartnerBuses;
