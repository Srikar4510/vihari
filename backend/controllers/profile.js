const User = require('../models/user');
const Ticket = require('../models/ticket');
const TourTicket = require('../models/tourTickets');

const GENDERS = ['Male', 'Female', 'Other'];
const MAX_SAVED = 20;

const publicUser = (u) => ({
  _id: u._id,
  firstName: u.firstName,
  lastName: u.lastName,
  email: u.email,
  mobile: u.mobile,
  createdAt: u.createdAt,
});

// Returns an error message, or null if the traveller is valid.
const travellerError = ({ name, age, gender } = {}) => {
  if (!String(name || '').trim()) return 'Name is required';
  if (!(Number(age) >= 1 && Number(age) <= 120)) return 'Age must be between 1 and 120';
  if (!GENDERS.includes(gender)) return 'Choose a gender';
  return null;
};

const fail = (res, error) => {
  console.log(error);
  res.status(500).json({ success: false, error: 'Something went wrong' });
};

module.exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    const [trips, tours] = await Promise.all([
      Ticket.countDocuments({ user: user._id }),
      TourTicket.countDocuments({ user: user._id }),
    ]);
    res.json({ success: true, user: publicUser(user), stats: { trips, tours, travellers: user.savedPassengers.length } });
  } catch (error) {
    fail(res, error);
  }
};

// Users can change their name and mobile number. Email is the login, so it stays fixed.
module.exports.updateProfile = async (req, res) => {
  try {
    const firstName = String(req.body.firstName || '').trim();
    const lastName = String(req.body.lastName || '').trim();
    const mobile = String(req.body.mobile || '').trim();
    if (!firstName || !lastName) return res.status(400).json({ success: false, error: 'First and last name are required' });
    if (!/^\d{10}$/.test(mobile)) return res.status(400).json({ success: false, error: 'Enter a 10-digit mobile number' });
    const user = await User.findByIdAndUpdate(req.user.id, { firstName, lastName, mobile }, { new: true });
    res.json({ success: true, user: publicUser(user) });
  } catch (error) {
    fail(res, error);
  }
};

module.exports.myTrips = async (req, res) => {
  try {
    const trips = await Ticket.find({ user: req.user.id }).populate('bus').sort({ date: -1, createdAt: -1 });
    res.json({ success: true, trips });
  } catch (error) {
    fail(res, error);
  }
};

module.exports.myTours = async (req, res) => {
  try {
    const tours = await TourTicket.find({ user: req.user.id }).populate('tour').sort({ _id: -1 });
    res.json({
      success: true,
      tours: tours.map((t) => ({ _id: t._id, tour: t.tour, travellers: t.tickets, price: Number(t.price), bookedAt: t._id.getTimestamp() })),
    });
  } catch (error) {
    fail(res, error);
  }
};

module.exports.listTravellers = async (req, res) => {
  try {
    const user = await User.findById(req.user.id, 'savedPassengers');
    res.json({ success: true, travellers: user?.savedPassengers || [] });
  } catch (error) {
    fail(res, error);
  }
};

// Adds a traveller, or returns the existing one if the same name, age and gender is already saved.
module.exports.addTraveller = async (req, res) => {
  try {
    const error = travellerError(req.body);
    if (error) return res.status(400).json({ success: false, error });
    const user = await User.findById(req.user.id);
    const name = req.body.name.trim();
    const age = Number(req.body.age);
    const { gender } = req.body;
    const existing = user.savedPassengers.find((p) => p.name.toLowerCase() === name.toLowerCase() && p.age === age && p.gender === gender);
    if (existing) return res.json({ success: true, traveller: existing, travellers: user.savedPassengers });
    if (user.savedPassengers.length >= MAX_SAVED) return res.status(400).json({ success: false, error: `You can save up to ${MAX_SAVED} travellers` });
    user.savedPassengers.push({ name, age, gender });
    await user.save();
    res.status(201).json({ success: true, traveller: user.savedPassengers[user.savedPassengers.length - 1], travellers: user.savedPassengers });
  } catch (error) {
    fail(res, error);
  }
};

module.exports.updateTraveller = async (req, res) => {
  try {
    const error = travellerError(req.body);
    if (error) return res.status(400).json({ success: false, error });
    const user = await User.findById(req.user.id);
    const traveller = user.savedPassengers.id(req.params.id);
    if (!traveller) return res.status(404).json({ success: false, error: 'Traveller not found' });
    traveller.set({ name: req.body.name.trim(), age: Number(req.body.age), gender: req.body.gender });
    await user.save();
    res.json({ success: true, traveller, travellers: user.savedPassengers });
  } catch (error) {
    fail(res, error);
  }
};

module.exports.deleteTraveller = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const traveller = user.savedPassengers.id(req.params.id);
    if (!traveller) return res.status(404).json({ success: false, error: 'Traveller not found' });
    traveller.deleteOne();
    await user.save();
    res.json({ success: true, travellers: user.savedPassengers });
  } catch (error) {
    fail(res, error);
  }
};
