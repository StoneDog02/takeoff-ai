# DNS setup: projxmanager.com (GoDaddy → Netlify + Resend)

You own **projxmanager.com** at GoDaddy. This guide gets the site live on Netlify and email sending set up in Resend by adding the right DNS records in GoDaddy.

**Strategy:** Keep DNS at GoDaddy and add records there. No need to export/import “all” records—you only add what Netlify and Resend need.

---

## 1. Back up current GoDaddy DNS (optional)

1. Log in to [GoDaddy](https://www.godaddy.com) → **My Products**.
2. Find **projxmanager.com** → **DNS** (or **Manage DNS**).
3. Note or screenshot existing records, especially:
   - Any **A** or **CNAME** for `@` or `www`
   - Any **MX** (if you use email at this domain elsewhere)
   - Any **TXT** (e.g. verification, SPF)

You’ll add new records in the next steps; avoid deleting MX/TXT that other services need.

---

## 2. Netlify: connect the domain and get DNS values

1. In [Netlify](https://app.netlify.com): open your site → **Domain management** (or **Site configuration** → **Domains**).
2. **Add custom domain** → enter `projxmanager.com` and add `www.projxmanager.com` if you want both.
3. Netlify will show you which records to use. Typically:
   - **A record (apex)**  
     - Name/host: `@`  
     - Value: Netlify’s load balancer IP (e.g. **75.2.60.5** — confirm in Netlify’s UI, as it can change).
   - **CNAME (www)**  
     - Name/host: `www`  
     - Value: `[your-site-name].netlify.app` (exact value from Netlify).

4. Leave this tab open; you’ll add these in GoDaddy in step 4.

---

## 3. Resend: add domain and get DNS records

1. In [Resend](https://resend.com): **Domains** → **Add Domain**.
2. Enter **projxmanager.com** (or a subdomain like **send.projxmanager.com** — subdomains are recommended for sending).
3. Resend will show:
   - **DKIM**: one or more **TXT** records (e.g. name `resend._domainkey` or similar, value = long string).
   - **SPF**: a **TXT** record (e.g. name `@` or your subdomain, value like `v=spf1 include:resend.com ~all` or similar).
   - Optionally **MX** for return-path (if Resend shows it; often for a subdomain like `send`).

Write down or keep the Resend tab open; you’ll add these in GoDaddy in step 4.

**If you use a subdomain (e.g. `send.projxmanager.com`):**  
- In GoDaddy, create records **for that subdomain** (e.g. host `send` for MX/SPF, and the DKIM host Resend gives you).

---

## 4. Add records in GoDaddy

In GoDaddy DNS for **projxmanager.com**:

### 4.1 Netlify (site)

- Remove any existing **A** or **CNAME** for `@` that point elsewhere (so only Netlify’s A is used).
- **A**  
  - Name: `@`  
  - Value: `75.2.60.5` (or the IP Netlify shows)  
  - TTL: 600 or 1 Hour  
- **CNAME**  
  - Name: `www`  
  - Value: `[your-site-name].netlify.app`  
  - TTL: 600 or 1 Hour  

### 4.2 Resend (email)

Add exactly what Resend shows. Example pattern:

- **TXT** (SPF)  
  - Name: `@` (or `send` if you use subdomain `send.projxmanager.com`)  
  - Value: (paste from Resend, e.g. `v=spf1 include:resend.com ~all`)  
  - If you already have an SPF record, merge into one TXT; do not create two SPF records for the same name.
- **TXT** (DKIM)  
  - Name: (from Resend, e.g. `resend._domainkey`)  
  - Value: (long string from Resend)  
- **MX** (only if Resend shows one)  
  - Name: e.g. `send`  
  - Value and priority: as shown in Resend  

Save all changes.

---

## 5. Wait and verify

- **Netlify:** Propagation often 5–60 minutes; sometimes up to 24–48 hours. In Netlify, **Domain management** will show when the domain is verified and when HTTPS is provisioned.
- **Resend:** In **Domains**, click **Verify**; DKIM/SPF can take 5–15 minutes (up to 48 hours in rare cases).

---

## 6. App and env config

- **Supabase:** In **Authentication → URL Configuration**, set **Site URL** to `https://projxmanager.com` and add `https://projxmanager.com/auth/callback` to **Redirect URLs** (see `docs/SUPABASE_EMAIL_AND_REDIRECT.md`).
- **Resend:** In Netlify (or your server env), set:
  - `APP_ORIGIN=https://projxmanager.com`
  - `INVITE_EMAIL_FROM=Proj-X <noreply@projxmanager.com>` (or `noreply@send.projxmanager.com` if you verified a subdomain).

Use the same “from” domain/subdomain you verified in Resend.

---

## Summary

| Purpose   | Where it’s set | What you do |
|----------|----------------|-------------|
| Site     | Netlify        | Add domain in Netlify, then in GoDaddy: A for `@`, CNAME for `www`. |
| Email    | Resend         | Add domain in Resend, then in GoDaddy: TXT (SPF), TXT (DKIM), MX if required. |
| DNS host | GoDaddy        | Keep DNS here; add only the records above (and keep any existing MX/TXT you need). |

You don’t have to “export” all DNS from GoDaddy—just add the records Netlify and Resend give you and leave other records (e.g. existing MX) unchanged unless they conflict.
