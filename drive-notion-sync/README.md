# Google Doc → Notion newsletter sync

This Google Apps Script watches the [Daily Newsletter Digest - Editions Queue](https://drive.google.com/drive/u/0/folders/1mhNmOwgL3lBMlrWAdNZQNiHZ3uZ-Lk9o) folder. It copies each finished Google Doc's Markdown text into the existing Notion **Editions** data source. The website's existing GitHub job then copies those Notion pages to the Email app. Zapier is not needed.

## One-time connection

1. While signed into the **West Shore** Google account, open [Apps Script](https://script.google.com/home/projects/create). Name the project `Daily Newsletter → Notion`.
2. Replace the default `Code.gs` with this directory's [Code.gs](Code.gs). In **Project Settings**, enable **Show appsscript.json manifest file in editor**, then replace the manifest with [appsscript.json](appsscript.json). Save both files. The manifest limits Google's access to read-only Drive, external requests, and trigger management.
3. In Notion, create a **separate internal connection** with **Read content**, **Insert content**, and **Insert property** capabilities. Share only the **Daily Newsletter Digest → Editions** database with it. Keep the website's existing read-only Notion connection unchanged.
4. In Apps Script, open **Project Settings → Script properties → Add script property**. Set the name to `NOTION_TOKEN` and the value to the new Notion connection's token. Do not put the token in code, Git, or chat.
5. Run `checkNewsletterConnections` once. Google will ask you to authorize read-only access to your Drive, external requests, and trigger management. Confirm the account and permissions yourself. The execution log should say the connections work.
6. Run `syncNewsletterDocs` once. It will backfill missing Docs, including the September 29 edition, while skipping titles already in Notion.
7. Run `installNewsletterTrigger` once. New Docs in the folder will be checked every 15 minutes. Check **Executions** for errors.

The script uses the Google Doc filename as the Notion page title, removing a trailing `.md`. It sends the Doc's actual Markdown body so headings and public links become Notion blocks. It refuses an empty Doc or one with private inbox/Notion links. It checks all existing Notion edition titles before creating a page, preventing repeat imports. If a Doc is edited after import, edit its Notion page separately; this sync does not overwrite published editions.

The website's GitHub workflow checks Notion every 15 minutes, so a new edition may take two scheduled runs plus Pages deployment time to appear. A failed Notion/Drive read does not create a blank edition. The existing website snapshot remains available if its own feed job fails.
