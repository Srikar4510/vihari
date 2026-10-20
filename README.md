# Vihari

A MERN travel platform for booking intercity buses and curated city tours, with separate portals for
travellers, bus/tour partners and admins.

- **Travellers:** search buses, pick seats on seater/sleeper/mixed seat maps (with the neighbouring-seat
  gender rule), pay (Razorpay or demo mode), download PDF tickets and tour vouchers, save travellers,
  and use the chat assistant.
- **Partners:** dashboard with revenue and bookings, manage buses (live preview, time and duration
  pickers), tours and their places, passenger lists with CSV export.
- **Admins:** platform overview, travellers, partner approvals (with document review), all buses and
  tours, email announcements.

**Stack:** React 18 (Create React App, Redux Toolkit), Express, MongoDB (Mongoose), optional Redis,
Cloudinary for uploads, jsPDF, Razorpay.

```
backend/    Express API (routes, controllers, models, middleware, scripts/seed.js)
frontend/   React app (pages, components, utils)
docs/       ROADMAP.md: planned features and follow-ups
```

## Run it locally

Needs Node.js 20.12 or newer and MongoDB (local or Atlas). Redis is optional.

```bash
# 1. Backend
cd backend
cp .env.example .env        # then edit MONGO_URI and JWT_SECRET
npm install
npm run seed                # demo accounts + 184 buses + 9 tours (local only)
npm run dev                 # http://localhost:4000, API docs at /api-docs

# 2. Frontend (second terminal)
cd frontend
cp .env.example .env
npm install
npm start                   # http://localhost:3000
```

### Demo accounts (local only, created by `npm run seed`)

| Role | Email | Where to log in |
|---|---|---|
| Traveller | `user@example.com` | `/login` |
| Partner | `agent@example.com` | `/agentLogin` |
| Admin | `admin@example.com` | `/admin/login` |

The password is `password123`, or the value of `SEED_PASSWORD` if it was set when seeding.
`npm run seed` refuses to run on a database that already has data; `npm run seed -- --reset` wipes
buses, tours, bookings and demo accounts and starts again. **Never run it against production.**

### Seed scripts

| Command | Use | What it does |
|---|---|---|
| `npm run seed` | Local | Demo traveller, partner and admin, plus the demo buses and tours |
| `npm run seed:admin` | Production | Creates the admin from `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME`, or resets that admin's password. Touches nothing else. |
| `npm run seed:catalog -- --owner=<partner email>` | Production (optional) | Adds the 184 demo buses and 9 tours to an existing, approved partner. Only works on an empty catalog. |

## Environment variables

### Backend (`backend/.env`, or the host's environment settings)

| Variable | Needed | What it is |
|---|---|---|
| `MONGO_URI` | Yes | MongoDB connection string |
| `JWT_SECRET` | Yes | Long random string for login tokens |
| `FRONTEND_URL` | In production | Website address(es) allowed to call the API, comma-separated |
| `CLOUDINARY_URL` | In production | Where partner photos and documents are stored. Without it, files go to `backend/uploads`, which most hosts wipe on every deploy |
| `REDIS_URL` | No | Caches the tours list |
| `BREVO_API_KEY`, `MAIL_FROM` | No | Email via Brevo (works on Render's free plan): booking confirmations with the PDF ticket, partner emails, announcements. `MAIL_FROM` must be a verified Brevo sender |
| `MAIL_USER`, `MAIL_PASS` | No | Local alternative: Gmail address and app password (used when `BREVO_API_KEY` is empty). Render's free plan blocks this |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | No | Razorpay keys (see *Payments*). Without them, bookings use demo payments |
| `PUBLIC_API_URL` | No | API address shown in the API docs |
| `SEED_PASSWORD` | No | Password for the local demo accounts |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | For `seed:admin` | The production admin account |

### Frontend (`frontend/.env`, or the host's environment settings)

| Variable | Needed | What it is |
|---|---|---|
| `REACT_APP_API_URL` | In production | Backend address, e.g. `https://vihari-api.onrender.com` |

Frontend variables are baked in at build time, so redeploy the frontend after changing them.

## Deploy (free tiers)

Free tier limits change; check them when you sign up.

1. **MongoDB Atlas.** Create a free M0 cluster and a database user. Under *Network Access*, allow
   `0.0.0.0/0` (the backend host has no fixed IP). Copy the connection string and put a database
   name in it, e.g. `.../vihari?retryWrites=true&w=majority`.
2. **Cloudinary.** Sign up, then copy the *API environment variable* (`cloudinary://...`) from the
   dashboard.
3. **Upstash** (optional). Create a Redis database and copy its `rediss://` URL.
4. **Backend on Render.** *New > Web Service*, connect this repo.
   - Root directory: `backend`
   - Build command: `npm ci`
   - Start command: `npm start`
   - Node version: the repo pins Node 22 (`backend/.node-version`). Newer Node versions break an
     old token library, so keep 22 (or set `NODE_VERSION=22` in Render's environment).
   - Environment: `MONGO_URI`, `JWT_SECRET`, `CLOUDINARY_URL`, plus the optional ones.
     Set `FRONTEND_URL` after step 5.
   - Health check path: `/`
5. **Frontend on Vercel.** *Add New > Project*, import this repo.
   - Root directory: `frontend` (Create React App is detected automatically)
   - Environment: `REACT_APP_API_URL` = the Render address from step 4
   - `vercel.json` sends every route to `index.html`, so refreshing `/agent/allbuses` works.
     Netlify uses `public/_redirects` for the same thing.
6. Back on Render, set `FRONTEND_URL` to the Vercel address and redeploy.
7. **Create the admin** from your computer, with the Atlas `MONGO_URI` in `backend/.env` (Render's *Shell*
   tab can also run it if your plan has one):
   ```bash
   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a-long-strong-password' ADMIN_NAME='Your Name' npm run seed:admin
   ```
8. **Partners and travellers sign up on the live site.** Sign up a partner at `/agentSignUp`, then
   approve it in the admin console under *Partners*. Travellers sign up at `/login`.
9. **Optional demo catalog.** To fill the site with the demo buses and tours, owned by your
   approved partner:
   ```bash
   npm run seed:catalog -- --owner=partner@example.com
   ```

Notes:
- Render's free plan sleeps after about 15 minutes with no traffic, so the first request after that
  takes 30–60 seconds.
- Bus and tour photos in the demo data load from Wikimedia Commons (credits at `/credits`).
- Bus and tour photos for new items are uploaded to Cloudinary.
- Email on Render goes through Brevo (Render's free plan blocks SMTP). `MAIL_FROM` must be a verified
  Brevo sender. Addresses on domains with a strict DMARC policy (many college or company domains) can't
  be verified without access to that domain's DNS; use a Gmail address, or your own domain authenticated
  in Brevo for the best inbox placement.

## Payments (Razorpay)

Without keys, every booking is confirmed in **demo mode**: no checkout, and no money is taken.

To use the real Razorpay checkout in **test mode** (no real money):
1. Sign up at the Razorpay dashboard and switch to **Test Mode**.
2. *Account & Settings > API Keys > Generate Test Key*. Copy the Key Id (`rzp_test_...`) and the
   Key Secret, which is shown only once.
3. Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` on the backend (Render > Environment) and redeploy.
   The frontend needs nothing: the server sends the key id with each order.
4. Pay with Razorpay's test cards or test UPI ids (listed in Razorpay's "Test card details" docs).

How it is protected:
- The price is always worked out on the server.
- The payment signature, order, amount and currency are verified before a booking is saved.
- An authorized payment is captured automatically.
- One payment can confirm only one booking (also enforced by a unique index).
- If the booking still fails after payment (for example, the seat was taken while paying), the
  payment is refunded automatically and the traveller is told.

Accepting real money (**Live Mode**) needs a Razorpay account activated with business KYC; switch to
the live keys only after that.

## API

Interactive docs are served at `/api-docs` on the backend. The main groups:
- **Public:** bus search, routes, tours, places, the chat assistant
- **Traveller** (`auth-token` header): bookings, profile, trips, saved travellers
- **Partner** (`/api/agent/...`): only the partner's own buses, tours and places
- **Admin** (`/api/admin/...`): admin token required. Admins can also manage any bus or tour through
  the partner endpoints.

See [docs/ROADMAP.md](docs/ROADMAP.md) for what is planned next.
