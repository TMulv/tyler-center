# Publishing channel feeds

The site includes the full public Betting Antelope archive as linked previews and one existing newsletter edition as an initial snapshot. The scheduled workflow runs in GitHub Actions. The Notion newsletter connection has completed a successful production run.

## Turn on RSS

Push this version to `TMulv/tyler-center` on `main`. The **Sync channel feeds** GitHub Actions workflow runs on this initial code push, manually, and at minutes 7, 22, 37 and 52 of every hour, every day. Publishing days do not need to be configured. It commits changed public JSON and explicitly requests a GitHub Pages build because commits made with `GITHUB_TOKEN` do not trigger a legacy Pages build on their own.

The workflow needs repository contents-write and Pages-write permissions (declared in the file). Check Actions → Sync channel feeds after the first push. Repository policies must permit the workflow to commit to main. No personal GitHub token is needed by the workflow.

Schedules can run late, and GitHub can disable schedules on public repositories after 60 days without repository activity. Allow time for both the scheduled check and Pages deployment. This is periodic publishing, not an instant webhook. An already-open site checks its public snapshots once a minute and on returning to the tab. Source failures preserve the last successful snapshot and fail the workflow rather than erase content.

## Connect the daily newsletter archive

1. Create an internal connection in Notion's Developer portal in the workspace containing **Daily Newsletter Digest**. Name it **Tyler.Center feed** and enable **Read content**; it does not need insert, update, or user information capabilities.
2. On [Daily Newsletter Digest](https://app.notion.com/p/074c794ec62f48cc97c9dc98fba14a32), choose **••• → Connections → Add connection** and select it. Ensure its Editions database is included. Sharing this archive grants inherited access to its children.
3. Copy its API token into a [GitHub Actions repository secret](https://github.com/TMulv/tyler-center/settings/secrets/actions/new) named **NOTION_TOKEN_NEWSLETTER** (the workflow also accepts **NOTION_TOKEN**). Do not put the key in website files or chat. Alternatively run `gh secret set NOTION_TOKEN_NEWSLETTER --repo TMulv/tyler-center`; the CLI prompts for the value.
4. Run **Actions → Sync channel feeds → Run workflow**, or wait for the next scheduled run. Verify one new edition and an edit on the site.

The existing newsletter agent keeps doing the summarizing. It should save finished editions in the archive's **Editions** database, or as direct child pages of the archive. Both locations are supported and duplicate page IDs are merged. Page creation time determines feed order; edits update the existing message. The initial manually read edition uses its known last-edit timestamp; the first authenticated sync replaces that with its creation timestamp.

Every nonempty, non-archived edition in those two locations is eligible to appear publicly. Keep drafts and private notes elsewhere. The sync reads digest text, not the underlying Gmail messages. It removes private Gmail/Outlook/Notion URLs and private citation markers, omits files and embedded email attachments, and preserves available public source links. It does not bypass subscriptions, attach paid PDFs, or generate new summaries. Public digest cards say **Agent-written digest**.

Notion source IDs in `scripts/sync_feeds.py`:

- Archive page: `074c794e-c62f-48cc-97c9-dc98fba14a32`
- Editions data source: `aab9f113-6439-4714-9185-0cc08f9d70df`

Until the secret is configured, RSS continues working and the included newsletter snapshot stays in place. The workflow records a notice that newsletter sync is pending. Removing or archiving an edition removes it from the current feed after the next successful sync; old repository commits can still contain previously published text.

## Local use and maintenance

Serve this directory over HTTP, for example `python3 -m http.server 8766`. Opening index.html as a file cannot reliably load the JSON feeds.

```bash
python3 scripts/sync_feeds.py rss
python3 scripts/sync_feeds.py notion  # requires NOTION_TOKEN in the environment
python3 -m unittest discover -s tests -p 'test_*.py'
node --test tests/*.test.cjs
```

RSS stores short previews and original links. Its stable URL-based IDs prevent duplicates and preserve read markers. Older imported posts remain when Substack's latest-items window rolls forward. For an intentionally removed RSS post, delete its record from `data/writing.json` once it is no longer returned by RSS.

Scheduled feed commits advance GitHub's main branch. Before publishing subsequent local changes, commit them locally, then pull with rebase from the actual GitHub URL. This checkout's `origin` still points to the previous local checkout:

```bash
git -C "$HOME/Documents/GitHub/tyler-center" pull --rebase https://github.com/TMulv/tyler-center.git main
git -C "$HOME/Documents/GitHub/tyler-center" push https://github.com/TMulv/tyler-center.git HEAD:main
```

## References

- [Notion internal connections and page access](https://developers.notion.com/guides/get-started/internal-connections)
- [GitHub Actions secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets)
- [Scheduled workflow behavior](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
- [Requesting a Pages build](https://docs.github.com/en/rest/pages/pages#request-a-github-pages-build)

## Story links and readable editions

Digest headings retain the typewriter face; body text uses Georgia. The importer preserves Notion headings, emphasis, and public hyperlinks as structured blocks. URLs written directly in the text also become clickable. Private inbox links remain excluded.

For future editions, the newsletter agent should link each story title to its original public article or recipe URL (even if the publisher requires a subscription), rather than a Gmail message URL. Missing public links cannot be recovered automatically from a private inbox citation.

The original September 25 edition has five manually verified public destinations in `scripts/newsletter-links.json`. These backfilled links survive scheduled syncs and only apply while the matching story text is present. The Downpressors link opens the event listing.

### Backfill older writing

Run `python3 scripts/sync_feeds.py rss --backfill` to paginate the public Substack archive to its end. This imports titles, subtitles, original publication dates, and links, including links to subscriber-only posts. Article bodies remain on Substack. The regular RSS sync preserves older entries and adds new posts. Archive errors leave the existing snapshot intact.

### Link previews and channel filters

`link-previews.js` stores public Open Graph metadata read from the existing App Store, article, and video links. These cards load artwork directly from the original image host and fall back to text if it fails. Update that map when adding a new static source link. RSS image enclosures and archive cover images are included in the writing sync. Supported image hosts are validated in `feeds.js`; no generic preview proxy is used.

Channel descriptions and filters remain above the scroll area. Projects filter by Apps or Websites, other content filters by its available types, multi-year channels filter by year, and every channel supports text search. Filters only affect the current view; they do not remove records or change other channels.

### September 30 sync repair

The repository secret is named `NOTION_TOKEN_NEWSLETTER`; the workflow maps it to the script’s `NOTION_TOKEN` environment variable, with the older secret name as a fallback. RSS errors report safe HTTP codes. If RSS fails, the sync reads the newest page of the publication’s public archive. Substack returns HTTP 403 to GitHub’s runner, so a second fallback reads that same public archive JSON through `r.jina.ai`. The reader sees only a public URL; no token or private data is sent. The importer validates the original Substack URLs and keeps only post metadata. Backfills still paginate all pages. If these sources fail, the last snapshot stays in place and the writing job fails visibly.


## Read Later → #read-later

The user approved public publication of titles, article links, saved dates, and reading statuses on September 30, 2026. The importer queries data source `a08dfd74-875d-4998-affe-968c65c3e41f` using the same read-only Notion connection and existing repository secret. It does not read page bodies, Notes, ADHD Summary, file properties, or PDF attachments. The public snapshot only contains those approved fields plus stable record IDs and channel/source identifiers.

The entire data source is synced, so changing a status to Read keeps the article visible. Unset statuses display Not marked. The Archive status is preserved; actually archiving/deleting a page removes it after the next successful sync. Missing article links remain blank; there is no fallback to a private Notion page or attachment. Known email tracking parameters and signed file links are removed.

Edit Title, Link, or Status in Notion to update the corresponding public message. Date added determines its saved timestamp and order. The scheduled workflow checks every 15 minutes, with possible GitHub scheduling and Pages deployment delays; the open website refreshes snapshots every minute. New saves appear automatically. The status filter describes Tyler’s reading status, independently of visitors’ unread badges. Historical Git commits can retain previously published metadata.

Run `python3 scripts/sync_feeds.py read-later` with NOTION_TOKEN set for a local sync. Any query or schema error preserves the previous complete snapshot. Independent source steps let Read Later and the newsletter publish even when the writing source fails.


## My Domains → #what-i've-built

The Notion page formerly called My Domains is now What I’ve Built. The importer queries its child data source `3eb8153c-8a3e-80ec-9922-000bccb5a71c` every 15 minutes, using the existing read-only connection. It publishes only records with **Keep Private unchecked** and **Status = Live or Practice**. Any Parked/Sold status excludes the record, even if Live is also selected. Missing or renamed privacy fields fail closed. Archiving, deleting, or checking Keep Private removes the project after the next successful sync; previously public metadata remains in Git history.

Public fields are Name, derived HTTPS domain link, Description, project status and the explicit Notion `date ` property, plus a stable source identifier. Names must be domains (for example `example.com`); invalid eligible rows preserve the last successful snapshot and report an error. Files, page bodies, internal notes, and private records are never included. The timestamp matches the calendar date Tyler selected in Notion; it never falls back to row creation, row editing, or import time. Empty dates display “Date not set.”

The browser loads `data/websites.json`, combines it with the explicitly added TomoTomo App Store entry, and ignores stale browser-stored prototype projects. The Apps / Websites filters still apply. Renaming or updating a source record updates the same message, and new eligible rows appear automatically. The first production run must succeed before the channel can show the Notion sites.

Local command: `python3 scripts/sync_feeds.py domains` with NOTION_TOKEN set. Source failures leave the previous complete snapshot available and do not block the other sources from publishing.


## Watch or Listen Later

The public #watch-or-listen-later channel reads `data/watch.json`. GitHub Actions refreshes the Notion data source `ecf1cef2-0a76-4486-93ee-f558c8b9afd0` every 15 minutes using the existing Notion secret. Share the Watch or Listen Later database with that integration if access changes.

Publish only title, public Link, Added date, Type, and Status. Notes, Recommended by, files, and page bodies are excluded. Archived/trashed pages disappear on the next successful sync. An optional Keep Private checkbox excludes checked rows. Failed or incomplete syncs retain the previous snapshot.

Notion Movie / TV Show / Podcast / Documentary / Book map to the plural website filters. Other with a YouTube link maps to YouTube; other public links map to Online. Missing links remain visible as saved titles. YouTube thumbnails derive only from validated public video IDs. No video files are copied or hosted. The channel retains its internal `watch` ID to preserve existing links and read markers.


### Independent workflow results

The sync workflow has separate **Notion channels** and **Betting Antelope writing** jobs. A writing-source failure leaves its previous snapshot intact and keeps a failed status for visibility; it cannot mark the Notion job as failed. Jobs run sequentially to avoid snapshot push races. Each job includes a channel-by-channel summary. A successful local RSS request does not establish that GitHub's runner can access Substack; verify the writing job separately.


### Automatic link previews

`scripts/sync_previews.py` reads public links from the Read Later and built-project snapshots. It stores only page titles, short descriptions, site names, and original image/icon URLs in `data/previews.json`. It does not store article bodies or image files. The Notion sync refreshes newly added URLs and revisits cached sources weekly. Private/local destinations and signed file URLs are rejected; redirects are checked before following. Sites without available artwork use an explicit domain card. Existing metadata is retained when a source cannot refresh. The visible writing channel is named `betting-antelope`; its stable internal `writing` ID is unchanged.


Project timestamps in #what-i’ve-built come from the Notion `date ` property (matched case-insensitively after trimming whitespace), never the row’s creation or import timestamp. Calendar dates stay YYYY-MM-DD, so display and year filtering preserve the selected day. Empty dates display “Date not set”; a missing/renamed date property fails the sync without replacing the previous snapshot. The standalone TomoTomo app remains separate from this domains database.


Built-project previews use the original site's social artwork where available. `data/project-preview-sources.json` includes the standalone TomoTomo App Store URL in scheduled metadata refreshes and a public Mulvey.World gallery thumbnail fallback. GatoradeMovie and Tyler.Center have noninteractive, sandboxed page miniatures; Tyler.Center's preview mode skips feeds/accounts to avoid recursive previews. Butter.Living blocks framing, so its card uses its real public landing-page name and wording. Do not remove its frame restrictions or proxy around them. New projects without artwork receive a branded title/domain card. Every card remains one normal external link.

## Daily Newsletter Email app

Daily Newsletter editions now appear in the separate desktop Email app rather than a messaging channel. The app consumes the same validated `data/newsletters.json` snapshot and the existing scheduled Notion sync, so no new credentials or publishing destination are needed. Only public, Notion-synced digest editions appear in the inbox, newest first. Newsletter IDs and the `newsletters` read-state key stay unchanged, preserving prior read markers and saved-item links. New editions update the inbox while keeping the selected edition and reading position. Source failures retain the last available editions and display a refresh notice.
