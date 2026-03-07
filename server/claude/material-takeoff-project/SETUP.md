# Material takeoff custom project — step-by-step setup

Follow these steps to wire up and test the Takeoff tab on a project detail page.

---

## 1. Environment variables

In the project root, ensure `.env` exists (copy from `.env.example` if needed) and set:

| Variable | Required | Notes |
|----------|----------|--------|
| `ANTHROPIC_API_KEY` | Yes | Your Anthropic API key (for Claude). Required for takeoff to run. |
| `VITE_SUPABASE_URL` | Yes* | Your Supabase project URL (e.g. `https://xxx.supabase.co`). |
| `VITE_SUPABASE_ANON_KEY` | Yes* | Supabase anon/public key (used by the client for auth and API calls). |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes* | Supabase service role key (used by the server for DB access). |
| `PORT` | No | Server port; default `3001`. |

\* Required to use Projects and the Takeoff tab. Without Supabase, the project detail page and launch-takeoff will return 503/401.

---

## 2. Supabase: project and migrations

1. Create a Supabase project at [supabase.com](https://supabase.com) if you don’t have one.
2. In the Supabase dashboard, open **SQL Editor** and run the migrations in order (so tables and RLS exist):
   - `supabase/migrations/20260303000000_create_projects_and_related_tables.sql` (includes `projects`, `project_takeoffs`)
   - Any other migrations you need for the app.
3. In **Settings → API**, copy:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** key → `VITE_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`
4. Put those values into your root `.env` and restart the server so it picks them up.

---

## 3. Custom project instructions and knowledge

1. **Instructions**  
   Open `server/claude/material-takeoff-project/instructions.txt` and replace the placeholder with the **exact instructions** from your Claude custom project (the system prompt / custom instructions you use there).

2. **Reference files**  
   Put any reference files (specs, unit conventions, trade lists, etc.) into:
   ```text
   server/claude/material-takeoff-project/knowledge/
   ```
   - Use plain text formats (e.g. `.txt`, `.md`).
   - They are loaded in **alphabetical order** and injected into the system prompt.
   - You can add or remove files anytime; no code changes needed.

The app will always append the required JSON output format to your instructions so responses work with the Takeoff tab and database.

---

## 4. Install and run

From the repo root:

```bash
npm install
cd client && npm install && cd ..
cd server && npm install && cd ..
```

Start client and server:

```bash
npm run dev
```

- Client: [http://localhost:5173](http://localhost:5173)
- Server: [http://localhost:3001](http://localhost:3001)

---

## 5. Sign in and create a project

1. Open [http://localhost:5173](http://localhost:5173).
2. **Sign up** or **Sign in** (Supabase Auth). The Takeoff tab and project APIs require an authenticated user.
3. Go to **Projects** (or the main app area where projects are listed).
4. Create a new project or open an existing one.

---

## 6. Test the Takeoff tab

1. Open a **project detail** page.
2. Click the **Takeoff** sub-tab.
3. In **Launch Takeoff**:
   - Click the upload area and choose a **PDF** (or image) of plans/blueprints.
   - Click **Run takeoff**.
4. Wait for the request to finish (Claude runs on the server). The table below will show the material list (categories, description, qty, unit, trade, est. cost).

If something fails:

- **401 Unauthorized** — Not signed in or Supabase auth keys/URL wrong.
- **503 Database not configured** — Supabase URL or service role key missing/wrong in `.env`.
- **ANTHROPIC_API_KEY is not set** — Add your Anthropic API key to `.env` and restart the server.
- **Project not found** — You’re not the owner of that project, or the project doesn’t exist in Supabase.

---

## 7. Optional: use the same behavior on the standalone Takeoff page

The **project detail → Takeoff tab** already uses your custom project (instructions + knowledge).  
The standalone **Takeoff** page (`/takeoff`) still uses the legacy prompts in `server/prompts/`.

To make `/takeoff` use the same custom project:

- In `server/routes/takeoff.js`, change the call to `runTakeoff` to pass `{ useCustomProject: true }` (e.g. `runTakeoff(req.file.buffer, req.file.mimetype, { useCustomProject: true })`).

---

## Summary checklist

- [ ] `.env` has `ANTHROPIC_API_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Supabase migrations run (at least `projects` and `project_takeoffs`)
- [ ] `material-takeoff-project/instructions.txt` contains your custom project instructions
- [ ] Reference files (if any) are in `material-takeoff-project/knowledge/`
- [ ] `npm run dev` and sign in at [http://localhost:5173](http://localhost:5173)
- [ ] Open a project → Takeoff tab → upload PDF → Run takeoff
