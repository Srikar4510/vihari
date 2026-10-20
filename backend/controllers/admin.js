const bcrypt = require('bcryptjs');
const User = require('../models/user');
const Agent = require('../models/agent');
const Bus = require('../models/buses');
const Tour = require('../models/tour');
const Ticket = require('../models/ticket');
const TourTicket = require('../models/tourTickets');
const { removeStored, sendStored } = require('../middleware/fileUpload');
const { sendMail, mailConfigured } = require('../utils/mailer');

// All handlers run after adminAuth, so req.admin is the logged-in admin.

// Sends an email if mail is configured. Never throws: the admin action itself already
// succeeded, so a mail problem is reported back instead of failing the request.
const notify = (to, subject, text) => sendMail({ to, subject, text });

class InputError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
const fail = (res, error) => {
  if (error instanceof InputError) return res.status(error.status).json({ success: false, error: error.message });
  if (error?.name === 'CastError') return res.status(404).json({ success: false, error: 'Not found' });
  console.log(error);
  return res.status(500).json({ success: false, error: 'Something went wrong. Please try again.' });
};

const clean = (v) => String(v ?? '').trim().replace(/\s+/g, ' ');
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const bookedAt = (doc) => doc.createdAt || doc._id.getTimestamp();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const publicUser = (u) => ({ _id: u._id, firstName: u.firstName, lastName: u.lastName, email: u.email, mobile: u.mobile, createdAt: u.createdAt || u._id.getTimestamp() });
const partnerStatus = (a) => (a.blocked ? 'blocked' : a.flag === 1 ? 'approved' : 'pending');
const publicAgent = (a) => ({
  _id: a._id, agentName: a.agentName, email: a.email, createdAt: a.createdAt, status: partnerStatus(a), hasDocument: Boolean(a.document && a.document !== 'seed'),
});

// ---------- Profile ----------

exports.me = (req, res) => {
  const { _id, firstName, lastName, email } = req.admin;
  res.json({ success: true, admin: { _id, firstName, lastName, email }, mailConfigured: mailConfigured() });
};

// ---------- Dashboard ----------

exports.dashboard = async (req, res) => {
  try {
    const [users, agents, buses, tours, tickets, tourTickets] = await Promise.all([
      User.find({}, 'firstName lastName createdAt').lean(),
      Agent.find({}, '-password').lean(),
      Bus.find({}, 'srcname destname tktprice agent').lean(),
      Tour.find({}, 'tname agentId').lean(),
      Ticket.find({}).populate('user', 'firstName lastName').lean(),
      TourTicket.find({}).populate('user', 'firstName lastName').lean(),
    ]);
    const busById = Object.fromEntries(buses.map((b) => [String(b._id), b]));
    const tourById = Object.fromEntries(tours.map((t) => [String(t._id), t]));
    const agentById = Object.fromEntries(agents.map((a) => [String(a._id), a]));
    const busAmount = (t) => t.amount || (busById[String(t.bus)]?.tktprice || 0) * t.tickets.length;
    const name = (u) => (u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : 'Deleted user');

    const days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - (13 - i));
      return { date: d, bookings: 0, revenue: 0, signups: 0 };
    });
    const dayOf = (when) => days.find((d) => when >= d.date && when < new Date(d.date.getTime() + 86400000));
    tickets.forEach((t) => { const d = dayOf(new Date(bookedAt(t))); if (d) { d.bookings += 1; d.revenue += busAmount(t); } });
    tourTickets.forEach((t) => { const d = dayOf(new Date(bookedAt(t))); if (d) { d.bookings += 1; d.revenue += Number(t.price || 0); } });
    users.forEach((u) => { const d = dayOf(new Date(u.createdAt || u._id.getTimestamp())); if (d) d.signups += 1; });

    // Revenue per partner.
    const perPartner = {};
    const credit = (agentId, amount) => {
      if (!agentId) return;
      const k = String(agentId);
      perPartner[k] = perPartner[k] || { bookings: 0, revenue: 0 };
      perPartner[k].bookings += 1;
      perPartner[k].revenue += amount;
    };
    tickets.forEach((t) => credit(busById[String(t.bus)]?.agent, busAmount(t)));
    tourTickets.forEach((t) => credit(tourById[String(t.tour)]?.agentId, Number(t.price || 0)));

    const busRevenue = tickets.reduce((s, t) => s + busAmount(t), 0);
    const tourRevenue = tourTickets.reduce((s, t) => s + Number(t.price || 0), 0);
    const weekAgo = Date.now() - 7 * 86400000;

    res.json({
      success: true,
      stats: {
        users: users.length,
        newUsers: users.filter((u) => new Date(u.createdAt || u._id.getTimestamp()) >= weekAgo).length,
        partners: agents.filter((a) => partnerStatus(a) === 'approved').length,
        pendingPartners: agents.filter((a) => partnerStatus(a) === 'pending').length,
        blockedPartners: agents.filter((a) => partnerStatus(a) === 'blocked').length,
        buses: buses.length,
        routes: new Set(buses.map((b) => `${b.srcname}|${b.destname}`)).size,
        tours: tours.length,
        busBookings: tickets.length,
        tourBookings: tourTickets.length,
        upcomingTrips: tickets.filter((t) => t.date >= today()).length,
        revenue: busRevenue + tourRevenue,
        busRevenue,
        tourRevenue,
      },
      daily: days.map((d) => ({ date: d.date.toISOString(), bookings: d.bookings, revenue: d.revenue, signups: d.signups })),
      recent: [
        ...tickets.map((t) => {
          const bus = busById[String(t.bus)];
          return {
            _id: t._id, kind: 'bus', title: bus ? `${bus.srcname} → ${bus.destname}` : 'Bus', refId: t.bus,
            detail: `${t.tickets.length} seat${t.tickets.length > 1 ? 's' : ''}`, travelDate: t.date,
            who: name(t.user), partner: agentById[String(bus?.agent)]?.agentName, amount: busAmount(t), bookedAt: bookedAt(t),
          };
        }),
        ...tourTickets.map((t) => {
          const tour = tourById[String(t.tour)];
          return {
            _id: t._id, kind: 'tour', title: tour?.tname || 'Tour', refId: t.tour,
            detail: `${t.tickets} traveller${t.tickets > 1 ? 's' : ''}`,
            who: name(t.user), partner: agentById[String(tour?.agentId)]?.agentName, amount: Number(t.price || 0), bookedAt: bookedAt(t),
          };
        }),
      ].sort((a, b) => new Date(b.bookedAt) - new Date(a.bookedAt)).slice(0, 8),
      pending: agents.filter((a) => partnerStatus(a) === 'pending')
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5).map(publicAgent),
      topPartners: Object.entries(perPartner)
        .map(([id, v]) => ({ _id: id, agentName: agentById[id]?.agentName || 'Removed partner', ...v }))
        .sort((a, b) => b.revenue - a.revenue).slice(0, 5),
    });
  } catch (error) {
    fail(res, error);
  }
};

// ---------- Users ----------

exports.listUsers = async (req, res) => {
  try {
    const [users, trips, tours] = await Promise.all([
      User.find({}).sort({ _id: -1 }).lean(),
      Ticket.aggregate([{ $group: { _id: '$user', trips: { $sum: 1 }, spent: { $sum: { $ifNull: ['$amount', 0] } }, upcoming: { $sum: { $cond: [{ $gte: ['$date', today()] }, 1, 0] } } } }]),
      TourTicket.aggregate([{ $group: { _id: '$user', tours: { $sum: 1 }, spent: { $sum: { $toDouble: '$price' } } } }]),
    ]);
    const t = Object.fromEntries(trips.map((x) => [String(x._id), x]));
    const r = Object.fromEntries(tours.map((x) => [String(x._id), x]));
    res.json({
      success: true,
      users: users.map((u) => ({
        ...publicUser(u),
        trips: t[String(u._id)]?.trips || 0,
        upcoming: t[String(u._id)]?.upcoming || 0,
        tours: r[String(u._id)]?.tours || 0,
        spent: (t[String(u._id)]?.spent || 0) + (r[String(u._id)]?.spent || 0),
      })),
    });
  } catch (error) {
    fail(res, error);
  }
};

const userInput = (body, { creating }) => {
  const firstName = clean(body.firstName);
  const lastName = clean(body.lastName);
  const email = clean(body.email).toLowerCase();
  const mobile = clean(body.mobile);
  if (!firstName || !lastName || firstName.length > 40 || lastName.length > 40) throw new InputError('Enter a first and last name');
  if (!EMAIL_RE.test(email)) throw new InputError('Enter a valid email address');
  if (!/^[6-9]\d{9}$/.test(mobile)) throw new InputError('Enter a valid 10-digit mobile number');
  if (creating && String(body.password || '').length < 8) throw new InputError('Password must be at least 8 characters');
  return { firstName, lastName, email, mobile };
};

exports.addUser = async (req, res) => {
  try {
    const data = userInput(req.body, { creating: true });
    if (await User.exists({ email: data.email })) throw new InputError('A user with this email already exists', 409);
    const user = await User.create({ ...data, password: await bcrypt.hash(String(req.body.password), 10) });
    res.status(201).json({ success: true, user: { ...publicUser(user.toObject()), trips: 0, upcoming: 0, tours: 0, spent: 0 } });
  } catch (error) {
    fail(res, error);
  }
};

exports.editUser = async (req, res) => {
  try {
    const data = userInput(req.body, { creating: false });
    if (await User.exists({ email: data.email, _id: { $ne: req.params.userId } })) throw new InputError('Another user already uses this email', 409);
    const user = await User.findByIdAndUpdate(req.params.userId, data, { new: true }).lean();
    if (!user) throw new InputError('User not found', 404);
    res.json({ success: true, user: publicUser(user) });
  } catch (error) {
    fail(res, error);
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) throw new InputError('User not found', 404);
    const upcoming = await Ticket.countDocuments({ user: user._id, date: { $gte: today() } });
    if (upcoming) throw new InputError(`This user has ${upcoming} upcoming trip${upcoming > 1 ? 's' : ''}, so the account can't be deleted yet`, 409);
    // Past bookings stay for the partners' records; they show as "Deleted user".
    await user.deleteOne();
    res.json({ success: true });
  } catch (error) {
    fail(res, error);
  }
};

// ---------- Partners ----------

exports.listAgents = async (req, res) => {
  try {
    const [agents, buses, tours] = await Promise.all([
      Agent.find({}, '-password').sort({ createdAt: -1 }).lean(),
      Bus.aggregate([{ $group: { _id: '$agent', n: { $sum: 1 } } }]),
      Tour.aggregate([{ $group: { _id: '$agentId', n: { $sum: 1 } } }]),
    ]);
    const b = Object.fromEntries(buses.map((x) => [String(x._id), x.n]));
    const t = Object.fromEntries(tours.map((x) => [String(x._id), x.n]));
    res.json({
      success: true,
      mailConfigured: mailConfigured(),
      agents: agents.map((a) => ({ ...publicAgent(a), buses: b[String(a._id)] || 0, tours: t[String(a._id)] || 0 })),
    });
  } catch (error) {
    fail(res, error);
  }
};

const findAgent = async (id) => {
  const agent = await Agent.findById(id);
  if (!agent) throw new InputError('Partner not found', 404);
  return agent;
};

exports.approveAgent = async (req, res) => {
  try {
    const agent = await findAgent(req.params.agentId);
    agent.flag = 1;
    agent.blocked = false;
    await agent.save();
    const emailSent = await notify(agent.email, 'Your Vihari partner account is approved',
      `Hi ${agent.agentName},\n\nYour partner application has been approved. You can now log in to the Vihari partner portal and add your buses and tours.\n\nTeam Vihari`);
    res.json({ success: true, agent: publicAgent(agent), emailSent });
  } catch (error) {
    fail(res, error);
  }
};

// Rejecting removes a pending application. Approved partners are blocked instead, so their
// buses, tours and bookings stay intact.
exports.rejectAgent = async (req, res) => {
  try {
    const agent = await findAgent(req.params.agentId);
    if (agent.flag === 1) throw new InputError('This partner is already approved. Block the account instead.', 409);
    await agent.deleteOne();
    removeStored(agent.document);
    const emailSent = await notify(agent.email, 'Your Vihari partner application',
      `Hi ${agent.agentName},\n\nThank you for applying to become a Vihari partner. Unfortunately we couldn't approve your application this time.\n\nTeam Vihari`);
    res.json({ success: true, emailSent });
  } catch (error) {
    fail(res, error);
  }
};

const setBlocked = (blocked) => async (req, res) => {
  try {
    const agent = await findAgent(req.params.agentId);
    agent.blocked = blocked;
    await agent.save();
    const emailSent = await notify(agent.email, `Your Vihari partner account has been ${blocked ? 'blocked' : 'unblocked'}`,
      blocked
        ? `Hi ${agent.agentName},\n\nYour partner account has been blocked. Please contact the Vihari team if you think this is a mistake.\n\nTeam Vihari`
        : `Hi ${agent.agentName},\n\nYour partner account is active again. You can log in to the partner portal.\n\nTeam Vihari`);
    res.json({ success: true, agent: publicAgent(agent), emailSent });
  } catch (error) {
    fail(res, error);
  }
};
exports.blockAgent = setBlocked(true);
exports.unblockAgent = setBlocked(false);

// Streams a partner's registration document to the admin.
exports.agentDocument = async (req, res) => {
  try {
    const agent = await findAgent(req.params.agentId);
    if (!agent.document || agent.document === 'seed') throw new InputError('No document on file', 404);
    if (!(await sendStored(agent.document, res))) throw new InputError('The document file is missing', 404);
  } catch (error) {
    fail(res, error);
  }
};

// ---------- Announcements ----------

exports.announce = async (req, res) => {
  try {
    const subject = clean(req.body.subject);
    const message = String(req.body.message || '').trim();
    const audience = ['users', 'partners', 'all'].includes(req.body.audience) ? req.body.audience : 'users';
    if (subject.length < 3 || subject.length > 120) throw new InputError('Subject must be 3 to 120 characters');
    if (message.length < 10 || message.length > 5000) throw new InputError('Message must be 10 to 5000 characters');
    if (!mailConfigured()) throw new InputError('Email is not set up on the server yet (BREVO_API_KEY, or MAIL_USER and MAIL_PASS)', 503);
    const [users, agents] = await Promise.all([
      audience === 'partners' ? [] : User.find({}, 'email').lean(),
      audience === 'users' ? [] : Agent.find({ flag: 1, blocked: { $ne: true } }, 'email').lean(),
    ]);
    const emails = [...new Set([...users, ...agents].map((x) => x.email).filter(Boolean))];
    if (!emails.length) throw new InputError('There is nobody to send this to', 404);
    // BCC so recipients don't see each other's addresses.
    await sendMail({ bcc: emails, subject, text: message }, { throwOnError: true });
    res.json({ success: true, sent: emails.length });
  } catch (error) {
    if (!(error instanceof InputError)) {
      console.log('Announcement failed:', error.message);
      return res.status(502).json({ success: false, error: 'The email service rejected the message. Please check the mail settings.' });
    }
    return fail(res, error);
  }
};

exports.recipients = async (req, res) => {
  try {
    const [users, partners] = await Promise.all([User.countDocuments(), Agent.countDocuments({ flag: 1, blocked: { $ne: true } })]);
    res.json({ success: true, users, partners, mailConfigured: mailConfigured() });
  } catch (error) {
    fail(res, error);
  }
};
