# Tyler.Center

A desktop-style personal site with channels for About me, Websites, Articles, Watch, Writing, and Photography.

Open `index.html` locally, or publish this directory from the root of a GitHub Pages repository. The `CNAME` file sets the custom domain to `tyler.center`.

## What works

- A movable desktop window, menu bar, and one app icon in the dock.
- Search across the site's content.
- Rich previews for links, website cards, video recommendations, and a photo gallery.
- Comments on each item. Channel editors open with the plus button; items can be edited or removed from their detail views.
- The File, Rec, View, and Window menus, including Surprise Me for a random video.

## Current limits

Edits and comments made through the website are saved in the visitor's own browser. They do **not** publish to GitHub or appear for other visitors. The site needs a shared backend before public comments and browser edits can be shared.

The File menu's Email and Instagram links need Tyler's chosen public contact details in `CONTACT` at the top of `app.js`. Until an email is configured, Rec saves a draft only on the visitor's device. These drafts can be reopened from the Rec menu; they are not delivered to Tyler.

The initial website preview is an illustration of the original prototype. No real website screenshots or photography were supplied. To add content visible to everyone on this static site, edit `STARTER_PROJECTS` and `STARTER_ENTRIES` in `app.js` and put images in `assets/`. Existing browser storage can take precedence over updated starter records; clear this site's browser storage while testing changes to starter data.

## Files

- `index.html`: desktop and app layout
- `styles.css` and `v2.css`: visual design
- `app.js`: content and interactions
- `assets/`: local illustrations
- `CNAME`: GitHub Pages custom domain
