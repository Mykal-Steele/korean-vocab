# Hangul Study Deck

A static study site for beginner Korean vocabulary — 나라 (countries), 직업
(occupations), 물건 (things), 음료 (drinks), 장소 (places) and both counting
systems, 고유어 숫자 (native) and 한자어 숫자 (Sino-Korean). Every word can be heard,
and every syllable can be watched being written stroke by stroke in the correct
order.

## Features

- **Meaning** — Hangul, Revised Romanization, English and Thai on every card, plus
  the real pronunciation where sound-change rules alter the spelling (독일 → 도길,
  학생 → 학쌩) and a short example sentence.
- **Pronunciation** — 315 audio clips bundled into the page, so sound works on any
  browser or OS with no voice pack and no network: 239 Korean read by Google
  Translate's voice, covering every word, syllable and example sentence, and 76
  English (Piper `en_US-lessac-medium`) covering the glosses that the English
  listening drill reads out. Example sentences use Google's slow reading and land
  near 4 syllables a second, which a beginner can follow. Nothing plays unprompted
  anywhere except the listening drills, where the sound *is* the question — but
  *Check* and *Show answer* both speak the Korean as they reveal it, in every mode,
  since by then there is nothing left for the ear to give away.
- **Stroke order** — generated from Hangul composition rules rather than traced from
  a font. Play, pause, step one stroke at a time, adjust speed, and toggle the
  numbered stroke starts, the target outline and the writing grid.
- **Practice** — a separate page with four modes, chosen before the word set:

  | Mode | Question | Answer |
  | --- | --- | --- |
  | Korean → meaning | the Hangul word | typed English |
  | Meaning → Korean | the English gloss | typed Hangul |
  | Listen in Korean | the word spoken, nothing on screen | typed Hangul |
  | Listen in English | the meaning spoken, nothing on screen | typed Hangul |
  | Matching pairs | four meanings beside four Korean words | tap one from each column |

  The four written modes take a typed answer rather than offering choices. A 두벌식
  Hangul input method is built in, so the Korean answers work without a system IME —
  type on a normal keyboard, click the on-screen keys, or write the romanization.
  Any mode can be run over a single set or the whole deck.
- **Handwriting** — a canvas pad per syllable on both the study sheet and every
  written practice question. Trace the target shape, then switch it off and write
  from memory. Wherever Hangul is the answer, both the guide shape and the pad's
  romanization caption stay hidden until the question has been settled, so the pads
  cannot give the answer away.
- **Progress** — learned words are stored in `localStorage`, along with theme,
  playback speed and display toggles.
- Dark by default with a light theme, responsive from 320px up, keyboard operable,
  `prefers-reduced-motion` aware, and printable as a study sheet.

## Running it

No build step and no dependencies:

```sh
python3 -m http.server 8000
# then open http://localhost:8000
```

`index.html` also opens directly from disk over `file://`.

## Layout

```
index.html              markup, with BUILD markers used by the bundler
assets/css/styles.css   design tokens and all component styles
assets/css/fonts.css    generated @font-face rules (see tools/build-fonts.py)
assets/js/data.js       the vocabulary, one object per word
assets/js/audio.js      generated clip table (see tools/build-audio.py)
assets/js/hangul.js     jamo stroke paths, syllable layout, and the Hangul IME
assets/js/writer.js     SVG rendering and the stroke-sequence player
assets/js/voice.js      clip playback, with Web Speech only as a fallback
assets/js/draw.js       the handwriting canvas
assets/js/app.js        routing, deck, study sheet, practice modes, preferences
assets/audio/*.mp3      clips: Korean words, syllables and examples, English glosses
tools/check-data.js     validates data.js; build.py runs it first
tools/build-audio.py    regenerates the clips from data.js
tools/build-fonts.py    regenerates the embedded font subsets from the source files
build.py                bundles everything into dist/
```

## How stroke order is produced

A precomposed syllable such as `한` (U+D55C) is decomposed arithmetically into
an initial consonant, a vowel and an optional final consonant. Each jamo is stored
in `hangul.js` as an ordered list of SVG strokes drawn in its own 100×100 box.
The syllable's composition — vertical vowel, horizontal vowel or compound vowel,
with or without a final — selects a layout that assigns each jamo a sub-box, and
the box placement is baked into the path coordinates so stroke width stays even.

Concatenating the jamo in the order initial → vowel → final, and the strokes within
each jamo top-to-bottom and left-to-right, yields the correct writing sequence. The
player animates that sequence with `stroke-dasharray` / `stroke-dashoffset`, timing
each stroke against its own length.

Adding vocabulary only means adding entries to `assets/js/data.js`; any Hangul
syllable in the Unicode block composes automatically.

## Adding a word set

Everything the page shows is generated from `data.js`. A new set is one entry in
`CATEGORIES` plus words carrying its `id`, and nothing else needs touching: the deck
headings, the filter chips, the practice set picker, the masthead subtitle and every
count are all derived from that list. There is no markup or number to keep in sync
by hand.

```js
// assets/js/data.js
const CATEGORIES = [
  // ...
  { id: 'jangso', ko: '장소', en: 'Places', th: 'สถานที่' }
];

const WORDS = [
  // ...
  {
    ko: '도서관', rom: 'doseogwan', syl: ['do', 'seo', 'gwan'],
    accept: ['library'],
    en: 'Library', th: 'ห้องสมุด', category: 'jangso',
    example: { ko: '도서관에서 공부해요.', en: 'I study at the library.' }
  }
];
```

Then regenerate and rebuild:

```sh
node tools/check-data.js     # optional; build.py runs it anyway
python3 tools/build-audio.py --gtts ... --piper ... --en-model ... --en-config ...
python3 tools/build-fonts.py
python3 build.py
```

Both regeneration steps are incremental, so a new set only costs the clips and
glyphs it actually introduces. The order matters: audio and fonts read `data.js`,
and `build.py` inlines whatever they produced.

### What the checker catches

`tools/check-data.js` runs first inside `build.py` and refuses to bundle broken
data, because a bad field usually surfaces far from its cause. It checks that
`syl` lines up one-to-one with the syllables of `ko` (a short array leaves a
handwriting pad with no caption), that `say` is the same length as `ko`, that no
two words share an English gloss (which would put two identical tiles on a
matching board with only one right answer), that every `category` exists and
every category has words, that `ko` is a bare run of Hangul, that `accept` is
lowercase and free of duplicates, and that every syllable in a word *and its
example sentence* has stroke data. It also warns, without failing, about strings
that have no clip yet, which is the normal state between editing `data.js` and
rerunning `build-audio.py`.

Fields on a word:

| field | notes |
|---|---|
| `ko` | Hangul spelling, letters only, no spaces |
| `rom` | Revised Romanization of the whole word |
| `syl` | per-syllable romanization, exactly one entry per block |
| `say` | optional, actual pronunciation where a sound change hides it (학교 → 학꾜). Skip the automatic ones a learner never gets wrong |
| `accept` | extra lowercase spellings accepted when typing the English |
| `en` | English gloss, unique across the deck. `A / B` offers both answers and only the first is read aloud |

Uniqueness is not just a tidiness rule. Two sets can describe the same thing —
하나 and 일 are both "one" — and an identical gloss would put two correct-looking
tiles on a matching board, and read out the same audio in the English listening
drill with no way to tell which word is wanted. The Sino-Korean numbers carry the
system in the gloss for exactly that reason: `One (Sino-Korean)` against the
native `One`.
| `th` | Thai gloss |
| `category` | an `id` from `CATEGORIES` |
| `example` | short sentence plus translation |

## Typing Korean without an IME

`HangulInput` in `hangul.js` implements the same composition automaton a system IME
uses: jamo arrive from the 두벌식 positions on a normal QWERTY keyboard (`gks` types
한) or from the on-screen keys, and are assembled into syllable blocks, including
compound vowels, cluster finals, and the liaison that turns 각 + ㅏ into 가가.
Backspace unwinds one jamo at a time.

## Adding a word

```js
{
  ko: '가수', rom: 'gasu', syl: ['ga', 'su'],
  en: 'Singer', th: 'นักร้อง', category: 'jigeop',
  example: { ko: '저는 가수예요.', en: 'I am a singer.' }
}
```

`say` is optional and only needed when pronunciation differs from spelling.

A new set is a new entry in `CATEGORIES` plus words carrying its `id`. The deck
headings, the filter chips and the practice set picker are all built from that
list at boot, so no markup or word count has to be edited by hand.

After changing `data.js`, rerun `tools/build-audio.py` for the new clips and
`tools/build-fonts.py` for the new glyphs, then `build.py`.

## Audio

The page ships its own sound. The Web Speech API was not good enough here: it needs
a Korean voice installed on the viewer's machine, is silent on most Linux desktops,
and is commonly blocked outright inside sandboxed cross-origin iframes — so a shared
link would play nothing. Instead every string in `data.js` is rendered ahead of time
and bundled as an MP3, which plays anywhere. `build.py` inlines the clips as data
URIs for the single-file build.

One engine per language:

| | engine | why |
|---|---|---|
| Korean | Google Translate, via `gTTS` | Piper's only Korean model, `ko_KR-kss-medium`, rushes single syllables — it gives 넷 about 0.26 s of sound against Google's 0.41 s, which reads as the word being cut off. |
| English glosses | Piper `en_US-lessac-medium` | A gloss is one or two words at a natural rate, so the pacing problem does not arise and a local model is preferable. |

Example sentences use Google's slow reading; single words are already deliberate
and sound laboured when slowed further. A slashed gloss such as `Watch / Clock` is
stored in the table under the whole string, because that is what the card prints,
but only its first alternative is read aloud.

Clips are trimmed at −55 dB, levelled to −16 LUFS with a −1.5 dB ceiling, and given
60 ms of silence at each end. The gate is deliberately loose: a final unreleased
stop (셋, 넷) or a weak fricative onset carries almost no energy, and a tighter gate
shears it off the very short words that already sound clipped.

To regenerate after editing `data.js`:

```sh
python3 tools/build-audio.py \
    --gtts /path/to/venv-with-gtts/bin/python \
    --piper /path/to/venv-with-piper/bin/python \
    --en-model /path/to/en_US-lessac-medium.onnx \
    --en-config /path/to/en_US-lessac-medium.onnx.json
python3 build.py
```

Only clips that are missing get rendered, so adding a handful of words needs
whichever engine covers them and no more. `--force` re-renders everything, which is
what a change to the filter chain calls for. A clip's filename hashes the voice
along with the text, so switching an engine renames every clip it owns; the script
then reports any file left unreferenced instead of letting it be swept into the
single-file build.

`gTTS` comes from `pip install gTTS`, Piper from `pip install piper-tts`
(Python 3.12), and the English voice from Hugging Face `rhasspy/piper-voices` — not
committed, it is 63 MB. gTTS calls an undocumented Google endpoint: it is used only
here, at build time, and the published page reaches no network at all.

## Bundling

```sh
python3 build.py
```

Produces `dist/index.html` (a single self-contained file) and `dist/artifact.html`
(a head + body fragment for hosts that provide their own document shell).

`dist/index.html` has no network dependencies at all: CSS, JavaScript, the audio
clips and the subset fonts are all inlined, so it works from a USB stick, an email
attachment or an offline laptop. Send someone that one file and every feature —
audio, stroke animation, the IME, the drawing pads, saved progress — still works.

## Fonts

Hangul and Thai cannot be left to the viewer's system: a Windows machine without
a Korean font renders the whole deck as tofu boxes. `tools/build-fonts.py` scans
the source for every character actually used, asks Google Fonts for exactly those
glyphs via the `text=` parameter, and writes the woff2 payloads into
`assets/css/fonts.css` as base64. Twelve faces covering four families come to
around 350 KB.

```sh
python3 tools/build-fonts.py
```
