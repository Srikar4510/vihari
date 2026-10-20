const Bus = require('../models/buses');
const Tour = require('../models/tour');
const Ticket = require('../models/ticket');
const { allSeats, neighbours } = require('./seatLayout');

const MAX_SEATS_PER_BOOKING = 6;
const MAX_TOUR_TRAVELLERS = 20;

class QuoteError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const isValidDate = (date) => /^\d{4}-\d{2}-\d{2}$/.test(date || '') && date >= todayISO();

// Seats already taken on this bus for this date, with the gender of whoever booked them.
const bookedSeats = async (busId, date) => {
  const tickets = await Ticket.find({ bus: busId, date }, 'tickets.seat tickets.gender');
  return tickets.flatMap((t) => t.tickets.map((s) => ({ seat: s.seat, gender: s.gender })));
};

// Like most Indian bus booking sites: a seat right next to a woman can only be booked by a woman,
// and next to a man only by a man. Seats booked together in one booking are exempt from this.
const genderRule = (btype, seat, booked) => {
  const next = neighbours(btype, seat).map((n) => booked.find((b) => b.seat === n)).find(Boolean);
  return next && ['Male', 'Female'].includes(next.gender) ? next.gender : null;
};

// Price for seats on a bus, computed on the server. `passengers` ([{ seat, gender }]) is optional;
// when given, the neighbouring-seat gender rule is checked too. Throws QuoteError if invalid.
const busQuote = async (busId, seats, date, passengers = []) => {
  if (!Array.isArray(seats) || seats.length === 0) throw new QuoteError(400, 'Select at least one seat');
  if (seats.length > MAX_SEATS_PER_BOOKING) throw new QuoteError(400, `You can book up to ${MAX_SEATS_PER_BOOKING} seats at a time`);
  if (!isValidDate(date)) throw new QuoteError(400, 'Choose a travel date from today onwards');

  const bus = await Bus.findById(busId).catch(() => null);
  if (!bus) throw new QuoteError(404, 'Bus not found');

  const valid = new Set(allSeats(bus.btype));
  if (new Set(seats).size !== seats.length || !seats.every((s) => valid.has(s))) throw new QuoteError(400, 'Invalid seat selection');

  const booked = await bookedSeats(bus._id, date);
  const clash = seats.filter((s) => booked.some((b) => b.seat === s));
  if (clash.length) throw new QuoteError(409, `Seat ${clash.join(', ')} was just booked by someone else. Please pick another seat.`);

  for (const p of Array.isArray(passengers) ? passengers : []) {
    const rule = genderRule(bus.btype, p.seat, booked);
    if (rule && p.gender !== rule) {
      throw new QuoteError(409, `Seat ${p.seat} is next to a ${rule === 'Female' ? 'woman' : 'man'}, so it can only be booked for a ${rule === 'Female' ? 'female' : 'male'} passenger.`);
    }
  }

  return { bus, amount: bus.tktprice * seats.length };
};

const tourQuote = async (tourId, travellers) => {
  const count = Number(travellers);
  if (!Number.isInteger(count) || count < 1 || count > MAX_TOUR_TRAVELLERS) throw new QuoteError(400, `Travellers must be between 1 and ${MAX_TOUR_TRAVELLERS}`);
  const tour = await Tour.findById(tourId).catch(() => null);
  if (!tour) throw new QuoteError(404, 'Tour not found');
  return { tour, travellers: count, amount: tour.tprice * count };
};

module.exports = { QuoteError, busQuote, tourQuote, bookedSeats, isValidDate };
