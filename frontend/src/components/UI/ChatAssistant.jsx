import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import TripModal from './TripModal';
import { busSearchUrl } from './SearchForm';
import { formatDate } from './DatePicker';
import { askAssistant } from '../../utils/assistant';
import { getProfile } from '../../utils/account';
import { downloadTourPdf } from '../../utils/ticketPdf';
import { imageUrl } from '../../utils/imageUrl';
import { tripDateTime, timeLeft, shortCountdown, useNow } from '../../utils/time';
import '../CSS/ChatAssistant.css';

const STORAGE_KEY = 'vihari-assistant';
const MAX_HISTORY = 60;
const MIN_TYPING_MS = 450;
const HIDDEN_ON = /^\/(agent|admin|admindb|agentLogin|agentSignUp|waitForApproval)/i;

const WELCOME = {
  from: 'bot',
  blocks: [
    { type: 'text', text: "Hi! I'm the Vihari assistant. Ask me to find buses, show your trips, suggest tours or explain how bookings work." },
    { type: 'chips', chips: [
      { label: 'Search buses', send: 'Search buses' },
      { label: 'My next trip', send: 'When is my next trip?' },
      { label: 'Tours under ₹1500', send: 'Tours under 1500' },
      { label: 'Baggage rules', send: 'How much baggage can I carry?' },
    ] },
  ],
};

const titleCase = (s = '') => s.replace(/\b\w/g, (c) => c.toUpperCase());
const rupees = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const load = () => {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.messages)) return saved;
  } catch { /* storage unavailable */ }
  return { messages: [WELCOME], context: {}, open: false };
};

// Floating chat bubble on traveller pages. Answers come from /api/assistant/chat, which
// matches the text against our own buses, tours and bookings (no AI service needed).
const ChatAssistant = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const initial = useRef(load()).current;
  const [open, setOpen] = useState(initial.open);
  const [messages, setMessages] = useState(initial.messages);
  const [context, setContext] = useState(initial.context);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [nudge, setNudge] = useState(false);
  const [trip, setTrip] = useState(null);
  const logRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ messages: messages.slice(-MAX_HISTORY), context, open }));
    } catch { /* storage unavailable */ }
  }, [messages, context, open]);

  // A one-time "Need help?" hint a few seconds after the first visit in this session.
  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem(`${STORAGE_KEY}-nudged`); } catch { /* ignore */ }
    if (seen || open) return undefined;
    const timer = setTimeout(() => {
      setNudge(true);
      try { sessionStorage.setItem(`${STORAGE_KEY}-nudged`, '1'); } catch { /* ignore */ }
    }, 4000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    setNudge(false);
    const timer = setTimeout(() => inputRef.current?.focus(), 250);
    const onKey = (e) => { if (e.key === 'Escape' && !trip) setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => { clearTimeout(timer); document.removeEventListener('keydown', onKey); };
  }, [open, trip]);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTo({ top: log.scrollHeight, behavior: 'smooth' });
  }, [messages, typing, open]);

  if (HIDDEN_ON.test(location.pathname)) return null;

  const send = async (text) => {
    const message = text.trim();
    if (!message || typing) return;
    setInput('');
    setMessages((m) => [...m, { from: 'user', text: message }]);
    setTyping(true);
    const started = Date.now();
    let reply;
    try {
      const res = await askAssistant(message, context);
      setContext(res.context || {});
      reply = { from: 'bot', blocks: res.messages };
    } catch (err) {
      reply = { from: 'bot', error: true, blocks: [
        { type: 'text', text: navigator.onLine === false ? "You seem to be offline. I'll be here when you're back." : err.message },
        { type: 'chips', chips: [{ label: 'Try again', send: message }] },
      ] };
    }
    await new Promise((r) => setTimeout(r, Math.max(0, MIN_TYPING_MS - (Date.now() - started))));
    setTyping(false);
    setMessages((m) => [...m, reply]);
  };

  const go = (to) => {
    navigate(to);
    if (window.innerWidth < 640) setOpen(false);
  };

  const onChip = (chip) => (chip.to ? go(chip.to) : send(chip.send || chip.label));

  const reset = () => {
    setMessages([WELCOME]);
    setContext({});
  };

  const renderBlock = (block, key, latest) => {
    switch (block.type) {
      case 'text':
        return <div key={key} className="chat-bubble">{block.text}</div>;
      case 'chips':
        return (
          <div key={key} className={`chat-chips${latest ? '' : ' chat-chips--old'}`}>
            {block.title && <small>{block.title}</small>}
            {block.chips.map((c) => (
              <button type="button" key={c.label} onClick={() => onChip(c)} disabled={typing}>
                {c.label}{c.to && <i className="fa fa-arrow-right" />}
              </button>
            ))}
          </div>
        );
      case 'buses':
        return (
          <div key={key} className="chat-cards">
            {block.buses.map((b) => (
              <div className="chat-card chat-bus" key={b._id}>
                <div className="chat-bus-top">
                  <div>
                    <strong>{b.trname}</strong>
                    <small>{b.btype}</small>
                  </div>
                  <span className="chat-price">{rupees(b.tktprice)}</span>
                </div>
                <div className="chat-bus-times">
                  <b>{b.deptime}</b>
                  <span><em><i className="fa fa-bus" /> {b.durtime}</em></span>
                  <b>{b.arrtime}</b>
                </div>
                <button type="button" className="chat-action" onClick={() => go(`${busSearchUrl(block.search)}&bus=${b._id}`)}>
                  Select seats <i className="fa fa-arrow-right" />
                </button>
              </div>
            ))}
            {block.total > block.buses.length && (
              <button type="button" className="chat-more" onClick={() => go(busSearchUrl(block.search))}>
                See all {block.total} buses <i className="fa fa-arrow-right" />
              </button>
            )}
          </div>
        );
      case 'trips':
        return (
          <div key={key} className="chat-cards">
            {block.trips.map((t) => <TripCard key={t._id} trip={t} onOpen={() => setTrip(t)} />)}
          </div>
        );
      case 'tours':
        return (
          <div key={key} className="chat-cards chat-cards--scroll">
            {block.tours.map((t) => (
              <div className="chat-card chat-tour" key={t._id}>
                <img src={imageUrl(t.DispImageurl)} alt="" loading="lazy" />
                <div className="chat-tour-body">
                  <strong>{t.tname}</strong>
                  <small>
                    {t.duration}{t.rating ? <> · <i className="fa fa-star" /> {t.rating}</> : null}
                  </small>
                  <div className="chat-tour-foot">
                    <span className="chat-price">{rupees(t.tprice)}<small>/person</small></span>
                    <div>
                      <button type="button" className="chat-link" onClick={() => go(`/tourplaces/${t._id}`)}>Itinerary</button>
                      <button type="button" className="chat-action chat-action--small" onClick={() => go(`/tours?book=${t._id}`)}>Book</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      case 'tourBookings':
        return (
          <div key={key} className="chat-cards">
            {block.bookings.map((b) => <TourBookingCard key={b._id} booking={b} />)}
          </div>
        );
      default:
        return null;
    }
  };

  const lastBot = messages.map((m) => m.from).lastIndexOf('bot');

  return (
    <>
      {nudge && !open && (
        <div className="chat-nudge">
          <button type="button" onClick={() => setOpen(true)}>Need help planning a trip? <b>Ask me</b></button>
          <button type="button" className="chat-nudge-close" onClick={() => setNudge(false)} aria-label="Dismiss">×</button>
        </div>
      )}
      <button
        type="button"
        className={`chat-launcher${open ? ' open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close assistant' : 'Open assistant'}
        aria-expanded={open}
      >
        <i className="fa fa-comment-dots" />
        <i className="fa fa-times" />
      </button>

      <section className={`chat-panel${open ? ' open' : ''}`} role="dialog" aria-label="Vihari assistant" aria-hidden={!open}>
        <header className="chat-head">
          <div className="chat-avatar"><i className="fa fa-route" /></div>
          <div>
            <strong>Vihari assistant</strong>
            <small><span className="chat-online" /> Instant answers about buses, tours and bookings</small>
          </div>
          <button type="button" onClick={reset} aria-label="Start over" title="Start over"><i className="fa fa-redo-alt" /></button>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close"><i className="fa fa-times" /></button>
        </header>

        <div className="chat-log" ref={logRef} aria-live="polite">
          {messages.map((m, i) => (m.from === 'user' ? (
            // eslint-disable-next-line react/no-array-index-key
            <div key={i} className="chat-row chat-row--user"><div className="chat-bubble">{m.text}</div></div>
          ) : (
            // eslint-disable-next-line react/no-array-index-key
            <div key={i} className={`chat-row chat-row--bot${m.error ? ' chat-row--error' : ''}`}>
              {m.blocks.map((b, j) => renderBlock(b, j, i === lastBot))}
            </div>
          )))}
          {typing && (
            <div className="chat-row chat-row--bot">
              <div className="chat-bubble chat-typing" aria-label="Assistant is typing"><span /><span /><span /></div>
            </div>
          )}
        </div>

        <form className="chat-input" onSubmit={(e) => { e.preventDefault(); send(input); }}>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='Try "Hyderabad to Chennai tomorrow"'
            maxLength={300}
            aria-label="Message"
            tabIndex={open ? 0 : -1}
          />
          <button type="submit" disabled={!input.trim() || typing} aria-label="Send" tabIndex={open ? 0 : -1}>
            <i className="fa fa-paper-plane" />
          </button>
        </form>
      </section>

      {trip && <TripModal trip={trip} onClose={() => setTrip(null)} />}
    </>
  );
};

const TripCard = ({ trip, onOpen }) => {
  const now = useNow(30000);
  const bus = trip.bus || {};
  const departure = tripDateTime(trip.date, bus.deptime);
  const left = shortCountdown(timeLeft(departure, now));
  return (
    <div className="chat-card chat-trip">
      <div className="chat-bus-top">
        <div>
          <strong>{titleCase(bus.srcname)} → {titleCase(bus.destname)}</strong>
          <small>{formatDate(trip.date, { weekday: 'short', day: 'numeric', month: 'short' })} · {bus.deptime} · {trip.tickets.length} seat{trip.tickets.length > 1 ? 's' : ''}</small>
        </div>
        {left && <span className="chat-countdown"><i className="far fa-clock" /> {left}</span>}
      </div>
      <button type="button" className="chat-action" onClick={onOpen}>
        Details &amp; PDF ticket <i className="fa fa-arrow-right" />
      </button>
    </div>
  );
};

const TourBookingCard = ({ booking }) => {
  const [busy, setBusy] = useState(false);
  const download = async () => {
    setBusy(true);
    try {
      const user = await getProfile().then((r) => r.user).catch(() => null);
      await downloadTourPdf(booking, booking.tour, { name: user ? `${user.firstName} ${user.lastName}` : '', email: user?.email, mobile: user?.mobile });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="chat-card chat-trip">
      <div className="chat-bus-top">
        <div>
          <strong>{booking.tour?.tname || 'Tour no longer listed'}</strong>
          <small>{booking.travellers} traveller{booking.travellers > 1 ? 's' : ''} · booked {formatDate(String(booking.bookedAt).slice(0, 10), { day: 'numeric', month: 'short' })}</small>
        </div>
        <span className="chat-price">{rupees(booking.price)}</span>
      </div>
      {booking.tour && (
        <button type="button" className="chat-action" onClick={download} disabled={busy}>
          <i className="fa fa-file-download" /> {busy ? 'Preparing…' : 'Download voucher'}
        </button>
      )}
    </div>
  );
};

export default ChatAssistant;
