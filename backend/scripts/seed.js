// Seeds the database. Three modes (run from backend/):
//
//   npm run seed                 LOCAL DEVELOPMENT. Demo traveller, partner and admin
//                                (user@ / agent@ / admin@example.com) plus 184 buses and 9 tours.
//                                Refuses if buses exist; add "-- --reset" to wipe and start again.
//                                SEED_PASSWORD sets the demo password (default: password123).
//
//   npm run seed:admin           PRODUCTION. Creates (or resets the password of) one admin from
//                                ADMIN_EMAIL, ADMIN_PASSWORD and optional ADMIN_NAME. Touches nothing else.
//
//   npm run seed:catalog -- --owner=partner@email [--create-owner]
//                                Adds the demo buses, tours and places to an existing, approved
//                                partner (e.g. one you signed up on the live site). With
//                                --create-owner it first creates that partner (OWNER_NAME,
//                                OWNER_PASSWORD). Refuses if the database already has buses.
try { process.loadEnvFile(require('path').join(__dirname, '..', '.env')); } catch { /* no .env file */ }
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { createClient } = require('redis');

const Agent = require('../models/agent');
const Bus = require('../models/buses');
const Tour = require('../models/tour');
const Place = require('../models/place');
const User = require('../models/user');
const Admin = require('../models/admin');
const Ticket = require('../models/ticket');
const TourTicket = require('../models/tourTickets');

// Wikimedia Commons photos (URL, author, license), shared with the frontend credits page.
const PHOTOS = require('../../frontend/src/constants/tourPhotos.json');

// [from, to, hours, base fare]
const ROUTES = [
  ['Hyderabad', 'Bangalore', 10, 1150],
  ['Hyderabad', 'Chennai', 11, 1100],
  ['Hyderabad', 'Vijayawada', 5, 550],
  ['Hyderabad', 'Mumbai', 13, 1450],
  ['Hyderabad', 'Pune', 11, 1300],
  ['Hyderabad', 'Tirupati', 10, 900],
  ['Hyderabad', 'Visakhapatnam', 11, 1150],
  ['Bangalore', 'Chennai', 6, 750],
  ['Bangalore', 'Goa', 10, 1100],
  ['Bangalore', 'Tirupati', 5, 600],
  ['Bangalore', 'Mysore', 3, 350],
  ['Mumbai', 'Pune', 4, 450],
  ['Mumbai', 'Goa', 11, 1200],
  ['Delhi', 'Agra', 4, 450],
  ['Delhi', 'Jaipur', 5, 600],
  ['Vijayawada', 'Visakhapatnam', 6, 650],
  ['Vijayawada', 'Eluru', 1, 150],
  ['Chennai', 'Tirupati', 4, 350],
  ['Chennai', 'Pondicherry', 3, 300],
  ['Mumbai', 'Ahmedabad', 9, 950],
  ['Ahmedabad', 'Pune', 11, 1250],
  ['Ahmedabad', 'Jaipur', 11, 1150],
  ['Delhi', 'Ahmedabad', 15, 1550],
  ['Chennai', 'Madurai', 8, 800],
  ['Chennai', 'Coimbatore', 8, 850],
  ['Bangalore', 'Kochi', 10, 1100],
  ['Bangalore', 'Mangalore', 7, 750],
  ['Delhi', 'Chandigarh', 5, 600],
  ['Delhi', 'Dehradun', 6, 650],
  ['Hyderabad', 'Warangal', 3, 300],
  ['Vijayawada', 'Tirupati', 7, 700],
];

const OPERATORS = [
  { name: 'SkyLine Travels', type: 'AC Sleeper', mult: 1.2, photo: 'bus_airavat' },
  { name: 'GreenRoute Express', type: 'Non-AC Seater', mult: 0.7, photo: 'bus_garuda' },
  { name: 'Royal Cruiser', type: 'Volvo Multi-Axle AC Seater', mult: 1.0, photo: 'bus_shivneri' },
  { name: 'Night Rider', type: 'AC Seater / Sleeper', mult: 1.1, photo: 'bus_scania' },
];
const DEPARTURES = [6 * 60, 13 * 60 + 30, 21 * 60, 22 * 60 + 45];

const fmt = (mins) => {
  const m = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${((h + 11) % 12) + 1}:${String(m % 60).padStart(2, '0')} ${ampm}`;
};

// Each place is [name, photo key in tourPhotos.json, description].
const TOURS = [
  {
    tname: 'Hyderabad Heritage Trail', tprice: 1499, cover: 'charminar', duration: '3 Days 2 Nights', rating: 4.8, reviews: 344,
    highlight: 'Charminar, Golconda Fort and the Nizam palaces',
    features: ['3★ hotel stay', 'AC transport', 'Biryani food walk', 'Local guide'],
    places: [
      ['Charminar', 'charminar', 'The 1591 monument at the heart of the old city, surrounded by the bangle stalls of Laad Bazaar.'],
      ['Golconda Fort', 'golconda', 'A hilltop fort famous for its acoustics, with sweeping views of the city and an evening sound-and-light show.'],
      ['Chowmahalla Palace', 'chowmahalla', 'The seat of the Nizams, with grand durbar halls, chandeliers and a vintage car collection.'],
    ],
  },
  {
    tname: 'Delhi Capital Explorer', tprice: 1199, cover: 'redfort', duration: '3 Days 2 Nights', rating: 4.7, reviews: 544,
    highlight: 'Mughal monuments and modern New Delhi',
    features: ['3★ hotel stay', 'AC transport', 'Metro passes', 'Local guide'],
    places: [
      ['Red Fort', 'redfort', 'The Mughal fort where the Prime Minister hoists the flag on Independence Day.'],
      ['India Gate', 'indiagate', 'The war memorial on Kartavya Path, best visited in the evening when it is lit up.'],
      ['Qutub Minar', 'qutub', 'A 73 m tall minaret and UNESCO World Heritage Site from the 12th century.'],
      ['Lotus Temple', 'lotus', 'A lotus-shaped Bahai house of worship open to people of all faiths.'],
      ["Humayun's Tomb", 'humayun', 'The garden tomb that inspired the design of the Taj Mahal.'],
    ],
  },
  {
    tname: 'Mumbai Coastal Escape', tprice: 1299, cover: 'gateway', duration: '3 Days 2 Nights', rating: 4.6, reviews: 298,
    highlight: 'Sea-facing promenades, beaches and island caves',
    features: ['3★ hotel stay', 'AC transport', 'Ferry tickets', 'Street food tour'],
    places: [
      ['Gateway of India', 'gateway', 'The 1924 arch on the waterfront, next to the Taj Mahal Palace hotel.'],
      ['Marine Drive', 'marinedrive', "The 3.6 km seafront promenade known as the Queen's Necklace."],
      ['Juhu Beach', 'juhu', 'A lively beach known for sunsets, pav bhaji and celebrity bungalows.'],
      ['Elephanta Caves', 'elephanta', 'Rock-cut cave temples on an island, home to the giant three-headed Shiva sculpture.'],
    ],
  },
  {
    tname: 'Bangalore Garden City', tprice: 999, cover: 'vidhana', duration: '2 Days 1 Night', rating: 4.6, reviews: 212,
    highlight: 'Palaces, gardens and a wildlife safari',
    features: ['3★ hotel stay', 'AC transport', 'Safari tickets'],
    places: [
      ['Bangalore Palace', 'blrpalace', 'A Tudor-style palace with turrets and carved wooden interiors.'],
      ['Lalbagh Botanical Garden', 'lalbagh', 'A 240-acre garden with a Victorian glass house that hosts the famous flower show.'],
      ['ISKCON Temple', 'iskcon', 'One of the largest ISKCON temples in the world, set on a hill in Rajajinagar.'],
      ['Bannerghatta National Park', 'bannerghatta', 'A national park with a lion and tiger safari and a butterfly park.'],
    ],
  },
  {
    tname: 'Goa Beach Holiday', tprice: 1799, cover: 'palolem', duration: '4 Days 3 Nights', rating: 4.9, reviews: 610,
    highlight: 'Beaches, Portuguese forts and old churches',
    features: ['Beach resort stay', 'AC transport', 'River cruise', 'Breakfast included'],
    places: [
      ['Palolem Beach', 'palolem', 'A crescent-shaped beach in South Goa with calm water, palm trees and beach huts.'],
      ['Fort Aguada', 'aguada', 'A 17th-century Portuguese fort and lighthouse overlooking the Arabian Sea.'],
      ['Basilica of Bom Jesus', 'bomjesus', 'A UNESCO-listed baroque church in Old Goa, built in 1605.'],
    ],
  },
  {
    tname: 'Chennai Coast and Culture', tprice: 899, cover: 'kapaleeshwarar', duration: '2 Days 1 Night', rating: 4.5, reviews: 187,
    highlight: 'Temples, the Marina and colonial Chennai',
    features: ['3★ hotel stay', 'AC transport', 'Filter coffee trail'],
    places: [
      ['Kapaleeshwarar Temple', 'kapaleeshwarar', 'A Dravidian-style Shiva temple in Mylapore with a colourful gopuram.'],
      ['Marina Beach', 'marina', 'One of the longest urban beaches in the world, lively in the evenings.'],
      ['San Thome Basilica', 'santhome', 'A neo-Gothic basilica built over the tomb of St. Thomas the Apostle.'],
      ['Chennai Central', 'chennaicentral', 'The red-brick Indo-Saracenic railway station, a city landmark since 1873.'],
    ],
  },
  {
    tname: 'Agra Taj Mahal Day Trip', tprice: 499, cover: 'taj', duration: '1 Day', rating: 4.8, reviews: 254,
    highlight: 'Sunrise at the Taj and the Mughal fort',
    features: ['AC transport', 'Entry tickets', 'Local guide'],
    places: [
      ['Taj Mahal', 'taj', 'The white marble mausoleum on the Yamuna, best seen at sunrise.'],
      ['Agra Fort', 'agrafort', 'A red sandstone fort and UNESCO site where Shah Jahan spent his last years.'],
    ],
  },
  {
    tname: 'Ahmedabad Heritage Walk', tprice: 1099, cover: 'adalaj', duration: '2 Days 1 Night', rating: 4.7, reviews: 176,
    highlight: "Stepwells, Gandhi's ashram and India's first World Heritage City",
    features: ['3★ hotel stay', 'AC transport', 'Gujarati thali', 'Heritage walk'],
    places: [
      ['Sabarmati Ashram', 'sabarmatiashram', "Mahatma Gandhi's home from 1917 to 1930, where the Dandi March began."],
      ['Adalaj Stepwell', 'adalaj', 'A five-storey stepwell from 1499 with intricate carvings in Indo-Islamic style.'],
      ['Sabarmati Riverfront', 'riverfront', 'A landscaped promenade along the river with gardens and the Atal pedestrian bridge.'],
      ['Sidi Saiyyed Mosque', 'sidisaiyyed', "A 1573 mosque famous for its 'tree of life' stone lattice window."],
    ],
  },
  {
    tname: 'Jaipur Pink City Royal Tour', tprice: 1699, cover: 'hawamahal', duration: '3 Days 2 Nights', rating: 4.9, reviews: 432,
    highlight: 'Royal forts, palaces and the Palace of Winds',
    features: ['Heritage hotel stay', 'AC transport', 'Rajasthani dinner', 'Local guide'],
    places: [
      ['Hawa Mahal', 'hawamahal', 'The Palace of Winds, a pink sandstone facade with 953 small windows.'],
      ['Amer Fort', 'amer', 'A hilltop fort-palace with mirror halls and views over Maota Lake.'],
      ['Jal Mahal', 'jalmahal', 'A palace that appears to float in the middle of Man Sagar Lake.'],
      ['City Palace', 'citypalace', 'The royal residence that still houses the Jaipur royal family, with a museum.'],
    ],
  },
];

const banner = () => console.log('Connected to database', mongoose.connection.name);

const clearToursCache = async () => {
  if (!process.env.REDIS_URL) return;
  const redis = createClient({ url: process.env.REDIS_URL });
  await redis.connect();
  await redis.del('all-tours');
  await redis.quit();
};

// Creates the demo buses, tours and places, owned by `agent`.
const seedCatalog = async (agent) => {
  const buses = [];
  for (const [a, b, hours, fare] of ROUTES) {
    for (const [src, dest] of [[a, b], [b, a]]) {
      OPERATORS.forEach((op, i) => {
        const dep = DEPARTURES[i];
        buses.push({
          agent: agent._id,
          srcname: src.toLowerCase(),
          destname: dest.toLowerCase(),
          trname: op.name,
          deptime: fmt(dep),
          arrtime: fmt(dep + hours * 60),
          durtime: `${hours} hrs`,
          tktprice: Math.round((fare * op.mult) / 10) * 10,
          btype: op.type,
          Imageurl: PHOTOS[op.photo].src,
        });
      });
    }
  }
  const createdBuses = await Bus.insertMany(buses);

  const createdTours = [];
  for (const t of TOURS) {
    const { cover, places: tourPlaces, ...details } = t;
    const tour = await Tour.create({ ...details, DispImageurl: PHOTOS[cover].src, agentId: agent._id });
    const places = await Place.insertMany(
      tourPlaces.map(([name, key, description]) => ({ name, Imageurl: PHOTOS[key].src, description, tour: tour._id })),
    );
    tour.places = places.map((p) => p._id);
    await tour.save();
    createdTours.push(tour);
  }

  await Agent.updateOne({ _id: agent._id }, {
    $addToSet: { buses: { $each: createdBuses.map((b) => b._id) }, tours: { $each: createdTours.map((t) => t._id) } },
  });
  await clearToursCache();
  console.log(`Added ${createdBuses.length} buses on ${ROUTES.length * 2} routes and ${createdTours.length} tours for ${agent.agentName} (${agent.email}).`);
};

const seedLocal = async () => {
  if (!process.argv.includes('--reset') && (await Bus.estimatedDocumentCount()) > 0) {
    console.log('The database already has buses. Run "npm run seed -- --reset" to wipe and reseed it.');
    return;
  }
  await Promise.all([Ticket.deleteMany({}), TourTicket.deleteMany({}), Agent.deleteMany({ email: /@example\.com$/ }), User.deleteMany({ email: /@example\.com$/ }), Admin.deleteMany({ email: /@example\.com$/ }), Bus.deleteMany({}), Tour.deleteMany({}), Place.deleteMany({})]);

  const password = await bcrypt.hash(process.env.SEED_PASSWORD || 'password123', 10);
  const agent = await Agent.create({ agentName: 'Practice Travels', email: 'agent@example.com', password, document: 'seed', flag: 1 });
  await Admin.create({ firstName: 'Site', lastName: 'Admin', email: 'admin@example.com', password });
  await User.create({ firstName: 'Test', lastName: 'Traveller', email: 'user@example.com', mobile: '9000000000', password });
  await seedCatalog(agent);
  console.log(`Demo logins (password: ${process.env.SEED_PASSWORD ? 'SEED_PASSWORD' : 'password123'}): user@example.com, agent@example.com, admin@example.com (admin at /admin/login)`);
};

const seedAdmin = async () => {
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const plain = String(process.env.ADMIN_PASSWORD || '');
  const [firstName, ...rest] = String(process.env.ADMIN_NAME || 'Site Admin').trim().split(/\s+/);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error('Set ADMIN_EMAIL to the admin login email.');
  if (plain.length < 10 || /^password/i.test(plain)) throw new Error('Set ADMIN_PASSWORD to a strong password (at least 10 characters).');
  const password = await bcrypt.hash(plain, 10);
  const existing = await Admin.findOne({ email });
  if (existing) {
    existing.password = password;
    await existing.save();
    console.log(`Admin ${email} already existed: password updated.`);
  } else {
    await Admin.create({ firstName, lastName: rest.join(' ') || 'Admin', email, password });
    console.log(`Admin ${email} created. Log in at /admin/login.`);
  }
};

const seedCatalogFor = async () => {
  const arg = process.argv.find((a) => a.startsWith('--owner='));
  const email = arg ? arg.slice(8).trim().toLowerCase() : '';
  if (!email) throw new Error('Pass the partner email: npm run seed:catalog -- --owner=partner@email');
  let agent = await Agent.findOne({ email });
  // --create-owner: create the partner (approved) when it doesn't exist yet. Uses OWNER_NAME and
  // OWNER_PASSWORD (10+ characters) so no weak demo password ends up in production.
  if (!agent && process.argv.includes('--create-owner')) {
    const plain = String(process.env.OWNER_PASSWORD || '');
    if (plain.length < 10 || /^password/i.test(plain)) throw new Error('Set OWNER_PASSWORD to a strong password (at least 10 characters).');
    agent = await Agent.create({
      agentName: String(process.env.OWNER_NAME || 'Practice Travels').trim(), email, password: await bcrypt.hash(plain, 10), document: 'seed', flag: 1,
    });
    console.log(`Partner ${email} created (approved).`);
  }
  if (!agent) throw new Error(`No partner with email ${email}. Sign up as a partner on the site first, or add --create-owner.`);
  if (agent.flag !== 1 || agent.blocked) throw new Error(`${email} is not an approved, active partner. Approve it in the admin console first.`);
  if ((await Bus.estimatedDocumentCount()) > 0) throw new Error('The database already has buses; the demo catalog is only added to an empty database.');
  await seedCatalog(agent);
};

async function main() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is not set (backend/.env or the environment).');
  await mongoose.connect(process.env.MONGO_URI);
  banner();
  if (process.argv.includes('--admin')) await seedAdmin();
  else if (process.argv.includes('--catalog')) await seedCatalogFor();
  else await seedLocal();
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err.message || err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
