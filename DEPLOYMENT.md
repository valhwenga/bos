# Deploying BOS

Work through these in order. Steps 1–4 are blockers: the system will lose or
corrupt data without them. Steps 5–8 are the deployment itself. Steps 9–11 are
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

### 3. Configure SMTP — the last blocker

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

### 4. Dependency vulnerabilities — done

`npm audit --omit=dev` reports **0 vulnerabilities**. The three high-severity
ones were patched in place; the two moderate React Router advisories needed the
major upgrade to v7, which was taken and verified across 24 routes.

Re-run `npm audit --omit=dev` before each deploy — this only stays true if
somebody keeps checking.

---

## Deployment

### 5. Create the hosted Supabase project

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

### 6. Create the first administrator by hand

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

### 7. Deploy the edge function

Creating another user's account needs the service key, which cannot ship to a
browser, so it runs in a function:

```bash
npx supabase functions deploy admin-create-user
```

Without this, "create client login" and any admin-created account will fail.

### 8. Build and host the front end

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

### 9. Point Supabase at the deployed URL

In Authentication → URL Configuration, set the Site URL to the Fly hostname and
add `https://<app>.fly.dev/auth/reset` to the redirect allow-list. Password
reset links will not work otherwise.

---

## Before real use

### 10. Import the existing data, once

Whoever has the real data in their browser signs in on **that machine** and uses
the banner on the Invoices page. Order matters:

1. Sign in as an administrator on the browser holding the data.
2. Import, and read the report — it lists per-record failures rather than
   claiming a total.
3. Check the figures against what you expect before choosing "set the local copy
   aside".

The import is keyed by original id, so running it twice updates rather than
duplicates. The local copy is renamed, not deleted.

### 11. Take a backup and prove you can restore it

Supabase takes daily backups on paid plans. Before trusting it, do one restore
into a scratch project. A backup you have never restored is a hypothesis.

---

## Known gaps at launch

State these to whoever is using the system, rather than letting them discover
them:

- **Two-factor authentication does not work.** `require_2fa` on a role and the
  toggle in user management are both stored and then ignored. Either implement
  it or remove the switches, because a security control that appears to be on
  and is not is worse than one that is visibly off.
- **Workflow, Documents, Analytics and the Support dashboard were restyled but
  never audited.** Expect controls that look functional and are not; that
  pattern was found repeatedly everywhere else in the codebase.
- **The backup export no longer covers everything.** It serialises what the app
  holds in the browser, and most data is in Postgres now. Rely on the database
  and storage backups (step 11), not on this button.
- **"System lockdown" ends only the current session.** Revoking everyone else's
  needs an admin API call the browser cannot make.
- **132 lint errors**, mostly `no-explicit-any`. Not user-visible, but they are
  where type errors hide.
