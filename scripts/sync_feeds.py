#!/usr/bin/env python3
"""Build public snapshots. No API credentials or private inbox links reach the browser."""
import argparse
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from hashlib import sha256
from html.parser import HTMLParser
import ipaddress
import json
import os
from pathlib import Path
import re
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse, parse_qsl, urlencode, urlunparse
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
RSS_URL = 'https://bettingantelope.substack.com/feed'
WRITING_ARCHIVE_URL = 'https://bettingantelope.substack.com/api/v1/archive'
ARCHIVE = '074c794e-c62f-48cc-97c9-dc98fba14a32'
EDITIONS = 'aab9f113-6439-4714-9185-0cc08f9d70df'
READ_LATER = 'a08dfd74-875d-4998-affe-968c65c3e41f'
READING_STATUSES = ('To Read', 'Priority', 'Reading', 'Read', 'Archive', 'Not marked')
PRIVATE_HOSTS = ('mail.google.com', 'gmail.com', 'outlook.com', 'outlook.office.com',
                 'notion.so', 'notion.com', 'accounts.google.com', 'localhost')


def public_url(value):
    try:
        url = urlparse(value)
        host = url.hostname or ''
        if url.scheme not in ('https', 'http') or not host or url.username or url.password:
            return ''
        if any(host == h or host.endswith('.' + h) for h in PRIVATE_HOSTS):
            return ''
        if '.' not in host or host.endswith(('.local', '.internal')):
            return ''
        try:
            if not ipaddress.ip_address(host).is_global:
                return ''
        except ValueError:
            pass
        return value
    except ValueError:
        return ''


def clean_text(value, strip=True):
    # Also remove private URLs that the agent pasted as plain text.
    result = re.sub(r'https?://[^\s<>\)\]]+', lambda m: m[0] if public_url(m[0]) else '', value)
    return result.strip() if strip else result


class PlainHTML(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
        self.hidden = 0

    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style'):
            self.hidden += 1
        if tag in ('p', 'br', 'div', 'li') and not self.hidden:
            self.parts.append(' ')

    def handle_endtag(self, tag):
        if tag in ('script', 'style'):
            self.hidden = max(0, self.hidden - 1)
        if tag in ('p', 'div', 'li') and not self.hidden:
            self.parts.append(' ')

    def handle_data(self, data):
        if not self.hidden:
            self.parts.append(data)


def plain_html(value):
    parser = PlainHTML()
    parser.feed(value)
    return clean_text(' '.join(''.join(parser.parts).split()))


def iso_date(value):
    try:
        date = datetime.fromisoformat(value.replace('Z', '+00:00'))
    except ValueError:
        date = parsedate_to_datetime(value)
    if not date.tzinfo:
        date = date.replace(tzinfo=timezone.utc)
    return date.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')


class SourceHTTPError(RuntimeError):
    def __init__(self, status):
        self.status = int(status)
        super().__init__(f'Source returned HTTP {self.status}')


def error_summary(error):
    # Only diagnostic codes/types: never exception bodies, URLs, headers, or tokens.
    return f'HTTP {error.status}' if isinstance(error, SourceHTTPError) else type(error).__name__


def fetch(url, headers=None, data=None):
    request = Request(url, headers={'User-Agent': 'TylerCenterFeed/1.0', **(headers or {})},
                      data=json.dumps(data).encode() if data is not None else None)
    for attempt in range(4):
        try:
            with urlopen(request, timeout=30) as response:
                result = response.read(8_000_001)
                if len(result) > 8_000_000:
                    raise ValueError('Source exceeds size limit')
                return result
        except HTTPError as error:
            if error.code not in (429, 500, 502, 503, 504) or attempt == 3:
                # Do not echo response bodies, request headers, or tokens.
                raise SourceHTTPError(error.code) from None
            time.sleep(min(10, 2 ** attempt))


def read_snapshot(path):
    return json.loads(path.read_text())['entries'] if path.exists() else []


def write_snapshot(path, entries):
    payload = {'version': 1, 'entries': sorted(entries, key=lambda e: (e['publishedAt'], e['id']))}
    serialized = json.dumps(payload, ensure_ascii=False, indent=2) + '\n'
    if path.exists() and path.read_text() == serialized:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix('.tmp')
    temporary.write_text(serialized)
    temporary.replace(path)


def parse_rss(xml):
    root = ET.fromstring(xml)
    items = root.findall('./channel/item')
    if not items:
        raise ValueError('RSS has no posts; keeping the previous snapshot')
    records = []
    for item in items:
        url = public_url((item.findtext('link') or '').strip())
        if not url or urlparse(url).hostname != 'bettingantelope.substack.com':
            raise ValueError('Unexpected RSS post URL')
        title = plain_html(item.findtext('title') or '')
        if not title:
            raise ValueError('RSS post is missing a title')
        preview = plain_html(item.findtext('description') or '')
        if len(preview) > 240:
            preview = preview[:237].rsplit(' ', 1)[0] + '…'
        # Canonical article URL stays stable if the RSS GUID changes.
        identity = url.split('?')[0].rstrip('/')
        records.append({'id': 'rss-' + sha256(identity.encode()).hexdigest()[:24],
                        'channel': 'writing', 'source': 'rss', 'kind': 'Betting Antelope',
                        'domain': 'bettingantelope.substack.com', 'title': title,
                        'url': identity, 'description': preview, 'publishedAt': iso_date(item.findtext('pubDate') or '')})
        enclosure = item.find('enclosure')
        image = public_url(enclosure.get('url', '')) if enclosure is not None and enclosure.get('type', '').startswith('image/') else ''
        if image:
            records[-1]['image'] = image
    return records


def collect_writing_archive():
    """Backfill public metadata only, including links to subscriber-only posts."""
    records = {}
    offset = 0
    while True:
        page = json.loads(fetch(f'{WRITING_ARCHIVE_URL}?sort=new&offset={offset}&limit=20'))
        if not isinstance(page, list):
            raise ValueError('Unexpected archive response')
        if not page:
            if not records:
                raise ValueError('Archive has no posts; keeping the previous snapshot')
            return list(records.values())
        previous_count = len(records)
        for post in page:
            url = public_url(post.get('canonical_url', ''))
            if not url or urlparse(url).hostname != 'bettingantelope.substack.com' or not urlparse(url).path.startswith('/p/'):
                raise ValueError('Unexpected archive post URL')
            identity = url.split('?')[0].rstrip('/')
            title = plain_html(post.get('title') or '')
            if not title:
                raise ValueError('Archive post is missing a title')
            preview = plain_html(post.get('subtitle') or '')
            if len(preview) > 240:
                preview = preview[:237].rsplit(' ', 1)[0] + '…'
            record = {'id': 'rss-' + sha256(identity.encode()).hexdigest()[:24],
                      'channel': 'writing', 'source': 'rss', 'kind': 'Betting Antelope',
                      'domain': 'bettingantelope.substack.com', 'title': title,
                      'url': identity, 'description': preview,
                      'publishedAt': iso_date(post.get('post_date') or '')}
            image = public_url(post.get('cover_image') or '')
            if image:
                record['image'] = image
            records[record['id']] = record
        if len(records) == previous_count:
            raise ValueError('Archive pagination did not advance')
        offset += len(page)


def sync_rss(xml=None, backfill=False):
    path = ROOT / 'data/writing.json'
    records = {e['id']: e for e in read_snapshot(path)}
    if backfill:
        records.update({e['id']: e for e in collect_writing_archive()})
    if xml is not None:
        incoming = parse_rss(xml)
    else:
        try:
            incoming = parse_rss(fetch(RSS_URL))
        except (SourceHTTPError, URLError, TimeoutError, ET.ParseError, ValueError) as error:
            print(f'::warning::RSS unavailable ({error_summary(error)}); trying the public publication archive.')
            incoming = collect_writing_archive()
    records.update({e['id']: e for e in incoming})
    write_snapshot(path, list(records.values()))


class Notion:
    def __init__(self, token):
        self.headers = {'Authorization': 'Bearer ' + token, 'Notion-Version': '2025-09-03',
                        'Content-Type': 'application/json'}

    def request(self, route, body=None):
        return json.loads(fetch('https://api.notion.com/v1/' + route, self.headers, body))

    def pages(self, route, query=False):
        cursor = None
        while True:
            args = {'page_size': 100, **({'start_cursor': cursor} if cursor else {})}
            result = self.request(route, args) if query else self.request(
                route + '?page_size=100' + ('&start_cursor=' + cursor if cursor else ''))
            yield from result['results']
            if not result.get('has_more'):
                break
            cursor = result['next_cursor']


def rich_text(items, links, runs=None):
    parts = []
    for item in items:
        text = item.get('plain_text', item.get('text', {}).get('content', ''))
        href = item.get('href') or (item.get('text', {}).get('link') or {}).get('url')
        if href and not public_url(href):
            # Remove private citation markers but retain meaningful source labels.
            if re.fullmatch(r'[\s\[\]\d]+', text):
                continue
        elif href:
            links[href] = clean_text(text) or urlparse(href).hostname
        text = clean_text(text, strip=False)
        parts.append(text)
        for match in re.finditer(r'https?://[^\s<>]+', text):
            url = match[0].rstrip('.,;!?)]')
            if public_url(url):
                links.setdefault(url, urlparse(url).hostname)
        if runs is not None and text:
            annotations = item.get('annotations', {})
            runs.append({'text': text, 'url': public_url(href) if href else '',
                         'bold': bool(annotations.get('bold')), 'italic': bool(annotations.get('italic'))})
    return clean_text(''.join(parts))


def digest_blocks(api, page_id, links, depth=0, blocks=None):
    if depth > 12:
        raise ValueError('Digest block nesting exceeds limit')
    lines = []
    for block in api.pages(f'blocks/{page_id}/children'):
        kind = block['type']
        content = block.get(kind, {})
        runs = []
        text = rich_text(content.get('rich_text', []), links, runs)
        if text:
            lines.append(('• ' if kind in ('bulleted_list_item', 'numbered_list_item') else '') + text)
            if blocks is not None:
                blocks.append({'type': kind, 'runs': runs})
        # Skip attachments, embeds, child pages and raw email files.
        if block.get('has_children') and kind not in ('child_page', 'child_database', 'synced_block'):
            lines.extend(digest_blocks(api, block['id'], links, depth + 1, blocks))
    return lines


def collect_digests(api):
    overrides_path = ROOT / 'scripts/newsletter-links.json'
    overrides = json.loads(overrides_path.read_text()) if overrides_path.exists() else {}
    pages = {p['id']: p for p in api.pages(f'data_sources/{EDITIONS}/query', query=True)}
    for block in api.pages(f'blocks/{ARCHIVE}/children'):
        if block['type'] == 'child_page':
            page = api.request('pages/' + block['id'])
            pages[page['id']] = page
    records = []
    for page in pages.values():
        if page.get('archived') or page.get('in_trash'):
            continue
        links = {}
        title = next((rich_text(p['title'], {}) for p in page['properties'].values() if p['type'] == 'title'), '')
        blocks = []
        lines = digest_blocks(api, page['id'], links, blocks=blocks)
        if not title or not lines:
            continue
        source_links = [{'title': label, 'url': url} for url, label in links.items()]
        body = '\n\n'.join(lines)
        for source in overrides.get(page['id'], []):
            if source.get('text') in body and public_url(source.get('url', '')):
                source_links = [s for s in source_links if s['url'] != source['url']]
                source_links.append(source)
        records.append({'id': 'digest-' + page['id'], 'channel': 'newsletters', 'source': 'notion',
                        'kind': 'Agent-written digest', 'domain': 'Daily newsletter digest',
                        'title': title, 'url': '', 'description': lines[0][:300],
                        'body': body, 'blocks': blocks, 'publishedAt': iso_date(page['created_time']),
                        'links': source_links})
    return records


def article_url(value):
    safe = public_url(value or '')
    if not safe:
        return ''
    url = urlparse(safe)
    # Never republish signed file URLs, even if pasted into the Link property.
    host = url.hostname or ''
    if host.endswith(('.amazonaws.com', '.notion-static.com', '.notionusercontent.com')):
        return ''
    params = parse_qsl(url.query, keep_blank_values=True)
    if any(k.lower().startswith(('x-amz-', 'x-goog-')) or k.lower() in ('signature', 'token', 'access_token') for k, _ in params):
        return ''
    params = [(k, v) for k, v in params if not k.lower().startswith('utm_') and k.lower() not in ('ueid', 'fbclid', 'gclid', 'mc_cid', 'mc_eid')]
    return urlunparse(url._replace(query=urlencode(params)))


def read_later_record(page):
    if page.get('archived') or page.get('in_trash'):
        return None
    props = page['properties']
    status = (props.get('Status', {}).get('status') or {}).get('name') or 'Not marked'
    if status not in READING_STATUSES:
        raise ValueError('Unknown reading status; review mapping before publishing')
    title = rich_text(props['Title']['title'], {}).replace('**', '').replace(r'\|', '|').strip()
    if not title:
        raise ValueError('Read Later title is missing')
    date = props.get('Date added', {}).get('created_time') or page['created_time']
    # Explicit public allowlist: never read notes, summaries, page blocks, or files.
    return {'id': 'readlater-' + page['id'].replace('-', ''), 'channel': 'articles',
            'source': 'notion', 'title': title, 'url': article_url(props.get('Link', {}).get('url')),
            'publishedAt': iso_date(date), 'readingStatus': status}


def collect_read_later(api):
    records = []
    for page in api.pages(f'data_sources/{READ_LATER}/query', query=True):
        record = read_later_record(page)
        if record:
            records.append(record)
    return records


def sync_read_later():
    token = os.environ.get('NOTION_TOKEN', '').strip()
    if not token:
        raise RuntimeError('Read Later requires NOTION_TOKEN')
    # Collect every page first: partial failures must leave the last good file intact.
    records = collect_read_later(Notion(token))
    write_snapshot(ROOT / 'data/articles.json', records)


def sync_notion():
    token = os.environ.get('NOTION_TOKEN', '').strip()
    if not token:
        print('::notice::Newsletter sync awaits NOTION_TOKEN_NEWSLETTER (or NOTION_TOKEN) in repository secrets. Existing digest snapshot kept.')
        return
    # Only replace after all pages succeed. Deletions in Notion then remove public editions.
    write_snapshot(ROOT / 'data/newsletters.json', collect_digests(Notion(token)))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('source', choices=['rss', 'notion', 'read-later'])
    parser.add_argument('--backfill', action='store_true', help='Import the full public writing archive before syncing RSS')
    args = parser.parse_args()
    try:
        if args.source == 'rss':
            sync_rss(backfill=args.backfill)
        elif args.source == 'read-later':
            sync_read_later()
        else:
            sync_notion()
    except Exception as error:
        print(f'::error::{args.source} sync failed ({error_summary(error)}); previous snapshot kept.', file=sys.stderr)
        sys.exit(1)
