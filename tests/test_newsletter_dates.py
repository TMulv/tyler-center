import importlib.util
from pathlib import Path
import unittest


spec = importlib.util.spec_from_file_location('sync_feeds', Path(__file__).parents[1] / 'scripts/sync_feeds.py')
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)


class NewsletterDateTests(unittest.TestCase):
    def test_backfilled_doc_uses_edition_date(self):
        title = "The AI Capex Debt Cliff — Tuesday, September 29, 2026"
        self.assertEqual(sync.newsletter_published_at(title, '2026-10-01T13:00:00Z'),
                         '2026-09-29T12:00:00Z')

    def test_existing_edition_keeps_its_original_time(self):
        title = "A title — Wednesday, September 30, 2026"
        self.assertEqual(sync.newsletter_published_at(title, '2026-09-30T23:58:00Z'),
                         '2026-09-30T23:58:00Z')

    def test_title_without_date_uses_notion_creation(self):
        self.assertEqual(sync.newsletter_published_at('Daily digest', '2026-09-30T23:58:00Z'),
                         '2026-09-30T23:58:00Z')
