"""Words keep the spacing and brackets from the handout, but only Hangul syllables get a pad.

Run from the repo root:  python3 -m unittest discover -s tests -v
"""
import json
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def node(expression: str):
    """Evaluates a JS expression against hangul.js and data.js, and returns the JSON value."""
    code = (
        "const fs = require('fs'), vm = require('vm');"
        "const ctx = vm.createContext({ window: {}, document: undefined });"
        "vm.runInContext(fs.readFileSync('assets/js/hangul.js', 'utf8') + ';globalThis.__Hangul = Hangul;', ctx);"
        "vm.runInContext(fs.readFileSync('assets/js/data.js', 'utf8') + ';globalThis.__WORDS = WORDS;', ctx);"
        "const Hangul = ctx.__Hangul, WORDS = ctx.__WORDS;"
        f"console.log(JSON.stringify({expression}));"
    )
    result = subprocess.run(["node", "-e", code], cwd=ROOT, capture_output=True, text=True)
    if result.returncode != 0:
        raise AssertionError(result.stderr)
    return json.loads(result.stdout)


class SyllablesOf(unittest.TestCase):
    def test_plain_word_is_unchanged(self):
        self.assertEqual(node("Hangul.syllablesOf('독일')"), ["독", "일"])

    def test_spaces_are_not_syllables(self):
        self.assertEqual(
            node("Hangul.syllablesOf('아침 식사하다')"),
            ["아", "침", "식", "사", "하", "다"],
        )

    def test_brackets_are_not_syllables(self):
        self.assertEqual(
            node("Hangul.syllablesOf('(장소)에 가다')"),
            ["장", "소", "에", "가", "다"],
        )


class WordsKeepTheHandoutText(unittest.TestCase):
    def word(self, ko):
        words = node(f"WORDS.filter((w) => w.ko === {json.dumps(ko, ensure_ascii=False)})")
        self.assertEqual(len(words), 1, f"expected one word for {ko}")
        return words[0]

    def test_spaced_words_match_the_handout(self):
        for ko in ("아침 식사하다", "점심 식사하다", "저녁 식사하다"):
            self.assertEqual(self.word(ko)["ko"], ko)

    def test_place_word_matches_the_handout(self):
        self.assertEqual(self.word("(장소)에 가다")["ko"], "(장소)에 가다")

    def test_romanization_lines_up_with_the_syllables(self):
        for ko in ("아침 식사하다", "점심 식사하다", "저녁 식사하다", "(장소)에 가다"):
            word = self.word(ko)
            count = node(f"Hangul.syllablesOf({json.dumps(ko, ensure_ascii=False)}).length")
            self.assertEqual(len(word["syl"]), count, ko)

    def test_pronunciation_keeps_the_spacing(self):
        self.assertEqual(self.word("아침 식사하다")["say"], "아침 식싸하다")
        self.assertEqual(self.word("점심 식사하다")["say"], "점심 식싸하다")
        self.assertEqual(self.word("저녁 식사하다")["say"], "저녁 식싸하다")


# The English glosses exactly as the class handout writes them.
HANDOUT_EN = {
    "오전": "morning / a.m.(7-11:59)",
    "오후": "afternoon / p.m.(1-5)",
    "아침": "Morning(7-11:59)",
    "점심": "lunch / noon(12)",
    "저녁": "Evening(6-8)",
    "밤": "Night(9-11:59)",
    "시": "hour / o’clock",
    "분": "minute",
    "공부하다": "to study",
    "세수하다": "to wash one’s face",
    "쇼핑하다": "to go shopping",
    "숙제하다": "to do homework",
    "운동하다": "to exercise",
    "이야기하다": "to talk / to chat",
    "일하다": "to work",
    "전화하다": "to make a phone call",
    "아침 식사하다": "to have breakfast",
    "점심 식사하다": "to have lunch",
    "저녁 식사하다": "to have dinner",
    "(장소)에 가다": "to go (to a place)",
}


class EnglishMatchesTheHandout(unittest.TestCase):
    def test_every_handout_gloss_is_exact(self):
        for ko, en in HANDOUT_EN.items():
            words = node(f"WORDS.filter((w) => w.ko === {json.dumps(ko, ensure_ascii=False)})")
            self.assertEqual(len(words), 1, f"expected one word for {ko}")
            self.assertEqual(words[0]["en"], en, ko)


if __name__ == "__main__":
    unittest.main()
