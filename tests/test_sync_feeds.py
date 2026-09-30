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

    def test_rss_failure_uses_public_archive_and_preserves_history(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(sync, 'ROOT', Path(directory)):
            path = Path(directory) / 'data/writing.json'
            sync.sync_rss(rss('Old post','older'))
            incoming = sync.parse_rss(rss('New post','newer'))
            with patch.object(sync,'fetch',side_effect=sync.SourceHTTPError(403)), patch.object(sync,'collect_writing_archive',return_value=incoming):
                sync.sync_rss()
            self.assertEqual(len(sync.read_snapshot(path)),2)
            before = path.read_bytes()
            with patch.object(sync,'fetch',side_effect=sync.SourceHTTPError(403)), patch.object(sync,'collect_writing_archive',side_effect=sync.SourceHTTPError(503)):
                with self.assertRaises(sync.SourceHTTPError): sync.sync_rss()
            self.assertEqual(path.read_bytes(),before)

    def test_source_errors_only_log_safe_status_or_type(self):
        self.assertEqual(sync.error_summary(sync.SourceHTTPError(403)), 'HTTP 403')
        self.assertEqual(sync.error_summary(RuntimeError('secret or response body')), 'RuntimeError')

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


class ReadLaterTests(unittest.TestCase):
    def page(self, status='Read'):
        return {'id':'abc-123', 'created_time':'2026-09-01T12:00:00Z', 'properties': {
            'Title': {'title':[{'plain_text':'An article'}]},
            'Link': {'url':'https://example.com/story?utm_source=email&ueid=PRIVATE&part=2'},
            'Date added': {'created_time':'2026-08-01T12:00:00Z'},
            'Status': {'status':{'name':status} if status else None},
            'Notes': {'rich_text':[{'plain_text':'PRIVATE NOTE'}]},
            'ADHD Summary': {'rich_text':[{'plain_text':'PRIVATE SUMMARY'}]},
            'Files': {'files':[{'url':'https://private.example/PRIVATE.pdf'}]}}}

    def test_exact_public_allowlist_and_saved_date(self):
        record = sync.read_later_record(self.page())
        self.assertEqual(set(record), {'id','channel','source','title','url','publishedAt','readingStatus'})
        self.assertEqual(record['publishedAt'], '2026-08-01T12:00:00Z')
        self.assertEqual(record['url'], 'https://example.com/story?part=2')
        self.assertEqual(record['readingStatus'], 'Read')
        self.assertNotIn('PRIVATE', json.dumps(record))
        changed = self.page('Reading')
        changed['last_edited_time'] = '2026-09-30T12:00:00Z'
        self.assertEqual(sync.read_later_record(changed)['id'], record['id'])

    def test_unset_status_missing_links_and_removed_pages(self):
        page = self.page(None)
        page['properties']['Link']['url'] = None
        record = sync.read_later_record(page)
        self.assertEqual(record['readingStatus'], 'Not marked')
        self.assertEqual(record['url'], '')
        # Archive status remains a faithful status; actual archived pages disappear.
        self.assertEqual(sync.read_later_record(self.page('Archive'))['readingStatus'], 'Archive')
        page['archived'] = True
        self.assertIsNone(sync.read_later_record(page))
        with self.assertRaises(ValueError): sync.read_later_record(self.page('Unknown'))

    def test_private_and_signed_article_links_are_excluded(self):
        for url in ['https://app.notion.com/private', 'https://bucket.s3.amazonaws.com/private.pdf',
                    'https://example.com/file?X-Amz-Signature=private', 'https://example.com/file?token=private',
                    'http://127.0.0.1/private', 'https://user:pass@example.com/story']:
            self.assertEqual(sync.article_url(url), '')
        self.assertEqual(sync.article_url('https://example.com/story?giftId=public-gift'), 'https://example.com/story?giftId=public-gift')

    def test_only_queries_properties_and_keeps_snapshot_on_partial_failure(self):
        page = self.page()
        class FakeNotion:
            def pages(self, route, query=False):
                assert route == f'data_sources/{sync.READ_LATER}/query' and query
                yield page
                raise RuntimeError('second page failed')
        with tempfile.TemporaryDirectory() as directory, patch.object(sync, 'ROOT', Path(directory)), patch.dict(sync.os.environ, {'NOTION_TOKEN':'test'}):
            path = Path(directory) / 'data/articles.json'
            sync.write_snapshot(path, [sync.read_later_record(page)])
            before = path.read_bytes()
            with patch.object(sync, 'Notion', return_value=FakeNotion()):
                with self.assertRaises(RuntimeError): sync.sync_read_later()
            self.assertEqual(path.read_bytes(), before)
            with patch.object(sync, 'collect_read_later', return_value=[]): sync.sync_read_later()
            self.assertEqual(sync.read_snapshot(path), [])


class DomainSyncTests(unittest.TestCase):
    def page(self, private=False, statuses=('Live',)):
        return {'id':'domain-123','created_time':'2026-09-30T12:00:00Z','properties':{
            'Name':{'title':[{'plain_text':'Example.COM'}]},
            'Keep Private':{'type':'checkbox','checkbox':private},
            'Status':{'multi_select':[{'name':s} for s in statuses]},
            'Description':{'rich_text':[{'plain_text':'A public project.'}]},
            'files':{'files':[{'url':'SECRET_FILE'}]},'Notes':{'rich_text':[{'plain_text':'SECRET_NOTE'}]}}}
    def test_public_allowlist_domain_and_stable_identity(self):
        record=sync.domain_record(self.page())
        self.assertEqual(record['url'],'https://example.com/')
        self.assertEqual(record['projectStatus'],'Live')
        self.assertEqual(set(record),{'id','channel','source','title','url','description','projectStatus','publishedAt'})
        self.assertNotIn('SECRET',json.dumps(record))
        page=self.page();page['properties']['Name']['title'][0]['plain_text']='Renamed.com'
        self.assertEqual(sync.domain_record(page)['id'],record['id'])
    def test_private_archived_and_nonbuilt_domains_never_publish(self):
        self.assertIsNone(sync.domain_record(self.page(private=True)))
        for statuses in [(),('Parked',),('Sold',),('Live','Sold'),('Practice','Parked')]:
            self.assertIsNone(sync.domain_record(self.page(statuses=statuses)))
        self.assertEqual(sync.domain_record(self.page(statuses=('Practice',)))['projectStatus'],'Practice')
        for flag in ['archived','in_trash']:
            page=self.page();page[flag]=True;self.assertIsNone(sync.domain_record(page))
        for value in [{},{'type':'text','checkbox':False},{'type':'checkbox','checkbox':None}]:
            page=self.page();page['properties']['Keep Private']=value;self.assertIsNone(sync.domain_record(page))
    def test_invalid_public_names_fail_without_overwriting_snapshot(self):
        for name in ['My cool site','example.com/private','notion.so','localhost','https://example.com']:
            page=self.page();page['properties']['Name']['title'][0]['plain_text']=name
            with self.assertRaises(ValueError):sync.domain_record(page)
        with tempfile.TemporaryDirectory() as directory, patch.object(sync,'ROOT',Path(directory)), patch.dict(sync.os.environ,{'NOTION_TOKEN':'test'}):
            path=Path(directory)/'data/websites.json';sync.write_snapshot(path,[sync.domain_record(self.page())]);before=path.read_bytes()
            with patch.object(sync,'collect_domains',side_effect=RuntimeError('failed second page')):
                with self.assertRaises(RuntimeError):sync.sync_domains()
            self.assertEqual(path.read_bytes(),before)
            with patch.object(sync,'collect_domains',return_value=[]):sync.sync_domains()
            self.assertEqual(sync.read_snapshot(path),[])
