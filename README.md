# Tyler.Center

A desktop-style personal site with chat channels for About me, what-i've-built, read-later, watch-or-listen-later, betting-antelope, daily-newsletter, and photography.

Read [AGENTS.md](AGENTS.md) before making changes. It records Tyler's standing preferences and tells future agents to keep them current as part of each task.

Serve locally with `python3 -m http.server 8766`, or publish this directory from the root of a GitHub Pages repository. The `CNAME` file sets the custom domain to `tyler.center`.

## What works

- A movable desktop window, menu bar, and desktop shortcuts.
- Drag the bottom-right corner to resize the desktop window. Content adapts to the window width; arrow keys on the corner grip also resize it. Zooming out restores the chosen size.
- Rocket badges for channels with unread or updated items, including home-page channel shortcuts. Only visible messages are marked read; unseen earlier messages keep their badge. Channels sort oldest to newest, open at the bottom, and offer Last read / Latest controls; empty channels have no badge. Read markers persist when browser storage is available. These are local read indicators, not a claim that live Notion sync is enabled.
- LinkedIn desktop shortcut and mobile navigation link, opening Tyler's profile in a new tab.
- NASA's Challenger launch wallpaper with full attribution and Unsplash license links.
- Locally hosted Special Elite typewriter font and original procedural print textures.
- Search across the site's content.
- Chat-style link previews, website cards, video recommendations, and photo attachments.
- About me as a chat thread, a personal details toggle, and five redacted case-study file previews. Betting Antelope uses its textured logo as its posting avatar.
- Kanye2024.com shows Tyler's first domain purchase and sale with a typewriter SOLD stamp and a linked Namecheap ownership-transfer confirmation.
- An Easter egg under View → Take a break opens playable Spider Solitaire: 1/2/4 suits, legal moves, deals, completed runs, hints, undo, and a game saved on this device.
- Verified email-code reader accounts and private saved-item channels. Comment/thread entry points are visible, but public comments remain disabled; public built projects have no visitor edit control.
- The File, Rec, View, and Window menus, including Surprise Me for a random video.

## Current limits

Reader accounts and private saved-item channels are enabled after live email delivery and database isolation checks. Public comments remain disabled in `reader-config.js` pending their separate database and policy checks. Local read markers remain browser-only.

The File menu links to Instagram and Twitter / X as @tyler_mulvey. Email me opens `mail@tyler.center`, which Namecheap forwards to Tyler's personal inbox. Send me a rec opens a prefilled email to the same address; the visitor must press Send in their email app. The site does not claim delivery from merely opening a draft. Browser-only drafts saved before this address was configured remain available from the Rec menu.

Built projects come from the public Notion snapshot plus the standalone TomoTomo entry. Cached source artwork, selected page miniatures, and branded cards provide visual previews. Stale browser project copies do not override the canonical feed. Photography ingestion is still pending.

## Files

- `index.html`: desktop and app layout
- `styles.css` and `v2.css`: layout and component foundations
- `texture.css`: textured paper, ink-blue, faded-red, and typewriter design
- `chat-apps.css`: chat files and game surfaces
- `about.js`: biography and anonymized case-study messages
- `spider-engine.js` and `spider.js`: card rules and playable UI
- `app.js`: content and interactions
- `unread.js`: per-channel read markers
- `feeds.js` and `data/`: validated shared channel snapshots
- `scripts/sync_feeds.py`: RSS and Notion readers
- `.github/workflows/sync-feeds.yml`: scheduled publishing
- `assets/`: local illustrations
- `CNAME`: GitHub Pages custom domain

## LinkedIn

The shortcut points to `https://www.linkedin.com/in/tylermulvey/` with `target="_blank"` and `rel="noopener"`. A normal browser tab uses that browser profile's existing LinkedIn session. It does not log a visitor in automatically, bypass LinkedIn's login requirements, or guarantee that LinkedIn records or identifies a view. See [LinkedIn's private viewing explanation](https://www.linkedin.com/help/linkedin/answer/a567226).

## Wallpaper credit

**Space Shuttle Challenger launches from Kennedy Space Center**

The Space Shuttle Challenger launching from Complex 39. Kennedy Space Center, Florida, USA.

Photo: NASA, via [Unsplash](https://unsplash.com/photos/dCgbRAQmTQA). Published on March 2, 2021 (UTC). Free to use under the [Unsplash License](https://unsplash.com/license). This is the photo's publication date, not a claim about the launch date.

The provided image is stored unchanged in `assets/challenger-launch.jpg`. The reference texture images were not reused; `assets/print-grain.svg` provides original procedural surface grain. Special Elite's license is included under `assets/fonts/`.

## Channel sync

Notion supplies built projects, Read Later, Watch or Listen Later, and finished Daily Newsletter Digest editions through public snapshots. Betting Antelope uses RSS/archive snapshots; when GitHub's runner gets HTTP 403 from Substack, the writing job reads the same public archive metadata through a public reader. The workflow checks every 15 minutes; source failures retain the previous snapshot. Check the latest job before claiming writing sync is healthy. Photography sync is still pending.

See [FEED-SETUP.md](FEED-SETUP.md) for approved fields, source IDs, date mappings, publishing, and limitations.

## Testing

Run `node --test tests/*.test.cjs` for reading-state and Spider rules tests.

See `assets/ASSET-NOTES.md` for the Betting Antelope source and texture edit.


## Reader accounts and rocket menus

Click a channel’s rocket for **Mark all as read**, or **Mark every channel as read**. Email-code sign-in and private saved-item channels are live. See [READER-ACCOUNTS.md](READER-ACCOUNTS.md) for the verified setup and remaining public-comment checks.
