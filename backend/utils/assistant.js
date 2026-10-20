// Rule-based travel assistant: understands common requests by pattern matching and answers
// only from our own data (buses, tours, the user's bookings) plus fixed help answers.
// No AI service is involved, so it never invents buses, prices or policies.
//
// reply(message, { userId, context }) -> { messages: [...], context }
// Message blocks: { type: 'text', text } | { type: 'buses', buses, total, search }
//   | { type: 'trips', trips } | { type: 'tourBookings', bookings } | { type: 'tours', tours }
//   | { type: 'chips', chips: [{ label, send } | { label, to }] }
// `context` is echoed back by the client so follow-ups ("what about friday?") work.

const Bus = require('../models/buses');
const Tour = require('../models/tour');
const Place = require('../models/place');
const Ticket = require('../models/ticket');
const TourTicket = require('../models/tourTickets');

const MAX_BUSES = 4;
const MAX_TOURS = 4;
const MAX_BOOKINGS = 3;

const titleCase = (s = '') => s.replace(/\b\w/g, (c) => c.toUpperCase());

// ---------- Text helpers ----------

const ALIASES = {
  bengaluru: 'bangalore', blr: 'bangalore', bombay: 'mumbai', madras: 'chennai', vizag: 'visakhapatnam',
  vskp: 'visakhapatnam', hyd: 'hyderabad', hyderbad: 'hyderabad', pondy: 'pondicherry', puducherry: 'pondicherry',
  mysuru: 'mysore', bezawada: 'vijayawada', 'new delhi': 'delhi', amdavad: 'ahmedabad', tirumala: 'tirupati',
  cochin: 'kochi', ernakulam: 'kochi', mangaluru: 'mangalore', kovai: 'coimbatore',
};

const STATES = {
  hyderabad: 'telangana', bangalore: 'karnataka', mysore: 'karnataka', chennai: 'tamil nadu',
  pondicherry: 'tamil nadu', mumbai: 'maharashtra', pune: 'maharashtra', goa: 'goa', delhi: 'delhi',
  agra: 'uttar pradesh', jaipur: 'rajasthan', ahmedabad: 'gujarat', vijayawada: 'andhra pradesh',
  visakhapatnam: 'andhra pradesh', tirupati: 'andhra pradesh', eluru: 'andhra pradesh',
  madurai: 'tamil nadu', coimbatore: 'tamil nadu', kochi: 'kerala', mangalore: 'karnataka',
  chandigarh: 'chandigarh', dehradun: 'uttarakhand', warangal: 'telangana',
};
const REGIONS = {
  south: ['telangana', 'karnataka', 'tamil nadu', 'andhra pradesh', 'kerala'],
  north: ['delhi', 'uttar pradesh', 'rajasthan', 'punjab', 'haryana', 'chandigarh', 'uttarakhand'],
  west: ['maharashtra', 'goa', 'gujarat'],
};
const STATE_WORDS = { tamilnadu: 'tamil nadu', tn: 'tamil nadu', up: 'uttar pradesh', ap: 'andhra pradesh', ts: 'telangana', ka: 'karnataka' };

const THEMES = {
  beach: ['beach', 'beaches', 'sea', 'coast', 'coastal'],
  heritage: ['heritage', 'history', 'historic', 'monument', 'monuments', 'fort', 'forts', 'palace', 'palaces', 'mughal'],
  temple: ['temple', 'temples', 'spiritual', 'pilgrimage', 'church', 'churches'],
  nature: ['nature', 'garden', 'gardens', 'wildlife', 'safari', 'lake', 'hills'],
  food: ['food', 'dinner', 'cuisine'],
};

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const normalise = (text) => ` ${String(text).toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9/\-.₹\s]/g, ' ').replace(/\s+/g, ' ').trim()} `;
const has = (t, words) => words.some((w) => new RegExp(`\\b${w}\\b`).test(t));

const levenshtein = (a, b) => {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[a.length][b.length];
};

const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const chipDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${titleCase(MONTHS[m - 1])} ${y}`;
};
const prettyDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
};

const toMinutes = (t = '') => {
  const m = String(t).match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (!m) return 0;
  let h = Number(m[1]) % 12;
  if (m[3] && m[3].toLowerCase() === 'pm') h += 12;
  return h * 60 + Number(m[2]);
};
const durationMinutes = (s = '') => {
  const h = s.match(/(\d+(?:\.\d+)?)\s*h/i);
  const m = s.match(/(\d+)\s*m/i);
  return Math.round((h ? parseFloat(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0));
};

// ---------- Cities ----------

let cityCache = { at: 0, list: [] };
const knownCities = async () => {
  if (Date.now() - cityCache.at < 5 * 60 * 1000) return cityCache.list;
  const [src, dest] = await Promise.all([Bus.distinct('srcname'), Bus.distinct('destname')]);
  const list = [...new Set([...src, ...dest, ...Object.keys(STATES)].map((c) => c.toLowerCase().trim()).filter(Boolean))];
  cityCache = { at: Date.now(), list };
  return list;
};

// Finds city mentions in order, with a role from the word in front ("from X" / "to X").
const findCities = (t, cities) => {
  let text = t;
  Object.entries(ALIASES).forEach(([alias, city]) => { text = text.replace(new RegExp(`\\b${alias}\\b`, 'g'), city); });
  const words = text.trim().split(' ');
  const found = [];
  const add = (city, index) => {
    if (found.some((f) => f.city === city)) return;
    const before = words[index - 1];
    const role = before === 'from' ? 'from' : ['to', 'for', 'towards', 'till', 'until'].includes(before) ? 'to' : null;
    found.push({ city, index, role });
  };
  words.forEach((w, i) => {
    const two = `${w} ${words[i + 1] || ''}`;
    const multi = cities.find((c) => c.includes(' ') && c === two);
    if (multi) return add(multi, i);
    if (cities.includes(w)) return add(w, i);
    // Allow small typos in longer names ("hyderbad", "banglore").
    if (w.length >= 5) {
      const near = cities.find((c) => !c.includes(' ') && Math.abs(c.length - w.length) <= 2
        && levenshtein(c, w) <= (c.length >= 8 ? 2 : 1));
      if (near) add(near, i);
    }
    return undefined;
  });
  return found.sort((a, b) => a.index - b.index);
};

const pickRoute = (mentions) => {
  let from = mentions.find((m) => m.role === 'from')?.city || null;
  let to = mentions.find((m) => m.role === 'to')?.city || null;
  mentions.filter((m) => m.city !== from && m.city !== to).forEach((m) => {
    if (!from) from = m.city;
    else if (!to) to = m.city;
  });
  return { from, to };
};

// ---------- Dates and filters ----------

const parseDate = (t) => {
  const today = startOfToday();
  if (/\b(yesterday|last night)\b/.test(t)) return addDays(today, -1);
  if (/\bday after (tomorrow|tmrw|tmr)\b/.test(t)) return addDays(today, 2);
  if (/\b(tomorrow|tmrw|tmr|tommorow|tomorow)\b/.test(t)) return addDays(today, 1);
  if (/\b(today|tonight|now)\b/.test(t)) return today;
  const inDays = t.match(/\bin (\d{1,2}) days?\b/);
  if (inDays) return addDays(today, Number(inDays[1]));
  if (/\b(this|coming) weekend\b|\bweekend\b/.test(t)) return addDays(today, (6 - today.getDay() + 7) % 7);
  const iso = t.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const monthRe = MONTHS.join('|');
  const dm = t.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:of\\s+)?(${monthRe})[a-z]*\\b`))
    || t.match(new RegExp(`\\b(${monthRe})[a-z]*\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`));
  let day;
  let month;
  let year;
  if (dm) {
    const first = /^\d/.test(dm[1]);
    day = Number(first ? dm[1] : dm[2]);
    month = MONTHS.indexOf((first ? dm[2] : dm[1]).slice(0, 3));
  } else {
    const num = t.match(/\b(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?\b/);
    if (!num) {
      // Weekday names only when no explicit date was given.
      const wd = WEEKDAYS.findIndex((d) => new RegExp(`\\b${d}|\\b${d.slice(0, 3)}\\b`).test(t));
      if (wd < 0) return null;
      let diff = (wd - today.getDay() + 7) % 7;
      if (diff === 0 && /\bnext\b/.test(t)) diff = 7;
      return addDays(today, diff);
    }
    day = Number(num[1]);
    month = Number(num[2]) - 1;
    if (num[3]) year = Number(num[3].length === 2 ? `20${num[3]}` : num[3]);
  }
  if (!(day >= 1 && day <= 31 && month >= 0 && month <= 11)) return null;
  const date = new Date(year || today.getFullYear(), month, day);
  if (date.getMonth() !== month) return null;
  if (!year && date < today) date.setFullYear(date.getFullYear() + 1);
  return date;
};

const parsePriceCap = (t) => {
  const m = t.match(/\b(?:under|below|less than|within|max|maximum|upto|up to|budget|cheaper than)\s*(?:rs\.?|inr|₹)?\s*(\d{2,6})\b/)
    || t.match(/\b(?:rs\.?|₹)\s*(\d{2,6})\s*(?:or less|max)\b/);
  return m ? Number(m[1]) : null;
};

const parseBusFilters = (t) => {
  const f = {};
  if (/\bnon[\s-]?ac\b/.test(t)) f.ac = false;
  else if (/\b(ac|a\/c|air conditioned)\b/.test(t)) f.ac = true;
  if (/\bsleepers?\b|\bberths?\b/.test(t)) f.kind = 'sleeper';
  else if (/\bseaters?\b/.test(t)) f.kind = 'seater';
  if (/\bvolvo\b/.test(t)) f.volvo = true;
  if (/\bmorning\b/.test(t)) f.slot = 'morning';
  else if (/\bafternoon\b/.test(t)) f.slot = 'afternoon';
  else if (/\bevening\b/.test(t)) f.slot = 'evening';
  else if (/\b(night|overnight|tonight|late)\b/.test(t)) f.slot = 'night';
  if (/\b(cheap|cheapest|lowest|budget|affordable|low cost|low price)\b/.test(t)) f.sort = 'price';
  else if (/\b(fastest|quickest|shortest)\b/.test(t)) f.sort = 'duration';
  const cap = parsePriceCap(t);
  if (cap) f.maxPrice = cap;
  return f;
};

const SLOT_RANGES = { morning: [300, 720], afternoon: [720, 1020], evening: [1020, 1260] };
const busMatches = (bus, f) => {
  const type = bus.btype.toLowerCase();
  if (f.ac === false && !type.includes('non-ac')) return false;
  if (f.ac === true && type.includes('non-ac')) return false;
  if (f.kind && !type.includes(f.kind)) return false;
  if (f.volvo && !type.includes('volvo')) return false;
  if (f.maxPrice && bus.tktprice > f.maxPrice) return false;
  if (f.slot) {
    const m = toMinutes(bus.deptime);
    if (f.slot === 'night') return m >= 1260 || m < 300;
    const [a, b] = SLOT_RANGES[f.slot];
    return m >= a && m < b;
  }
  return true;
};
const describeFilters = (f) => [
  f.ac === true && 'AC', f.ac === false && 'non-AC', f.kind, f.volvo && 'Volvo',
  f.slot && `${f.slot} departures`, f.maxPrice && `under ₹${f.maxPrice.toLocaleString('en-IN')}`,
].filter(Boolean).join(', ');

// ---------- Answers ----------

const HELP_CHIPS = [
  { label: 'Search buses', send: 'Search buses' },
  { label: 'My trips', send: 'Show my trips' },
  { label: 'Explore tours', send: 'Show tours' },
  { label: 'Help & FAQs', send: 'What can you help with?' },
];

const FAQS = [
  {
    keys: ['cancel', 'cancellation', 'refund', 'refunds', 'money back'],
    text: "Cancellations aren't available online yet. Send us your booking ID through the contact form on the About page and the team will help you with it.",
    chips: [{ label: 'Contact us', to: '/about#contact' }, { label: 'My trips', send: 'Show my trips' }],
  },
  {
    keys: ['reschedule', 'change date', 'change my date', 'change the date', 'modify booking', 'change booking'],
    text: "Changing the date of a booking isn't supported online yet. You can book the new date and contact us about the old ticket through the About page.",
    chips: [{ label: 'Contact us', to: '/about#contact' }],
  },
  {
    keys: ['baggage', 'luggage', 'bag', 'bags', 'suitcase', 'carry'],
    text: 'Each passenger can usually carry one suitcase in the luggage hold and one small bag on board. Bus operators may charge for extra or oversized luggage, and flammable items are not allowed.',
  },
  {
    keys: ['boarding', 'board', 'reach', 'early', 'pickup', 'pick up', 'pick-up', 'arrive before', 'report'],
    text: 'Please reach the boarding point at least 15 minutes before departure. Carry a photo ID for every passenger and show your e-ticket on your phone or as a printout.',
  },
  {
    keys: ['id proof', 'id card', 'identity', 'aadhaar', 'aadhar', 'documents', 'document'],
    text: 'Carry a valid photo ID (Aadhaar, PAN, driving licence, passport or voter ID) for every passenger. The conductor may check it along with your ticket.',
  },
  {
    keys: ['payment', 'payments', 'pay', 'upi', 'card', 'cards', 'netbanking', 'net banking', 'wallet', 'razorpay', 'gpay', 'phonepe'],
    text: 'Payments go through Razorpay, which supports UPI, debit and credit cards, net banking and wallets. Fares are worked out on our server and every payment is verified before the ticket is issued.',
  },
  {
    keys: ['partner', 'agent', 'operator', 'list my bus', 'add my bus', 'add bus', 'become', 'agency', 'register my'],
    text: 'Bus operators and tour agencies can join as partners. Sign up with your agency details and a registration document; once an admin approves it you can add buses and tours.',
    chips: [{ label: 'Partner sign-up', to: '/agentSignUp' }, { label: 'Partner login', to: '/agentLogin' }],
  },
  {
    keys: ['download', 'pdf', 'e-ticket', 'eticket', 'print', 'ticket copy'],
    text: 'You can download a PDF ticket right after booking, or any time later from Profile → My trips (open a trip and press "Download PDF ticket"). Tour vouchers are under Profile → My tours.',
    chips: [{ label: 'My trips', send: 'Show my trips' }],
  },
  {
    keys: ['women', 'woman', 'female', 'lady', 'ladies', 'gender', 'next to', 'beside', 'adjacent'],
    text: 'For comfort and safety, a seat next to a booked female passenger can only be taken by a female passenger, and the same applies the other way round. The seat map shows these seats with a marker and disables the options that are not allowed.',
  },
  {
    keys: ['sleeper', 'seater', 'berth', 'berths', 'upper', 'lower', 'seat type', 'seat types', 'layout'],
    text: 'We have seater buses (2+2 seats), sleeper buses (lower and upper berths in a 2+1 layout) and mixed buses with seats below and berths above. You can pick exact seats on the seat map.',
  },
  {
    keys: ['child', 'children', 'kid', 'kids', 'infant', 'baby'],
    text: 'Every traveller who needs a seat or berth needs their own ticket. Add each child as a passenger with their age when booking.',
  },
  {
    keys: ['saved travellers', 'save passenger', 'saved passengers', 'travellers list', 'frequent'],
    text: 'Save the people you travel with under Profile → Saved travellers. They appear as one-tap chips on the passenger page, so you never type their details twice.',
    chips: [{ label: 'Saved travellers', to: '/profile?tab=travellers' }],
  },
  {
    keys: ['contact', 'support', 'help desk', 'customer care', 'complaint', 'email you', 'call'],
    text: 'You can reach us through the contact form on the About page. Please include your booking ID if it is about a trip.',
    chips: [{ label: 'Contact us', to: '/about#contact' }],
  },
  {
    keys: ['password', 'login', 'log in', 'sign in', 'signup', 'sign up', 'account', 'register'],
    text: 'Use the Login page to sign in or create a traveller account. Your trips, tour bookings and saved travellers are all in your profile.',
    chips: [{ label: 'Login', to: '/login' }],
  },
  {
    keys: ['track', 'tracking', 'live location', 'where is my bus', 'gps'],
    text: "Live bus tracking isn't available yet; it is on our roadmap. Until then, the trip details in your profile show a live countdown to departure and arrival.",
    chips: [{ label: 'My trips', send: 'Show my trips' }],
  },
];

const matchFaq = (t) => {
  let best = null;
  FAQS.forEach((faq) => {
    const score = faq.keys.filter((k) => new RegExp(`\\b${k}\\b`).test(t)).reduce((s, k) => s + k.length, 0);
    if (score && (!best || score > best.score)) best = { faq, score };
  });
  return best?.faq || null;
};

const busCard = (b) => ({
  _id: b._id, trname: b.trname, btype: b.btype, srcname: b.srcname, destname: b.destname,
  deptime: b.deptime, arrtime: b.arrtime, durtime: b.durtime, tktprice: b.tktprice, Imageurl: b.Imageurl,
});

const searchBuses = async ({ from, to, date, filters = {} }) => {
  const all = await Bus.find({ srcname: from, destname: to }).lean();
  const list = all.filter((b) => busMatches(b, filters));
  if (filters.sort === 'price') list.sort((a, b) => a.tktprice - b.tktprice);
  else if (filters.sort === 'duration') list.sort((a, b) => durationMinutes(a.durtime) - durationMinutes(b.durtime));
  else list.sort((a, b) => toMinutes(a.deptime) - toMinutes(b.deptime));
  // Today: hide buses that have already left.
  const visible = date === toISO(startOfToday())
    ? list.filter((b) => toMinutes(b.deptime) > new Date().getHours() * 60 + new Date().getMinutes())
    : list;
  return { all, visible };
};

const busAnswer = async ({ from, to, date, filters }) => {
  const route = `${titleCase(from)} → ${titleCase(to)}`;
  const { all, visible } = await searchBuses({ from, to, date, filters });
  const context = { last: { from, to, date, filters } };
  if (all.length === 0) {
    const fromHere = await Bus.distinct('destname', { srcname: from });
    return {
      messages: [
        { type: 'text', text: `We don't have buses from ${titleCase(from)} to ${titleCase(to)} yet.` },
        ...(fromHere.length ? [{
          type: 'chips',
          title: `Buses from ${titleCase(from)} go to:`,
          chips: fromHere.slice(0, 6).map((c) => ({ label: titleCase(c), send: `${from} to ${c} on ${chipDate(date)}` })),
        }] : []),
      ],
      context,
    };
  }
  const desc = describeFilters(filters);
  if (visible.length === 0) {
    return {
      messages: [
        { type: 'text', text: `No ${desc ? `${desc} ` : ''}buses left for ${route} on ${prettyDate(date)}.` },
        { type: 'chips', chips: [
          { label: 'Next day', send: `${from} to ${to} on ${chipDate(toISO(addDays(new Date(`${date}T00:00`), 1)))}` },
          ...(desc ? [{ label: 'Clear filters', send: `all buses ${from} to ${to} on ${chipDate(date)}` }] : []),
        ] },
      ],
      context,
    };
  }
  const cheapest = Math.min(...visible.map((b) => b.tktprice));
  return {
    messages: [
      { type: 'text', text: `${visible.length} bus${visible.length > 1 ? 'es' : ''}${desc ? ` (${desc})` : ''} for ${route} on ${prettyDate(date)}, from ₹${cheapest.toLocaleString('en-IN')}.` },
      { type: 'buses', buses: visible.slice(0, MAX_BUSES).map(busCard), total: visible.length, search: { from: titleCase(from), to: titleCase(to), date } },
      { type: 'chips', chips: [
        { label: 'Cheapest first', send: 'cheapest' },
        { label: 'Night buses', send: 'only night buses' },
        { label: 'Sleeper only', send: 'sleeper only' },
        { label: 'Next day', send: `${from} to ${to} on ${chipDate(toISO(addDays(new Date(`${date}T00:00`), 1)))}` },
      ].filter((c) => !(c.send === 'cheapest' && filters.sort === 'price')) },
    ],
    context,
  };
};

const departure = (trip) => {
  const d = new Date(`${trip.date}T00:00`);
  d.setMinutes(toMinutes(trip.bus?.deptime));
  return d;
};

const LOGIN_NEEDED = (what) => ({
  messages: [
    { type: 'text', text: `Please log in to see your ${what}.` },
    { type: 'chips', chips: [{ label: 'Login', to: '/login' }] },
  ],
});

const tripsAnswer = async (userId, t) => {
  if (!userId) return LOGIN_NEEDED('trips');
  const trips = await Ticket.find({ user: userId }).populate('bus').lean();
  const now = new Date();
  const wantPast = /\b(past|previous|old|completed|history|last)\b/.test(t);
  const list = trips
    .filter((tr) => (wantPast ? departure(tr) <= now : departure(tr) > now))
    .sort((a, b) => (wantPast ? departure(b) - departure(a) : departure(a) - departure(b)));
  const onlyNext = !wantPast && /\b(next|upcoming trip|when is my)\b/.test(t);
  if (list.length === 0) {
    return {
      messages: [
        { type: 'text', text: wantPast ? "You don't have any past trips yet." : "You don't have any upcoming trips. Where would you like to go?" },
        { type: 'chips', chips: wantPast ? [{ label: 'Upcoming trips', send: 'my upcoming trips' }] : [{ label: 'Search buses', send: 'Search buses' }, { label: 'Past trips', send: 'my past trips' }] },
      ],
    };
  }
  const shown = list.slice(0, onlyNext ? 1 : MAX_BOOKINGS);
  const intro = onlyNext
    ? 'Here is your next trip:'
    : `You have ${list.length} ${wantPast ? 'past' : 'upcoming'} trip${list.length > 1 ? 's' : ''}${list.length > shown.length ? `; here are the ${wantPast ? 'latest' : 'next'} ${shown.length}` : ''}:`;
  return {
    messages: [
      { type: 'text', text: intro },
      { type: 'trips', trips: shown },
      { type: 'chips', chips: [
        { label: 'All my trips', to: '/profile?tab=trips' },
        wantPast ? { label: 'Upcoming trips', send: 'my upcoming trips' } : { label: 'Past trips', send: 'my past trips' },
        { label: 'My tours', send: 'my tour bookings' },
      ] },
    ],
  };
};

const tourBookingsAnswer = async (userId) => {
  if (!userId) return LOGIN_NEEDED('tour bookings');
  const rows = await TourTicket.find({ user: userId }).populate('tour').sort({ _id: -1 }).lean();
  if (rows.length === 0) {
    return { messages: [{ type: 'text', text: "You haven't booked any tours yet." }, { type: 'chips', chips: [{ label: 'Explore tours', send: 'Show tours' }] }] };
  }
  const bookings = rows.slice(0, MAX_BOOKINGS).map((r) => ({
    _id: r._id, tour: r.tour, travellers: r.tickets, price: Number(r.price), bookedAt: r._id.getTimestamp(),
  }));
  return {
    messages: [
      { type: 'text', text: `You have ${rows.length} tour booking${rows.length > 1 ? 's' : ''}:` },
      { type: 'tourBookings', bookings },
      { type: 'chips', chips: [{ label: 'All my tours', to: '/profile?tab=tours' }, { label: 'My bus trips', send: 'Show my trips' }] },
    ],
  };
};

const tourCity = (tour, cities) => cities.find((c) => new RegExp(`\\b${c}\\b`).test(tour.tname.toLowerCase()));

const toursAnswer = async (t, cities, mentions) => {
  const [tours, places] = await Promise.all([Tour.find({}).lean(), Place.find({}, 'name description tour').lean()]);
  const placeText = {};
  places.forEach((p) => { placeText[p.tour] = `${placeText[p.tour] || ''} ${p.name || ''} ${p.description || ''}`.toLowerCase(); });

  const words = t.trim().split(' ');
  const wantedStates = new Set();
  Object.entries(REGIONS).forEach(([region, states]) => { if (has(t, [region, `${region}ern`])) states.forEach((s) => wantedStates.add(s)); });
  [...new Set(Object.values(STATES))].forEach((s) => { if (t.includes(` ${s} `)) wantedStates.add(s); });
  words.forEach((w) => { if (STATE_WORDS[w]) wantedStates.add(STATE_WORDS[w]); });
  const wantedCities = mentions.map((m) => m.city);
  const themes = Object.entries(THEMES).filter(([, keys]) => has(t, keys)).map(([name, keys]) => ({ name, keys }));
  const cap = parsePriceCap(t);
  const short = /\b(weekend|short|quick|day trip|one day|1 day)\b/.test(t);

  let list = tours.map((tour) => ({ tour, city: tourCity(tour, cities) }));
  const filters = [];
  if (wantedCities.length) {
    list = list.filter(({ city }) => wantedCities.includes(city));
    filters.push(wantedCities.map(titleCase).join(' or '));
  } else if (wantedStates.size) {
    list = list.filter(({ city }) => wantedStates.has(STATES[city]));
    filters.push([...wantedStates].map(titleCase).join(', '));
  }
  if (themes.length) {
    list = list.filter(({ tour }) => {
      const text = `${tour.tname} ${tour.highlight || ''} ${(tour.features || []).join(' ')} ${placeText[tour._id] || ''}`.toLowerCase();
      return themes.some(({ keys }) => has(text, keys));
    });
    filters.push(themes.map((x) => x.name).join(' / '));
  }
  if (cap) {
    list = list.filter(({ tour }) => tour.tprice <= cap);
    filters.push(`under ₹${cap.toLocaleString('en-IN')}`);
  }
  if (short) {
    list = list.filter(({ tour }) => /\b(1 day|2 days)\b/i.test(tour.duration || ''));
    filters.push('short trips');
  }
  const sortByPrice = /\b(cheap|cheapest|budget|affordable|lowest)\b/.test(t) && !cap;
  list.sort((a, b) => (sortByPrice ? a.tour.tprice - b.tour.tprice : (b.tour.rating || 0) - (a.tour.rating || 0)));

  const card = ({ tour }) => ({
    _id: tour._id, tname: tour.tname, tprice: tour.tprice, DispImageurl: tour.DispImageurl,
    duration: tour.duration, highlight: tour.highlight, rating: tour.rating, reviews: tour.reviews,
  });
  if (list.length === 0) {
    const top = [...tours].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 3);
    return {
      messages: [
        { type: 'text', text: `I couldn't find tours matching ${filters.join(', ')}. Here are our top-rated tours instead:` },
        { type: 'tours', tours: top.map((tour) => card({ tour })) },
        { type: 'chips', chips: [{ label: 'All tours', to: '/tours' }] },
      ],
    };
  }
  return {
    messages: [
      { type: 'text', text: filters.length
        ? `${list.length} tour${list.length > 1 ? 's' : ''} for ${filters.join(', ')}:`
        : `Here are our ${sortByPrice ? 'most affordable' : 'top-rated'} tours:` },
      { type: 'tours', tours: list.slice(0, MAX_TOURS).map(card) },
      { type: 'chips', chips: [
        { label: 'Tours under ₹1500', send: 'tours under 1500' },
        { label: 'Beach tours', send: 'beach tours' },
        { label: 'Heritage tours', send: 'heritage tours' },
        { label: 'All tours', to: '/tours' },
      ] },
    ],
  };
};

const sanitiseContext = (ctx) => {
  const last = ctx?.last;
  const awaiting = ctx?.awaiting;
  const clean = {};
  if (last && typeof last.from === 'string' && typeof last.to === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(last.date || '')) {
    clean.last = { from: last.from, to: last.to, date: last.date, filters: typeof last.filters === 'object' && last.filters ? last.filters : {} };
  }
  if (awaiting && ['from', 'to'].includes(awaiting.need) && typeof awaiting.city === 'string') {
    clean.awaiting = { need: awaiting.need, city: awaiting.city, date: /^\d{4}-\d{2}-\d{2}$/.test(awaiting.date || '') ? awaiting.date : null };
  }
  return clean;
};

// ---------- Entry point ----------

exports.reply = async (message, { userId = null, context: rawContext } = {}) => {
  const t = normalise(message);
  const context = sanitiseContext(rawContext);
  const cities = await knownCities();
  const mentions = findCities(t, cities);
  const date = parseDate(t);
  const today = startOfToday();

  if (date && date < today) {
    return { messages: [{ type: 'text', text: "That date has already passed. Which day would you like to travel?" }], context };
  }

  const busWord = /\b(bus|buses|seat|seats|ticket|tickets|travel|go|going|route|journey|ride)\b/.test(t);
  const tourWord = /\b(tour|tours|package|packages|holiday|holidays|vacation|sightseeing|getaway|explore|visit|places)\b/.test(t);
  const myWord = /\b(my|mine|i have|i booked|booked)\b/.test(t);

  // 1. The user's own bookings.
  if (myWord && /\b(tour|tours)\b/.test(t) && /\b(booking|bookings|booked|tour|tours)\b/.test(t)) return tourBookingsAnswer(userId);
  if ((myWord && /\b(trip|trips|booking|bookings|ticket|tickets|journey|journeys|travel)\b/.test(t))
    || /\b(next trip|upcoming trip|upcoming trips|past trips)\b/.test(t)) {
    return tripsAnswer(userId, t);
  }

  // 2. Bus search with two cities, or one city when we were waiting for it.
  const filters = parseBusFilters(t);
  if (context.awaiting && mentions.length >= 1 && !tourWord) {
    const city = mentions[0].city;
    const { need, city: other } = context.awaiting;
    if (city !== other) {
      const route = need === 'from' ? { from: city, to: other } : { from: other, to: city };
      return busAnswer({ ...route, date: toISO(date || (context.awaiting.date ? new Date(`${context.awaiting.date}T00:00`) : today)), filters });
    }
  }
  if (mentions.length >= 2 && !(tourWord && !busWord)) {
    const { from, to } = pickRoute(mentions);
    return busAnswer({ from, to, date: toISO(date || today), filters });
  }
  if (mentions.length === 1 && busWord && !tourWord && !matchFaq(t)) {
    const { city, role } = mentions[0];
    const need = role === 'from' ? 'to' : 'from';
    const field = need === 'from' ? 'srcname' : 'destname';
    const known = await Bus.distinct(field, need === 'from' ? { destname: city } : { srcname: city });
    return {
      messages: [
        { type: 'text', text: need === 'from' ? `Where are you travelling to ${titleCase(city)} from?` : `Where would you like to go from ${titleCase(city)}?` },
        ...(known.length ? [{ type: 'chips', chips: known.slice(0, 8).map((c) => ({ label: titleCase(c), send: titleCase(c) })) }] : []),
      ],
      context: { ...context, awaiting: { need, city, date: date ? toISO(date) : null } },
    };
  }

  // 3. Follow-ups on the last bus search: "what about friday", "only sleeper", "cheapest".
  // Questions ("what is a sleeper?") still go to the help answers below.
  const question = /\b(what|how|why|can|is|are|do|does|rules?|policy|allowed)\b/.test(t) && !/\b(what|how) about\b/.test(t);
  if (context.last && !tourWord && !question && (date || Object.keys(filters).length || /\b(all buses|clear)\b/.test(t))) {
    const merged = /\b(all buses|clear)\b/.test(t) ? filters : { ...context.last.filters, ...filters };
    return busAnswer({ ...context.last, date: date ? toISO(date) : context.last.date, filters: merged });
  }

  // 4. Fixed help answers.
  const faq = matchFaq(t);
  if (faq && !(tourWord && !/\b(cancel|refund|pay|payment)\b/.test(t))) {
    return { messages: [{ type: 'text', text: faq.text }, ...(faq.chips ? [{ type: 'chips', chips: faq.chips }] : [])], context };
  }

  // 5. Tours.
  const mentioned = mentions.map((m) => m.city);
  const statesMentioned = [...new Set(Object.values(STATES))].some((s) => !mentioned.includes(s) && t.includes(` ${s} `))
    || Object.keys(REGIONS).some((r) => has(t, [r, `${r}ern`]))
    || Object.keys(THEMES).some((k) => has(t, THEMES[k]));
  if (tourWord || (statesMentioned && !busWord)) return { ...(await toursAnswer(t, cities, mentions)), context };

  // 6. One city on its own: ask what they want.
  if (mentions.length === 1) {
    const city = titleCase(mentions[0].city);
    return {
      messages: [
        { type: 'text', text: `What would you like for ${city}?` },
        { type: 'chips', chips: [{ label: `Buses to ${city}`, send: `buses to ${city}` }, { label: `Buses from ${city}`, send: `buses from ${city}` }, { label: `Tours in ${city}`, send: `tours in ${city}` }] },
      ],
      context,
    };
  }

  // 7. Small talk and help.
  if (/\b(search buses|book a bus|book bus|find bus|find a bus|bus search|buses)\b/.test(t)) {
    return {
      messages: [{ type: 'text', text: 'Tell me where and when, for example "Hyderabad to Bangalore tomorrow" or "Mumbai to Goa on Friday night".' },
        { type: 'chips', chips: [
          { label: 'Hyderabad → Bangalore', send: 'Hyderabad to Bangalore tomorrow' },
          { label: 'Mumbai → Goa', send: 'Mumbai to Goa this weekend' },
          { label: 'Delhi → Jaipur', send: 'Delhi to Jaipur tomorrow' },
        ] }],
      context,
    };
  }
  if (/\b(thanks|thank you|thx|ty|great|awesome|cool|ok|okay)\b/.test(t)) {
    return { messages: [{ type: 'text', text: 'Happy to help! Anything else?' }, { type: 'chips', chips: HELP_CHIPS }], context };
  }
  if (/\b(bye|goodbye|see you)\b/.test(t)) {
    return { messages: [{ type: 'text', text: 'Have a great trip! 👋' }], context };
  }
  if (/\b(hi|hello|hey|hii|namaste|good morning|good evening|good afternoon|help|what can you|who are you)\b/.test(t) || !t.trim()) {
    return {
      messages: [{ type: 'text', text: "Hi! I'm the Vihari assistant. I can find buses, show your trips and tickets, suggest tours and answer questions about bookings." }, { type: 'chips', chips: HELP_CHIPS }],
      context,
    };
  }

  return {
    messages: [
      { type: 'text', text: "Sorry, I didn't get that. Try something like \"Hyderabad to Chennai tomorrow\", \"my next trip\", \"tours under 1500\" or \"baggage rules\"." },
      { type: 'chips', chips: HELP_CHIPS },
    ],
    context,
  };
};
