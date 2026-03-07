# Full setup guide: Takeoff AI (Anthropic + Supabase + knowledge base)

Use this guide to get the app running end-to-end: environment, database, Anthropic API, and the material takeoff knowledge base. Follow the steps in order.

---

## Step 1. Environment variables

1. In the **project root**, copy the example env file if you don’t have `.env` yet:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and set:

   | Variable | Required | Where to get it |
   |----------|----------|------------------|
   | `ANTHROPIC_API_KEY` | **Yes** (for takeoff) | [Anthropic Console](https://console.anthropic.com/) → API Keys → Create Key. Copy the key and paste here. |
   | `VITE_SUPABASE_URL` | **Yes** (for app) | Supabase project → Settings → API → **Project URL** |
   | `VITE_SUPABASE_ANON_KEY` | **Yes** (for app) | Same page → **anon public** key |
   | `SUPABASE_SERVICE_ROLE_KEY` | **Yes** (for server) | Same page → **service_role** key (keep secret) |
   | `PORT` | No | Server port; default `3001` |

   Leave no quotes around values. Example:
   ```env
   ANTHROPIC_API_KEY=sk-ant-...
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   PORT=3001
   ```

3. Save `.env`. Restart the server after any change so it picks up new values.

---

## Step 2. Supabase project and database

### 2a. Create or open a Supabase project

- Go to [supabase.com](https://supabase.com) and sign in.
- Create a **New project** (or use an existing one). Note the database password; you may need it for direct DB access.
- Wait until the project is fully provisioned.

### 2b. Run migrations (in order)

In the Supabase dashboard, open **SQL Editor** and run each migration file **in this order**. Copy the contents of each file from your repo and execute.

| Order | Migration file | Purpose |
|-------|----------------|---------|
| 1 | `supabase/migrations/20260302000000_create_takeoffs.sql` | Standalone takeoffs table (Build Lists) |
| 2 | `supabase/migrations/20260303000000_create_projects_and_related_tables.sql` | Projects, project_takeoffs, phases, milestones, etc. |
| 3 | `supabase/migrations/20260303100000_create_teams_tables.sql` | Teams-related tables |
| 4 | `supabase/migrations/20260303200000_add_projects_extended_fields.sql` | Extended project fields |
| 5 | `supabase/migrations/20260304100000_create_project_tasks.sql` | Project tasks |
| 6 | `supabase/migrations/20260305000000_create_contractors_table.sql` | Contractors |
| 7 | `supabase/migrations/20260305100000_drop_project_takeoffs_takeoff_id.sql` | Cleanup: remove unused takeoff_id from project_takeoffs |

**If your project already has tables:** Run only migrations that haven’t been applied yet. The last one (`drop_project_takeoffs_takeoff_id`) is safe to run even if the column was already dropped.

### 2c. Copy API keys into `.env`

- In Supabase: **Settings → API**.
- Copy **Project URL** → `VITE_SUPABASE_URL` in `.env`.
- Copy **anon public** → `VITE_SUPABASE_ANON_KEY`.
- Copy **service_role** → `SUPABASE_SERVICE_ROLE_KEY`.
- Save `.env`.

---

## Step 3. Anthropic (Claude) API

1. Go to [console.anthropic.com](https://console.anthropic.com/) and sign in.
2. Open **API Keys** (or **Settings** → API keys).
3. **Create key** and give it a name (e.g. “Takeoff AI”).
4. Copy the key (it starts with `sk-ant-`). You won’t see it again.
5. Paste it into `.env` as `ANTHROPIC_API_KEY=sk-ant-...`.
6. Save `.env`. The server uses this for all takeoff requests (project Takeoff tab and optional standalone Takeoff page).

---

## Step 4. Knowledge base (custom takeoff instructions + reference files)

The **project detail → Takeoff tab** uses your custom instructions and reference files so Claude behaves like your Claude custom project.

### 4a. Instructions (system prompt)

1. Open in your editor:
   ```text
   server/claude/material-takeoff-project/instructions.txt
   ```
2. Replace the placeholder with the **exact instructions** from your Claude custom project (the system prompt / custom instructions you use there).
3. Save the file. The app will append the required JSON output format automatically so responses work with the Takeoff tab and database.

### 4b. Reference files (knowledge)

1. Put any reference documents (specs, unit conventions, trade lists, etc.) in:
   ```text
   server/claude/material-takeoff-project/knowledge/
   ```
2. **Supported formats:** plain text (`.txt`, `.md`, `.csv`, `.json`, `.py`), **PDF** (`.pdf`), **Excel** (`.xlsx`, `.xls`), and **Word** (`.docx`). Text is extracted from PDF/Excel/Word and injected into the prompt. Files are read in **alphabetical order** with clear labels.
3. You can add, edit, or remove files anytime; no code changes needed.

Example layout:
```text
server/claude/material-takeoff-project/
  instructions.txt     ← your full custom project instructions
  knowledge/
    units-and-conventions.txt
    trade-scopes.md
    pricing-sheet.xlsx
    scope-template.docx
    spec.pdf
```

---

## Step 5. Install dependencies and run the app

From the **project root**:

```bash
npm install
cd client && npm install && cd ..
cd server && npm install && cd ..
```

Start client and server:

```bash
npm run dev
```

- **Client:** [http://localhost:5173](http://localhost:5173)
- **Server:** [http://localhost:3001](http://localhost:3001)

---

## Step 6. Sign in and create a project

1. Open [http://localhost:5173](http://localhost:5173) in your browser.
2. **Sign up** or **Sign in** (Supabase Auth). The app and Takeoff tab require an authenticated user.
3. Go to **Projects** (or the main area where projects are listed).
4. **Create a new project** or open an existing one.

---

## Step 7. Test the Takeoff tab (with Anthropic + knowledge base)

1. Open a **project detail** page.
2. Click the **Takeoff** sub-tab.
3. In **Launch Takeoff**:
   - Click the upload area and choose a **PDF** (or image) of plans/blueprints.
   - Click **Run takeoff**.
4. Wait for the request to finish. Claude runs on the server using your `instructions.txt` and all files in `knowledge/`. The table below will show the material list (categories, description, qty, unit, trade, est. cost).

If something fails:

| Symptom | Likely cause | Fix |
|--------|----------------|-----|
| **401 Unauthorized** | Not signed in or wrong Supabase keys | Sign in again; check `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. |
| **503 Database not configured** | Server can’t reach Supabase | Set `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env` and restart server. |
| **ANTHROPIC_API_KEY is not set** | Missing or wrong key | Add valid key to `.env`, restart server. |
| **Project not found** | Wrong project or not owner | Open a project you own. |
| Empty or odd takeoff | Instructions or knowledge need tuning | Edit `instructions.txt` and/or files in `knowledge/`. |

---

## Optional: Use the same takeoff behavior on the standalone Takeoff page

- The **project detail → Takeoff tab** already uses your custom project (instructions + knowledge).
- The standalone **Takeoff** page (`/takeoff`) still uses the legacy prompts in `server/prompts/`.

To make `/takeoff` use the same instructions and knowledge:

1. Open `server/routes/takeoff.js`.
2. Find the line that calls `runTakeoff(req.file.buffer, req.file.mimetype)`.
3. Change it to:
   ```js
   runTakeoff(req.file.buffer, req.file.mimetype, { useCustomProject: true })
   ```
4. Save and restart the server.

---

## Summary checklist

- [ ] **Env:** `.env` has `ANTHROPIC_API_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] **Supabase:** Project created; all migrations run in order; API keys copied to `.env`
- [ ] **Anthropic:** API key created and set in `.env`
- [ ] **Knowledge base:** `server/claude/material-takeoff-project/instructions.txt` has your custom instructions; reference files (if any) in `server/claude/material-takeoff-project/knowledge/`
- [ ] **Run:** `npm run dev`; open [http://localhost:5173](http://localhost:5173); sign in
- [ ] **Test:** Open a project → Takeoff tab → upload PDF → Run takeoff

After this, you’re set to use Anthropic and the knowledge base for takeoffs from the project Takeoff tab (and optionally from the standalone Takeoff page if you made that change).
