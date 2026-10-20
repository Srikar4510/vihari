import { useContext, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useRazorpay from 'react-razorpay';
import Navbar from './Navbar';
import Footer from './Footer';
import busContext from '../../context/bus/busContext';
import { formatDate } from './DatePicker';
import { busSearchUrl } from './SearchForm';
import { imageUrl } from '../../utils/imageUrl';
import { createOrder, collectPayment, bookBus } from '../../utils/payments';
import { getProfile, getTravellers, addTraveller } from '../../utils/account';
import { downloadTicketPdf } from '../../utils/ticketPdf';
import '../CSS/BusResults.css';
import '../CSS/Checkout.css';

const GENDERS = ['Male', 'Female', 'Other'];
const GENDER_ICONS = { Male: 'fa fa-mars', Female: 'fa fa-venus', Other: 'fa fa-genderless' };
const SAVE_DELAY_MS = 400;

const blankPassenger = (seat) => ({ seat, name: '', age: '', gender: '', save: false });

// Rebuild the passenger list for the current seats, keeping anything typed earlier for the same seat.
const initialPassengers = (draft) => (draft?.seats || []).map((seat) => ({
  ...blankPassenger(seat),
  ...(draft.form?.passengers || []).find((p) => p.seat === seat),
}));

const PassengerDetails = () => {
  const navigate = useNavigate();
  const [Razorpay] = useRazorpay();
  const { draft, setDraft } = useContext(busContext);
  const [contact, setContact] = useState(draft?.form?.contact || { email: '', phone: '' });
  const [passengers, setPassengers] = useState(() => initialPassengers(draft));
  const [saved, setSaved] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [booking, setBooking] = useState(null);
  const finished = useRef(false);

  const loggedIn = Boolean(localStorage.getItem('token'));
  useEffect(() => {
    if (draft && !loggedIn) navigate(`/login?next=${encodeURIComponent('/passengers')}`, { replace: true });
  }, [draft, loggedIn, navigate]);

  // Prefill contact details from the profile and load saved travellers.
  useEffect(() => {
    if (!loggedIn || !draft) return;
    getProfile()
      .then(({ user }) => setContact((c) => ({ email: c.email || user.email, phone: c.phone || user.mobile })))
      .catch(() => {});
    getTravellers().then(({ travellers }) => setSaved(travellers)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn]);

  // Autosave what has been typed into the session draft, so leaving and coming back keeps it.
  useEffect(() => {
    if (!draft || finished.current) return undefined;
    const timer = setTimeout(() => {
      if (!finished.current) setDraft({ ...draft, form: { contact, passengers } });
    }, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contact, passengers]);

  const updatePassenger = (i, patch) => {
    setPassengers((list) => list.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
    setError('');
  };

  if (booking) {
    return (
      <>
        <Navbar />
        <div className="bus-page checkout-page">
          <div className="ticket-wrap">
            <div className="ticket-check"><i className="fa fa-check" /></div>
            <h1>Booking confirmed!</h1>
            <p>{booking.demo ? 'Demo mode: no payment was taken.' : 'Payment received.'} Have a great trip.</p>
            <div className="ticket">
              <div className="ticket-top">
                <div>
                  <small>From</small>
                  <strong>{booking.from}</strong>
                  <span>{booking.bus.deptime}</span>
                </div>
                <i className="fa fa-bus ticket-bus" />
                <div className="text-end">
                  <small>To</small>
                  <strong>{booking.to}</strong>
                  <span>{booking.bus.arrtime}</span>
                </div>
              </div>
              <div className="ticket-cut" />
              <div className="ticket-details">
                <div><small>Date</small><strong>{formatDate(booking.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</strong></div>
                <div><small>Operator</small><strong>{booking.bus.trname}</strong></div>
                <div><small>Seats</small><strong>{booking.ticket.tickets.map((t) => t.seat).join(', ')}</strong></div>
                <div><small>Paid</small><strong>₹{booking.ticket.amount.toLocaleString('en-IN')}</strong></div>
              </div>
              <div className="ticket-passengers">
                {booking.ticket.tickets.map((t) => (
                  <span key={t.seat}><i className="fa fa-user" /> {t.name} · {t.age} · {t.gender} · Seat {t.seat}</span>
                ))}
              </div>
              <div className="ticket-id">Booking ID <strong>{booking.ticket._id.slice(-8).toUpperCase()}</strong></div>
            </div>
            <div className="ticket-actions">
              <button type="button" className="btn-outline" onClick={() => downloadTicketPdf(booking.ticket, booking.bus)}><i className="fa fa-file-download" /> Download PDF</button>
              <Link to="/profile?tab=trips" className="btn-outline">View my bookings</Link>
              <Link to="/" className="btn-continue">Book another trip <i className="fa fa-arrow-right" /></Link>
            </div>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  if (!draft) {
    return (
      <>
        <Navbar />
        <div className="bus-page">
          <div className="bus-empty" style={{ marginTop: 140 }}>
            <div className="bus-empty-art"><i className="fa fa-chair" /></div>
            <h2>No seats selected</h2>
            <p>Your booking session has ended. Search for a bus and pick your seats to continue.</p>
            <Link to="/" className="btn-continue" style={{ maxWidth: 260, margin: '18px auto 0' }}>Search buses</Link>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  const { bus, date, from, to, rules = {} } = draft;
  const total = bus.tktprice * passengers.length;
  const searchUrl = busSearchUrl({ from, to, date });
  const seatsUrl = `${searchUrl}&bus=${bus._id}`;

  const fillFromSaved = (i, t) => updatePassenger(i, { name: t.name, age: String(t.age), gender: t.gender, save: false });

  const submit = async (e) => {
    e.preventDefault();
    const missing = passengers.findIndex((p) => !p.gender);
    if (missing !== -1) {
      setError(`Select a gender for passenger ${missing + 1}`);
      return;
    }
    const wrong = passengers.find((p) => rules[p.seat] && p.gender !== rules[p.seat]);
    if (wrong) {
      setError(`Seat ${wrong.seat} can only be booked for a ${rules[wrong.seat].toLowerCase()} passenger`);
      return;
    }
    setSubmitting(true);
    setError('');
    const seats = passengers.map(({ seat, name, age, gender }) => ({ seat, name, age, gender }));
    try {
      const order = await createOrder({ type: 'bus', busId: bus._id, seats: seats.map((p) => p.seat), date, passengers: seats });
      const payment = await collectPayment(order, Razorpay, {
        description: `${from} → ${to}, ${seats.length} seat(s)`,
        prefill: { email: contact.email, contact: contact.phone },
      });
      const result = await bookBus({ busId: bus._id, date, seats, payment });
      // Save ticked passengers for next time; a failure here shouldn't affect the booking.
      await Promise.allSettled(passengers.filter((p) => p.save).map(({ name, age, gender }) => addTraveller({ name, age, gender })));
      finished.current = true;
      setDraft(null);
      setBooking({ ...result, bus, date, from, to });
      window.scrollTo(0, 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Navbar />
      <div className="bus-page checkout-page">
        <div className="container">
          <ol className="checkout-steps">
            <li className="done"><Link to={searchUrl}><span><i className="fa fa-check" /></span>Search</Link></li>
            <li className="done"><Link to={seatsUrl}><span><i className="fa fa-check" /></span>Seats</Link></li>
            <li className="current"><span>3</span>Passengers</li>
            <li><span>4</span>Payment</li>
          </ol>

          <form className="checkout" onSubmit={submit}>
            <div className="checkout-main">
              <section className="checkout-card">
                <h2><i className="fa fa-address-card" /> Contact details</h2>
                <p className="checkout-hint">Your ticket and updates will be sent here. Your details are saved as you type.</p>
                <div className="checkout-row">
                  <label>Email<input type="email" required value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} placeholder="you@example.com" /></label>
                  <label>Mobile number<input type="tel" required pattern="[0-9]{10}" title="10-digit mobile number" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} placeholder="10-digit number" /></label>
                </div>
              </section>

              {passengers.map((p, i) => {
                const rule = rules[p.seat];
                const usedElsewhere = (t) => passengers.some((q, j) => j !== i && q.name.trim().toLowerCase() === t.name.toLowerCase() && String(q.age) === String(t.age));
                const options = saved.filter((t) => !usedElsewhere(t));
                return (
                  <section className="checkout-card" key={p.seat} style={{ animationDelay: `${(i + 1) * 90}ms` }}>
                    <h2>
                      <span className="seat-badge">{p.seat}</span> Passenger {i + 1}
                      {rule && <span className={`seat-rule seat-rule--${rule.toLowerCase()}`}><i className={GENDER_ICONS[rule]} /> {rule} only</span>}
                    </h2>

                    {options.length > 0 && (
                      <div className="saved-pick">
                        <span>Saved travellers</span>
                        {options.map((t) => {
                          const blocked = rule && t.gender !== rule;
                          return (
                            <button type="button" key={t._id} className="saved-chip" disabled={blocked} onClick={() => fillFromSaved(i, t)} title={blocked ? `Seat ${p.seat} is for ${rule.toLowerCase()} passengers only` : `Fill in ${t.name}`}>
                              <i className={GENDER_ICONS[t.gender]} /> {t.name} <small>{t.age}</small>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <div className="checkout-row checkout-row--passenger">
                      <label>Full name<input required value={p.name} onChange={(e) => updatePassenger(i, { name: e.target.value })} placeholder="As on ID proof" /></label>
                      <label>Age<input type="number" required min={1} max={120} value={p.age} onChange={(e) => updatePassenger(i, { age: e.target.value })} placeholder="Age" /></label>
                    </div>
                    <div className="gender-toggle" role="radiogroup" aria-label={`Gender for seat ${p.seat}`}>
                      {GENDERS.map((g) => {
                        const blocked = rule && g !== rule;
                        return (
                          <button type="button" role="radio" aria-checked={p.gender === g} key={g} disabled={blocked} className={p.gender === g ? 'active' : ''} onClick={() => updatePassenger(i, { gender: g })}>
                            <i className={GENDER_ICONS[g]} /> {g}
                          </button>
                        );
                      })}
                    </div>
                    {rule && <p className="seat-rule-hint"><i className="fa fa-info-circle" /> Seat {p.seat} is next to a {rule === 'Female' ? 'woman' : 'man'}, so only a {rule.toLowerCase()} passenger can take it.</p>}
                    <label className="save-traveller">
                      <input type="checkbox" checked={p.save} onChange={(e) => updatePassenger(i, { save: e.target.checked })} />
                      Save to my travellers for next time
                    </label>
                  </section>
                );
              })}
              <p className="checkout-manage"><Link to="/profile?tab=travellers"><i className="fa fa-users" /> Manage saved travellers</Link></p>
            </div>

            <aside className="checkout-summary">
              <img src={imageUrl(bus.Imageurl)} alt={bus.trname} />
              <div className="checkout-summary-body">
                <h3>{bus.trname}</h3>
                <span className="bus-type">{bus.btype}</span>
                <div className="checkout-route">
                  <div><strong>{bus.deptime}</strong><span>{from}</span></div>
                  <i className="fa fa-long-arrow-alt-right" />
                  <div className="text-end"><strong>{bus.arrtime}</strong><span>{to}</span></div>
                </div>
                <p className="checkout-date"><i className="far fa-calendar-alt" /> {formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' })} · {bus.durtime}</p>
                <div className="checkout-seats">
                  {passengers.map((p) => <span key={p.seat}>{p.seat}</span>)}
                  <Link to={seatsUrl}>Change</Link>
                </div>
                <div className="checkout-fare">
                  <div><span>Base fare ({passengers.length} × ₹{bus.tktprice.toLocaleString('en-IN')})</span><span>₹{total.toLocaleString('en-IN')}</span></div>
                  <div><span>Convenience fee</span><span className="free">FREE</span></div>
                  <div className="checkout-total"><span>Total</span><strong>₹{total.toLocaleString('en-IN')}</strong></div>
                </div>
                {error && <div className="checkout-error" role="alert"><i className="fa fa-exclamation-circle" /> {error}</div>}
                <button className="btn-continue" disabled={submitting}>
                  {submitting ? <span className="bus-spinner light" /> : <><i className="fa fa-lock" /> Pay ₹{total.toLocaleString('en-IN')}</>}
                </button>
                <p className="checkout-secure"><i className="fa fa-shield-alt" /> Secure payments via Razorpay</p>
              </div>
            </aside>
          </form>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default PassengerDetails;
