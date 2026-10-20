const Ticket = require('../models/ticket');
const TourTicket = require('../models/tourTickets');
const Place = require('../models/place');
// Registered here because the emails populate them (don't rely on other files loading them first).
require('../models/buses');
require('../models/tour');
require('../models/user');
const { sendMail, mailConfigured } = require('./mailer');
const { busTicketPdf, tourVoucherPdf } = require('./ticketPdf');

// Booking confirmation emails with the PDF attached. Called in the background after a booking
// is saved, so a slow or failed email never affects the booking itself.

const titleCase = (s = '') => s.replace(/\b\w/g, (c) => c.toUpperCase());
const shortId = (id) => String(id).slice(-8).toUpperCase();
const rupees = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const prettyDate = (iso) => {
  const [y, m, d] = String(iso).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
};
const siteUrl = () => (process.env.FRONTEND_URL || '').split(',')[0].trim().replace(/\/+$/, '');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Simple, email-client-safe HTML (tables + inline styles).
const layout = ({ heading, intro, rows, note }) => {
  const site = siteUrl();
  return `<!doctype html><html><body style="margin:0;background:#f3f6f8;font-family:Arial,Helvetica,sans-serif;color:#1f2d36">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f6f8;padding:24px 0"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden">
<tr><td style="background:#1f2d36;padding:22px 28px;color:#ffffff;font-size:22px;font-weight:bold">Vihari <span style="color:#29d9d5;font-size:13px;font-weight:normal">&nbsp;${esc(heading)}</span></td></tr>
<tr><td style="padding:26px 28px 8px;font-size:15px;line-height:1.6">${intro}</td></tr>
<tr><td style="padding:8px 28px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eafbfb;border-radius:10px">
${rows.map(([k, v]) => `<tr><td style="padding:9px 16px;color:#6e7d87;font-size:13px;width:38%">${esc(k)}</td><td style="padding:9px 16px;font-size:14px;font-weight:bold">${esc(v)}</td></tr>`).join('')}
</table></td></tr>
<tr><td style="padding:16px 28px;font-size:13px;color:#6e7d87;line-height:1.6">${note}</td></tr>
${site ? `<tr><td style="padding:0 28px 26px"><a href="${esc(site)}/profile" style="display:inline-block;background:#1fb5c4;color:#ffffff;text-decoration:none;font-weight:bold;padding:11px 20px;border-radius:9px;font-size:14px">View my bookings</a></td></tr>` : ''}
<tr><td style="background:#1fb5c4;height:5px"></td></tr>
</table>
<p style="font-size:12px;color:#8a9aa4">Vihari: buses and curated tours across India</p>
</td></tr></table></body></html>`;
};

const sendBusTicketEmail = async (ticketId) => {
  if (!mailConfigured()) return false;
  const ticket = await Ticket.findById(ticketId).populate('bus').populate('user', 'firstName email').lean();
  if (!ticket?.user?.email || !ticket.bus) return false;
  const { bus, user } = ticket;
  const route = `${titleCase(bus.srcname)} → ${titleCase(bus.destname)}`;
  const seats = ticket.tickets.map((t) => t.seat).join(', ');
  const pdf = busTicketPdf(ticket, bus);
  return sendMail({
    to: user.email,
    subject: `Your Vihari ticket: ${route}, ${prettyDate(ticket.date)} (#${shortId(ticket._id)})`,
    text: [
      `Hi ${user.firstName || 'there'},`,
      '',
      `Your bus is booked. Your e-ticket is attached as a PDF.`,
      '',
      `Booking ID: ${shortId(ticket._id)}`,
      `Route: ${titleCase(bus.srcname)} to ${titleCase(bus.destname)}`,
      `Date: ${prettyDate(ticket.date)}, departs ${bus.deptime}, arrives ${bus.arrtime}`,
      `Bus: ${bus.trname} (${bus.btype})`,
      `Seats: ${seats}`,
      `Total paid: Rs. ${Number(ticket.amount || 0).toLocaleString('en-IN')}`,
      '',
      'Please reach the boarding point at least 15 minutes before departure and carry a photo ID for every passenger.',
      siteUrl() ? `\nView your bookings: ${siteUrl()}/profile` : '',
      '',
      'Happy travels,',
      'Team Vihari',
    ].join('\n'),
    html: layout({
      heading: 'Bus e-ticket',
      intro: `Hi ${esc(user.firstName || 'there')},<br>Your bus is booked! Your e-ticket is attached as a PDF.`,
      rows: [
        ['Booking ID', shortId(ticket._id)],
        ['Route', route],
        ['Date', prettyDate(ticket.date)],
        ['Departs / arrives', `${bus.deptime} → ${bus.arrtime}`],
        ['Bus', `${bus.trname} · ${bus.btype}`],
        ['Seats', seats],
        ['Total paid', rupees(ticket.amount)],
      ],
      note: 'Please reach the boarding point at least 15 minutes before departure and carry a photo ID for every passenger.',
    }),
    attachments: [pdf],
  });
};

const sendTourVoucherEmail = async (tourTicketId) => {
  if (!mailConfigured()) return false;
  const booking = await TourTicket.findById(tourTicketId).populate('tour').populate('user', 'firstName lastName email mobile').lean();
  if (!booking?.user?.email || !booking.tour) return false;
  const { tour, user } = booking;
  const places = await Place.find({ tour: tour._id }).lean();
  const price = Number(booking.price || 0);
  const pdf = await tourVoucherPdf(
    { _id: booking._id, travellers: booking.tickets, price, bookedAt: booking._id.getTimestamp() },
    tour,
    places,
    { name: `${user.firstName || ''} ${user.lastName || ''}`.trim(), email: user.email, mobile: user.mobile },
  );
  return sendMail({
    to: user.email,
    subject: `Your Vihari tour voucher: ${tour.tname} (#${shortId(booking._id)})`,
    text: [
      `Hi ${user.firstName || 'there'},`,
      '',
      `Your tour is booked. Your voucher with the full itinerary is attached as a PDF.`,
      '',
      `Booking ID: ${shortId(booking._id)}`,
      `Tour: ${tour.tname}${tour.duration ? ` (${tour.duration})` : ''}`,
      `Travellers: ${booking.tickets}`,
      `Total paid: Rs. ${price.toLocaleString('en-IN')}`,
      '',
      'The tour partner will contact you on your phone number with pickup time and hotel details.',
      siteUrl() ? `\nView your bookings: ${siteUrl()}/profile` : '',
      '',
      'Happy travels,',
      'Team Vihari',
    ].join('\n'),
    html: layout({
      heading: 'Tour voucher',
      intro: `Hi ${esc(user.firstName || 'there')},<br>Your tour is booked! Your voucher with the full itinerary is attached as a PDF.`,
      rows: [
        ['Booking ID', shortId(booking._id)],
        ['Tour', tour.tname],
        ...(tour.duration ? [['Duration', tour.duration]] : []),
        ['Travellers', String(booking.tickets)],
        ['Places', places.length ? places.map((p) => p.name).join(', ') : 'Shared by the partner before the trip'],
        ['Total paid', rupees(price)],
      ],
      note: 'The tour partner will contact you on your phone number with pickup time and hotel details.',
    }),
    attachments: [pdf],
  });
};

// Fire-and-forget wrapper used by the booking controllers.
const queue = (task, label) => {
  setImmediate(() => {
    task().catch((error) => console.log(`${label} email failed:`, error.message));
  });
};

module.exports = {
  emailBusTicket: (ticketId) => queue(() => sendBusTicketEmail(ticketId), 'Bus ticket'),
  emailTourVoucher: (tourTicketId) => queue(() => sendTourVoucherEmail(tourTicketId), 'Tour voucher'),
  sendBusTicketEmail,
  sendTourVoucherEmail,
};
