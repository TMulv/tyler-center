# Tyler.Center rules

## Notion project dates

- For `#what-i've-built`, use the My Domains database's explicit `date ` property. Match its name case-insensitively after trimming whitespace; the current property has a trailing space.
- Never substitute Notion row creation/edit times, sync times, or today's date for a project date.
- Preserve date-only values as `YYYY-MM-DD` throughout import, display, ordering, and year filters. Do not convert them through UTC and shift the calendar day.
- Empty dates display “Date not set.” Missing, renamed, ambiguous, or invalid date properties fail the sync and preserve the last good snapshot.
- Keep the standalone TomoTomo entry separate from the Notion domains source.
- When changing this mapping, run the date regression tests and compare the public snapshot with the selected dates in Notion. See `FEED-SETUP.md`.

## Beach camera

- The Jersey Shore icon opens its own draggable, resizable window, separate from the channel window.
- Embed only the provider-approved player, never the full webcam website.
- Use AtTheShore’s standalone `combined-player?id=14thstreetpierpzt` player for the Ocean City Fishing Club camera. The provider manages its own stream tokens; never save expiring stream URLs or generate tokens. Do not proxy around stream restrictions.
- Keep the source credit and an external fallback link. Closing the window must remove the player and stop playback.
- An HTTP success or iframe load event does not prove video playback. Verify playback in a browser before reporting it working; state clearly when verification is blocked.
