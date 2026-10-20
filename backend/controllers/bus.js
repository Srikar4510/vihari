const Bus = require('../models/buses');
const Ticket = require('../models/ticket');
const { paymentsEnabled, verifyPayment, refundIfPaid } = require('../utils/payments');
const { emailBusTicket } = require('../utils/bookingEmails');
const { mailConfigured } = require('../utils/mailer');
const { QuoteError, busQuote, bookedSeats } = require('../utils/pricing');

const GENDERS = ['Male', 'Female', 'Other'];

// "9:30 PM" -> minutes after midnight, for sorting by departure.
const toMinutes = (t = '') => {
   const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
   if (!m) return 0;
   return ((Number(m[1]) % 12) + (m[3].toUpperCase() === 'PM' ? 12 : 0)) * 60 + Number(m[2]);
};

module.exports.busList = async (req, res) => {
   try {
      const srcname = String(req.body.srcname || '').trim().toLowerCase();
      const destname = String(req.body.destname || '').trim().toLowerCase();
      if (!srcname || !destname) return res.status(400).json({ error: 'Source and destination are required' });
      const buses = await Bus.find({ srcname, destname });
      buses.sort((a, b) => toMinutes(a.deptime) - toMinutes(b.deptime));
      res.json(buses);
   } catch (error) {
      console.log(error);
      res.status(500).json({ error: 'Could not load buses' });
   }
};

// All routes with their number of buses and lowest fare, used for "no buses found" suggestions.
module.exports.routes = async (req, res) => {
   try {
      const routes = await Bus.aggregate([
         { $group: { _id: { from: '$srcname', to: '$destname' }, buses: { $sum: 1 }, minFare: { $min: '$tktprice' } } },
         { $project: { _id: 0, from: '$_id.from', to: '$_id.to', buses: 1, minFare: 1 } },
         { $sort: { from: 1, to: 1 } },
      ]);
      res.json(routes);
   } catch (error) {
      console.log(error);
      res.status(500).json({ error: 'Could not load routes' });
   }
};

// Books seats after checking they are still free and, when payments are live, that the
// Razorpay payment is genuine and for the right amount.
//   { busId, date, seats: [{ seat, name, age, gender }], payment: { orderId, paymentId, signature } }
// If the traveller has already paid and the booking still fails (a seat was taken meanwhile,
// invalid details, a server error), the payment is refunded automatically.
module.exports.booking = async (req, res) => {
   const { busId, date, payment } = req.body;
   const live = paymentsEnabled();
   let refundable = live; // false once we know the payment is fake or already used
   const fail = async (status, error) => {
      const refunded = refundable && await refundIfPaid(payment, error);
      return res.status(status).json({ success: false, error: refunded ? `${error.replace(/\.?$/, '.')} Your payment has been refunded.` : error, refunded });
   };
   try {
      if (live && payment?.paymentId && await Ticket.exists({ paymentId: payment.paymentId })) {
         refundable = false;
         return res.status(409).json({ success: false, error: 'This payment has already been used for a booking' });
      }
      const passengers = Array.isArray(req.body.seats) ? req.body.seats : [];
      const invalid = passengers.find((p) => !String(p.name || '').trim()
         || !(Number(p.age) >= 1 && Number(p.age) <= 120)
         || !GENDERS.includes(p.gender));
      if (passengers.length === 0 || invalid) {
         return fail(400, 'Enter a name, age and gender for every passenger.');
      }

      const { bus, amount } = await busQuote(busId, passengers.map((p) => p.seat), date, passengers);

      if (live && !(await verifyPayment(payment, amount))) {
         refundable = false;
         return res.status(402).json({ success: false, error: 'Payment could not be verified' });
      }

      const ticket = await Ticket.create({
         user: req.user.id,
         bus: bus._id,
         date,
         amount,
         paymentId: paymentsEnabled() ? payment.paymentId : undefined,
         tickets: passengers.map(({ seat, name, age, gender }) => ({ seat, name: name.trim(), age: String(age), gender })),
      });
      // Ticket PDF goes to the account email in the background.
      emailBusTicket(ticket._id);
      res.status(201).json({ success: true, ticket, demo: !live, emailQueued: mailConfigured() });
   } catch (error) {
      if (error?.code === 11000) {
         refundable = false;
         return res.status(409).json({ success: false, error: 'This payment has already been used for a booking' });
      }
      if (error instanceof QuoteError) return fail(error.status, error.message);
      console.log(error);
      return fail(500, 'Something went wrong while booking.');
   }
};

module.exports.getBusDetails = async (req, res) => {
   try {
      const bus = await Bus.findById(req.body.id);
      if (!bus) return res.status(404).json({ success: false, error: 'Bus not found' });
      res.json({ success: true, bus });
   } catch (error) {
      console.log(error);
      res.status(500).json({ success: false, error: 'Internal error' });
   }
};

// booked: [{ seat, gender }] lets the seat map apply the neighbouring-seat gender rule.
// seats and bookings keep the older response shapes for existing callers.
module.exports.booked = async (req, res) => {
   try {
      const { id, date } = req.body;
      const booked = await bookedSeats(id, date);
      const seats = booked.map((b) => b.seat);
      res.json({ success: true, booked, seats, bookings: [{ tickets: seats.map((seat) => ({ seat })) }] });
   } catch (error) {
      console.log(error);
      res.status(500).json({ success: false, error: 'Internal error' });
   }
};
