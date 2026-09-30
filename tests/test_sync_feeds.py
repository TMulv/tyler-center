import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('sync', Path(__file__).parents[1] / 'scripts/sync_feeds.py')
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)


def rss(title='Post', slug='post'):
    return f'<rss><channel><item><title>{title}</title><link>https://bettingantelope.substack.com/p/{slug}</link><pubDate>Mon, 28 Sep 2026 23:43:38 GMT</pubDate><description>&lt;p&gt;Hello&lt;/p&gt;&lt;script&gt;evil&lt;/script&gt;</description></item></channel></rss>'


class SyncTests(unittest.TestCase):
    def test_rss_dedup_edits_retention_and_failure(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(sync, 'ROOT', Path(directory)):
            path = Path(directory) / 'data/writing.json'
            sync.sync_rss(rss())
            sync.sync_rss(rss('Edited'))
            sync.sync_rss(rss('Older remains', 'next'))
            entries = sync.read_snapshot(path)
            self.assertEqual(len(entries), 2)
            self.assertEqual(entries[0]['description'], 'Hello')
            self.assertIn('Edited', [e['title'] for e in entries])
            before = path.read_bytes()
            with self.assertRaises(Exception):
                sync.sync_rss('<broken')
            self.assertEqual(path.read_bytes(), before)
            sync.sync_rss(rss('Older remains', 'next'))
            self.assertEqual(path.read_bytes(), before)

    def test_rss_keeps_source_image_metadata(self):
        xml = rss().replace('</item>', '<enclosure type="image/jpeg" url="https://substackcdn.com/image/cover.jpg"/></item>')
        self.assertEqual(sync.parse_rss(xml)[0]['image'], 'https://substackcdn.com/image/cover.jpg')
        self.assertNotIn('image', sync.parse_rss(xml.replace('https://substackcdn.com/image/cover.jpg', 'http://127.0.0.1/private'))[0])

    def test_invalid_feed_keeps_snapshot(self):
        for xml in ['<rss/>', rss().replace('bettingantelope.substack.com','evil.example'), rss().replace('Mon, 28 Sep 2026 23:43:38 GMT','bad')]:
            with self.assertRaises(Exception):
                sync.parse_rss(xml)

    def test_archive_pagination_and_rss_overlap(self):
        def post(slug):
            return {'title':slug, 'subtitle':'A preview', 'canonical_url':f'https://bettingantelope.substack.com/p/{slug}',
                    'post_date':'2025-01-01T12:00:00Z', 'body_html':'Private full text', 'audience':'only_paid'}
        with tempfile.TemporaryDirectory() as directory, patch.object(sync, 'ROOT', Path(directory)):
            with patch.object(sync, 'fetch', side_effect=[json.dumps([post('post')]).encode(), json.dumps([post('older')]).encode(), b'[]']) as fetch:
                sync.sync_rss(rss(), backfill=True)
                self.assertIn('offset=1', fetch.call_args_list[1].args[0])
                self.assertIn('offset=2', fetch.call_args_list[2].args[0])
            path = Path(directory) / 'data/writing.json'
            entries = sync.read_snapshot(path)
            self.assertEqual(len(entries), 2)
            self.assertEqual(entries[0]['title'], 'older')
            self.assertNotIn('Private full text', path.read_text())
            before = path.read_bytes()
            for responses in [[b'[]'], [json.dumps([post('another')]).encode(), RuntimeError('failed')],
                              [json.dumps([post('another')]).encode()] * 2]:
                with patch.object(sync, 'fetch', side_effect=responses):
                    with self.assertRaises(Exception):
                        sync.sync_rss(rss(), backfill=True)
                self.assertEqual(path.read_bytes(), before)
            sync.sync_rss(rss())
            self.assertEqual(len(sync.read_snapshot(path)), 2)

    def test_private_links_never_published(self):
        links = {}
        text = sync.rich_text([
            {'plain_text':'Read '}, {'plain_text':'this', 'href':'https://example.com/article'},
            {'plain_text':'[1]', 'href':'https://mail.google.com/mail/u/0/#all/private'},
            {'plain_text':' https://app.notion.com/p/private'},
        ], links)
        self.assertEqual(text, 'Read this')
        self.assertEqual(list(links), ['https://example.com/article'])
        for url in ['https://mail.google.com/a', 'https://app.notion.com/p/a', 'http://127.0.0.1/a', 'javascript:alert(1)', 'https://user:pass@example.com']:
            self.assertEqual(sync.public_url(url), '')

    def test_rich_text_preserves_inline_links_emphasis_and_bare_urls(self):
        links, runs = {}, []
        text = sync.rich_text([
            {'plain_text':'Read ', 'annotations':{}},
            {'plain_text':'the story', 'text':{'link':{'url':'https://example.com/story'}}, 'annotations':{'bold':True}},
            {'plain_text':' or https://example.com/other.'},
        ], links, runs)
        self.assertEqual(text, 'Read the story or https://example.com/other.')
        self.assertEqual(runs[1]['url'], 'https://example.com/story')
        self.assertTrue(runs[1]['bold'])
        self.assertIn('https://example.com/other', links)

    def test_notion_pagination(self):
        api = sync.Notion('test')
        with patch.object(api,'request',side_effect=[{'results':[1], 'has_more':True, 'next_cursor':'cursor'}, {'results':[2], 'has_more':False}]) as request:
            self.assertEqual(list(api.pages('data_sources/id/query',query=True)), [1,2])
            self.assertEqual(request.call_args.args[1]['start_cursor'], 'cursor')

    def test_database_and_direct_child_editions_deduplicate(self):
        page = {'id':'edition', 'created_time':'2026-09-25T00:00:00Z', 'properties':{'Name':{'type':'title','title':[{'plain_text':'Daily digest'}]}}}
        class FakeNotion:
            def pages(self, route, query=False):
                if query:
                    return [page]
                if sync.ARCHIVE in route:
                    return [{'id':'edition','type':'child_page'}]
                return [{'id':'paragraph','type':'paragraph','paragraph':{'rich_text':[{'plain_text':'Highlights.'}]}}]
            def request(self, route):
                return page
        records = sync.collect_digests(FakeNotion())
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]['body'], 'Highlights.')
        self.assertEqual(records[0]['url'], '')
        self.assertEqual(records[0]['blocks'][0]['runs'][0]['text'], 'Highlights.')


if __name__ == '__main__':
    unittest.main()
