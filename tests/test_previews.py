import sys, unittest
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).parents[1]/'scripts'))
import sync_previews as previews

class PreviewTests(unittest.TestCase):
    def test_public_head_metadata_not_article_body(self):
        p=previews.parse_metadata('<title>Fallback</title><meta property="og:title" content="A &amp; B"><meta name="description" content="Summary"><meta property="og:image" content="/cover.jpg"><link rel="icon" href="/icon.svg"><body>FULL ARTICLE</body>','https://example.com/story')
        self.assertEqual(p['title'],'A & B')
        self.assertEqual(p['image'],'https://example.com/cover.jpg')
        self.assertNotIn('FULL ARTICLE',str(p))
    def test_private_and_signed_assets_rejected(self):
        for u in ['javascript:alert(1)','http://example.com/image','https://app.notion.com/private','https://cdn.example.com/a?token=secret']:
            self.assertEqual(previews.absolute_asset('https://example.com',u),'')
    def test_original_site_art_is_only_used_when_requested(self):
        html='<title>Shop</title><img src="/shop.jpg" alt="The workshop" width="500">'
        self.assertEqual(previews.parse_metadata(html,'https://example.com')['image'],'')
        self.assertEqual(previews.parse_metadata(html,'https://example.com',True)['image'],'https://example.com/shop.jpg')
    def test_private_destination_and_bot_challenge_are_not_previews(self):
        with patch.object(previews.socket,'getaddrinfo',return_value=[(2,1,6,'',('127.0.0.1',443))]):
            with self.assertRaises(ValueError):previews.public_target('https://example.com')
        for url in ['https://localhost','file:///etc/passwd','https://user:password@example.com','https://example.com:3000']:
            with self.assertRaises(ValueError):previews.public_target(url)
        with self.assertRaises(ValueError):previews.parse_metadata('<title>Just a moment...</title>','https://example.com')
