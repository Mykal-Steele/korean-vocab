"""The local viewer must answer the same URLs Adorio answers.

Run from the repo root:  python3 -m unittest discover -s tests -v
"""
import importlib.util
import re
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def load_serve():
    spec = importlib.util.spec_from_file_location("serve", ROOT / "tools" / "serve.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class LocalViewer(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        serve = load_serve()
        cls.server = serve.make_server(0)
        cls.port = cls.server.server_address[1]
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.base = f"http://127.0.0.1:{cls.port}"
        cls.entry = cls.get("/learn-korean")[1].decode("utf-8")

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    @classmethod
    def get(cls, path):
        """Returns (response, body) without following redirects."""
        class NoRedirect(urllib.request.HTTPRedirectHandler):
            def redirect_request(self, *args, **kwargs):
                return None

        opener = urllib.request.build_opener(NoRedirect)
        try:
            with opener.open(cls.base + path) as res:
                return res, res.read()
        except urllib.error.HTTPError as err:
            return err, err.read()

    def test_learn_korean_serves_the_entry_page_as_html(self):
        res, body = self.get("/learn-korean")
        self.assertEqual(res.status, 200)
        self.assertTrue(res.headers["Content-Type"].startswith("text/html"))
        self.assertIn(b"<title>", body)

    def test_root_redirects_to_the_page(self):
        res, _ = self.get("/")
        self.assertEqual(res.status, 302)
        self.assertEqual(res.headers["Location"], "/learn-korean")

    def test_every_asset_the_page_links_is_served(self):
        urls = re.findall(r'(?:href|src)="(/learn-korean/[^"]+)"', self.entry)
        self.assertTrue(urls, "entry page links no assets")
        for url in urls:
            res, body = self.get(url)
            self.assertEqual(res.status, 200, url)
            self.assertGreater(len(body), 0, url)

    def test_clip_urls_resolve_to_audio(self):
        name = re.search(r'"([0-9a-f]{12}\.mp3)"', self.get_js()).group(1)
        res, body = self.get(f"/learn-korean/audio/{name}")
        self.assertEqual(res.status, 200)
        self.assertEqual(res.headers["Content-Type"], "audio/mpeg")
        self.assertGreater(len(body), 0)

    def test_unknown_paths_are_not_found(self):
        res, _ = self.get("/learn-korean/does-not-exist.js")
        self.assertEqual(res.status, 404)

    def get_js(self):
        js = self.get(next(
            url for url in re.findall(r'src="(/learn-korean/js/audio[^"]+)"', self.entry)
        ))[1]
        return js.decode("utf-8")


if __name__ == "__main__":
    unittest.main()
