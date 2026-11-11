# Moving login to the server: plan

**Status:** proposal only. Nothing in the app or database has been changed yet.
Please read this, run the check in step 0, and reply before any code is changed.

---

## 1. What is wrong today (plain-language version)

Today the website itself decides whether you are logged in. That is like a
shop asking each customer whether they paid and believing the answer.

| # | Problem | Where | Why it matters |
|---|---------|-------|----------------|
| A | Students, teachers and student-service staff log in by asking the database for a row "where name/email = X **and** `temp_password` = Y". | `src/App.tsx` `handleLoginSubmit`, and the same code again in `src/lms/components/Login.tsx` | That only works if **anyone on the internet** can read the `temp_password` column. The key the site uses (the "anon"/publishable key) is public by design: it ships inside the website. So anyone can ask for every password. |
| B | Passwords are stored as plain text. | `students.temp_password`, `teachers.temp_password`, `student_services.temp_password`. Admins can also see them in `StudentDirectory.tsx`. | If they leak, they leak readable. People often reuse passwords elsewhere. |
| C | The typed name/email is pasted straight into the `.or(...)` filter text. | `.or(\`name.eq.${identifier},email.eq.${identifier}\`)` (also the parent email filter) | Typing commas or brackets can change what the filter means ("filter injection"). |
| D | Parents log in with **only an email**, no password. | `isParentLogin = !password.trim()` | Anyone who knows (or guesses) a parent's email sees that parent's children's data. |
| E | "Logged in" is just a note in the browser (`iem_logged_in`, `iem_user`, `iem_parent_session` in localStorage). | `src/App.tsx`, `src/lms/App.tsx`, `src/parent/App.tsx` | The database cannot tell who you are, so it has to let *everybody* read and write. Anyone can type that note into their own browser. |
| F | Changing your password in the LMS reads the old password from the table and writes the new one, as an anonymous user. | `src/lms/App.tsx` (around line 1470) | Proves anon can also **update** passwords, i.e. take over accounts. |

### What the repo's SQL tells us (step 0, done from the code only)

`src/sms/supabase/sql/full_program_setup.sql` defines `apply_open_rls(...)`, which
creates policies `for select/insert/update/delete to anon, authenticated using (true)`
and applies them to `students`, `teachers`, `parents`, `profiles`, grades,
payments, report cards and others. "Using (true) to anon" means **any visitor
can read and change those rows**.

`tenant_scope_core_tables.sql` would replace those with
`to authenticated using (school_id = current_school_id())`, which is much better.
But students, teachers and parents never sign in to Supabase Auth today, so if that
file were in force their logins would fail. **Logins work on iemsms.com, so the
open (anon) policies are almost certainly what is live.** Also, the login query
filters on `temp_password`, and PostgreSQL only allows that if the caller can
read the column. So a working student login shows that anon can read the passwords.

To confirm this without reading any real data, run
[`check_rls_readonly.sql`](./check_rls_readonly.sql) in the Supabase dashboard
(SQL Editor). It only reads policy and permission settings, never table rows.

### Other things found along the way

- `verify_admin_delete_password()` compares the typed text with
  `password_hash` using `=`, so the "hash" is really plain text. It can also be
  called by anon. It should use `crypt()` (pgcrypto) and only be callable by
  `authenticated` users.
- Admin enrolment calls `supabase.auth.signUp(...)` **in the admin's browser**
  (`src/sms/services/authService.ts`). Depending on project settings this can
  replace the admin's session with the new student's. Creating users belongs in a
  server function that uses the Admin API.
- The anon key hard-coded in `src/sms/supabaseClient.ts` is not a secret, and
  it does not need to be removed. What protects data is RLS, not hiding that key.
  (The **service_role** key must never be in the website; it is not there today.)

---

## 2. The target design

1. **Supabase Auth does the login.** It stores hashed passwords and gives the browser a
   signed session token (JWT). The database then knows who is asking (`auth.uid()`).
2. **Every person row is linked to an Auth user** through the existing
   `auth_user_id` column (`students`, `teachers`, `student_services`; parents get one
   too).
3. **RLS policies use `auth.uid()`**, for example:
   - a student reads only their own row and their own grades/attendance;
   - a teacher reads students in their own classes/school;
   - a parent reads only students where `parent_email` / `secondary_parent_email`
     equals their signed-in email (`auth.jwt() ->> 'email'`);
   - admins/staff use the existing `current_school_id()` tenant policies.
4. **Nobody but the server can read password columns.** `temp_password` is
   emptied and then dropped.
5. **Parents sign in with an email code or magic link** (`signInWithOtp`). They
   don't need a password: the code proves they own the inbox.
6. **Server-side work runs in Supabase Edge Functions** (or Netlify Functions),
   which hold the service_role key as a secret. That covers creating users,
   resetting passwords and the one-time migration login.

---

## 3. How we get there without locking out the ~100 users

The trick is **migrating each user the first time they log in**. Users keep typing the
same name/email and password they use today. Behind the scenes we move them to
real Auth accounts.

### Phase 0: Prepare (no user-visible change)
1. Run `check_rls_readonly.sql` and share the output (it contains no personal data).
2. Back up the database (Dashboard → Database → Backups, or `pg_dump`).
3. Set up **custom SMTP** for Auth emails (e.g. Resend, Brevo, or the school's mail
   provider). Supabase's built-in mailer only sends a handful of emails per hour.
   That is not enough for parent codes.
4. In Auth → URL Configuration, add the Netlify deploy-preview URLs
   (`https://deploy-preview-*--<your-site>.netlify.app/**`) and `https://iemsms.com/**`
   as redirect URLs.

### Phase 1: Stop the password leak (small, quick)
1. Add an Edge Function **`legacy-login`**:
   - input: `{ identifier, password }`
   - looks up `students` → `teachers` → `student_services` using the service_role
     key, with **separate `.eq('email', …)` / `.eq('name', …)` queries** (no
     string-built `.or()`, which fixes problem C);
   - if the password matches, makes sure an Auth user exists for that person
     (creates it, or sets its password, with `auth.admin`) and saves `auth_user_id`;
   - returns only `{ ok, email, role }`, **never** any password column.
2. The login page calls `legacy-login`, then `supabase.auth.signInWithPassword(email, password)`.
   Now the user has a real session.
3. Users who have no email (name-only logins) get an internal address such as
   `<student-id>@students.iemsms.invalid` so Auth can store them. They keep typing
   their name.
4. **Revoke anon access to password columns:**
   ```sql
   revoke select, update on public.students, public.teachers, public.student_services from anon;
   grant select (id, name, email, school_id /* …all non-secret columns… */) on public.students to anon; -- only if still needed during the transition
   ```
   (The exact column list is written once we know which screens still run as anon.)
5. Replace the LMS "change password" form with `supabase.auth.updateUser({ password })`.
6. Replace "show temp_password" in the admin directory with a **"Reset password"**
   button that calls an Edge Function.

Effect: passwords are no longer downloadable, and logins look the same to users.

### Phase 2: Give parents a real credential
1. The parent tab asks for email → `supabase.auth.signInWithOtp({ email })` → the parent
   types the 6-digit code (or clicks the link).
2. Remove the "email only" path and the "parent typed a password" fallback.
3. Add RLS so a signed-in parent sees only their own children.

### Phase 3: Lock the database to signed-in users
1. Replace every `apply_open_rls` (anon) policy with `authenticated` policies
   scoped by `auth.uid()` / `current_school_id()`. Go table by table, testing each
   screen on a deploy preview.
2. Stop trusting `iem_logged_in` / `iem_user` / `iem_parent_session`. The app reads
   who you are from `supabase.auth.getSession()` (localStorage may still cache the
   display name, but it no longer controls access).
3. Move admin "create student/teacher/staff" to an Edge Function using
   `auth.admin.createUser`, instead of `signUp` in the admin's browser.
4. Fix `verify_admin_delete_password` to compare hashes and revoke it from anon.

### Phase 4: Remove the old path
1. After a set date (e.g. 3–4 weeks, or once the "not migrated yet" list is
   empty), send password-reset emails to anyone who never logged in.
2. `update … set temp_password = null`, then drop the `temp_password` columns.
3. Delete `legacy-login` and the `VITE_LEGACY_LOGIN` flag.

### Feature flag
A Netlify environment variable `VITE_LEGACY_LOGIN` (`true`/`false`) chooses the
old or new login screen. Deploy previews get `false` (new flow) first. Production
switches only after testing. Switching back is a one-click redeploy.

---

## 4. How each change is tested

1. Every change goes in a branch → pull request → **Netlify deploy preview**.
2. Test accounts: one student, one teacher, one student-service user and one parent
   in a **test school**, not real people.
3. Checklist on the preview:
   - each role can log in, log out and refresh the page while staying logged in;
   - the wrong password is rejected; a name with commas/brackets does not break the query;
   - a parent gets a code by email and sees only their own children;
   - with DevTools → Application → Local Storage cleared or edited, you can't see
     another user's data;
   - an anonymous request for `temp_password` is refused (see the check file).
4. Only then merge to `main` and watch the first real logins on iemsms.com.

> Note: deploy previews talk to the **same Supabase database** as the live site
> (`netlify.toml` proxies `/supabase/*` to the one project). Database changes
> (SQL, policies) therefore affect the live site immediately, even when tested
> from a preview. For that reason, SQL changes in each phase are written to be
> additive first (new function, new policies) and restrictive last (revokes), and
> each comes with an "undo" SQL snippet. A separate Supabase **branch/staging
> project** is recommended if you want fully isolated testing.

---

## 5. What I need from you (the owner)

1. Run `docs/security/check_rls_readonly.sql` in the Supabase SQL Editor and paste the result.
2. Confirm: OK to set up custom SMTP for parent emails? Which provider?
3. Confirm: may name-only students get an internal placeholder email (they still
   type their name to log in)?
4. Approve Phase 1. I will then open a pull request with the Edge Function, the
   login changes and the SQL, and test it on a deploy preview before anything
   reaches iemsms.com.
