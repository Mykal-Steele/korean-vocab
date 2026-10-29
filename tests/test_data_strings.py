"""The validator must reject backslashes in word text.

A `\\` in data.js is an escape sequence, so the string the page shows is not the one
written in the file. A doubled escape once shipped as a visible backslash in a gloss and
broke its clip lookup. Escaping is not in check-data's other rules, so this guards it.

Run from the repo root:  python3 -m unittest discover -s tests -v
"""
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def run_checker_on(data_js: str) -> subprocess.CompletedProcess:
    """Runs tools/check-data.js against a copy of the repo with a replaced data.js."""
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        (tmp / "tools").mkdir()
        shutil.copy(ROOT / "tools" / "check-data.js", tmp / "tools" / "check-data.js")
        shutil.copytree(ROOT / "assets" / "js", tmp / "assets" / "js")
        (tmp / "assets" / "js" / "data.js").write_text(data_js, encoding="utf-8")
        return subprocess.run(
            ["node", str(tmp / "tools" / "check-data.js")],
            capture_output=True, text=True,
        )


class ValidatorRejectsBackslashes(unittest.TestCase):
    def setUp(self):
        self.good = (ROOT / "assets" / "js" / "data.js").read_text(encoding="utf-8")

    def test_current_data_passes(self):
        result = run_checker_on(self.good)
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_backslash_in_an_english_gloss_fails(self):
        bad = self.good.replace("en: 'Germany'", "en: 'Germany\\\\s'", 1)
        self.assertNotEqual(bad, self.good, "test setup did not change the data")
        result = run_checker_on(bad)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("backslash", result.stderr.lower())

    def test_backslash_in_an_example_fails(self):
        bad = self.good.replace("example: { ko: '독일은 유럽에 있어요.'",
                                "example: { ko: '독일\\\\은 유럽에 있어요.'", 1)
        self.assertNotEqual(bad, self.good, "test setup did not change the data")
        result = run_checker_on(bad)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("backslash", result.stderr.lower())


if __name__ == "__main__":
    unittest.main()
