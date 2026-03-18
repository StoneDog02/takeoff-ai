# Supabase: Email confirmation redirect & custom email template

## 1. Fix “Confirm your mail” link (redirect URL)

The confirmation link in the email must redirect to your app so the app can complete sign-in. Do this in Supabase:

1. Open **Supabase Dashboard** → your project → **Authentication** → **URL Configuration**.
2. Set **Site URL** to your app’s base URL, e.g.:
   - Production: `https://proj-x.netlify.app`
   - Local: `http://localhost:5173` (or whatever port your client uses).
3. Under **Redirect URLs**, add:
   - `https://proj-x.netlify.app/auth/callback`
   - For local testing: `http://localhost:5173/auth/callback`
4. Save.

The app now sends `emailRedirectTo: ${origin}/auth/callback` when signing up, and the `/auth/callback` route establishes the session and redirects to `/dashboard`. Supabase will only redirect to URLs listed in **Redirect URLs**.

---

## 2. Custom email template (Proj-X branding, no “Supabase”)

Use a custom template so the email is from **Proj-X** and uses your styling.

### 2.1 Where to edit

1. **Supabase Dashboard** → **Authentication** → **Email Templates**.
2. Open **Confirm signup**.

### 2.2 Sender and subject

- **Sender name:** `Proj-X` (or “Proj-X Team”).
- **Subject:** e.g. `Confirm your Proj-X account` (you can use the default or customize).

Supabase does not let you change the “from” email address on the free tier (it stays `noreply@...supabase.co`), but the **sender name** is what users see (e.g. “Proj-X” instead of “Supabase”).

### 2.3 Styled HTML body

Replace the default body with the template below. It uses Supabase’s variables and keeps your branding.

**Variables you can use:**

- `{{ .ConfirmationURL }}` – link the user must click to confirm.
- `{{ .Email }}` – user’s email.
- `{{ .Token }}` – raw token (usually you use `ConfirmationURL`).
- `{{ .TokenHash }}` – token hash.
- `{{ .SiteURL }}` – Site URL from URL Configuration.

**Example: Proj-X styled confirm email**

```html
<div style="font-family: 'DM Sans', system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1a1a1a;">
  <div style="margin-bottom: 24px;">
    <strong style="font-size: 20px; color: #0f0f0f;">Proj-X</strong>
  </div>
  <h1 style="font-size: 22px; font-weight: 600; margin: 0 0 16px;">Confirm your email</h1>
  <p style="margin: 0 0 24px; line-height: 1.5; color: #444;">
    Thanks for signing up. Click the button below to confirm your email and get started.
  </p>
  <p style="margin: 0 0 24px;">
    <a href="{{ .ConfirmationURL }}" style="display: inline-block; padding: 12px 24px; background: #0f0f0f; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;">
      Confirm email
    </a>
  </p>
  <p style="font-size: 13px; color: #666;">
    If you didn’t create an account with Proj-X, you can ignore this email.
  </p>
  <p style="font-size: 12px; color: #999; margin-top: 32px;">
    Proj-X
  </p>
</div>
```

Paste that into the **Message (body)** of the Confirm signup template and save. The “Confirm your mail” link will use `{{ .ConfirmationURL }}`, which points to your app’s `/auth/callback` once Redirect URLs are set as in section 1.

---

## 3. Optional: custom SMTP (send from your own domain)

To send from e.g. `noreply@proj-x.com`:

1. **Authentication** → **Providers** → **Email**.
2. Enable **Custom SMTP** and enter your SMTP server (e.g. SendGrid, Postmark, Resend).
3. Use the same **Email Templates** as above; the sender name and body stay the same.

After that, the “from” address will be your domain instead of Supabase.
