#!/usr/bin/env python3
"""Tyler.Center nightly Substack publisher, v2 (fixed login).

Why: Substack's Cloudflare bot-check returns 403 to the python-substack raw
API login from GitHub runner IPs (first live run failed 2026-10-22 ~9pm ET,
workflow run 39879697630). A real Chromium browser passes the check, so this
script logs in through the browser UI, exports the session cookies, and
publishes through python-substack with cookies_string.

FIX 2026-10-26: the v2 live test (run #3, 2026-10-26 4:05pm ET) failed at
the email-field wait: Playwright timed out after 30s because the login form
never appeared. Runner IPs get Cloudflare's "Just a moment" challenge, and
the old code waited only 3s then gave up after 30s. This version:
- removes navigator.webdriver (Cloudflare checks it),
- polls for the email field for up to 120s, waiting out the challenge,
- logs page title and URL on every failed poll so the next failure is
  diagnosable from the workflow log alone,
- uses longer timeouts for the password field and the New post check.

MODE=draft -> create a DRAFT only, print its edit URL, never publish or send.
MODE=live  -> publish the draft and send to Everyone (email + Substack app).

Reads substack-queue/title.txt, subtitle.txt, latest.md from the repo root.
Env: SUBSTACK_EMAIL, SUBSTACK_PASSWORD, MODE (default: live).

Exit codes: 0 ok; 2 bad input/queue; 3 login gate or failed login;
4 API auth failed with exported cookies; 5 draft/publish call failed
(draft, if any, is left in place).
"""
import os
import sys

PUBLICATION_URL = "https://tylercenter.substack.com"
SIGNIN_URL = "https://substack.com/sign-in"

MODE = os.environ.get("MODE", "live").strip().lower()
LIVE = MODE == "live"
EMAIL = os.environ.get("SUBSTACK_EMAIL", "")
PASSWORD = os.environ.get("SUBSTACK_PASSWORD", "")

if not EMAIL or not PASSWORD:
    print("ERROR: SUBSTACK_EMAIL / SUBSTACK_PASSWORD secrets are not set.",
          file=sys.stderr)
    sys.exit(2)


def read_queue():
    try:
        title = open("substack-queue/title.txt", encoding="utf-8").read().strip()
        subtitle = open("substack-queue/subtitle.txt", encoding="utf-8").read().strip()
        markdown = open("substack-queue/latest.md", encoding="utf-8").read()
    except OSError as e:
        print(f"ERROR: cannot read substack-queue/: {e}", file=sys.stderr)
        sys.exit(2)
    if not title or not markdown.strip():
        print("ERROR: title or article body is empty; refusing to continue.",
              file=sys.stderr)
        sys.exit(2)
    return title, subtitle, markdown


def _page_state(page):
    """Best-effort title and URL for diagnostics; never raises."""
    try:
        title = page.title()
    except Exception:
        title = "<unknown>"
    try:
        url = page.url
    except Exception:
        url = "<unknown>"
    return title, url


def _is_cloudflare_challenge(title):
    low = (title or "").lower()
    return "just a moment" in low or "attention required" in low


def export_cookies_via_browser():
    """Log in through real Chromium and return a cookies_string."""
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=False,  # headed under xvfb: far more bot-resistant
            args=[
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-dev-shm-usage",
            ],
        )
        context = browser.new_context(
            user_agent=("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                        "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"),
            viewport={"width": 1366, "height": 900},
            locale="en-US",
        )
        # Cloudflare checks navigator.webdriver; hide it before any page loads.
        context.add_init_script(
            "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
        )
        page = context.new_page()
        try:
            page.goto(SIGNIN_URL, wait_until="domcontentloaded", timeout=60000)

            # The email field may not appear for a while on runner IPs while
            # Cloudflare's challenge resolves. Poll up to ~150s, logging the
            # page state each time so a failure is diagnosable from the log.
            email = page.locator('input[type="email"], input[name="email"]').first
            email_found = False
            for attempt in range(15):
                try:
                    email.wait_for(state="visible", timeout=10000)
                    email_found = True
                    break
                except Exception:
                    title, url = _page_state(page)
                    print(f"Login form not ready (poll {attempt + 1}/15): "
                          f"title={title!r} url={url}", file=sys.stderr)
                    if _is_cloudflare_challenge(title):
                        print("Cloudflare challenge detected, waiting for "
                              "it to resolve...", file=sys.stderr)
                        page.wait_for_timeout(10000)
                    else:
                        page.wait_for_timeout(5000)
            if not email_found:
                title, url = _page_state(page)
                print("ERROR: email input never appeared on the sign-in page. "
                      f"Final title={title!r} url={url}. If the title is a "
                      "Cloudflare challenge, the runner IP is still blocked; "
                      "if it is a Substack page, the login layout changed.",
                      file=sys.stderr)
                sys.exit(3)
            email.fill(EMAIL)
            page.locator('button:has-text("Continue")').first.click()

            pw = page.locator('input[type="password"]').first
            pw.wait_for(state="visible", timeout=60000)
            pw.fill(PASSWORD)
            page.locator('button[type="submit"], button:has-text("Sign in")').first.click()
            page.wait_for_timeout(6000)

            # Substack sometimes skips the password and sends an email code.
            body_text = page.inner_text("body").lower()
            if ("check your email" in body_text
                    or "verification code" in body_text
                    or "enter the code" in body_text):
                print("LOGIN_GATE=email_code: Substack asked for an email "
                      "verification code instead of the password. Cannot "
                      "complete autonomously from the runner; surface this.",
                      file=sys.stderr)
                sys.exit(3)

            # Confirm sign-in: the publish home shows a "New post" control.
            page.goto(PUBLICATION_URL + "/publish/home",
                      wait_until="domcontentloaded", timeout=60000)
            page.wait_for_timeout(3000)
            try:
                page.locator(
                    'a:has-text("New post"), button:has-text("New post")'
                ).first.wait_for(state="visible", timeout=60000)
            except Exception:
                title, url = _page_state(page)
                print("ERROR: login did not complete; no 'New post' control "
                      f"on the publish home. title={title!r} url={url}. "
                      "Check credentials and the gate.", file=sys.stderr)
                sys.exit(3)

            cookies = context.cookies()
        finally:
            browser.close()

    kv = [f"{c['name']}={c['value']}" for c in cookies
          if c.get("domain", "").endswith("substack.com")]
    if not any(k.startswith("substack.sid=") for k in kv):
        print("WARNING: substack.sid cookie not found in exported cookies; "
              "the API call may fail.", file=sys.stderr)
    return "; ".join(kv)


def main():
    title, subtitle, markdown = read_queue()
    cookies_string = export_cookies_via_browser()

    from substack import Api
    from substack.exceptions import SubstackAPIException, SubstackRequestException

    api = Api(cookies_string=cookies_string, publication_url=PUBLICATION_URL)
    try:
        uid = api.get_user_id()
    except (SubstackAPIException, SubstackRequestException) as e:
        print("ERROR: API auth check failed with exported cookies "
              f"({type(e).__name__}).", file=sys.stderr)
        sys.exit(4)
    print(f"Authenticated as user_id={uid}", file=sys.stderr)

    try:
        result = api.create_draft_from_markdown(
            title=title,
            markdown=markdown,
            subtitle=subtitle,
            audience="everyone",
            publish=LIVE,
            send=LIVE,
            share_automatically=False,
        )
    except (SubstackAPIException, SubstackRequestException) as e:
        print(f"ERROR: {'publish' if LIVE else 'draft creation'} failed "
              f"({type(e).__name__}). If this is the broadcast email-"
              "verification gate, the draft is left in place and the "
              "existing protected code-fill flow is the fallback.",
              file=sys.stderr)
        sys.exit(5)

    if LIVE:
        print("PUBLISHED:", result.get("post_url", result))
    else:
        draft = result.get("draft") or {}
        did = draft.get("id")
        print(f"DRAFT_ID={did}")
        print(f"EDIT_URL={PUBLICATION_URL}/publish/post/{did}")
        print("Draft-only test complete. Nothing was published or sent.")


if __name__ == "__main__":
    main()
