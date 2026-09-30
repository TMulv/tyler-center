# Private reader channels

## Current deployment gate

Email-code accounts and private saved channels are enabled in `reader-config.js` after live database isolation checks and a real browser sign-in/save test. Public comments remain disabled (`commentsEnabled:false`) until their separate database and owner-verification checks pass. A browser-only mock account is never presented as a real account.

The rocket beside a channel opens **Mark all as read** for that channel, plus **Mark every channel as read**. These existing read markers stay on the visitor’s browser. New or edited posts become unread again. They are independent of Tyler’s Notion reading status and each account’s saved-item status.

## Live setup audit — September 30, 2026

- Existing project: `tyler-center` (`uxoinnfalmhobghdfawx`), healthy. Reuse it; do not create a duplicate.
- `reader_profiles` and `reader_saves` exist. SQL inspection confirmed RLS enabled and authenticated owner checks on both tables. The approved live transactional test then passed owner access, cross-account denial, and anonymous denial; all fixtures were rolled back.
- Site URL is already `https://tyler.center`. Email provider and new signups are enabled; email confirmation remains required.
- Resend custom SMTP is saved and enabled. Both Confirm signup and Magic link / OTP templates send `{{ .Token }}` with the subject “Your Tyler.Center sign-in code.” Resend confirmed delivery of the first code requested through the local site preview.
- Public connection URL/key are configured in `reader-config.js`; accounts are enabled after the checks below, while public comments remain disabled. No secret keys are used.
- Tyler approved Resend and the live transactional privacy test. The SQL editor returned `PASS: owner access, cross-account denial, and anonymous denial`. Real email-code delivery, signup, profile creation, session restoration, save persistence, reading status, removal and logout were then verified through the site preview. Cross-account isolation was verified by SQL fixtures and account switching by automated client tests.
- `post_comments` and `site_owners` were absent from the live schema inspection. Public comments and owner replies remain pending.
- Resend domain `auth.tyler.center` is verified. Tyler approved the three DNS records, which were saved in Namecheap and checked against its authoritative DNS: DKIM TXT at `resend._domainkey.auth`, CNAME `rsend.auth` → `rsend.forge.rmta.net`, and CNAME `send.auth` → `send.forge.rmta.net`. Existing website and forwarding records were preserved.
- Tyler completed the private-key handoff. Supabase SMTP uses sender `login@auth.tyler.center`, name `Tyler.Center`, host `smtp.resend.com`, port 465, username `resend`, and a 60-second per-user interval. The key was prepared with Sending access restricted to `auth.tyler.center`; no credential was read, stored locally, or committed.
- Browser acceptance passed: the real emailed code signed in, the requested username created a private channel, saving a public post persisted across reload, its Read status updated, removal worked, and logout removed the private channel. The test save was removed. Fourteen focused account/guide/unread tests passed.
- Account activation was published in `0952653`; GitHub Pages reported that commit built. The live `https://tyler.center` form delivered a second code, verified it, and opened the existing private channel without asking for a new username. New-reader and returning-reader templates both worked.
- A second real inbox/device and deliberately expired code were not exercised; do not describe those as completed. Public comments remain gated separately.

## Account behavior

- Visitors enter their email, verify a one-time code, and choose a unique lowercase username.
- A private `#username` channel appears only for the signed-in visitor.
- **Save for later** on public channel messages saves the title, article link and source identity to that visitor’s private channel. Duplicate saves do not create duplicate rows.
- Visitors may add their own titled links, filter saved items by read/unread, mark them read and remove them.
- Source posts without a URL (such as newsletter editions) retain their source identity and can reopen the original public post.
- Saves follow the account between devices. Logout or switching accounts immediately clears private data from the displayed channel. Private saves are not cached in the public feed or committed to GitHub.
- This feature does not turn the existing prototype comments into shared comments.

## Live setup

1. Create the dedicated **tyler-center** Supabase project on the free personal organization. Keep Data API enabled, automatic exposure of new tables disabled, and automatic row-level security enabled. Save the database password in your password manager, never in this repository.
2. Run `supabase/migrations/20260930_private_readers.sql` once in the project’s SQL editor. The tables explicitly grant only the permissions the client needs. Owner checks use the authenticated user ID, not a browser-supplied username. Emails stay in Supabase Auth; they are not copied into profile rows.
3. Run `supabase/tests/reader-privacy.sql`. It creates two disposable database fixtures inside a transaction, verifies owner-only reading/writing and anonymous denial, and rolls everything back. It must return PASS. This check passed locally in PGlite and in the live project on September 30, 2026.
4. In Authentication, enable email sign-in and signup. Set Site URL to `https://tyler.center`. Edit both the Confirm signup and Magic Link templates to send a code using `{{ .Token }}`, covering new and returning readers. Example below. Code verification uses `verifyOtp` with type `email`; the site does not rely on clicking a magic link.
5. Configure a production SMTP sender. Supabase’s default sender only sends to project team members. For Resend, verify a sending subdomain such as `auth.tyler.center` using the DNS records Resend provides. Configure the generated SMTP credentials directly in Supabase, with an appropriate verified sender address. Do not commit SMTP passwords/API keys. Set reasonable OTP expiration and send-rate limits; retain Supabase’s verification rate limits.
6. Add only the project URL and **publishable** (`sb_publishable_…`) key to `reader-config.js`. Never use `sb_secret_…`, a service-role key, a database password, or an SMTP key in public JavaScript. Publishable keys are safe to expose only alongside the verified database policies.
7. Test with two real test accounts: receive and verify a code, choose usernames, save and remove posts, add a link, reload, sign out and sign back in on another device. Confirm each account sees only its own channel. Test invalid/expired codes and sender rate-limit errors. Check keyboard navigation and narrow-screen layout.
8. Set `enabled:true`, publish, then repeat the sign-in/save check on the live domain. Until these checks pass, leave the gate off.

Suggested code email subject: **Your Tyler.Center sign-in code**

```html
<h2>Your Tyler.Center sign-in code</h2>
<p>Enter this code in the window where you requested it:</p>
<p style="font-size:28px;letter-spacing:4px"><strong>{{ .Token }}</strong></p>
<p>If you didn’t request this, you can ignore this email.</p>
```

## Checks and dependencies

`node --test tests/reader-account.test.cjs tests/unread.test.cjs` covers verified-account flows, owner-scoped requests, data cleanup on logout/account switching, save failures and unread-marker behavior. The SQL test verifies the database privacy boundary.

`vendor/supabase.js` bundles official `@supabase/supabase-js` version 2.117.2, built with esbuild 0.28.2 as a browser IIFE named `supabase`. License notices are in `vendor/`. No private account information is sent to Notion or GitHub Actions.

Official references: [email OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless), [custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security).


## Public comments and Tyler verification

Run `supabase/migrations/20260930_public_comments.sql` after the private-reader migration. Run both SQL policy tests in an isolated test project first. Public comments expose only usernames, text, timestamps, and the server-computed owner badge; private saves and emails stay private. Posts show the official badge only for repository-authored content and approved Notion snapshots, never browser-created entries.

After Tyler signs in with his verified email and chooses a username, confirm his UUID directly in Supabase Auth and insert that UUID into `public.site_owners` using the SQL editor as administrator. Never assign ownership based on a requested username or a client-supplied flag. Regular accounts cannot read or write this table. Do not guess the UUID or commit any credentials.

Enable `commentsEnabled:true` only after live email sign-in works, two-account privacy tests pass, an ordinary user cannot forge ownership, and a real owner reply returns `is_owner:true`. Check posting, signing out, anonymous public reading, and the 20-per-hour limit before launch. Public comments are disabled until then. Old browser-only comments are no longer displayed as shared replies.
