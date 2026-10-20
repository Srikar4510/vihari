# Vihari: notes for development

Working notes for continuing development (for Claude Code or any developer). User-facing setup and
deployment are in `README.md`; planned work is in `docs/ROADMAP.md`. Keep both up to date: when a
feature ships, move its roadmap item to **Done** with the date.

## Run locally

| What | Command (from) | Address |
|---|---|---|
| Backend | `npm run dev` (backend/) | http://localhost:4000, API docs at `/api-docs` |
| Frontend | `npm start` (frontend/) | http://localhost:3000 |
| Demo data | `npm run seed` (backend/; `-- --reset` to wipe) | |

- Needs MongoDB (`MONGO_URI`). Redis is optional (tours cache).
- `backend/.env` is loaded by `app.js` itself (`process.loadEnvFile`); hosts pass real env vars instead.
- Demo logins (local only), password `password123`: `user@example.com` at `/login`,
  `agent@example.com` at `/agentLogin`, `admin@example.com` at `/admin/login`.
- Production never gets demo accounts: `npm run seed:admin` (ADMIN_EMAIL/ADMIN_PASSWORD) and
  optionally `npm run seed:catalog -- --owner=<approved partner email>`.

## Architecture

**Backend** (`backend/`, Express + Mongoose, CommonJS)
- `app.js`: env loading, CORS (`FRONTEND_URL`), Swagger, route mounting, `/uploads` static.
- **Auth:** JWT in the `auth-token` header. The payload says which kind of account: `{ user: {id} }`,
  `{ agent: {id} }` or `{ admin: {id} }`.
  - `middleware/fetchUser.js`: travellers only.
  - `middleware/agentAuth.js`: `agentAuth`, `adminAuth`, `agentOrAdmin`. Partners must be approved
    (`flag === 1`) and not blocked; this is checked on every request.
- Routes and controllers:
  - Traveller: `routes/auth.js` (login/signup/profile/trips/travellers), `routes/bus.js` (search,
    booking, seats), `routes/tour.js`, `routes/assistant.js` (rule-based chat).
  - Partner API under `/api/agent/*` (`controllers/agent.js`). Public reads: allbuses, getbus, alltours,
    gettour, tourplaces. Everything else needs a partner or admin token. Ownership is checked via
    `ownBus`/`ownTour`/`ownPlace(req, id)`, which admins bypass.
  - Admin API under `/api/admin/*` (`controllers/admin.js`, all behind `adminAuth`).
- **Pricing:** always on the server (`utils/pricing.js`: `busQuote`, `tourQuote`, seat-clash and
  gender-neighbour rules).
- **Payments** (`utils/payments.js`):
  - Demo mode when Razorpay keys are missing.
  - Live mode verifies signature, order, amount and currency, captures authorized payments, and
    refunds when a paid booking fails.
  - A `paymentId` can be used once: checked in code and by a unique partial index on tickets and tour
    bookings.
- **Uploads** (`middleware/fileUpload.js`): multer, then `persistUpload(kind)`.
  - With `CLOUDINARY_URL`: photos are stored as public https URLs; partner documents as
    `cloudinary:<public_id>` (private, raw, authenticated), served only through
    `GET /api/admin/agents/:id/document`.
  - Without it: files go to `backend/uploads/images`, stored as `uploads/images/<file>`.
  - Use `uploadedPath`, `removeUpload`, `removeStored` and `sendStored` instead of touching files directly.
- **Redis** (`utils/Redis.js`): wrapper whose `get/set/del` silently do nothing when Redis is absent.
  Changing tours must call `redisClient.del('all-tours')`.
- **Data formats used everywhere:**
  - Cities: lowercase (`srcname`, `destname`); search lowercases its input.
  - Times: `"9:30 PM"`.
  - Durations: `"15 hrs"` or `"3h 45m"` (legacy `"10.5 hrs"` also parses; readers are
    `durationToMinutes` in `frontend/src/utils/time.js` and `durationMinutes` in `backend/utils/assistant.js`).
  - Travel dates: `"YYYY-MM-DD"` strings in local time.
  - Tour ticket `price` is Decimal128: convert with `Number()` before sending.
- **Seat layouts** (`utils/seatLayout.js`, mirrored in `frontend/src/utils/seatLayout.js`): the bus type
  decides seater (2+2 x10), sleeper (2+1, lower+upper) or mixed. The type can't change while a bus
  has upcoming bookings.
- **Seed script** (`scripts/seed.js`) reads photo URLs from `frontend/src/constants/tourPhotos.json`
  (Wikimedia, credited on `/credits`).

**Frontend** (`frontend/`, Create React App, React 18, react-router 6)
- **Backend address:** `src/config.js` (`API_URL` from `REACT_APP_API_URL`, default localhost:4000).
  Never hardcode `localhost:4000`.
- **API helpers:**
  - `utils/account.js` (traveller), `utils/payments.js`, `utils/partnerApi.js` (`partnerApi` and
    `adminApi`; a 401 sends you to the right login page), `utils/assistant.js`.
  - The old RTK slice (`Slices/agentApiSlice.js`) only serves public tours and partner sign-up.
- **Partner portal and admin console share one shell:** `components/Partner/PartnerUI.jsx`.
  - `PartnerProvider kind="partner"|"admin"` provides toasts, `confirm()` and the portal config;
    `PartnerLayout` is the sidebar layout.
  - `usePortal()` gives `paths`/`isAdmin`, so the bus, tour, place and booking screens in
    `pages/partner/` also serve `/admindb/...`. Don't hardcode `/agent/...` links in shared pages.
  - Routes are wrapped in `App.js` with `partner(<Page/>)` / `admin(<Page/>)` and guarded by
    `PrivateRoute role="user"|"agent"|"admin"`.
- **Custom controls:** `components/Partner/Pickers.jsx` (`Dropdown`, `TimePicker`, `DurationPicker`).
  - Wrap them in `<Field group>` (renders a div; a `<label>` would swallow clicks inside the popover).
  - Cards that hold an open picker are lifted with `:has(.pk--open)`, because animated cards create
    stacking contexts.
- **Modals** render through `createPortal(…, document.body)`, because animated (transformed) parents
  trap `position: fixed`.
- **Global CSS quirk:** `Navbar.css` sets `html { font-size: 62.5% }`. Size new UI in **px**, not rem.
- **Styles:**
  - Traveller site: Poppins, teal `#1fb5c4` / `#29d9d5`, dark `#1f2d36`.
  - Partner/admin: `components/CSS/Partner.css` (`pt-` prefix, tokens on `.pt-shell`, admin gets a
    purple sidebar via `.pt-shell--admin`).
  - Chat widget: `ChatAssistant.css`.
- **PDFs:** jsPDF (pinned 4.2.1). Built-in fonts have no ₹, so PDFs use "Rs.". Two copies of the same
  layout: `frontend/src/utils/ticketPdf.js` (traveller downloads) and `backend/utils/ticketPdf.js`
  (email attachments; crops photos with a clip path, reads image sizes itself). Keep them in sync.
- **Email:** `backend/utils/mailer.js` (`sendMail`) uses Brevo's HTTPS API when `BREVO_API_KEY` is set,
  else Gmail SMTP. It never throws by default and skips reserved test domains. Booking confirmations
  are queued from the booking controllers via `utils/bookingEmails.js`.
- **Booking draft:** kept in sessionStorage (bus context). The passenger form autosaves.

## Conventions

- Pin dependency versions exactly (`npm install --save-exact pkg@x.y.z`) and prefer releases at least
  a few weeks old.
- Never commit secrets: `.env` files are ignored; document new variables in the `.env.example` files
  and the README tables.
- Some files use CRLF line endings. Preserve them when editing programmatically.
- Validate on the server, give friendly error messages, and keep the frontend checks as convenience only.
- Check the backend for every UI change: auth, ownership, validation, cache invalidation, and file cleanup.
- Update `README.md` / `docs/ROADMAP.md` when behaviour or setup changes.

## Testing habits

- Backend: small throwaway node scripts against the local API or DB. Use a separate database name
  (e.g. `.../vihari_test`) for destructive tests, and drop it afterwards.
- Frontend: check flows in a browser at desktop width and at phone width (375px), and confirm there
  is no horizontal scroll.
- Strict build check: `CI=true ./node_modules/.bin/react-scripts build` in `frontend/`. The
  react-razorpay source-map warning is harmless.
- Delete any test bookings, users, buses or uploads you create, and never touch real users' data.

## Deployment

See the README. In short: Vercel (`frontend/`, `REACT_APP_API_URL`), Render (`backend/`, `npm ci`,
`npm start`), MongoDB Atlas, Cloudinary, optional Upstash Redis, Gmail app password for email, and
Razorpay test keys.
