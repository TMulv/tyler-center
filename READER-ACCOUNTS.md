# Private reader channels

## Current deployment gate

The account UI is implemented, but `reader-config.js` deliberately has `enabled:false` until the live Supabase project, database policies, and email sender have passed the checks below. With that flag off, public visitors see the working rocket menus but no account or save controls. A browser-only mock account is never presented as a real account.

The rocket beside a channel opens **Mark all as read** for that channel, plus **Mark every channel as read**. These existing read markers stay on the visitor’s browser. New or edited posts become unread again. They are independent of Tyler’s Notion reading status and each account’s saved-item status.

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
3. Run `supabase/tests/reader-privacy.sql`. It creates two disposable database fixtures inside a transaction, verifies owner-only reading/writing and anonymous denial, and rolls everything back. It must return PASS. The same migration and tests have passed locally in PGlite, but the live project still needs this check.
4. In Authentication, enable email sign-in and signup. Set Site URL to `https://tyler.center`. Edit the Magic Link template to send a code using `{{ .Token }}`. Example below. Code verification uses `verifyOtp` with type `email`; the site does not rely on clicking a magic link.
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
