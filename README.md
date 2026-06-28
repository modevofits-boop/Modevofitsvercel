# Modevofits — storefront + admin (Vercel)

The full store: a customer-facing storefront **and** an admin dashboard where you add
products, edit prices/stock, and see incoming orders — no code edits, no redeploys.

- **Storefront:** `/` (your domain root)
- **Admin:** `/admin`

It runs on Vercel using serverless functions (`/api`) and an **Upstash Redis** database
connected from the Vercel dashboard. The catalogue seeds itself on first visit.

```
index.html        Storefront (reads catalogue from the API)
admin/index.html  Admin dashboard (login-protected)
api/public.js     GET products / single product / settings  (public)
api/order.js      POST a new order                          (public)
api/admin.js      Login + products/orders/settings/stats    (auth required)
lib/db.js         Database layer (Upstash Redis) + seed data
lib/auth.js       Admin login + session cookie
vercel.json       Headers / clean URLs
```

---

## One-time setup (≈ 5 minutes)

### 1. Get the project into Vercel
**Option A — GitHub (recommended):** push this folder to a GitHub repo, then in Vercel:
**Add New → Project → Import** the repo. Framework preset: **Other**. No build command,
no output directory. Don't deploy yet — do step 2 first (or redeploy after).

**Option B — CLI:**
```bash
npm i -g vercel
cd modevofits-app
vercel        # links/creates the project
```

### 2. Connect the database (Upstash Redis)
In your Vercel project → **Storage** tab → **Connect Database** → choose **Upstash → Redis**
(it's in the Marketplace, free tier is fine) → create it and **connect it to this project**.

Vercel automatically injects the credentials (`UPSTASH_REDIS_REST_URL` and
`UPSTASH_REDIS_REST_TOKEN`) as environment variables — you don't copy anything by hand.

> Note: Vercel's old "Vercel KV / Vercel Postgres" products were retired; Upstash via the
> Marketplace is the current path, and `@upstash/redis` (already in package.json) reads those
> injected variables automatically.

### 3. Add three environment variables
Project → **Settings → Environment Variables** → add:

| Name | Value |
|------|-------|
| `ADMIN_USERNAME` | your admin login name |
| `ADMIN_PASSWORD` | a strong password |
| `JWT_SECRET` | a long random string (e.g. from `openssl rand -hex 32`) |

(Optionally set `NODE_ENV=production` so the session cookie is marked Secure.)

### 4. Deploy
Trigger a deploy (push to GitHub, or `vercel --prod`). On the first visit the store seeds
its starting catalogue into the database automatically.

---

## How you operate the store (the part you asked about)

1. Go to **`yourdomain.com/admin`** and sign in with the username/password you set.
2. **Products tab** → **+ Add product** to create one (name, category, garment shape, price,
   compare-at price, stock, colours, description, image URL, Active/Featured). Or click
   **Edit** on any product to change it, **Delete** to remove it.
3. Press **Save** — the change is written to the database and is **live on the storefront
   immediately**. No code, no redeploy.
4. **Orders tab** → every order customers place appears here with their details and items;
   change an order's status (pending → confirmed → shipped → delivered) as you fulfil it.
5. **Settings tab** → store name, announcement bar, free-delivery threshold, delivery fees.

That's the whole loop: customer buys → order lands in your admin → you fulfil it.

---

## Good to know

- **Adding a product is now a UI action**, not a file edit. The storefront pulls its
  catalogue from the database on every load, so saves appear right away.
- **Safety net:** if the API/database is ever unreachable, the storefront falls back to a
  built-in copy of the catalogue so it never shows an empty page.
- **Payments:** orders are cash-on-delivery; the card option at checkout is a labelled demo
  (no real charge) until you connect a payment provider.
- **Images:** products use the garment graphic by default; paste an Image URL in the admin to
  show a real photo. (Hosted file uploads can be added later via Vercel Blob.)
- **What was tested:** all API logic (auth, product CRUD, order creation + stock, settings)
  was verified against an in-memory database. The live Upstash connection is established by
  step 2 above and can only be confirmed once you connect it in your own Vercel account.
