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

### 2. Migrate HR and payroll, or turn those modules off

`hrmStore`, `payrollStore`, `leaveBalanceStore`, `hrmLeaveStore` and
`employeeDocumentsStore` are all still local. Payroll in particular holds salary
figures and bank details; per-browser is not an acceptable place for those.

If they are not migrated before launch, remove the modules from the roles that
would reach them rather than shipping screens that silently disagree between
users.

### 3. Turn on email confirmation

`supabase/config.toml` has `enable_confirmations = false`, so anyone can
register with an address they do not own. Approval mitigates it, but set:

```toml
[auth.email]
enable_confirmations = true
```

and configure a real SMTP provider under `[auth.email.smtp]`. Without SMTP,
password reset and confirmation emails go nowhere in production — the local
stack only catches them in Mailpit.

### 4. Patch the dependency vulnerabilities

Three high severity in production dependencies:

```bash
npm audit fix
```

Re-run the build and tests afterwards; if `audit fix` wants a major bump, take
it deliberately rather than with `--force`.

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

Fly serves the built static files. Two things to change first.

**The base path.** `vite.config.ts` sets `base: "/bos/"` in production, which is
a GitHub Pages path. On Fly the app is served from the root:

```ts
base: "/",
```

**The environment.** Build-time variables are baked into the bundle, so they are
set at build time, not as Fly runtime secrets:

```bash
fly launch --no-deploy
```

Then build with the hosted values and deploy:

```bash
VITE_SUPABASE_URL=https://<ref>.supabase.co VITE_SUPABASE_ANON_KEY=<anon-key> npm run build
```

```bash
fly deploy
```

The anon key belongs in the bundle — it is public by design and every request it
makes is still subject to row level security. The **service role key must never
be built into the front end**; it exists only in the edge function's
environment, where Supabase sets it for you.

Because this is a single-page app, the host must serve `index.html` for unknown
paths, or a refresh on `/accounting/invoices` returns 404. In `fly.toml`:

```toml
[[statics]]
guest_path = "/app/dist"
url_prefix = "/"
```

If you use a Node or nginx image instead, add the SPA fallback there.

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
- **"System lockdown" ends only the current session.** Revoking everyone else's
  needs an admin API call the browser cannot make.
- **132 lint errors**, mostly `no-explicit-any`. Not user-visible, but they are
  where type errors hide.
