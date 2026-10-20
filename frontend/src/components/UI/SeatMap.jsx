import { useEffect, useState } from 'react';
import { decksFor, genderRule, layoutType, seatId, totalSeats } from '../../utils/seatLayout';
import { API_URL } from '../../config';

const MAX_SEATS = 6;
const API = API_URL;

// Seat or sleeper-berth map for one bus on one date. Calls onContinue(seats, rules) where rules maps
// a seat to 'Female' / 'Male' when it sits next to a seat already booked by that gender.
const SeatMap = ({ bus, date, initialSelected = [], onContinue }) => {
  const [booked, setBooked] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const decks = decksFor(bus.btype);
  const kind = layoutType(bus.btype);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`${API}/bookedseats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: bus._id, date }),
    })
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        const list = json.booked || [];
        setBooked(list);
        // Restore a previous selection (e.g. coming back from the passenger page), minus seats taken since.
        setSelected(initialSelected.filter((s) => !list.some((b) => b.seat === s)));
      })
      .catch(() => !cancelled && setBooked([]))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bus._id, date]);

  const toggle = (seat) => {
    setNotice('');
    setSelected((s) => {
      if (s.includes(seat)) return s.filter((x) => x !== seat);
      if (s.length >= MAX_SEATS) {
        setNotice(`You can book up to ${MAX_SEATS} seats at a time`);
        return s;
      }
      return [...s, seat];
    });
  };

  const renderSeat = (deck, row, letter, i) => {
    const id = seatId(deck, row, letter);
    const bookedBy = booked.find((b) => b.seat === id);
    const rule = bookedBy ? null : genderRule(bus.btype, id, booked);
    const isSelected = selected.includes(id);
    const classes = [
      deck.kind,
      bookedBy && 'booked',
      bookedBy?.gender === 'Female' && 'booked-female',
      bookedBy?.gender === 'Male' && 'booked-male',
      rule && `only-${rule.toLowerCase()}`,
      isSelected && 'selected',
    ].filter(Boolean).join(' ');
    const label = `${deck.kind === 'berth' ? 'Berth' : 'Seat'} ${id}${bookedBy ? ', booked' : ''}${rule ? `, ${rule.toLowerCase()} passengers only` : ''}`;
    return (
      <button
        type="button"
        key={id}
        className={classes}
        disabled={Boolean(bookedBy)}
        onClick={() => toggle(id)}
        aria-pressed={isSelected}
        aria-label={label}
        title={rule ? `Only for ${rule.toLowerCase()} passengers` : undefined}
        style={{ animationDelay: `${i * 10}ms` }}
      >
        <span>{id}</span>
        {rule && !isSelected && <i className={rule === 'Female' ? 'fa fa-venus' : 'fa fa-mars'} />}
        {bookedBy?.gender === 'Female' && <i className="fa fa-venus" />}
        {bookedBy?.gender === 'Male' && <i className="fa fa-mars" />}
      </button>
    );
  };

  const total = totalSeats(bus.btype);
  const available = total - booked.length;
  const rules = Object.fromEntries(selected.map((s) => [s, genderRule(bus.btype, s, booked)]).filter(([, r]) => r));

  return (
    <div className={`seatmap seatmap--${kind}`}>
      <div className="seatmap-decks">
        {loading ? (
          <div className="seatmap-bus"><div className="seatmap-loading"><span className="bus-spinner" /> Loading seats…</div></div>
        ) : decks.map((deck) => (
          <div className={`seatmap-bus seatmap-bus--${deck.kind}`} key={deck.name}>
            <div className="seatmap-front">
              <span className="seatmap-deck-name">{deck.name}</span>
              {deck.driver ? <i className="fa fa-dharmachakra seatmap-wheel" title="Driver" /> : <i className="fa fa-level-up-alt seatmap-stairs" title="Upper deck" />}
            </div>
            <div className="seatmap-grid">
              {Array.from({ length: deck.rows }, (_, r) => r + 1).map((row) => (
                <div className="seatmap-row" key={row}>
                  {deck.groups[0].map((l, j) => renderSeat(deck, row, l, row * 4 + j))}
                  <span className="seatmap-aisle">{row}</span>
                  {deck.groups[1].map((l, j) => renderSeat(deck, row, l, row * 4 + 2 + j))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="seatmap-side">
        <div className="seatmap-legend">
          <span><i className={`seat-dot ${kind === 'seater' ? '' : 'berth'}`} /> Available</span>
          <span><i className="seat-dot selected" /> Selected</span>
          <span><i className="seat-dot booked" /> Booked</span>
          <span><i className="seat-dot only-female" /> Female only</span>
          <span><i className="seat-dot only-male" /> Male only</span>
        </div>
        <p className="seatmap-available"><strong>{loading ? '…' : available}</strong> of {total} {kind === 'seater' ? 'seats' : kind === 'sleeper' ? 'berths' : 'seats and berths'} available</p>
        {kind !== 'seater' && (
          <p className="seatmap-hint"><i className="fa fa-bed" /> {kind === 'sleeper' ? 'Lie-flat sleeper berths on both decks.' : 'Seats on the lower deck, sleeper berths upstairs.'} Single berths (C) have no neighbour.</p>
        )}

        <div className="seatmap-summary">
          <span className="seatmap-label">Selected {kind === 'sleeper' ? 'berths' : 'seats'}</span>
          <div className="seatmap-chips">
            {selected.length === 0 ? <em>Tap a {kind === 'sleeper' ? 'berth' : 'seat'} to select it</em> : selected.map((s) => (
              <button type="button" key={s} onClick={() => toggle(s)} className={`seat-chip${rules[s] ? ` only-${rules[s].toLowerCase()}` : ''}`}>
                {s}{rules[s] && <i className={rules[s] === 'Female' ? 'fa fa-venus' : 'fa fa-mars'} />} <i className="fa fa-times" />
              </button>
            ))}
          </div>
          {Object.keys(rules).length > 0 && (
            <p className="seatmap-rule-note"><i className="fa fa-info-circle" /> {Object.entries(rules).map(([s, r]) => `${s}: ${r.toLowerCase()} passenger only`).join(' · ')}</p>
          )}
          {notice && <p className="seatmap-notice">{notice}</p>}
          <div className="seatmap-total">
            <span>{selected.length} × ₹{bus.tktprice.toLocaleString('en-IN')}</span>
            <strong>₹{(selected.length * bus.tktprice).toLocaleString('en-IN')}</strong>
          </div>
          <button type="button" className="btn-continue" disabled={selected.length === 0} onClick={() => onContinue(selected, rules)}>
            Continue <i className="fa fa-arrow-right" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SeatMap;
