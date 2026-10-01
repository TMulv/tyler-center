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
READER_ARCHIVE_URL = 'https://r.jina.ai/' + WRITING_ARCHIVE_URL
SUBSTACK_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    'Accept': 'application/rss+xml, application/xml;q=0.9, application/json;q=0.8, */*;q=0.7',
}
ARCHIVE = '074c794e-c62f-48cc-97c9-dc98fba14a32'
EDITIONS = 'aab9f113-6439-4714-9185-0cc08f9d70df'
DOMAINS = '3eb8153c-8a3e-80ec-9922-000bccb5a71c'
READ_LATER = 'a08dfd74-875d-4998-affe-968c65c3e41f'
WATCH_LATER = 'ecf1cef2-0a76-4486-93ee-f558c8b9afd0'
MEDIA_TYPES = ('YouTube', 'Online', 'Movies', 'TV Shows', 'Podcasts', 'Documentaries', 'Books', 'Other')
WATCH_STATUSES = ('Want to see','Want to listen','Want to read','Watching','Listening','Reading','Finished','Skipped','Not marked')
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
    payload = {'version': 1, 'entries': sorted(entries, key=lambda e: (e['publishedAt'] or '', e['id']))}
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


def writing_archive_page(offset):
    query = f'?sort=new&offset={offset}&limit=20'
    try:
        return json.loads(fetch(WRITING_ARCHIVE_URL + query, headers=SUBSTACK_HEADERS))
    except SourceHTTPError as error:
        if error.status != 403:
            raise
        # GitHub's runner is blocked by Substack. The reader exposes the same
        # public JSON as text; check its source before trusting its contents.
        response = fetch(READER_ARCHIVE_URL + query, headers={'Accept': 'text/plain'}).decode()
        source = f'URL Source: {WRITING_ARCHIVE_URL + query}\n'
        marker = '\nMarkdown Content:\n'
        if source not in response or marker not in response:
            raise ValueError('Unexpected reader archive response')
        return json.loads(response.split(marker, 1)[1])


def collect_writing_archive(latest_only=False):
    """Backfill public metadata only, including links to subscriber-only posts."""
    records = {}
    offset = 0
    while True:
        page = writing_archive_page(offset)
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
        if latest_only:
            return list(records.values())
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
            incoming = parse_rss(fetch(RSS_URL, headers=SUBSTACK_HEADERS))
        except (SourceHTTPError, URLError, TimeoutError, ET.ParseError, ValueError) as error:
            print(f'::warning::RSS unavailable ({error_summary(error)}); trying the public publication archive.')
            incoming = collect_writing_archive(latest_only=True)
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


def digest_blocks(api, page_id, links, depth=0, blocks=None, items=None):
    if depth > 12:
        raise ValueError('Digest block nesting exceeds limit')
    lines = []
    for block in items if items is not None else api.pages(f'blocks/{page_id}/children'):
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


def newsletter_published_at(title, created_time):
    # Keep the source date when an older Google Doc reaches Notion later.
    created = iso_date(created_time)
    match = re.search(
        r'\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+'
        r'([A-Za-z]{3,9})\s+(\d{1,2}),\s+(\d{4})\b', title, re.I)
    if not match:
        return created
    month, day, year = match.groups()
    try:
        edition = datetime.strptime(f'{month} {day} {year}', '%B %d %Y')
    except ValueError:
        try:
            edition = datetime.strptime(f'{month} {day} {year}', '%b %d %Y')
        except ValueError:
            return created
    date = edition.strftime('%Y-%m-%d')
    return created if created.startswith(date) else date + 'T12:00:00Z'


def collect_digests(api):
    overrides_path = ROOT / 'scripts/newsletter-links.json'
    overrides = json.loads(overrides_path.read_text()) if overrides_path.exists() else {}
    pages = {p['id']: p for p in api.pages(f'data_sources/{EDITIONS}/query', query=True)}
    for block in api.pages(f'blocks/{ARCHIVE}/children'):
        if block['type'] == 'child_page':
            page = api.request('pages/' + block['id'])
            pages[page['id']] = page
    records = []
    snapshot_names = {'Morning edition': 'morning', 'Midday pass': 'midday',
                      'Afternoon edition': 'afternoon', 'Evening edition': 'evening'}
    snapshot_order = ('morning', 'midday', 'afternoon', 'evening')
    for page in pages.values():
        if page.get('archived') or page.get('in_trash'):
            continue
        title = next((rich_text(p['title'], {}) for p in page['properties'].values() if p['type'] == 'title'), '')
        if not title:
            continue
        top = list(api.pages(f'blocks/{page["id"]}/children'))
        versions = {}
        for block in top:
            if block['type'] != 'toggle':
                continue
            name = rich_text(block.get('toggle', {}).get('rich_text', []), {})
            stage = snapshot_names.get(name)
            if not stage:
                continue
            stage_links, stage_blocks = {}, []
            stage_lines = digest_blocks(api, block['id'], stage_links, blocks=stage_blocks)
            if not stage_lines:
                continue
            stage_body = '\n\n'.join(stage_lines)
            stage_sources = [{'title': label, 'url': url} for url, label in stage_links.items()]
            for source in overrides.get(page['id'], []):
                if source.get('text') in stage_body and public_url(source.get('url', '')):
                    stage_sources = [s for s in stage_sources if s['url'] != source['url']]
                    stage_sources.append(source)
            versions[stage] = {'body': stage_body, 'blocks': stage_blocks, 'links': stage_sources}
        if versions:
            latest = next(stage for stage in reversed(snapshot_order) if stage in versions)
            current = versions[latest]
            lines = current['body'].split('\n\n')
            body, blocks, source_links = current['body'], current['blocks'], current['links']
            versions['full'] = current
        else:
            links, blocks = {}, []
            lines = digest_blocks(api, page['id'], links, blocks=blocks, items=top)
            if not lines:
                continue
            body = '\n\n'.join(lines)
            source_links = [{'title': label, 'url': url} for url, label in links.items()]
            for source in overrides.get(page['id'], []):
                if source.get('text') in body and public_url(source.get('url', '')):
                    source_links = [s for s in source_links if s['url'] != source['url']]
                    source_links.append(source)
        records.append({'id': 'digest-' + page['id'], 'channel': 'newsletters', 'source': 'notion',
                        'kind': 'Agent-written digest', 'domain': 'Daily newsletter digest',
                        'title': title, 'url': '', 'description': lines[0][:300],
                        'body': body, 'blocks': blocks, 'publishedAt': newsletter_published_at(title, page['created_time']),
                        'links': source_links, **({'versions': versions} if versions else {})})
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


def project_date(properties):
    # The current Notion property is named "date " (with a trailing space).
    fields = [value for name, value in properties.items() if name.strip().lower() == 'date']
    if len(fields) != 1 or fields[0].get('type') != 'date':
        raise ValueError('Project date property is missing or ambiguous')
    date = fields[0].get('date')
    if not date or not date.get('start'):
        return None
    start = date['start']
    if re.fullmatch(r'\d{4}-\d{2}-\d{2}', start):
        datetime.fromisoformat(start)  # Validate while retaining calendar-date precision.
        return start
    return iso_date(start)


def domain_record(page):
    if page.get('archived') or page.get('in_trash'):
        return None
    props = page['properties']
    # Fail closed if the privacy property is missing, renamed or not a checkbox.
    privacy = props.get('Keep Private', {})
    if privacy.get('type') != 'checkbox' or privacy.get('checkbox') is not False:
        return None
    statuses = {s['name'] for s in props.get('Status', {}).get('multi_select', [])}
    if statuses & {'Parked', 'Sold'} or not statuses & {'Live', 'Practice'}:
        return None
    title = rich_text(props.get('Name', {}).get('title', []), {})
    # Current source stores the public domain as Name; no page-body scraping.
    if not re.fullmatch(r'(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}', title):
        raise ValueError('Public project Name must be a domain')
    url = public_url('https://' + title.lower() + '/')
    if not url:
        raise ValueError('Project domain is not public')
    status = 'Live' if 'Live' in statuses else 'Practice'
    return {'id':'domain-' + page['id'].replace('-', ''), 'channel':'websites', 'source':'notion',
            'title':title, 'url':url, 'description':rich_text(props.get('Description', {}).get('rich_text', []), {}),
            'projectStatus':status, 'publishedAt':project_date(props)}


def collect_domains(api):
    records = []
    for page in api.pages(f'data_sources/{DOMAINS}/query', query=True):
        record = domain_record(page)
        if record:
            records.append(record)
    return records


def sync_domains():
    token = os.environ.get('NOTION_TOKEN', '').strip()
    if not token:
        raise RuntimeError('My Domains requires NOTION_TOKEN')
    write_snapshot(ROOT / 'data/websites.json', collect_domains(Notion(token)))


def watch_later_record(page):
    if page.get('archived') or page.get('in_trash'):
        return None
    props = page['properties']
    privacy = props.get('Keep Private')
    if privacy is not None and (privacy.get('type') != 'checkbox' or privacy.get('checkbox') is not False):
        return None
    title = rich_text(props['Title']['title'], {}).replace('**', '').replace(r'\|', '|').strip()
    if not title:
        raise ValueError('Watch Later title is missing')
    url = article_url(props.get('Link', {}).get('url'))
    kind = (props.get('Type', {}).get('select') or {}).get('name') or 'Other'
    mapping = {'Movie':'Movies','TV Show':'TV Shows','Podcast':'Podcasts','Documentary':'Documentaries','Book':'Books','YouTube':'YouTube','Online':'Online','Other':'Other'}
    if kind not in mapping:
        raise ValueError('Unknown media type; review mapping before publishing')
    media_type = mapping[kind]
    host = urlparse(url).hostname or ''
    if media_type == 'Other' and url:
        media_type = 'YouTube' if host in ('youtube.com','www.youtube.com','m.youtube.com','youtu.be') else 'Online'
    status = (props.get('Status', {}).get('status') or {}).get('name') or 'Not marked'
    if status not in WATCH_STATUSES:
        raise ValueError('Unknown watch status; review mapping before publishing')
    # Only public listing metadata. Never export Notes, Recommended by, files, or page bodies.
    return {'id':'watchlater-'+page['id'].replace('-',''), 'channel':'watch', 'source':'notion',
            'title':title, 'url':url, 'mediaType':media_type, 'readingStatus':status,
            'publishedAt':iso_date(props.get('Added', {}).get('created_time') or page['created_time'])}


def collect_watch_later(api):
    records = []
    for page in api.pages(f'data_sources/{WATCH_LATER}/query', query=True):
        record = watch_later_record(page)
        if record:
            records.append(record)
    return records


def sync_watch_later():
    token = os.environ.get('NOTION_TOKEN', '').strip()
    if not token:
        raise RuntimeError('Watch or Listen Later requires NOTION_TOKEN')
    write_snapshot(ROOT / 'data/watch.json', collect_watch_later(Notion(token)))


def sync_notion():
    token = os.environ.get('NOTION_TOKEN', '').strip()
    if not token:
        print('::notice::Newsletter sync awaits NOTION_TOKEN_NEWSLETTER (or NOTION_TOKEN) in repository secrets. Existing digest snapshot kept.')
        return
    # Only replace after all pages succeed. Deletions in Notion then remove public editions.
    write_snapshot(ROOT / 'data/newsletters.json', collect_digests(Notion(token)))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('source', choices=['rss', 'notion', 'read-later', 'domains', 'watch-later'])
    parser.add_argument('--backfill', action='store_true', help='Import the full public writing archive before syncing RSS')
    args = parser.parse_args()
    try:
        if args.source == 'rss':
            sync_rss(backfill=args.backfill)
        elif args.source == 'watch-later':
            sync_watch_later()
        elif args.source == 'domains':
            sync_domains()
        elif args.source == 'read-later':
            sync_read_later()
        else:
            sync_notion()
    except Exception as error:
        print(f'::error::{args.source} sync failed ({error_summary(error)}); previous snapshot kept.', file=sys.stderr)
        sys.exit(1)
