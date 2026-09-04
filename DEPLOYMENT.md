# Deploying BOS

Work through these in order. Steps 1–5 are blockers: the system will lose or
corrupt data without them. Steps 6–10 are the deployment itself. Steps 11–12 are
things to do before real staff use it in anger.

Nothing here is automated on purpose — each step has a decision in it.

---

## Blockers

### 1. Accounting migration — done

All of accounting is on Postgres: customers, products, quotations, invoices,
line items, payments, expenses, sales, credit notes (with their applications),
recurring templates, and document numbering. Reports derives from those.

Nothing to do here. Kept as step 1 because the next two are the same class of
problem and are not done.

### 2. HR and payroll migration — done

Employees, departments, leave requests, leave balances and payroll entries are
all on Postgres, behind the same row level security as everything else. Verified
that an employee without `hrm.payroll` sees no payroll rows and no salary
figures, and cannot write one.

Employee documents are in the private `employee-documents` bucket, with the
`attachments` table as the index and short-lived signed links to open them —
there is no permanent URL to leak. Bank details are captured on the employee
form and the payroll bank export builds a real file from them.

Leave is no longer visible company-wide: an employee sees only their own
requests and balances, HR and managers (hrm.leave `full`) see everyone's. That
depends on each employee record being linked to a login, which is done on the
employee form under **System Access**.

**Link everyone before go-live.** An unlinked employee cannot see their own
leave or balance — the page just looks empty to them. A banner on the Employees
page names anyone still unlinked. As a safety net during the rollout, a person
can always see a request they submitted themselves, even before they are
linked; balances have no such fallback.

Bank details sit in their own table, not on `employees`, because row level
security in Postgres is per row and not per column: the staff directory has to
stay readable without exposing where colleagues are paid. Verified that a user
with employee access but no payroll access sees the directory and no account
numbers.

### 3. Company settings — done

The company name, address, banking details, brand colours, logo and signature
are one shared row in Postgres, readable by everyone signed in and writable only
with `settings` edit. They were per-machine, so an invoice sent from a second
computer went out with no banking block and the default company name.

The logo and signature are files in the `company-assets` bucket, which is public
to read — the logo appears on the login page, where there is no session yet to
authorise a private link. Writing is still restricted to administrators.

Set these once after deploying, before anyone sends a document.

### 4. Configure SMTP — the last blocker

Email confirmation is **on** in `supabase/config.toml`, along with
`secure_password_change` and a 60-second limit between reset emails. Verified
locally: a new signup gets no session, sign-in is refused with
`email_not_confirmed`, and the confirmation email is sent.

What is left is delivery. Locally, mail is caught by Mailpit
(http://127.0.0.1:54424), which is why this works in development with nothing
configured. **A hosted project has no such catcher.** Without a real SMTP
provider, confirmation and reset emails are never delivered, and since
confirmation is now required, nobody can complete a signup or recover an
account.

Set it in the hosted project's dashboard under **Authentication → SMTP
Settings**, not in `config.toml` — that file is committed and the password must
not be. Then send yourself a test signup and confirm the mail arrives before
letting anyone else register.

### 5. Dependency vulnerabilities — done

`npm audit --omit=dev` reports **0 vulnerabilities**. The three high-severity
ones were patched in place; the two moderate React Router advisories needed the
major upgrade to v7, which was taken and verified across 24 routes.

Re-run `npm audit --omit=dev` before each deploy — this only stays true if
somebody keeps checking.

---

## Deployment

### 6. Create the hosted Supabase project

`project_id = "bos"` in `supabase/config.toml` refers to the local Docker stack.
Create a hosted project, then link and push:

```bash
npx supabase link --project-ref <your-project-ref>
```

```bash
npx supabase db push
```

`db push` applies the migrations. It does **not** run `seed.sql`, which is
correct — that file contains development accounts with a known password and
must never reach production.

### 7. Create the first administrator by hand

There is a bootstrap problem: a new signup is `pending` and needs an
administrator to approve it, and a fresh database has none.

Create the user in the Supabase dashboard (Authentication → Add user, with
"Auto Confirm" on), then promote them in the SQL editor:

```sql
update public.profiles
set status = 'active', role_id = 'role_super_admin'
where email = 'you@yourcompany.co.za';
```

Every other account is then created through the app.

### 8. Deploy the edge functions

Two things cannot happen in a browser — creating another user's account needs
the service key, and sending mail needs SMTP credentials:

```bash
npx supabase functions deploy admin-create-user send-email
```

Then set the mail credentials as **function secrets**, never in the repo:

```bash
npx supabase secrets set SMTP_HOST=smtp.yourprovider.com SMTP_PORT=465 SMTP_USER=... SMTP_PASSWORD=... SMTP_FROM=billing@yourcompany.co.za SMTP_FROM_NAME="Your Company"
```

Use port 465 if you set a username and password: the function refuses to send
credentials over a non-TLS port rather than leaking them. A relay that needs no
login can omit `SMTP_USER` and `SMTP_PASSWORD`.

Without `send-email` deployed and configured, emailing an invoice fails with a
message saying exactly which secrets are missing — it does not fail silently.

### 9. Build and host the front end

`Dockerfile`, `nginx.conf` and `fly.toml` are in the repo and the image has been
built and served locally. `base` is `/`; it used to be `/bos/` for GitHub Pages,
which 404s every asset on a host that serves from the domain root.

Create the app once:

```bash
fly launch --no-deploy --name bos --region jnb
```

Then deploy, passing the Supabase values as **build arguments**:

```bash
fly deploy --build-arg VITE_SUPABASE_URL=https://<ref>.supabase.co --build-arg VITE_SUPABASE_ANON_KEY=<anon-key>
```

They are build arguments and not Fly secrets because Vite compiles them into
the bundle: by the time a secret would be read, the JavaScript is already
written. Changing either needs a rebuild, not a restart. The build fails fast if
they are missing, rather than shipping a bundle that throws on load.

The anon key belongs in the bundle — it is public by design and every request it
makes is still subject to row level security. The **service role key must never
be built into the front end**; it exists only in the edge function's
environment, where Supabase sets it.

nginx serves `index.html` for unknown paths, so a refresh on
`/accounting/invoices` works. Verified: that path returns the app shell, while a
missing asset still returns 404 rather than being masked by the fallback.

### 10. Point Supabase at the deployed URL

In Authentication → URL Configuration, set the Site URL to the Fly hostname and
add `https://<app>.fly.dev/auth/reset` to the redirect allow-list. Password
reset links will not work otherwise.

---

## Before real use

### 11. Import the existing data, once

Whoever has the real data in their browser signs in on **that machine** and uses
the banner on the Invoices page. Order matters:

1. Sign in as an administrator on the browser holding the data.
2. Import, and read the report — it lists per-record failures rather than
   claiming a total.
3. Check the figures against what you expect before choosing "set the local copy
   aside".

The import is keyed by original id, so running it twice updates rather than
duplicates. The local copy is renamed, not deleted.

### 12. Take a backup and prove you can restore it

Supabase takes daily backups on paid plans. Before trusting it, do one restore
into a scratch project. A backup you have never restored is a hypothesis.

### 13. Receiving email (optional)

Sending works with SMTP alone. Receiving needs a provider to take delivery for
your domain and post each message to the `receive-email` function.

1. Deploy the function. It is the one endpoint that does not require a signed-in
   caller, because a mail provider has no session:

   ```
   supabase functions deploy receive-email --no-verify-jwt
   ```

2. Invent a long random secret and set it. This is the only thing standing
   between your inbox and anyone who learns the URL, so treat it like a
   password:

   ```
   supabase secrets set INBOUND_EMAIL_SECRET="$(openssl rand -hex 32)"
   ```

3. Point a provider at it. The URL is
   `https://<project>.supabase.co/functions/v1/receive-email`, and the secret
   goes in an `x-inbound-secret` header, or as `?secret=…` if the provider
   cannot set headers.

   - **SendGrid** — Inbound Parse, pointed at a subdomain such as
     `mail.yourcompany.co.za`, with an MX record for it.
   - **Mailgun** — a Route with a `forward()` action.
   - **Postmark** — an inbound stream's webhook.

   All three post a format the function reads.

4. Send a test message to the address and watch it appear in Email → Inbox.

The function stores only the plain text part of each message, records what the
provider says about SPF and DKIM, and the app shows a warning on anything that
fails those checks. Do not remove that warning: an email claiming to be your own
accounts address, asking for bank details to be changed, is the most common
invoice fraud there is, and the SPF result is what distinguishes it.

---

## Known gaps at launch

State these to whoever is using the system, rather than letting them discover
them:

- **Two-factor authentication is real now.** A role with "require 2FA" forces
  enrolment before the app can be used, and a user with an authenticator is
  asked for a code at every sign-in. Turning it on for a role locks anyone in
  that role out of the app until they enrol, which is the intent — say so before
  switching it on.

- **There is no restore button, by design.** Settings → Export data downloads a
  copy of the records to keep off the system; it is not restorable. Restoring
  is a Postgres restore or point-in-time recovery on the Supabase project
  (step 12). The old "Backup & Restore" panel kept its snapshots in
  localStorage — inside the thing it was backing up, doubling in size each
  time — and its import silently did nothing while reporting success.
- **Inbound email needs a provider and a domain.** Until you do step 13 the
  inbox is empty and says so; sending works regardless.
- **"System lockdown" ends only the current session.** Revoking everyone else's
  needs an admin API call the browser cannot make.
- **108 lint errors**, mostly `no-explicit-any`. Not user-visible, but they are
  where type errors hide.
- **Typecheck with `npx tsc -p tsconfig.app.json --noEmit`.** The bare
  `npx tsc --noEmit` compiles nothing: the root config has `"files": []` and
  only project references, so it always passes.
