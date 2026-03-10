# Takeoff AI

Build plan material list takeoff app for GCs: upload plans, get an organized material list via Claude (Anthropic API).

## Stack

- **Client**: React 18, Vite, React Router 7, Tailwind
- **Server**: Node, Express, Anthropic API, Supabase (optional)
- **Theme**: Single source in `client/src/theme/theme.css`

## Setup

1. **Install**

   ```bash
   npm install
   cd client && npm install && cd ..
   cd server && npm install && cd ..
   ```

2. **Environment**

   Copy `.env.example` to `.env` and set:

   - `ANTHROPIC_API_KEY` – required for takeoff
   - `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_URL`) – optional; if set, takeoffs are stored and listed in Build Lists
   - `PORT` – server port (default 3001)
   - **Invite emails**: Employee invite emails use [Resend](https://resend.com). Set `RESEND_API_KEY` and `APP_ORIGIN` (e.g. `http://localhost:5173` or your production URL) to send invite emails when adding employees or inviting to the portal.

3. **Supabase (optional)**

   - Create a project at [supabase.com](https://supabase.com)
   - Run `server/db/schema.sql` in the SQL editor to create the `takeoffs` table
   - Add the project URL and service role key to `.env`

4. **Prompts**

   Edit `server/prompts/system-instruction.txt` and `server/prompts/rulebook.txt` to match your custom instruction and rulebook.

## Run

- **Dev** (client + server): `npm run dev`
- **Client only**: `npm run dev:client` (Vite, port 5173; proxy `/api` to server)
- **Server only**: `npm run dev:server` (Express, port 3001)

Then open [http://localhost:5173](http://localhost:5173).

## Deploy to Netlify

The frontend deploys from this repo: connect the repo to [Netlify](https://netlify.com), and each push will build and publish the client to a generic Netlify URL.

- **Build**: Netlify uses the root `npm run build` and publishes `client/dist` (see [netlify.toml](netlify.toml)).
- **Env vars** (set in Netlify UI): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. If the API runs on another host (e.g. Render), set `VITE_API_URL` to that URL (no trailing slash) so the client calls it for all `/api` requests.
- **Backend**: The Express server is not run on Netlify. Deploy it separately (e.g. [Render](https://render.com) free tier: same repo, start command `node server/index.js`, set `PORT` and server env vars). Then set that backend URL as `VITE_API_URL` in Netlify and set `APP_ORIGIN` on the server to your Netlify site URL.
- **Alternative**: Instead of `VITE_API_URL`, you can add a Netlify redirect that proxies `/api/*` to your backend (e.g. `https://your-backend.onrender.com/api/:splat` with status 200); the client keeps using relative `/api` and no code change is needed.

## Routes

- `/takeoff` – Upload plan (PDF/image), run takeoff, redirect to build list
- `/build-lists` – List past takeoffs (requires Supabase)
- `/build-lists/:id` – View material list for a takeoff

## Theme

Colors and layout are defined in `client/src/theme/theme.css` (CSS variables). Tailwind is extended from those variables in `client/tailwind.config.js` so changing the theme file updates the whole app.
