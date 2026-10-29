#!/usr/bin/env python3
"""Renders every spoken string in data.js to an audio clip.

The site ships its own audio rather than relying on the browser's speech
synthesiser: Web Speech needs the right voice installed on the viewer's machine,
is unavailable in sandboxed iframes, and is silent on most Linux setups. Baked
clips play anywhere -- which matters most for the shared single-file build, where
the page runs inside exactly such an iframe.

Two engines are used, one per language:

  Korean   Google Translate's voice, via gTTS. Piper's only Korean model
           (ko_KR-kss-medium) rushes single syllables badly -- it gives 넷 about
           0.26s of sound against Google's 0.41s -- which reads as the word being
           cut off. Example sentences use gTTS's slow mode, landing near 4
           syllables a second, which a beginner can follow.
  English  Piper with en_US-lessac-medium, for the glosses the English listening
           drill reads out. Glosses are one or two words at a natural rate, so
           Piper's pacing is not a problem here and a local model is preferable.

    python3 tools/build-audio.py --piper .../venv/bin/python \
        --en-model .../en.onnx --en-config .../en.onnx.json \
        --gtts .../venv-with-gtts/bin/python

Clip filenames hash the voice along with the text, so changing an engine renames
every clip it owns and the stale ones are reported rather than silently served.
Only missing clips are rendered; pass --force to re-render everything, which is
what a change to the filter chain below calls for.

gTTS talks to an undocumented Google endpoint. It is contacted only here, at
build time -- the published page carries the audio inline and reaches no network.

Outputs assets/audio/*.mp3 and the assets/js/audio.js lookup table.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
import tempfile
import time
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
AUDIO_DIR = ROOT / "assets" / "audio"
DATA = ROOT / "assets" / "js" / "data.js"
OUT_JS = ROOT / "assets" / "js" / "audio.js"

HANGUL_START, HANGUL_END = 0xAC00, 0xD7A3

# Baked into every clip's filename, so switching an engine invalidates its clips
# instead of leaving the old audio in place under an unchanged name.
VOICES = {"ko": "gtts-ko", "en": "piper-en_US-lessac-medium"}

# Trim the synthesiser's leading and trailing padding, even out loudness, then
# put a little silence back.
#
# The gate sits at -55dB rather than the -45dB used before: a final unreleased
# stop (셋, 넷) and a weak fricative onset carry very little energy, and the
# tighter gate was clipping them off the ends of exactly the short words that
# already sounded cut off. -55dB keeps 20-55ms more of each word.
#
# adelay/apad then restore a little silence at both ends. Speech that starts on
# the very first sample reads as clipped even when nothing is missing.
FILTERS = (
    "silenceremove=start_periods=1:start_silence=0.06:start_threshold=-55dB:detection=peak,"
    "areverse,"
    "silenceremove=start_periods=1:start_silence=0.06:start_threshold=-55dB:detection=peak,"
    "areverse,"
    "loudnorm=I=-16:TP=-1.5:LRA=11,"
    "adelay=50,"
    "apad=pad_dur=0.06"
)

# Google rate-limits anonymous callers, so requests are paced and retried.
GTTS_DELAY = 0.35
GTTS_TRIES = 4


def spoken_form(gloss: str) -> str:
    """A gloss like 'Watch / Clock' offers two words; only the first is read out."""
    return gloss.split("/")[0].strip()


def collect_strings() -> list[tuple[str, str, str]]:
    """Every string the app can ask for, as (lookup key, text to speak, language).

    The key is what app.js passes to Voice.play, which is not always what gets
    synthesised: a slashed gloss is stored whole because that is what the card
    prints, but only its first alternative is read.
    """
    source = DATA.read_text(encoding="utf-8")
    # CATEGORIES sits above WORDS and carries `ko` and `en` fields of its own.
    # Nothing ever speaks a set's name -- the chips and headings are silent -- so
    # both scans start at the word list rather than rendering clips no button
    # can reach.
    words_only = source[source.index("const WORDS"):]

    found = re.findall(r"ko:\s*'([^']+)'", words_only)
    phrases: list[str] = []
    syllables: list[str] = []

    for text in found:
        if text not in phrases:
            phrases.append(text)
        # Word entries are a bare run of Hangul; example sentences have spaces
        # and punctuation. Only words are broken down syllable by syllable.
        if all(HANGUL_START <= ord(c) <= HANGUL_END for c in text):
            for char in text:
                if char not in syllables:
                    syllables.append(char)

    korean = phrases + [s for s in syllables if s not in phrases]
    glosses: list[str] = []
    for gloss in re.findall(r"en:\s*'([^']+)',\s*th:", words_only):
        if gloss not in glosses:
            glosses.append(gloss)

    return ([(text, text, "ko") for text in korean]
            + [(gloss, spoken_form(gloss), "en") for gloss in glosses])


def is_sentence(text: str) -> bool:
    """Word entries are a bare run of Hangul; examples carry spaces and punctuation."""
    return not all(HANGUL_START <= ord(c) <= HANGUL_END for c in text)


def slug(key: str, lang: str) -> str:
    return hashlib.sha1(f"{VOICES[lang]}|{key}".encode("utf-8")).hexdigest()[:10]


GTTS_SCRIPT = """
import json, sys, time
from gtts import gTTS
delay, tries = float(sys.argv[2]), int(sys.argv[3])
jobs = json.load(open(sys.argv[1]))
for i, (text, path, slow) in enumerate(jobs):
    for attempt in range(tries):
        try:
            gTTS(text=text, lang='ko', slow=slow).save(path)
            break
        except Exception as error:
            if attempt == tries - 1:
                sys.stderr.write(f'gTTS failed for {text!r}: {error}\\n')
                sys.exit(1)
            time.sleep(delay * (2 ** attempt) + 1)
    time.sleep(delay)
    if (i + 1) % 25 == 0:
        print(f'  {i + 1}/{len(jobs)} Korean clips', flush=True)
"""

PIPER_SCRIPT = """
import json, sys, wave
from piper import PiperVoice
voice = PiperVoice.load(sys.argv[1], config_path=sys.argv[2])
for text, path in json.load(open(sys.argv[3])):
    with wave.open(path, 'wb') as handle:
        voice.synthesize_wav(text, handle)
"""


def encode(source: str, target: Path, bitrate: str) -> bool:
    result = subprocess.run([
        "ffmpeg", "-y", "-loglevel", "error", "-i", source,
        "-af", FILTERS, "-ac", "1", "-ar", "24000",
        "-c:a", "libmp3lame", "-b:a", bitrate, str(target)
    ], capture_output=True, text=True)
    if result.returncode != 0:
        sys.stderr.write(result.stderr)
        return False
    return True


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--gtts", help="python interpreter with gTTS installed (Korean)")
    parser.add_argument("--piper", help="python interpreter with piper-tts installed (English)")
    parser.add_argument("--en-model", help="English voice model")
    parser.add_argument("--en-config", help="English voice config")
    parser.add_argument("--force", action="store_true", help="re-render clips that already exist")
    parser.add_argument("--bitrate", default="64k")
    args = parser.parse_args()

    strings = collect_strings()
    AUDIO_DIR.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        table: dict[str, str] = {}
        pending: dict[str, list[tuple[str, str, str]]] = {"ko": [], "en": []}

        for key, text, lang in strings:
            name = f"{slug(key, lang)}.mp3"
            table[key] = name
            if (AUDIO_DIR / name).exists() and not args.force:
                continue
            suffix = "mp3" if lang == "ko" else "wav"
            pending[lang].append((key, text, str(tmp_path / f"{slug(key, lang)}.{suffix}")))

        if pending["ko"]:
            if not args.gtts:
                sys.stderr.write(f"{len(pending['ko'])} Korean clips need rendering; pass --gtts\n")
                return 1
            jobs = tmp_path / "jobs-ko.json"
            # Sentences get Google's slow reading; single words are already
            # deliberate enough and sound laboured when slowed further.
            jobs.write_text(json.dumps(
                [[text, path, is_sentence(text)] for _, text, path in pending["ko"]]
            ), encoding="utf-8")
            print(f"rendering {len(pending['ko'])} Korean clips with gTTS...")
            result = subprocess.run(
                [args.gtts, "-c", GTTS_SCRIPT, str(jobs), str(GTTS_DELAY), str(GTTS_TRIES)],
                text=True
            )
            if result.returncode != 0:
                return 1

        if pending["en"]:
            if not (args.piper and args.en_model and args.en_config):
                sys.stderr.write(f"{len(pending['en'])} English clips need rendering; "
                                 "pass --piper, --en-model and --en-config\n")
                return 1
            jobs = tmp_path / "jobs-en.json"
            jobs.write_text(json.dumps([[text, path] for _, text, path in pending["en"]]),
                            encoding="utf-8")
            result = subprocess.run(
                [args.piper, "-c", PIPER_SCRIPT, args.en_model, args.en_config, str(jobs)],
                capture_output=True, text=True
            )
            if result.returncode != 0:
                sys.stderr.write(result.stderr)
                return 1

        rendered = 0
        for lang, jobs_list in pending.items():
            for key, _, source in jobs_list:
                if not Path(source).exists():
                    sys.stderr.write(f"nothing was rendered for {key!r}\n")
                    return 1
                if not encode(source, AUDIO_DIR / table[key], args.bitrate):
                    return 1
                rendered += 1

    total = 0
    for key, name in table.items():
        clip = AUDIO_DIR / name
        if not clip.exists():
            sys.stderr.write(f"no clip on disk for {key!r}\n")
            return 1
        total += clip.stat().st_size

    # Clips left behind by an engine change or a deleted word would otherwise sit
    # in the directory forever and get swept into the single-file build.
    stale = sorted(p.name for p in AUDIO_DIR.glob("*.mp3") if p.name not in set(table.values()))
    if stale:
        sys.stderr.write(f"{len(stale)} clip(s) no longer referenced: {', '.join(stale[:6])}"
                         f"{' ...' if len(stale) > 6 else ''}\n")

    header = (
        "/* Generated by tools/build-audio.py. Do not edit by hand.\n"
        " * Korean read by Google Translate's voice, English glosses by Piper\n"
        " * en_US-lessac-medium, so the site never depends on a voice being\n"
        " * installed in the viewer's browser. */\n"
    )
    body = json.dumps(table, ensure_ascii=False, indent=0, sort_keys=True).replace("\n", "")
    OUT_JS.write_text(
        f"{header}const AUDIO_BASE = 'assets/audio/';\nconst AUDIO = {body};\n",
        encoding="utf-8"
    )

    english = sum(1 for _, _, lang in strings if lang == "en")
    print(f"{len(table)} clips, {total / 1024:.0f} KB total "
          f"({len(table) - english} Korean, {english} English; {rendered} rendered this run)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
