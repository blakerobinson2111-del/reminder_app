# Quiet Reminders

A small reminder app that runs entirely on Cloudflare Workers: a page to add
reminders, KV storage to hold them, and a scheduled job that emails you when
one comes due.

## Why an email API is needed

Cloudflare Workers have no built-in "send an email" function. This project
uses [Resend](https://resend.com), which has a free tier (100 emails/day)
and a very simple API. You could swap in another provider (SendGrid,
Postmark, Mailgun) by editing the `sendReminderEmail` function in
`src/index.js` — the rest of the app doesn't need to change.

## Setup

**1. Install Wrangler (Cloudflare's CLI), if you don't have it:**
```
npm install -g wrangler
wrangler login
```

**2. Create the KV namespace that stores reminders:**
```
wrangler kv namespace create REMINDERS
```
This prints an `id`. Copy it into `wrangler.toml`, replacing
`REPLACE_WITH_KV_ID`.

**3. Create a free Resend account:**
- Sign up at https://resend.com.
- Grab an API key from the Resend dashboard.
- **Important limitation:** without verifying a domain, Resend only lets you
  send from `onboarding@resend.dev`, and only *to* the email address on your
  own Resend account — no matter what recipient you type into the app. This
  is fine for testing with your own inbox, but to actually send reminders to
  whatever address you type per-reminder (the point of this update), you
  need to verify a domain you own in Resend (Resend dashboard → Domains →
  Add Domain, then add the DNS records it gives you). Once verified, set
  `FROM_EMAIL` in `wrangler.toml` to an address on that domain, e.g.
  `reminders@yourdomain.com`, and Resend will let you send to any recipient.

**4. Add the API key as a secret** (don't put it in wrangler.toml directly):
```
wrangler secret put RESEND_API_KEY
```
Paste the key when prompted.

**5. Check `wrangler.toml`:**
- `FROM_EMAIL` — `onboarding@resend.dev` works out of the box for sending to
  your own Resend account email only; change once you verify your own domain
  (see step 3) so you can send to any recipient.
- The `crons` schedule checks for due reminders every 5 minutes. Change
  `*/5 * * * *` to `* * * * *` for every minute if you want tighter timing.

**6. Deploy:**
```
wrangler deploy
```

Wrangler prints a URL like `https://quiet-reminders.<your-subdomain>.workers.dev`.
Open it, add a reminder, and wait for the scheduled job to catch it (or
temporarily set the cron to `* * * * *` while testing).

## How it works

- `src/index.js` serves the HTML/CSS/JS page at `/`, and a small JSON API:
  - `GET /api/reminders` — list all reminders
  - `POST /api/reminders` — add one (`{ title, notes, datetime, email }`)
  - `DELETE /api/reminders/:id` — remove one
- Each reminder now carries its own recipient `email`, entered in the form
  when you add it — reminders no longer all go to one fixed address.
- Reminders are stored as a single JSON array under the KV key `reminders`.
  Fine for personal use; if you ever need this to scale to many users, move
  to one KV key (or D1 row) per user.
- The `scheduled` handler runs on the cron trigger, finds reminders whose
  time has passed and haven't been emailed yet, sends them via Resend, and
  marks them `sent`.

## Testing locally

```
wrangler dev
```
Note: local `wrangler dev` won't fire the cron trigger automatically. To
test the email-sending path locally, you can temporarily call
`env.scheduled` -like logic yourself, or just deploy and set the cron to
run every minute while you test.
