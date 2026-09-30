# Tyler.Center

A desktop-style personal site with channels for About me, Websites, Articles, Watch, Writing, Newsletters, and Photography.

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
- About me as a chat thread, a personal details toggle, five redacted case-study previews, and a tactile Betting Antelope logo attachment.
- Jersey Shore opens a separate draggable, resizable Harvey Cedars beach window. The provider-approved player is pending; the window currently offers a link to NJ Beach Cams. Closing it removes any configured player and stops playback.
- An Easter egg under View → Take a break opens playable Spider Solitaire: 1/2/4 suits, legal moves, deals, completed runs, hints, undo, and a game saved on this device.
- Comments on each item. Channel editors open with the plus button; items can be edited or removed from their detail views.
- The File, Rec, View, and Window menus, including Surprise Me for a random video.

## Current limits

Edits and comments made through the website are saved in the visitor's own browser. They do **not** publish to GitHub or appear for other visitors. The site needs a shared backend before public comments and browser edits can be shared.

The File menu links to Instagram and Twitter / X as @tyler_mulvey. Its Email link still needs Tyler's chosen public email in `CONTACT` at the top of `app.js`. Until an email is configured, Rec saves a draft only on the visitor's device. These drafts can be reopened from the Rec menu; they are not delivered to Tyler.

The initial website preview is an illustration of the original prototype. No real website screenshots or photography were supplied. To add content visible to everyone on this static site, edit `STARTER_PROJECTS` and `STARTER_ENTRIES` in `app.js` and put images in `assets/`. Existing browser storage can take precedence over updated starter records; clear this site's browser storage while testing changes to starter data.

## Files

- `index.html`: desktop and app layout
- `styles.css` and `v2.css`: layout and component foundations
- `texture.css`: textured paper, ink-blue, faded-red, and typewriter design
- `chat-apps.css`: chat files, camera window, and game surfaces
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

Writing reads shared Betting Antelope RSS snapshots. Newsletters reads finished editions from the Daily Newsletter Digest archive, once its read-only Notion key is configured. See [FEED-SETUP.md](FEED-SETUP.md) for activation, source IDs, scheduling, and limitations. The local implementation includes 20 writing previews and one existing digest; scheduled production sync still requires publishing this version.

Websites, Articles, and Photography sync are not connected yet. The accompanying `NOTION-SYNC-ACTION-LIST.md` in the project directory maps the five channels to Notion sources, publishing properties, update behavior, and the server-side publishing bridge needed by this static site.

## Camera source and testing

The beach player is the [Coastal Camera Network embed](https://coastalcameranetwork.com/webcams/seaside-park/webcam-demo.php) used on the [Borough of Seaside Park’s official webcam page](https://www.seasideparknj.org/community/live_webcam.php). Playback, provider ads, and outages are controlled by the camera provider. The source link and Reconnect button stay available. No private stream URLs or expiring tokens are stored.

Run `node --test tests/*.test.cjs` for reading-state and Spider rules tests.

See `assets/ASSET-NOTES.md` for the Betting Antelope source and texture edit.


## Reader accounts and rocket menus

Click a channel’s rocket for **Mark all as read**, or **Mark every channel as read**. Private reader accounts are implemented behind a deployment gate. See [READER-ACCOUNTS.md](READER-ACCOUNTS.md) for backend setup, email delivery, privacy checks, and the exact remaining activation steps.

## Harvey Cedars player setup

The public NJ Beach Cams page is not a player embed. Its direct HLS stream returned HTTP 403 during a check on September 30, 2026. Coastal Camera Network [offers free embeds on request](https://coastalcameranetwork.com/streaming-experts/): request the Harvey Cedars camera for `https://tyler.center` through their [contact page](https://coastalcameranetwork.com/contact-us/?partner=camera).

Once they supply an authorized iframe player URL, set `SHORE_EMBED_URL` in `app.js`. If they supply a script-based widget, integrate that widget and its teardown instead. Use their documented muted-autoplay option; granting iframe autoplay permission alone does not start playback. Keep visible play/sound controls, credit, and the external fallback. Test actual live playback from the production domain and verify closing/reopening stops/restarts it. Until then, leave the URL empty and show the honest unavailable state.
