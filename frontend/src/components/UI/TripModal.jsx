import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatDate } from './DatePicker';
import { tripDateTime, tripArrival, timeLeft, useNow } from '../../utils/time';
import { downloadTicketPdf } from '../../utils/ticketPdf';

const GENDER_ICONS = { Male: 'fa fa-mars', Female: 'fa fa-venus', Other: 'fa fa-genderless' };
const titleCase = (s = '') => s.replace(/\b\w/g, (c) => c.toUpperCase());
const pad = (n) => String(n).padStart(2, '0');

// Details of one bus booking with a live countdown to departure and a PDF download.
const TripModal = ({ trip, onClose }) => {
  const now = useNow(1000);
  const [downloading, setDownloading] = useState(false);
  const bus = trip.bus || {};
  const departure = tripDateTime(trip.date, bus.deptime);
  const arrival = tripArrival(departure, bus.durtime);
  const toDeparture = timeLeft(departure, now);
  const toArrival = timeLeft(arrival, now);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const download = () => {
    setDownloading(true);
    try {
      downloadTicketPdf(trip, bus);
    } finally {
      setTimeout(() => setDownloading(false), 600);
    }
  };

  let status;
  if (toDeparture) {
    status = (
      <div className="trip-countdown">
        <span className="trip-countdown-label"><i className="far fa-clock" /> Departs in</span>
        <div className="trip-countdown-boxes">
          {[['days', 'Days'], ['hours', 'Hours'], ['minutes', 'Mins'], ['seconds', 'Secs']].map(([k, label]) => (
            <div key={k}><strong>{pad(toDeparture[k])}</strong><small>{label}</small></div>
          ))}
        </div>
      </div>
    );
  } else if (toArrival) {
    status = (
      <div className="trip-status trip-status--live">
        <span className="live-dot" /> On the road · arriving in {toArrival.hours ? `${toArrival.hours}h ` : ''}{toArrival.minutes}m
      </div>
    );
  } else {
    status = <div className="trip-status trip-status--done"><i className="fa fa-check-circle" /> Trip completed</div>;
  }

  // Rendered into <body> so animated parents (which create a containing block) can't trap the overlay.
  return createPortal(
    <div className="trip-modal-backdrop" onClick={onClose} role="presentation">
      <div className="trip-modal" role="dialog" aria-modal="true" aria-label="Trip details" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="trip-modal-close" onClick={onClose} aria-label="Close"><i className="fa fa-times" /></button>

        {status}

        <div className="ticket trip-modal-ticket">
          <div className="ticket-top">
            <div>
              <small>From</small>
              <strong>{titleCase(bus.srcname)}</strong>
              <span>{bus.deptime}</span>
            </div>
            <div className="trip-modal-mid">
              <i className="fa fa-bus ticket-bus" />
              <small>{bus.durtime}</small>
            </div>
            <div className="text-end">
              <small>To</small>
              <strong>{titleCase(bus.destname)}</strong>
              <span>{bus.arrtime}</span>
            </div>
          </div>
          <div className="ticket-cut" />
          <div className="ticket-details">
            <div><small>Date</small><strong>{formatDate(trip.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</strong></div>
            <div><small>Operator</small><strong>{bus.trname || '—'}</strong></div>
            <div><small>Bus type</small><strong>{bus.btype || '—'}</strong></div>
            <div><small>Paid</small><strong>₹{(trip.amount || 0).toLocaleString('en-IN')}</strong></div>
          </div>
          <table className="trip-modal-passengers">
            <thead><tr><th>Seat</th><th>Passenger</th><th>Age</th><th>Gender</th></tr></thead>
            <tbody>
              {trip.tickets.map((p) => (
                <tr key={p.seat}>
                  <td><b>{p.seat}</b></td>
                  <td>{p.name}</td>
                  <td>{p.age}</td>
                  <td><i className={GENDER_ICONS[p.gender] || 'fa fa-user'} /> {p.gender}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="ticket-id">
            Booking ID <strong>{trip._id.slice(-8).toUpperCase()}</strong>
            {trip.createdAt && <span className="trip-modal-booked">Booked {new Date(trip.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>}
          </div>
        </div>

        <div className="trip-modal-actions">
          <button type="button" className="btn-outline" onClick={onClose}>Close</button>
          <button type="button" className="btn-continue" onClick={download} disabled={downloading}>
            <i className="fa fa-file-download" /> {downloading ? 'Preparing…' : 'Download PDF ticket'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default TripModal;
