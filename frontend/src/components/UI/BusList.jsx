import { useContext, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import SearchForm, { busSearchUrl } from './SearchForm';
import SeatMap from './SeatMap';
import { formatDate, fromISODate, toISODate, todayISO } from './DatePicker';
import busContext from '../../context/bus/busContext';
import { imageUrl } from '../../utils/imageUrl';
import { durationToMinutes } from '../../utils/time';
import '../CSS/TravelPage.css';
import '../CSS/BusResults.css';
import { API_URL } from '../../config';

const API = API_URL;

const SLOTS = [
  { key: 'morning', label: 'Morning', icon: 'fa fa-sun', hint: '6 AM – 12 PM', test: (m) => m >= 360 && m < 720 },
  { key: 'afternoon', label: 'Afternoon', icon: 'fa fa-cloud-sun', hint: '12 – 5 PM', test: (m) => m >= 720 && m < 1020 },
  { key: 'evening', label: 'Evening', icon: 'fa fa-cloud-moon', hint: '5 – 9 PM', test: (m) => m >= 1020 && m < 1260 },
  { key: 'night', label: 'Night', icon: 'fa fa-moon', hint: 'After 9 PM', test: (m) => m >= 1260 || m < 360 },
];

const TYPES = [
  { key: 'ac', label: 'AC', test: (t) => /\bAC\b/i.test(t) && !/non-ac/i.test(t) },
  { key: 'nonac', label: 'Non-AC', test: (t) => /non-ac/i.test(t) },
  { key: 'sleeper', label: 'Sleeper', test: (t) => /sleeper/i.test(t) },
  { key: 'seater', label: 'Seater', test: (t) => /seater/i.test(t) },
];

const SORTS = {
  departure: { label: 'Earliest', fn: (a, b) => toMinutes(a.deptime) - toMinutes(b.deptime) },
  price: { label: 'Cheapest', fn: (a, b) => a.tktprice - b.tktprice },
  duration: { label: 'Fastest', fn: (a, b) => durationToMinutes(a.durtime) - durationToMinutes(b.durtime) },
};

const toMinutes = (t = '') => {
  const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return 0;
  return ((Number(m[1]) % 12) + (m[3].toUpperCase() === 'PM' ? 12 : 0)) * 60 + Number(m[2]);
};

const titleCase = (s = '') => s.replace(/\b\w/g, (c) => c.toUpperCase());

const amenities = (type) => [
  /\bAC\b/i.test(type) && !/non-ac/i.test(type) && { icon: 'fa fa-snowflake', label: 'Air conditioned' },
  /sleeper/i.test(type) && { icon: 'fa fa-bed', label: 'Sleeper berths' },
  /volvo|multi-axle/i.test(type) && { icon: 'fa fa-couch', label: 'Push-back seats' },
  { icon: 'fa fa-plug', label: 'Charging point' },
  { icon: 'fa fa-tint', label: 'Water bottle' },
].filter(Boolean);

const BusList = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { draft, setDraft } = useContext(busContext);
  const from = params.get('from') || '';
  const to = params.get('to') || '';
  const date = params.get('date') || '';
  const reopenBus = params.get('bus');

  const [buses, setBuses] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [openBus, setOpenBus] = useState(null);
  const [sort, setSort] = useState('departure');
  const [slots, setSlots] = useState([]);
  const [types, setTypes] = useState([]);
  const [maxPrice, setMaxPrice] = useState(null);

  useEffect(() => {
    if (!from || !to) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    setOpenBus(null);
    setSlots([]);
    setTypes([]);
    setMaxPrice(null);
    fetch(`${API}/buslist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ srcname: from, destname: to }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        setBuses(list);
        if (reopenBus && list.some((b) => b._id === reopenBus)) setOpenBus(reopenBus);
      })
      .catch(() => !cancelled && setError('Could not load buses. Please try again.'))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  // Coming back from the passenger page (?bus=...): bring that bus into view.
  useEffect(() => {
    if (!reopenBus || openBus !== reopenBus) return;
    const timer = setTimeout(() => {
      const el = document.getElementById(`bus-${reopenBus}`);
      if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 20, behavior: 'smooth' });
    }, 400);
    return () => clearTimeout(timer);
  }, [reopenBus, openBus]);

  // Route list for "no buses" suggestions; fetched once.
  useEffect(() => {
    fetch(`${API}/routes`).then((r) => r.json()).then((d) => setRoutes(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const priceCap = buses.length ? Math.max(...buses.map((b) => b.tktprice)) : 0;
  const priceFloor = buses.length ? Math.min(...buses.map((b) => b.tktprice)) : 0;

  const visible = useMemo(() => buses
    .filter((b) => !slots.length || slots.some((k) => SLOTS.find((s) => s.key === k).test(toMinutes(b.deptime))))
    .filter((b) => !types.length || types.every((k) => TYPES.find((t) => t.key === k).test(b.btype)))
    .filter((b) => maxPrice == null || b.tktprice <= maxPrice)
    .sort(SORTS[sort].fn), [buses, slots, types, maxPrice, sort]);

  const toggle = (list, setList, key) => setList(list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);
  const clearFilters = () => { setSlots([]); setTypes([]); setMaxPrice(null); };
  const filtersActive = slots.length || types.length || maxPrice != null;

  const dateStrip = useMemo(() => {
    const base = fromISODate(date) || new Date();
    const start = new Date(base);
    start.setDate(start.getDate() - 3);
    const today = todayISO();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return toISODate(d);
    }).filter((iso) => iso >= today);
  }, [date]);

  const continueToPassengers = (bus, seats, rules) => {
    // Keep anything already typed on the passenger page (matched by seat) when seats change.
    const sameTrip = draft?.bus?._id === bus._id && draft?.date === date;
    setDraft({ bus, seats, rules, date, from: titleCase(from), to: titleCase(to), form: sameTrip ? draft.form : undefined });
    if (!localStorage.getItem('token')) {
      navigate(`/login?next=${encodeURIComponent('/passengers')}`);
      return;
    }
    navigate('/passengers');
  };

  const lcFrom = from.trim().toLowerCase();
  const lcTo = to.trim().toLowerCase();
  const fromHere = routes.filter((r) => r.from === lcFrom).slice(0, 6);
  const toThere = routes.filter((r) => r.to === lcTo && r.from !== lcFrom).slice(0, 6);
  const reverse = routes.find((r) => r.from === lcTo && r.to === lcFrom);

  const routeLink = (r) => busSearchUrl({ from: titleCase(r.from), to: titleCase(r.to), date: date || todayISO() });

  return (
    <>
      <Navbar />
      <div className="bus-page">
        <section className="bus-hero">
          <div className="bus-hero-inner">
            {from && to && (
              <h1 className="bus-hero-title">
                {titleCase(from)} <i className="fa fa-long-arrow-alt-right" /> {titleCase(to)}
                {date && <span>{formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}</span>}
              </h1>
            )}
            <SearchForm variant="compact" initial={{ from: titleCase(from), to: titleCase(to), date }} />
          </div>
        </section>

        {!from || !to ? (
          <div className="bus-empty">
            <div className="bus-empty-art"><i className="fa fa-search-location" /></div>
            <h2>Where are you headed?</h2>
            <p>Enter your source, destination and date above to see available buses.</p>
          </div>
        ) : (
          <div className="container bus-layout-wrap">
            {date && dateStrip.length > 0 && (
              <div className="date-strip">
                {dateStrip.map((iso) => (
                  <Link key={iso} to={busSearchUrl({ from, to, date: iso })} className={`date-chip${iso === date ? ' active' : ''}`}>
                    <small>{formatDate(iso, { weekday: 'short' })}</small>
                    <strong>{formatDate(iso, { day: 'numeric' })}</strong>
                    <small>{formatDate(iso, { month: 'short' })}</small>
                  </Link>
                ))}
              </div>
            )}

            <div className="bus-layout">
              {buses.length > 0 && (
                <aside className="bus-filters">
                  <div className="bus-filters-head">
                    <h3><i className="fa fa-sliders-h" /> Filters</h3>
                    {filtersActive ? <button type="button" onClick={clearFilters}>Clear all</button> : null}
                  </div>

                  <h4>Departure time</h4>
                  <div className="filter-slots">
                    {SLOTS.map((s) => (
                      <button type="button" key={s.key} className={slots.includes(s.key) ? 'active' : ''} onClick={() => toggle(slots, setSlots, s.key)}>
                        <i className={s.icon} />
                        <strong>{s.label}</strong>
                        <small>{s.hint}</small>
                      </button>
                    ))}
                  </div>

                  <h4>Bus type</h4>
                  <div className="filter-types">
                    {TYPES.map((t) => (
                      <button type="button" key={t.key} className={types.includes(t.key) ? 'active' : ''} onClick={() => toggle(types, setTypes, t.key)}>
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {priceCap > priceFloor && (
                    <>
                      <h4>Max price <span>₹{(maxPrice ?? priceCap).toLocaleString('en-IN')}</span></h4>
                      <input
                        type="range"
                        className="filter-range"
                        min={priceFloor}
                        max={priceCap}
                        step={10}
                        value={maxPrice ?? priceCap}
                        onChange={(e) => setMaxPrice(Number(e.target.value))}
                      />
                      <div className="filter-range-labels"><span>₹{priceFloor}</span><span>₹{priceCap}</span></div>
                    </>
                  )}
                </aside>
              )}

              <main className="bus-results">
                {loading && [0, 1, 2].map((i) => <div className="bus-card skeleton" key={i} />)}

                {!loading && error && <div className="bus-error"><i className="fa fa-exclamation-triangle" /> {error}</div>}

                {!loading && !error && buses.length === 0 && (
                  <div className="bus-empty">
                    <div className="bus-empty-art">
                      <div className="bus-empty-road" />
                      <i className="fa fa-bus-alt" />
                    </div>
                    <h2>No buses from {titleCase(from)} to {titleCase(to)}</h2>
                    <p>We don't run this route yet. Try one of these instead:</p>

                    {reverse && (
                      <Link className="bus-empty-swap" to={routeLink(reverse)}>
                        <i className="fa fa-exchange-alt" /> Try {titleCase(reverse.from)} → {titleCase(reverse.to)} ({reverse.buses} buses)
                      </Link>
                    )}
                    {fromHere.length > 0 && (
                      <div className="bus-empty-group">
                        <h4>Buses from {titleCase(from)}</h4>
                        <div>{fromHere.map((r) => <Link key={r.to} to={routeLink(r)} className="route-chip">{titleCase(r.from)} → {titleCase(r.to)} <small>from ₹{r.minFare}</small></Link>)}</div>
                      </div>
                    )}
                    {toThere.length > 0 && (
                      <div className="bus-empty-group">
                        <h4>Buses to {titleCase(to)}</h4>
                        <div>{toThere.map((r) => <Link key={r.from} to={routeLink(r)} className="route-chip">{titleCase(r.from)} → {titleCase(r.to)} <small>from ₹{r.minFare}</small></Link>)}</div>
                      </div>
                    )}
                    {!fromHere.length && !toThere.length && !reverse && (
                      <div className="bus-empty-group">
                        <h4>Popular routes</h4>
                        <div>{routes.filter((r) => ['hyderabad', 'mumbai', 'bangalore', 'delhi'].includes(r.from)).slice(0, 6).map((r) => (
                          <Link key={`${r.from}-${r.to}`} to={routeLink(r)} className="route-chip">{titleCase(r.from)} → {titleCase(r.to)} <small>from ₹{r.minFare}</small></Link>
                        ))}</div>
                      </div>
                    )}
                  </div>
                )}

                {!loading && buses.length > 0 && (
                  <>
                    <div className="bus-results-head">
                      <p><strong>{visible.length}</strong> of {buses.length} buses</p>
                      <div className="bus-sort">
                        {Object.entries(SORTS).map(([key, s]) => (
                          <button type="button" key={key} className={sort === key ? 'active' : ''} onClick={() => setSort(key)}>{s.label}</button>
                        ))}
                      </div>
                    </div>

                    {visible.length === 0 && (
                      <div className="bus-error"><i className="fa fa-filter" /> No buses match these filters. <button type="button" onClick={clearFilters}>Clear filters</button></div>
                    )}

                    {visible.map((bus, i) => {
                      const open = openBus === bus._id;
                      return (
                        <article key={bus._id} id={`bus-${bus._id}`} className={`bus-card${open ? ' open' : ''}`} style={{ animationDelay: `${i * 70}ms` }}>
                          <div className="bus-card-main">
                            <img className="bus-card-photo" src={imageUrl(bus.Imageurl)} alt={bus.trname} loading="lazy" />
                            <div className="bus-card-info">
                              <h3>{bus.trname}</h3>
                              <span className="bus-type">{bus.btype}</span>
                              <div className="bus-amenities">
                                {amenities(bus.btype).map((a) => <i key={a.label} className={a.icon} title={a.label} aria-label={a.label} />)}
                              </div>
                            </div>
                            <div className="bus-card-times">
                              <div>
                                <strong>{bus.deptime}</strong>
                                <span>{titleCase(bus.srcname)}</span>
                              </div>
                              <div className="bus-card-line">
                                <span className="bus-card-duration">{bus.durtime}</span>
                                <div className="bus-card-track"><i className="fa fa-bus" /></div>
                              </div>
                              <div>
                                <strong>{bus.arrtime}</strong>
                                <span>{titleCase(bus.destname)}</span>
                              </div>
                            </div>
                            <div className="bus-card-price">
                              <small>Starts from</small>
                              <strong>₹{bus.tktprice.toLocaleString('en-IN')}</strong>
                              <button type="button" className={`btn-seats${open ? ' active' : ''}`} onClick={() => setOpenBus(open ? null : bus._id)} disabled={!date}>
                                {open ? 'Hide seats' : 'Select seats'} <i className={`fa fa-chevron-${open ? 'up' : 'down'}`} />
                              </button>
                            </div>
                          </div>
                          {open && date && (
                            <div className="bus-card-seats">
                              <SeatMap
                                bus={bus}
                                date={date}
                                initialSelected={draft?.bus?._id === bus._id && draft?.date === date ? draft.seats : []}
                                onContinue={(seats, rules) => continueToPassengers(bus, seats, rules)}
                              />
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </>
                )}
              </main>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </>
  );
};

export default BusList;
