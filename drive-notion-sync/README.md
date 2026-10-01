# Google Doc → Notion newsletter sync

This Google Apps Script watches the [Daily Newsletter Digest - Editions Queue](https://drive.google.com/drive/u/0/folders/1mhNmOwgL3lBMlrWAdNZQNiHZ3uZ-Lk9o) folder. Gemini Spark should create one dated Google Doc there and add to that same Doc throughout the day. The script saves cumulative 8am, 12pm, 4pm, and 8pm views inside **one Notion Editions page**, and the website displays that page as one Email message.

## One-time connection

1. While signed into the **West Shore** Google account, open [Apps Script](https://script.google.com/home/projects/create). Name the project `Daily Newsletter → Notion`.
2. Replace the default `Code.gs` with this directory's [Code.gs](Code.gs). In **Project Settings**, enable **Show appsscript.json manifest file in editor**, then replace the manifest with [appsscript.json](appsscript.json). Save both files. The manifest limits Google's access to read-only Drive, external requests, and trigger management.
3. In Notion, create a **separate internal connection** with **Read content**, **Insert content**, and **Insert property** capabilities. Share only the **Daily Newsletter Digest → Editions** database with it. Keep the website's existing read-only Notion connection unchanged.
4. In Apps Script, open **Project Settings → Script properties → Add script property**. Set the name to `NOTION_TOKEN` and the value to the new Notion connection's token. Do not put the token in code, Git, or chat.
5. Run `checkNewsletterConnections` once. Google will ask you to authorize read-only access to your Drive, external requests, and trigger management. Confirm the account and permissions yourself. The execution log should say the connections work.
6. Run `syncNewsletterDocs` once. It will backfill missing older Docs while skipping titles already in Notion.
7. Run `installNewsletterTrigger` once, unless the Triggers page already shows one time-based `syncNewsletterDocs` trigger. The existing trigger checks every 15 minutes. Check **Executions** for errors.

For a Doc whose filename ends with today's written date (for example, “Thursday, October 1, 2026”), the script captures the whole Doc starting at 8am, 12pm, 4pm, and 8pm **America/New_York**. During each four-hour window, a later Doc edit creates a newer version of that active time slot; previous slots stay frozen. The 15-minute timer means the website can lag a Doc edit by the Drive check, Notion feed check, and Pages deployment. A Doc missing from a window gets no invented snapshot for that window. The site's **Full** view follows the latest available pass. The Notion page uses collapsible toggles so the passes do not fill the page at once. Earlier revisions of the active slot remain in Notion as history; the site shows the newest one.

Spark must actually put today's Doc in the queue. If it does not, no edition can appear. Check Spark's task and schedule status, then check the queue for a dated Google Doc before troubleshooting this sync.

The script uses the Google Doc filename as the Notion page title, removing a trailing `.md`. It refuses a short Doc or one with private inbox/Notion links. Existing historical pages remain unchanged and retain their original IDs; previously missed older Docs still import once. A pre-existing page with the same title is never overwritten by the snapshot workflow.

The website's GitHub workflow checks Notion every 15 minutes, so a new edition may take two scheduled runs plus Pages deployment time to appear. A failed Notion/Drive read does not create a blank edition. The existing website snapshot remains available if its own feed job fails.
