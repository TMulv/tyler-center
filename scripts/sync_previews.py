#!/usr/bin/env python3
"""Cache public link-card metadata only. No article bodies or downloaded images."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime,timezone,timedelta
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin,urlparse
from urllib.request import Request,build_opener,HTTPRedirectHandler
from urllib.error import HTTPError
import ipaddress,json,socket
from sync_feeds import article_url
ROOT=Path(__file__).resolve().parents[1]
class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs): return None

def public_target(url):
    if not article_url(url): raise ValueError('Not a public URL')
    u=urlparse(url)
    if u.port not in (None,80,443): raise ValueError('Unsupported port')
    addresses=socket.getaddrinfo(u.hostname,u.port or (443 if u.scheme=='https' else 80),type=socket.SOCK_STREAM)
    if not addresses or any(not ipaddress.ip_address(a[4][0]).is_global for a in addresses):
        raise ValueError('Not a public address')
    return url

class Metadata(HTMLParser):
    def __init__(self):
        super().__init__();self.meta={};self.title=[];self.in_title=False;self.icon='';self.images=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=='title':self.in_title=True
        if tag=='meta':
            key=(a.get('property') or a.get('name') or '').lower()
            if key in ('og:title','og:description','og:image','og:site_name','description','twitter:image'):self.meta.setdefault(key,a.get('content',''))
        if tag=='link' and 'icon' in a.get('rel','').lower().split() and not self.icon:self.icon=a.get('href','')
        if tag=='img' and a.get('src') and a.get('alt'):
            try: width=int(a.get('width','0'))
            except ValueError: width=0
            if width>=300:self.images.append(a['src'])
    def handle_endtag(self,tag):
        if tag=='title':self.in_title=False
    def handle_data(self,data):
        if self.in_title:self.title.append(data)

def absolute_asset(base,value):
    result=article_url(urljoin(base,value)) if value else ''
    return result if result.startswith('https://') else ''

def parse_metadata(html,url,allow_art=False):
    p=Metadata();p.feed(html)
    title=' '.join((p.meta.get('og:title') or ''.join(p.title)).split())[:200]
    if any(x in title.lower() for x in ['just a moment','access denied','attention required','robot or human']):raise ValueError('Source did not return a page')
    description=' '.join((p.meta.get('og:description') or p.meta.get('description') or '').split())[:350]
    image=p.meta.get('og:image') or p.meta.get('twitter:image') or (p.images[0] if allow_art and p.images else '')
    return {'title':title,'description':description,'site':p.meta.get('og:site_name','')[:100],
            'image':absolute_asset(url,image),'icon':absolute_asset(url,p.icon),'domain':urlparse(url).hostname}

def fetch_metadata(url,allow_art=False):
    current=url
    for _ in range(5):
        public_target(current)
        try:
            response=build_opener(NoRedirect()).open(Request(current,headers={'User-Agent':'TylerCenterLinkPreview/1.0 (+https://tyler.center)','Accept':'text/html'}),timeout=8)
        except HTTPError as e:
            if e.code in (301,302,303,307,308) and e.headers.get('Location'):
                current=urljoin(current,e.headers['Location']);continue
            raise
        with response:
            if 'html' not in response.headers.get('Content-Type',''):raise ValueError('Not HTML')
            html=response.read(750000).decode(response.headers.get_content_charset() or 'utf-8','replace')
        return parse_metadata(html,current,allow_art)
    raise ValueError('Too many redirects')

def main():
    path=ROOT/'data/previews.json'
    previous=json.loads(path.read_text()).get('previews',{}) if path.exists() else {}
    urls={}
    for channel in ('articles','websites'):
        for row in json.loads((ROOT/f'data/{channel}.json').read_text())['entries']:
            if article_url(row.get('url','')):urls[row['url']]=channel=='websites'
    project_sources=json.loads((ROOT/'data/project-preview-sources.json').read_text())
    for url in project_sources:
        if article_url(url):urls[url]=True
    previews={url:value for url,value in previous.items() if url in urls}
    now=datetime.now(timezone.utc);due=[]
    for url,art in urls.items():
        try:last=datetime.fromisoformat(previews.get(url,{}).get('checkedAt',''))
        except ValueError:last=now-timedelta(days=8)
        if now-last>timedelta(days=7):due.append((url,art))
    def get(item):
        url,art=item
        try:return url,fetch_metadata(url,art),True
        except Exception:return url,{},False
    successes=0
    with ThreadPoolExecutor(max_workers=6) as pool:
        for url,meta,ok in pool.map(get,due):
            successes+=ok
            previews[url]={**previews.get(url,{}),**meta,'checkedAt':now.isoformat(),'available':ok}
    for url,source in project_sources.items():
        if url in previews and not previews[url].get('image'):
            image=absolute_asset(url,source.get('image',''))
            if image:previews[url]['image']=image
    payload=json.dumps({'version':1,'previews':previews},ensure_ascii=False,indent=2)+'\n'
    if not path.exists() or path.read_text()!=payload:
        temporary=path.with_suffix('.tmp');temporary.write_text(payload);temporary.replace(path)
    print(f'Preview refresh: {successes}/{len(due)} sources returned metadata; {len(previews)} links cached. Unavailable sources use domain cards.')
if __name__=='__main__':main()
