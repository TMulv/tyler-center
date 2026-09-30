# Publishing channel feeds

The site includes the full public Betting Antelope archive as linked previews and one existing newsletter edition as an initial snapshot. Neither the scheduled job nor the Notion API connection has been activated or tested against production from this checkout.

## Turn on RSS

Push this version to `TMulv/tyler-center` on `main`. The **Sync channel feeds** GitHub Actions workflow runs on this initial code push, manually, and at minutes 7, 22, 37 and 52 of every hour, every day. Publishing days do not need to be configured. It commits changed public JSON and explicitly requests a GitHub Pages build because commits made with `GITHUB_TOKEN` do not trigger a legacy Pages build on their own.

The workflow needs repository contents-write and Pages-write permissions (declared in the file). Check Actions → Sync channel feeds after the first push. Repository policies must permit the workflow to commit to main. No personal GitHub token is needed by the workflow.

Schedules can run late, and GitHub can disable schedules on public repositories after 60 days without repository activity. Allow time for both the scheduled check and Pages deployment. This is periodic publishing, not an instant webhook. An already-open site checks its public snapshots once a minute and on returning to the tab. Source failures preserve the last successful snapshot and fail the workflow rather than erase content.

## Connect the daily newsletter archive

1. Create an internal connection in Notion's Developer portal in the workspace containing **Daily Newsletter Digest**. Name it **Tyler.Center feed** and enable **Read content**; it does not need insert, update, or user information capabilities.
2. On [Daily Newsletter Digest](https://app.notion.com/p/074c794ec62f48cc97c9dc98fba14a32), choose **••• → Connections → Add connection** and select it. Ensure its Editions database is included. Sharing this archive grants inherited access to its children.
3. Copy its API token into a [GitHub Actions repository secret](https://github.com/TMulv/tyler-center/settings/secrets/actions/new) named **NOTION_TOKEN**. Do not put the key in website files or chat. Alternatively run `gh secret set NOTION_TOKEN --repo TMulv/tyler-center`; the CLI prompts for the value.
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
