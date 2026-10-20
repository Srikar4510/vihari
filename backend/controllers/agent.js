const Bus = require('../models/buses');
const Agent = require('../models/agent');
const Tour = require('../models/tour');
const Place = require('../models/place');
const Ticket = require('../models/ticket');
const TourTicket = require('../models/tourTickets');
const redisClient = require('../utils/Redis');
const { uploadedPath, removeUpload, removeStored } = require('../middleware/fileUpload');

// ---------------------------------------------------------------------------
// Public reads (used by the traveller pages and the admin bus list)
// ---------------------------------------------------------------------------

exports.getBuses = async (req, res) => {
  try {
    const buses = await Bus.find({});
    res.status(200).json({ buses });
  } catch (error) {
    res.status(500).json({ message: 'Error while fetching buses' });
  }
};

exports.getBusDetails = async (req, res) => {
  try {
    const bus = await Bus.findById(req.params.busId);
    if (!bus) return res.status(404).json({ message: 'Bus not found' });
    res.status(200).json({ bus });
  } catch (error) {
    res.status(404).json({ message: 'Bus not found' });
  }
};

exports.getTours = async (req, res) => {
  try {
    const cached = await redisClient.get('all-tours');
    if (cached) return res.status(200).json({ tours: JSON.parse(cached) });
    const tours = await Tour.find({});
    await redisClient.set('all-tours', JSON.stringify(tours));
    res.status(200).json({ tours });
  } catch (error) {
    res.status(500).json({ message: 'Error while fetching tours' });
  }
};

exports.getTourDetails = async (req, res) => {
  try {
    const tour = await Tour.findById(req.params.tourId);
    if (!tour) return res.status(404).json({ message: 'Tour not found' });
    res.status(200).json({ tour });
  } catch (error) {
    res.status(404).json({ message: 'Tour not found' });
  }
};

exports.getPlaces = async (req, res) => {
  try {
    const places = await Place.find({ tour: req.params.tourId });
    const tour = await Tour.findById(req.params.tourId);
    if (places.length === 0) {
      return res.status(404).json({ message: 'No places found for the provided tour ID' });
    }
    res.status(200).json({ places, tour });
  } catch (error) {
    res.status(500).json({ message: 'Error while fetching places' });
  }
};

// ---------------------------------------------------------------------------
// Partner (agent) endpoints. These run after agentAuth or agentOrAdmin, so req.agent is the
// logged-in partner, and every bus, tour or place is checked to belong to them.
// ---------------------------------------------------------------------------

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

const IMAGE_TYPES = /\.(png|jpe?g)$/i;
const imageFrom = (req, required) => {
  if (!req.file) {
    if (required) throw new InputError('Please add a photo');
    return null;
  }
  if (!IMAGE_TYPES.test(req.file.originalname) || !/^image\//.test(req.file.mimetype)) {
    throw new InputError('Photos must be JPG or PNG images');
  }
  return uploadedPath(req.file);
};

const clean = (v) => String(v ?? '').trim().replace(/\s+/g, ' ');
// Local date as stored on tickets ("2026-10-19").
const startOfToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const invalidateTours = () => redisClient.del('all-tours').catch(() => {});

// ----- Bus input -----

const BUS_TYPES = [
  'AC Sleeper', 'Non-AC Sleeper', 'AC Seater', 'Non-AC Seater',
  'Volvo Multi-Axle AC Seater', 'AC Seater / Sleeper', 'Non-AC Seater / Sleeper',
];
exports.BUS_TYPES = BUS_TYPES;

// "21:30" or "9:30 PM" -> minutes after midnight.
const parseTime = (value) => {
  const t = clean(value).toUpperCase();
  let m = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= 12 && Number(m[2]) < 60) {
    return ((Number(m[1]) % 12) + (m[3] === 'PM' ? 12 : 0)) * 60 + Number(m[2]);
  }
  m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (m && Number(m[1]) < 24 && Number(m[2]) < 60) return Number(m[1]) * 60 + Number(m[2]);
  return null;
};
const formatTime = (mins) => {
  const m = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  return `${((h + 11) % 12) + 1}:${String(m % 60).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

// 900 -> "15 hrs", 225 -> "3h 45m", 45 -> "45m" (the site reads all of these).
const formatDuration = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!m) return `${h} hrs`;
  return h ? `${h}h ${m}m` : `${m}m`;
};

// Validates bus fields. Times are stored like the rest of the site ("9:30 PM", "15 hrs" or "3h 45m")
// and the arrival time is worked out from departure + duration so they always agree.
const busInput = (body) => {
  const srcname = clean(body.srcname).toLowerCase();
  const destname = clean(body.destname).toLowerCase();
  const trname = clean(body.trname ?? body.bname);
  const btype = clean(body.btype);
  const dep = parseTime(body.deptime);
  const minutes = Number(body.durationMinutes);
  const price = Number(body.tktprice);

  const city = /^[a-z][a-z .'-]{1,39}$/;
  if (!city.test(srcname) || !city.test(destname)) throw new InputError('Enter valid From and To cities');
  if (srcname === destname) throw new InputError('From and To cities must be different');
  if (trname.length < 2 || trname.length > 60) throw new InputError('Enter the operator / travels name');
  if (!BUS_TYPES.includes(btype)) throw new InputError('Choose a bus type from the list');
  if (dep === null) throw new InputError('Enter a valid departure time');
  if (!Number.isInteger(minutes) || minutes < 15 || minutes > 48 * 60) throw new InputError('Duration must be between 15 minutes and 48 hours');
  if (!Number.isInteger(price) || price < 50 || price > 20000) throw new InputError('Fare must be a whole number between ₹50 and ₹20,000');

  return {
    srcname,
    destname,
    trname,
    btype,
    deptime: formatTime(dep),
    arrtime: formatTime(dep + minutes),
    durtime: formatDuration(minutes),
    tktprice: price,
  };
};

// Partners may only touch their own buses; admins may touch any bus.
const ownBus = async (req, busId) => {
  const bus = await Bus.findById(busId);
  if (!bus || (!req.admin && String(bus.agent) !== String(req.agent._id))) throw new InputError('Bus not found', 404);
  return bus;
};
const busScope = (req) => (req.admin ? {} : { agent: req.agent._id });
const tourScope = (req) => (req.admin ? {} : { agentId: req.agent._id });

// ----- Tour input -----

const parseFeatures = (raw) => {
  let list = raw;
  if (typeof raw === 'string') {
    try { list = JSON.parse(raw); } catch { list = raw.split(','); }
  }
  if (!Array.isArray(list)) return [];
  return [...new Set(list.map(clean).filter(Boolean))];
};

const tourInput = (body) => {
  const tname = clean(body.tname ?? body.tourName);
  const tprice = Number(body.tprice ?? body.tourPrice);
  const duration = clean(body.duration);
  const highlight = clean(body.highlight);
  const features = parseFeatures(body.features);
  if (tname.length < 3 || tname.length > 80) throw new InputError('Tour name must be 3 to 80 characters');
  if (!Number.isInteger(tprice) || tprice < 100 || tprice > 200000) throw new InputError('Price must be a whole number between ₹100 and ₹2,00,000');
  if (duration.length > 40) throw new InputError('Keep the duration short, e.g. "3 Days 2 Nights"');
  if (highlight.length > 140) throw new InputError('Keep the highlight under 140 characters');
  if (features.length > 8 || features.some((f) => f.length > 40)) throw new InputError('Add up to 8 inclusions, each under 40 characters');
  return { tname, tprice, duration, highlight, features };
};

const ownTour = async (req, tourId) => {
  const tour = await Tour.findById(tourId);
  if (!tour || (!req.admin && String(tour.agentId) !== String(req.agent._id))) throw new InputError('Tour not found', 404);
  return tour;
};

const placeInput = (body) => {
  const name = clean(body.name ?? body.title);
  const description = clean(body.description);
  if (name.length < 2 || name.length > 80) throw new InputError('Place name must be 2 to 80 characters');
  if (description.length < 10 || description.length > 600) throw new InputError('Description must be 10 to 600 characters');
  return { name, description };
};

const contactOf = (user) => (user ? {
  name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
  email: user.email,
  mobile: user.mobile,
} : { name: 'Deleted user' });

// ----- Profile -----

exports.me = async (req, res) => {
  try {
    const [buses, tours] = await Promise.all([
      Bus.countDocuments({ agent: req.agent._id }),
      Tour.countDocuments({ agentId: req.agent._id }),
    ]);
    const { _id, agentName, email, createdAt, document } = req.agent;
    res.json({ success: true, agent: { _id, agentName, email, createdAt, hasDocument: Boolean(document) }, stats: { buses, tours } });
  } catch (error) {
    fail(res, error);
  }
};

exports.updateMe = async (req, res) => {
  try {
    const agentName = clean(req.body.agentName);
    const email = clean(req.body.email).toLowerCase();
    if (agentName.length < 2 || agentName.length > 60) throw new InputError('Agency name must be 2 to 60 characters');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new InputError('Enter a valid email address');
    const taken = await Agent.findOne({ email, _id: { $ne: req.agent._id } });
    if (taken) throw new InputError('Another partner account already uses this email', 409);
    const agent = await Agent.findByIdAndUpdate(req.agent._id, { agentName, email }, { new: true }).select('-password');
    res.json({ success: true, agent: { _id: agent._id, agentName: agent.agentName, email: agent.email, createdAt: agent.createdAt } });
  } catch (error) {
    fail(res, error);
  }
};

// ----- Dashboard -----

exports.dashboard = async (req, res) => {
  try {
    const [buses, tours] = await Promise.all([
      Bus.find({ agent: req.agent._id }).lean(),
      Tour.find({ agentId: req.agent._id }).lean(),
    ]);
    const [tickets, tourTickets, placeCounts] = await Promise.all([
      Ticket.find({ bus: { $in: buses.map((b) => b._id) } }).populate('user', 'firstName lastName').lean(),
      TourTicket.find({ tour: { $in: tours.map((t) => t._id) } }).populate('user', 'firstName lastName').lean(),
      Place.aggregate([{ $match: { tour: { $in: tours.map((t) => t._id) } } }, { $group: { _id: '$tour', n: { $sum: 1 } } }]),
    ]);
    const busById = Object.fromEntries(buses.map((b) => [String(b._id), b]));
    const tourById = Object.fromEntries(tours.map((t) => [String(t._id), t]));
    const today = startOfToday();

    const busAmount = (t) => t.amount || (busById[String(t.bus)]?.tktprice || 0) * t.tickets.length;
    const bookedAt = (doc) => doc.createdAt || doc._id.getTimestamp();

    const busRevenue = tickets.reduce((s, t) => s + busAmount(t), 0);
    const tourRevenue = tourTickets.reduce((s, t) => s + Number(t.price || 0), 0);
    const upcoming = tickets.filter((t) => t.date >= today);

    // Bookings and revenue per day for the last 14 days.
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - (13 - i));
      return { date: d, bookings: 0, revenue: 0 };
    });
    const addToDay = (when, amount) => {
      const day = days.find((d) => when >= d.date && when < new Date(d.date.getTime() + 86400000));
      if (day) { day.bookings += 1; day.revenue += amount; }
    };
    tickets.forEach((t) => addToDay(new Date(bookedAt(t)), busAmount(t)));
    tourTickets.forEach((t) => addToDay(new Date(bookedAt(t)), Number(t.price || 0)));

    const recent = [
      ...tickets.map((t) => {
        const bus = busById[String(t.bus)];
        return {
          _id: t._id, kind: 'bus', title: bus ? `${bus.srcname} → ${bus.destname}` : 'Bus',
          detail: `${t.tickets.length} seat${t.tickets.length > 1 ? 's' : ''}`, travelDate: t.date,
          who: contactOf(t.user).name, amount: busAmount(t), bookedAt: bookedAt(t), refId: t.bus,
        };
      }),
      ...tourTickets.map((t) => ({
        _id: t._id, kind: 'tour', title: tourById[String(t.tour)]?.tname || 'Tour',
        detail: `${t.tickets} traveller${t.tickets > 1 ? 's' : ''}`,
        who: contactOf(t.user).name, amount: Number(t.price || 0), bookedAt: bookedAt(t), refId: t.tour,
      })),
    ].sort((a, b) => new Date(b.bookedAt) - new Date(a.bookedAt)).slice(0, 8);

    const routeStats = {};
    tickets.forEach((t) => {
      const bus = busById[String(t.bus)];
      if (!bus) return;
      const key = `${bus.srcname} → ${bus.destname}`;
      routeStats[key] = routeStats[key] || { route: key, bookings: 0, seats: 0, revenue: 0 };
      routeStats[key].bookings += 1;
      routeStats[key].seats += t.tickets.length;
      routeStats[key].revenue += busAmount(t);
    });
    const placesByTour = Object.fromEntries(placeCounts.map((p) => [String(p._id), p.n]));

    res.json({
      success: true,
      agent: { agentName: req.agent.agentName, email: req.agent.email, createdAt: req.agent.createdAt },
      stats: {
        buses: buses.length,
        routes: new Set(buses.map((b) => `${b.srcname}|${b.destname}`)).size,
        tours: tours.length,
        busBookings: tickets.length,
        seatsSold: tickets.reduce((s, t) => s + t.tickets.length, 0),
        tourBookings: tourTickets.length,
        travellers: tourTickets.reduce((s, t) => s + (t.tickets || 0), 0),
        revenue: busRevenue + tourRevenue,
        busRevenue,
        tourRevenue,
        upcomingTrips: upcoming.length,
      },
      daily: days.map((d) => ({ date: d.date.toISOString(), bookings: d.bookings, revenue: d.revenue })),
      recent,
      topRoutes: Object.values(routeStats).sort((a, b) => b.revenue - a.revenue).slice(0, 5),
      // Tours without places show an empty itinerary to travellers; nudge the partner.
      toursMissingPlaces: tours.filter((t) => !placesByTour[String(t._id)]).map((t) => ({ _id: t._id, tname: t.tname })),
    });
  } catch (error) {
    fail(res, error);
  }
};

// ----- Buses -----

exports.myBuses = async (req, res) => {
  try {
    const buses = await Bus.find(busScope(req)).populate('agent', 'agentName').sort({ srcname: 1, destname: 1 }).lean();
    const stats = await Ticket.aggregate([
      { $match: { bus: { $in: buses.map((b) => b._id) } } },
      { $group: {
        _id: '$bus',
        bookings: { $sum: 1 },
        seats: { $sum: { $size: '$tickets' } },
        upcoming: { $sum: { $cond: [{ $gte: ['$date', startOfToday()] }, 1, 0] } },
        revenue: { $sum: { $ifNull: ['$amount', 0] } },
      } },
    ]);
    const byBus = Object.fromEntries(stats.map((s) => [String(s._id), s]));
    res.json({
      success: true,
      busTypes: BUS_TYPES,
      buses: buses.map((b) => {
        const s = byBus[String(b._id)] || {};
        return { ...b, bookings: s.bookings || 0, seatsSold: s.seats || 0, upcoming: s.upcoming || 0, revenue: s.revenue || 0 };
      }),
    });
  } catch (error) {
    fail(res, error);
  }
};

exports.busTypes = (req, res) => res.json({ success: true, busTypes: BUS_TYPES });

exports.getMyBus = async (req, res) => {
  try {
    res.json({ success: true, bus: await ownBus(req, req.params.busId), busTypes: BUS_TYPES });
  } catch (error) {
    fail(res, error);
  }
};

exports.addBus = async (req, res) => {
  try {
    const data = busInput(req.body);
    const Imageurl = imageFrom(req, true);
    const bus = await Bus.create({ ...data, Imageurl, agent: req.agent._id });
    await Agent.updateOne({ _id: req.agent._id }, { $addToSet: { buses: bus._id } });
    res.status(201).json({ success: true, bus });
  } catch (error) {
    removeUpload(req.file);
    fail(res, error);
  }
};

exports.editBus = async (req, res) => {
  try {
    const bus = await ownBus(req, req.params.busId);
    const data = busInput(req.body);
    // Seat numbers depend on the layout, so the type can't change once seats are booked.
    if (data.btype !== bus.btype && await Ticket.exists({ bus: bus._id, date: { $gte: startOfToday() } })) {
      throw new InputError('This bus has upcoming bookings, so its type (seat layout) cannot be changed', 409);
    }
    const image = imageFrom(req, false);
    const oldImage = bus.Imageurl;
    Object.assign(bus, data, image ? { Imageurl: image } : {});
    await bus.save();
    if (image) removeStored(oldImage);
    res.json({ success: true, bus });
  } catch (error) {
    removeUpload(req.file);
    fail(res, error);
  }
};

exports.deleteBus = async (req, res) => {
  try {
    const bus = await ownBus(req, req.params.busId);
    const upcoming = await Ticket.countDocuments({ bus: bus._id, date: { $gte: startOfToday() } });
    if (upcoming) {
      throw new InputError(`This bus has ${upcoming} upcoming booking${upcoming > 1 ? 's' : ''} and can't be deleted until those trips are done`, 409);
    }
    await bus.deleteOne();
    removeStored(bus.Imageurl);
    await Agent.updateOne({ _id: bus.agent }, { $pull: { buses: bus._id } });
    res.json({ success: true });
  } catch (error) {
    fail(res, error);
  }
};

exports.busBookings = async (req, res) => {
  try {
    const bus = await ownBus(req, req.params.busId);
    const tickets = await Ticket.find({ bus: bus._id }).populate('user', 'firstName lastName email mobile').sort({ date: -1, createdAt: -1 }).lean();
    res.json({
      success: true,
      bus,
      bookings: tickets.map((t) => ({
        _id: t._id,
        date: t.date,
        passengers: t.tickets,
        amount: t.amount || bus.tktprice * t.tickets.length,
        bookedAt: t.createdAt || t._id.getTimestamp(),
        contact: contactOf(t.user),
      })),
    });
  } catch (error) {
    fail(res, error);
  }
};

// ----- Tours -----

exports.myTours = async (req, res) => {
  try {
    const tours = await Tour.find(tourScope(req)).populate('agentId', 'agentName').sort({ createdAt: -1 }).lean();
    const ids = tours.map((t) => t._id);
    const [bookings, places] = await Promise.all([
      TourTicket.aggregate([{ $match: { tour: { $in: ids } } }, { $group: { _id: '$tour', bookings: { $sum: 1 }, travellers: { $sum: '$tickets' }, revenue: { $sum: { $toDouble: '$price' } } } }]),
      Place.aggregate([{ $match: { tour: { $in: ids } } }, { $group: { _id: '$tour', n: { $sum: 1 } } }]),
    ]);
    const b = Object.fromEntries(bookings.map((x) => [String(x._id), x]));
    const p = Object.fromEntries(places.map((x) => [String(x._id), x.n]));
    res.json({
      success: true,
      tours: tours.map((t) => ({
        ...t,
        bookings: b[String(t._id)]?.bookings || 0,
        travellers: b[String(t._id)]?.travellers || 0,
        revenue: b[String(t._id)]?.revenue || 0,
        places: p[String(t._id)] || 0,
      })),
    });
  } catch (error) {
    fail(res, error);
  }
};

exports.getMyTour = async (req, res) => {
  try {
    const tour = await ownTour(req, req.params.tourId);
    const places = await Place.find({ tour: tour._id }).lean();
    res.json({ success: true, tour, places });
  } catch (error) {
    fail(res, error);
  }
};

exports.addTour = async (req, res) => {
  try {
    const data = tourInput(req.body);
    const DispImageurl = imageFrom(req, true);
    const tour = await Tour.create({ ...data, DispImageurl, agentId: req.agent._id });
    await Agent.updateOne({ _id: req.agent._id }, { $addToSet: { tours: tour._id } });
    await invalidateTours();
    res.status(201).json({ success: true, tour });
  } catch (error) {
    removeUpload(req.file);
    fail(res, error);
  }
};

exports.editTour = async (req, res) => {
  try {
    const tour = await ownTour(req, req.params.tourId);
    const data = tourInput(req.body);
    const image = imageFrom(req, false);
    const oldImage = tour.DispImageurl;
    Object.assign(tour, data, image ? { DispImageurl: image } : {});
    await tour.save();
    if (image) removeStored(oldImage);
    await invalidateTours();
    res.json({ success: true, tour });
  } catch (error) {
    removeUpload(req.file);
    fail(res, error);
  }
};

exports.deleteTour = async (req, res) => {
  try {
    const tour = await ownTour(req, req.params.tourId);
    const booked = await TourTicket.countDocuments({ tour: tour._id });
    if (booked) {
      throw new InputError(`This tour has ${booked} booking${booked > 1 ? 's' : ''}, so it can't be deleted. Travellers still need its details.`, 409);
    }
    const places = await Place.find({ tour: tour._id });
    await Place.deleteMany({ tour: tour._id });
    places.forEach((p) => removeStored(p.Imageurl));
    await tour.deleteOne();
    removeStored(tour.DispImageurl);
    await Agent.updateOne({ _id: tour.agentId }, { $pull: { tours: tour._id } });
    await invalidateTours();
    res.json({ success: true });
  } catch (error) {
    fail(res, error);
  }
};

exports.tourBookings = async (req, res) => {
  try {
    const tour = await ownTour(req, req.params.tourId);
    const rows = await TourTicket.find({ tour: tour._id }).populate('user', 'firstName lastName email mobile').sort({ _id: -1 }).lean();
    res.json({
      success: true,
      tour,
      bookings: rows.map((r) => ({
        _id: r._id,
        travellers: r.tickets,
        amount: Number(r.price || 0),
        bookedAt: r._id.getTimestamp(),
        contact: contactOf(r.user),
      })),
    });
  } catch (error) {
    fail(res, error);
  }
};

// ----- Places -----

exports.addPlace = async (req, res) => {
  try {
    const tour = await ownTour(req, req.params.tourId);
    const data = placeInput(req.body);
    const Imageurl = imageFrom(req, true);
    const place = await Place.create({ ...data, Imageurl, tour: tour._id });
    await Tour.updateOne({ _id: tour._id }, { $addToSet: { places: place._id } });
    await invalidateTours();
    res.status(201).json({ success: true, place });
  } catch (error) {
    removeUpload(req.file);
    fail(res, error);
  }
};

const ownPlace = async (req, placeId) => {
  const place = await Place.findById(placeId);
  if (!place) throw new InputError('Place not found', 404);
  await ownTour(req, place.tour);
  return place;
};

exports.editPlace = async (req, res) => {
  try {
    const place = await ownPlace(req, req.params.placeId);
    const data = placeInput(req.body);
    const image = imageFrom(req, false);
    const oldImage = place.Imageurl;
    Object.assign(place, data, image ? { Imageurl: image } : {});
    await place.save();
    if (image) removeStored(oldImage);
    res.json({ success: true, place });
  } catch (error) {
    removeUpload(req.file);
    fail(res, error);
  }
};

exports.deletePlace = async (req, res) => {
  try {
    const place = await ownPlace(req, req.params.placeId);
    await place.deleteOne();
    await Tour.updateOne({ _id: place.tour }, { $pull: { places: place._id } });
    removeStored(place.Imageurl);
    await invalidateTours();
    res.json({ success: true });
  } catch (error) {
    fail(res, error);
  }
};

exports.busInput = busInput;
exports.InputError = InputError;
