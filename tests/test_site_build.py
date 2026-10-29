"""What the site build must produce, written before build.py learned to produce it.

Run from the repo root:  python3 -m unittest discover -s tests -v
"""
import hashlib
import json
import re
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "dist" / "site"
ENTRY = SITE / "learn-korean.html"
ASSETS = SITE / "learn-korean"
PROD_BASE = "https://files.adorio.space/learn-korean/"
SOURCE_CLIPS = ROOT / "assets" / "audio"

# Above this the entry page is no longer "small": audio, fonts and scripts must
# all live in their own cacheable files.
ENTRY_LIMIT_BYTES = 100_000


def build_site(base: str = PROD_BASE) -> None:
    result = subprocess.run(
        [sys.executable, str(ROOT / "build.py"), "--site", "--base", base],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise AssertionError(f"build.py --site failed:\n{result.stdout}\n{result.stderr}")


def audio_table(js: str) -> dict:
    match = re.search(r"const AUDIO = (\{.*?\});", js, re.S)
    assert match, "audio.js has no AUDIO table"
    return json.loads(match.group(1))


class SiteBuild(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        build_site()
        cls.entry = ENTRY.read_text(encoding="utf-8")

    def test_entry_page_is_small(self):
        self.assertLess(ENTRY.stat().st_size, ENTRY_LIMIT_BYTES)

    def test_entry_has_no_inline_audio_or_script_bodies(self):
        self.assertNotIn("data:audio/mpeg;base64,", self.entry)
        self.assertNotRegex(self.entry, r"<script>(?!\s*</script>)")

    def test_entry_points_assets_at_the_base_url(self):
        refs = re.findall(r'(?:href|src)="([^"]+)"', self.entry)
        asset_refs = [r for r in refs if "/learn-korean/" in r or r.startswith(PROD_BASE)]
        self.assertTrue(asset_refs, "entry page links no bundled assets")
        for ref in asset_refs:
            self.assertTrue(ref.startswith(PROD_BASE), ref)

    def test_every_linked_asset_exists_and_is_content_hashed(self):
        refs = re.findall(r'(?:href|src)="(' + re.escape(PROD_BASE) + r'[^"]+)"', self.entry)
        self.assertTrue(refs)
        for ref in refs:
            path = ASSETS / ref[len(PROD_BASE):]
            self.assertTrue(path.is_file(), f"missing {path}")
            digest = hashlib.sha256(path.read_bytes()).hexdigest()[:12]
            self.assertIn(digest, path.name, f"{path.name} is not named by its content")

    def test_audio_names_are_content_hashes_of_the_bytes(self):
        js = next(ASSETS.glob("js/audio.*.js")).read_text(encoding="utf-8")
        table = audio_table(js)
        self.assertEqual(len(table), len(json.loads(
            re.search(r"const AUDIO = (\{.*?\});", (ROOT / "assets/js/audio.js").read_text(encoding="utf-8"), re.S).group(1)
        )), "every source clip must appear in the site table")
        for text, name in table.items():
            path = ASSETS / "audio" / name
            self.assertTrue(path.is_file(), f"missing clip for {text!r}: {path}")
            digest = hashlib.sha256(path.read_bytes()).hexdigest()[:12]
            self.assertEqual(name, f"{digest}.mp3", f"clip for {text!r} is not named by its bytes")

    def test_audio_base_points_at_the_hosted_folder(self):
        js = next(ASSETS.glob("js/audio.*.js")).read_text(encoding="utf-8")
        self.assertIn(f"const AUDIO_BASE = '{PROD_BASE}audio/';", js)

    def test_no_relative_asset_paths_survive(self):
        for path in [ENTRY, *ASSETS.glob("**/*.js"), *ASSETS.glob("**/*.css")]:
            text = path.read_text(encoding="utf-8")
            self.assertNotIn("assets/audio/", text, path.name)
            self.assertNotIn('"assets/', text, path.name)

    def test_build_is_deterministic(self):
        before = sorted(p.name for p in ASSETS.rglob("*") if p.is_file())
        build_site()
        after = sorted(p.name for p in ASSETS.rglob("*") if p.is_file())
        self.assertEqual(before, after)


class SingleFileBuild(unittest.TestCase):
    """The artifact host serves one file, so the artifact copy keeps its audio inline."""

    @classmethod
    def setUpClass(cls):
        result = subprocess.run(
            [sys.executable, str(ROOT / "build.py")], cwd=ROOT, capture_output=True, text=True
        )
        if result.returncode != 0:
            raise AssertionError(result.stderr)

    def test_artifact_copy_embeds_every_clip(self):
        html = (ROOT / "dist" / "artifact.html").read_text(encoding="utf-8")
        self.assertIn("data:audio/mpeg;base64,", html)
        self.assertNotIn("assets/", html)


if __name__ == "__main__":
    unittest.main()
