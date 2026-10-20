# Roadmap

Running list of features and follow-ups that are planned but not built yet. Add new ideas at the
bottom of the right section; move an item to **Done** with the date once it ships.

## Planned features

### 1. Email the PDF ticket to the booking email
- Add a "Send to my email" button next to "Download PDF ticket" (trip details modal and the
  booking confirmation screen), and optionally send it automatically after a booking.
- Generate the same ticket on the server (the browser version is `frontend/src/utils/ticketPdf.js`;
  a Node equivalent could use `pdfkit` or `jspdf` in Node) and attach it to the email.
- Send through a transactional email service (e.g. Resend, Brevo or SendGrid free tier) using
  credentials in `backend/.env`. The old hardcoded Gmail app password must not come back.
- Use the contact email entered on the passenger page; store it on the ticket so it can be resent.
- Rate-limit resends per booking.

### 2. Live bus tracking page (UI first)
- New page, e.g. `/trips/:id/track`, linked from the trip details modal while a trip is in progress.
- Version 1 (no GPS): estimate progress from departure time, arrival time and duration, and show
  the bus moving along a route line between the two cities with stops, ETA and "x% of journey done".
- Version 2: replace the estimate with real positions (operator GPS feed or driver app) and a map
  (Leaflet with OpenStreetMap tiles). Keep the same page and swap the data source.
- Show states: not started (countdown), on the road, delayed, arrived.

### 3. Coupon codes at checkout
- Add a "Have a coupon?" field to the bus checkout summary (under the fare breakdown, above the
  Pay button) and to the tour booking modal (above the total).
- Show the discount as its own line in the fare breakdown, with the new total, a remove (x) option
  and clear messages for invalid, expired or not-applicable codes.
- Validate and apply on the server only: a `Coupon` model (code, percent or flat amount, max
  discount, minimum fare, valid from/to, usage limit, per-user limit, applies to bus/tour/both),
  checked in `utils/pricing.js` so `/order` and the booking endpoints use the discounted amount.
- Store the applied code and discount on the ticket, and count redemptions.
- Optional: list available offers on the checkout page and an admin screen to create codes.

### 4. AI mode for the assistant (optional, needs a free API key)
- The chat assistant (`backend/utils/assistant.js`) is rule-based today. Add an optional AI layer that
  turns on only when a key is set in `backend/.env` (for example a free Gemini or Groq key), the same
  way payments switch between demo and live mode.
- Give the model the existing functions as tools (bus search, my trips, tour search, FAQs) so its
  answers still come from our data, and fall back to the rule-based reply on errors or limits.
- Keep the key on the server only, keep the rate limit, and never let the assistant book or pay by itself.

## Follow-ups found during the redesign

- **Email delivery**: `MAIL_USER` / `MAIL_PASS` are not set, so partner approval/block emails are skipped
  and admin announcements are disabled. Add a mail account (or a transactional email service) to
  `backend/.env`.
- **Admin accounts**: there is one seeded admin. Add a way to invite or create more admins and to
  change the admin password from the console.
- **Contact form delivery**: the About page form opens the visitor's email app. Optionally deliver
  messages directly with a form service (e.g. Formspree) or the email service above.
- **Self-host photos before deploying**: destination, tour and bus photos are loaded from
  Wikimedia's CDN. Download copies (keeping the credits on `/credits`) and serve them with the app.
- **Razorpay keys**: payments run in demo mode until test keys are added to the backend settings
  (see README > Payments). Live mode needs business KYC on Razorpay.

## Done

- 2026-10-19: Redesigned home, tours, about, login, partner, bus search, seat selection (seater,
  sleeper and mixed layouts with the neighbouring-seat gender rule), checkout and profile pages;
  saved travellers; trip details with countdown and PDF ticket download.
- 2026-10-19: Tour booking prefills email and phone from the profile; detailed tour voucher PDF
  (cover photo, inclusions, itinerary with place photos, payment) after booking and in My tours.
- 2026-10-19: Chat assistant on traveller pages (rule-based, no API key): bus search with dates and
  filters, my trips and tour bookings with PDFs, tour suggestions by place, theme and budget, and FAQs.
- 2026-10-19: Partner portal rebuilt: dashboard (revenue, bookings, 14-day chart, top routes), buses,
  bus form with live preview, passenger lists with CSV export, tours, tour form, places, profile.
  Partner APIs now require a partner token and only touch the partner's own buses, tours and places.
- 2026-10-19: Admin console: separate admin accounts and login (`/admin/login`, seeded
  admin@example.com), server-side admin checks on every `/api/admin/*` call, overview dashboard,
  travellers (add/edit/delete), partners (approve/reject/block with document review), buses and tours
  (shared screens with the partner portal), announcements. Password hashes are no longer sent to the
  browser by any login or list endpoint.
- 2026-10-19: Deployment prep: API URL from `REACT_APP_API_URL`, CORS limited by `FRONTEND_URL`,
  uploads to Cloudinary when `CLOUDINARY_URL` is set, Redis optional, `npm start` / `npm run dev` /
  `npm run seed` (guarded), `vercel.json`, `.env.example` files, README deploy guide, unused assets removed.
- 2026-10-19: Payments hardened for live keys (payment/order/amount check, auto-capture, one booking per
  payment with a unique index, automatic refund when a paid booking fails). Seed split into
  `seed` (local demo), `seed:admin` (production admin) and `seed:catalog` (demo buses/tours for a real
  partner). Development notes in `CLAUDE.md`.
