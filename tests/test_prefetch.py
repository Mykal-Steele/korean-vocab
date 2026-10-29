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


def warm_urls(table: dict, base: str, order=None) -> list:
    extra = "" if order is None else f", {json.dumps(order, ensure_ascii=False)}"
    code = (
        "const fs = require('fs'), vm = require('vm');"
        "const ctx = vm.createContext({ window: { addEventListener() {} }, document: undefined, Audio: function () {} });"
        "vm.runInContext(fs.readFileSync('assets/js/voice.js', 'utf8') + ';globalThis.__Voice = Voice;', ctx);"
        f"console.log(JSON.stringify(ctx.__Voice.clipUrlsToWarm({json.dumps(table, ensure_ascii=False)}, {json.dumps(base)}{extra})));"
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

    def test_order_puts_the_listed_keys_first(self):
        table = {"a": "1.mp3", "b": "2.mp3", "c": "3.mp3"}
        self.assertEqual(
            warm_urls(table, self.base, ["c", "a"]),
            [self.base + "3.mp3", self.base + "1.mp3", self.base + "2.mp3"],
        )

    def test_order_ignores_keys_not_in_the_table(self):
        table = {"a": "1.mp3", "b": "2.mp3"}
        self.assertEqual(
            warm_urls(table, self.base, ["zzz", "b"]),
            [self.base + "2.mp3", self.base + "1.mp3"],
        )

    def test_a_file_shared_by_two_keys_is_warmed_at_its_first_key(self):
        table = {"a": "1.mp3", "b": "2.mp3", "c": "1.mp3"}
        self.assertEqual(
            warm_urls(table, self.base, ["c", "b"]),
            [self.base + "1.mp3", self.base + "2.mp3"],
        )


if __name__ == "__main__":
    unittest.main()
