"""Which clips the page warms in the background.

Each distinct clip file gets one URL, in table order. Inline data: clips are skipped,
since they are already in the page.

Run from the repo root:  python3 -m unittest discover -s tests -v
"""
import json
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def warm_urls(table: dict, base: str) -> list:
    code = (
        "const fs = require('fs'), vm = require('vm');"
        "const ctx = vm.createContext({ window: { addEventListener() {} }, document: undefined, Audio: function () {} });"
        "vm.runInContext(fs.readFileSync('assets/js/voice.js', 'utf8') + ';globalThis.__Voice = Voice;', ctx);"
        f"console.log(JSON.stringify(ctx.__Voice.clipUrlsToWarm({json.dumps(table)}, {json.dumps(base)})));"
    )
    result = subprocess.run(["node", "-e", code], cwd=ROOT, capture_output=True, text=True)
    if result.returncode != 0:
        raise AssertionError(result.stderr)
    return json.loads(result.stdout)


class WarmUrls(unittest.TestCase):
    base = "https://files.example/learn-korean/audio/"

    def test_each_file_once_in_table_order(self):
        table = {"a": "2.mp3", "b": "1.mp3", "c": "2.mp3"}
        self.assertEqual(warm_urls(table, self.base), [self.base + "2.mp3", self.base + "1.mp3"])

    def test_inline_data_clips_are_skipped(self):
        table = {"a": "1.mp3", "b": "data:audio/mpeg;base64,AAAA"}
        self.assertEqual(warm_urls(table, self.base), [self.base + "1.mp3"])

    def test_empty_table_gives_nothing(self):
        self.assertEqual(warm_urls({}, self.base), [])


if __name__ == "__main__":
    unittest.main()
