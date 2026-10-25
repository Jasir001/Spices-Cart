# SPICE CART — SPICES AND MORE

A responsive React and TypeScript storefront built with Vite. Its Express and
MongoDB API supports authentication, a database-backed catalog, persistent
carts, inventory-checked orders, and a fail-closed Razorpay integration.
Checkout remains disabled by default and this repository does not include
verified store prices, stock, owner contact details, policy text, or payment
credentials. Do not accept real orders until the launch checklist below is
completed.

## Requirements

- Node.js 20 or newer
- npm
- Docker Desktop with Docker Compose v2 (for the containerized setup)

## Run the full stack locally with Docker

This starts the site and a local MongoDB database without requiring a separate
MongoDB installation. From the project directory:

```powershell
Copy-Item .env.example .env
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Copy the generated value into `SESSION_SECRET` in `.env`, replacing the
example placeholder. The Compose database starts as a single-node replica set
so MongoDB transactions can reserve inventory safely. Then start the services:

```powershell
docker compose up --build
```

Open `http://localhost:3000/`. The database is reachable only inside the
Compose network, and its data persists in a named Docker volume when the
containers stop. Use a different secret and managed database configuration
for any deployed environment; this local setup is not a production deployment.

## Run locally

From the project directory:

```powershell
npm install
Copy-Item .env.example .env
```

For a direct Node run, set `MONGODB_URI` to a reachable MongoDB replica set or
Atlas URI and replace `SESSION_SECRET` with a randomly generated value of at
least 32 characters. The default frontend/API origin is
`http://localhost:3000`. The local Vite preview uses browser-only cart storage
by default. To use the API, set `VITE_API_ENABLED=true` in `.env` and start
MongoDB before starting the API and frontend in separate terminals:

```powershell
npm run server:dev
```

```powershell
npm run dev
```

Open `http://localhost:3000/`. Vite forwards `/api` requests to
`API_PROXY_TARGET` (default `http://127.0.0.1:5000`). `VITE_API_BASE_URL` is
empty for same-origin/proxied requests; set it only when the browser should
call a separately hosted API. `CLIENT_ORIGIN` must exactly match the browser
origin. The API intentionally refuses to start without `MONGODB_URI` and a
strong `SESSION_SECRET`; these are configuration errors, not a reason to use
an insecure fallback secret.

The original local API 500 was caused by this required configuration being
absent: `MONGODB_URI` and `SESSION_SECRET` were unset and no `.env` existed.
The API therefore exited before listening on port 5000, leaving the Vite
`/api` proxy without an upstream. Create `.env` from `.env.example` and
configure MongoDB and a strong session secret to run the API; the site does
not substitute fake API responses for a failed backend.

Build and preview the production frontend:

```powershell
npm run build
npm run preview
```

The build compiles the API and frontend TypeScript before Vite creates `dist/`
and `server/dist/`. Run the API tests with `npm run test:server`.

## Available frontend routes

- `/` — storefront, catalog filters, browser cart and wishlist
- `/shop` — all catalog items
- `/products/:id` — database-backed product details or explicitly marked sample listings
- `/categories/whole-spices`
- `/categories/ground-spices`
- `/categories/masalas`
- `/categories/gift-boxes`
- `/collections/premium`
- `/collections/combos`
- `/search?q=...`
- `/wishlist`
- `/cart` — server cart when API is configured, otherwise browser-only preview
- `/checkout` — server checkout when all readiness checks pass; disabled otherwise
- `/market-prices` — attributed source links and browser-only CSV previews
- `/account`, `/login`, `/register`, `/profile`, `/orders`, `/tracking`
- `/forgot-password` — email validation and explicit unavailable state
- `/about`, `/contact`, `/faq`, `/recipes`, `/shipping`, `/returns`, `/privacy`,
  and `/terms` — information pages that clearly identify missing store-specific
  configuration

The SPA host must rewrite unknown paths to `index.html` so direct navigation to
these routes works after deployment. Vite's development server already handles
this fallback.

## Customer sign-in and registration

`/login`, `/register`, and `/forgot-password` provide responsive branded forms,
accessible client-side validation, password visibility controls, Indian mobile
number validation, and Terms/Privacy acknowledgement. An Express/Mongoose API
stores customers in MongoDB, hashes passwords with bcrypt, and authenticates
with Mongo-backed HttpOnly sessions and CSRF protection. `/account` and
`/profile` use the authenticated API session; credentials and session tokens
are not stored in browser storage.

Password reset and email verification are not implemented because no email
service is configured. Do not deploy customer authentication without HTTPS and
a secure production `SESSION_SECRET`.

## Shopping cart and checkout

The cart merges repeated additions of the same product and pack size and limits
each line to 99. When the API and MongoDB are available, guest carts are
attached to the secure server session and customer carts are stored by
authenticated user; guest items are merged into the customer cart at login or
registration. Cart lines are validated against the shared product/variant
catalog, and a MongoDB unique index prevents duplicate lines. The API exposes
`GET /api/cart`, `POST /api/cart/items`, `PATCH /api/cart/items`,
`DELETE /api/cart/items`, and `DELETE /api/cart`; all mutations require the
session CSRF token. Cart records expire after 90 days without updates. If the
API is unavailable, the cart continues in browser storage and the page
identifies that fallback.

The shared TypeScript catalog is sample data. `/api/products` and
`/api/products/:id` mark sample entries `isDemo: true` and `orderable: false`.
Product records saved in MongoDB override sample entries in the storefront.
Before recording a real product, an administrator must supply current
`pricePaise`, `inventory`, a source note for each price and stock count, and an
active flag through the protected endpoint `PUT /api/admin/products/:id`.
The endpoint requires a signed-in user whose MongoDB ObjectId is explicitly
listed in the server-only `ADMIN_USER_IDS` variable; it records verification
timestamps. Never put those IDs, session secrets, or payment credentials in
frontend variables.

Cart records contain product IDs, pack sizes, and bounded quantities only.
Configured product variants check active status and available stock during
cart updates. At checkout the server reloads the user's MongoDB cart, rejects
sample/unverified prices or insufficient inventory, calculates item prices,
shipping, and tax from server configuration, and reserves stock in a MongoDB
transaction. Idempotency keys prevent duplicate order creation. A successful
client callback alone does not mark an order paid: the backend verifies the
Razorpay signature and captured payment with Razorpay, and only a valid,
deduplicated signed webhook can confirm payment. Failed-payment webhooks restore
reserved stock. Captured payments that do not match a pending order are placed
in `payment_review`; they are never silently marked fulfilled.

MongoDB transactions require a replica set (the Compose setup provides one;
Atlas deployments are replica sets). The current catalog contains sample
prices, and there are no verified product records in this workspace, so
checkout remains disabled and no order/payment can currently be created. The
readiness endpoint also deliberately blocks checkout until pending-payment
inventory reservations can be expired and reconciled; no scheduled worker is
implemented or configured in this project yet.

## Brand assets and market data

- The original logo is kept at
  [`public/images/spices-cart-logo.png`](public/images/spices-cart-logo.png).
- Licensed spice-photo attributions are listed in
  [`public/spice-images/credits.md`](public/spice-images/credits.md).
- Market and retail CSV formats and limitations are documented in
  [`docs/market-prices.md`](docs/market-prices.md). Imported values are local
  previews only; no official live feed or shared price database is connected.
- Product card prices are sample listing values. They are not verified store
  prices, MRP, discounts, or market prices.

## Configuration and production blockers

The API requires `MONGODB_URI` and `SESSION_SECRET`. See `.env.example`; never
commit `.env` or expose server secrets through Vite environment variables.
Browser storage holds local preview cart, wishlist, and language preferences;
it is not authoritative inventory, customer storage, or checkout input.

Before launch, the store owner must supply real product descriptions,
ingredients, SKU/stock, verified selling prices, contact details, shipping
and returns policies, and approved product imagery. The app does not invent
these details or treat the sample catalog as orderable inventory.

### Checkout and payments

Razorpay Checkout (test-mode integration) is implemented, but checkout is
currently blocked even if the other settings are supplied: pending-payment
inventory reservations do not yet have an automated expiry and reconciliation
process. This intentional readiness blocker prevents abandoned payments from
holding stock indefinitely. Do not remove it or enable customer orders until a
reliable reconciliation workflow has been implemented, tested, and scheduled.
The server also requires `CHECKOUT_ENABLED=true`, test-mode Razorpay key
ID/secret/webhook secret, genuine store/legal/contact details, HTTPS policy
URLs, verified shipping/tax values, a connected MongoDB replica set, and active
database catalog records. Once the operational blocker is resolved, set the
Razorpay dashboard webhook URL to `/api/payments/razorpay/webhook` and
subscribe to `payment.captured` and `payment.failed`. Keep
`RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` server-side; only the
public key ID is sent to the browser after the readiness gate passes.
`RAZORPAY_MODE=live` additionally requires production mode and explicit
`ENABLE_LIVE_PAYMENTS=true`; do not enable it until the entire real-order
launch checklist has been approved.

The API routes are `POST /api/checkout/orders`,
`POST /api/checkout/verify`, and authenticated `GET /api/orders/:id`. The
customer must be signed in, accept policies, and supply a validated Indian
delivery address. The server never accepts a client-supplied price or paid
status. Use Razorpay's test dashboard credentials and test webhook secret for
test payments; there is no simulated payment success.

### Local test checklist

1. Start MongoDB and the app with the local instructions above. The first
   `/api/checkout/config` response should report disabled checkout and the
   missing configuration reasons. This is expected; `/api/health` verifies DB
   connectivity.
2. Browse `/api/products` and `/api/products/black-pepper`. Entries without
   owner-reviewed MongoDB data must say `isDemo: true` and `orderable: false`.
3. Register/sign in, use the cart page to add/update/remove items, and verify
   `/api/cart` responses. For an orderable cart test, authenticate an
   allowlisted admin and use `PUT /api/admin/products/:id` with owner-verified
   price/stock source notes; do not copy sample prices into MongoDB as real
   prices.
4. `/checkout` must continue to report the pending-inventory reconciliation
   blocker. Do not set `CHECKOUT_ENABLED=true` to bypass it. After a tested,
   scheduled reconciliation process is implemented, configure Razorpay test
   credentials, webhook events, HTTPS policy URLs, verified store settings,
   tax/shipping, and `CHECKOUT_ENABLED=true` only in a protected test
   environment. Test captured and failed payments and verify orders and
   inventory against MongoDB before considering launch.
5. The current workspace has no MongoDB URI, Razorpay credentials, or Docker
   executable, so live database transaction and payment-provider tests cannot
   run here. Never interpret the unit tests as proof of a real Razorpay
   payment.

### Market prices, email, and media

Use an official/authorized market data source and retain source, units, and
observation timestamps; do not scrape pages without permission. The current
CSV importer does not publish or persist observations. No email, WhatsApp/SMS,
AI, shipping, Cloudinary, or analytics provider is configured. Add credentials
only alongside a server-side integration and document its access controls.

## Deployment

### Recommended: one Node service and one origin

The included Dockerfile builds the frontend and API into one service. Serving
both at the same HTTPS origin keeps session cookies and `/api` requests
same-origin without a cross-domain cookie workaround. Create a MongoDB database
(for example, Atlas), then deploy this repository to a container-capable Node
host using the repository's `Dockerfile`. The host should:

- Use the Dockerfile to build and run the application.
- Provide a persistent `MONGODB_URI` reachable from the service.
- Set `SESSION_SECRET` to a unique random value of at least 32 characters.
- Set `CLIENT_ORIGIN` to the exact public origin, for example
  `https://your-store.example` (no trailing slash).
- Supply `PORT` if required by the host; the API listens on `0.0.0.0` in
  production.
- Route HTTPS traffic to the container's assigned port.

The API serves the production SPA from `dist/`, provides SPA fallback routing,
and exposes `GET /api/health` for health checks. For Vercel, add the app as a
static frontend with an `/api` serverless entry (`api/index.js`) and set
`MONGODB_URI`, `SESSION_SECRET`, and `CLIENT_ORIGIN` in the Vercel project
environment. The health check reports unavailable until MongoDB is connected.
Container build and run locally:

```powershell
docker build -t spice-cart .
docker run --rm -p 5000:5000 -e PORT=5000 -e MONGODB_URI="your-mongodb-uri" -e SESSION_SECRET="your-unique-random-secret" -e CLIENT_ORIGIN="http://localhost:5000" spice-cart
```

Generate a strong secret with Node.js:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Do not put production secrets in the repository, Dockerfile, image build
arguments, or frontend variables. Add them only in the hosting provider's
server-side environment settings. Allowlist the host's outbound IPs in the
MongoDB firewall as required; avoid opening the database to all networks.
Enable HTTPS and verify the deployed `GET /api/health` before using accounts.

### Separate static frontend and API hosts

This is not the recommended setup because authentication cookies require
careful same-site and cross-origin configuration. If the frontend and API are
on different hostnames, a simple Vite `/api` development proxy is not present
in production. Configure a same-origin reverse proxy for `/api` and the
frontend, or implement and review an explicit cross-origin cookie deployment
before launch. Do not assume `CLIENT_ORIGIN` alone makes cross-site session
cookies work.

### Vercel deployment

This repository includes `vercel.json` and `api/index.js` for a Vercel
frontend/API deployment. Import the GitHub repository as a Vercel project and
use these settings:

- Framework preset: Vite
- Root directory: `.`
- Install command: `npm ci`
- Build command: `npm run build`
- Output directory: `dist`
- Node.js version: 20.x or newer

Add these server-side environment variables for Production:

- `MONGODB_URI`: the MongoDB connection string for the production database.
- `SESSION_SECRET`: a unique random value containing at least 32 characters.
- `CLIENT_ORIGIN`: the exact public origin, with no trailing slash. For the
  current Vercel URL, use `https://spices-swart-six.vercel.app`.

Add environment variables in Vercel Project Settings → Environment Variables,
then redeploy after changing them. Do not commit secrets or put them in
`VITE_*` variables. If Preview deployments need authenticated API access, set
`CLIENT_ORIGIN` there to that exact preview deployment origin as well.

The frontend can be deployed as a storefront preview without these database
variables, but account and server-cart APIs will not work. The catalog still
contains sample prices and checkout remains disabled; adding Razorpay
credentials alone does not make it safe to accept orders. Confirm prices,
inventory, shipping charges and regions, tax, and store policies before
enabling real checkout.

### Storefront launch limitations

Deploying the application does not make it ready to accept orders. Before
sales, the owner must enter/verify each product and inventory record, supply
the genuine legal/trading business name and contact details, publish and review
all policies, establish delivery regions/rates and tax treatment, configure
production MongoDB replica-set access, prove test payments and webhook
delivery, and complete operational monitoring/refund/reconciliation plans.
Email verification, password reset, shipping-carrier integration, and
automated customer notifications are not configured.
