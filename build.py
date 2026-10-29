#!/usr/bin/env python3
"""Bundles the site into single-file builds.

  dist/index.html     standalone page, no external files, open it from disk
  dist/artifact.html  head + body fragment for hosts that supply their own shell

Run:  python3 build.py
"""
from __future__ import annotations

import base64
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DIST = ROOT / "dist"


def read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding="utf-8")


def embed_audio(js_source: str) -> str:
    """Turns the clip table into self-contained data URIs.

    A shared page has to carry its own sound: the artifact host serves one file
    and blocks requests to anything else, so a relative mp3 URL would 404.
    """
    match = re.search(r"const AUDIO = (\{.*?\});", js_source, re.S)
    if not match:
        raise SystemExit("audio.js has no AUDIO table; run tools/build-audio.py first")

    table = json.loads(match.group(1))
    embedded = {}
    total = 0
    for text, name in table.items():
        clip = ROOT / "assets" / "audio" / name
        if not clip.exists():
            raise SystemExit(f"missing audio clip {clip}")
        raw = clip.read_bytes()
        total += len(raw)
        embedded[text] = "data:audio/mpeg;base64," + base64.b64encode(raw).decode("ascii")

    print(f"  embedded {len(embedded)} clips ({total / 1024:.0f} KB raw)")
    # Splice the table first: the AUDIO_BASE edit sits earlier in the file and
    # would shift the offsets this slice depends on.
    js_source = (
        js_source[:match.start(1)]
        + json.dumps(embedded, ensure_ascii=False)
        + js_source[match.end(1):]
    )
    return js_source.replace("const AUDIO_BASE = 'assets/audio/';", "const AUDIO_BASE = '';")


def inline(html: str) -> str:
    def css(match: re.Match[str]) -> str:
        href = match.group(1)
        if href.startswith("http"):
            return match.group(0)
        return f"<style>\n{read(href)}\n</style>"

    def js(match: re.Match[str]) -> str:
        src = match.group(1)
        if src.startswith("http"):
            return match.group(0)
        body = read(src)
        if src.endswith("audio.js"):
            body = embed_audio(body)
        if "</script" in body:
            raise SystemExit(f"{src} contains a literal </script>; cannot inline safely")
        return f"<script>\n{body}\n</script>"

    html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', css, html)
    html = re.sub(r'<script src="([^"]+)"></script>', js, html)
    return html


def section(html: str, name: str) -> str:
    match = re.search(
        rf"<!-- BUILD:{name}-START -->(.*?)<!-- BUILD:{name}-END -->", html, re.S
    )
    if not match:
        raise SystemExit(f"missing BUILD:{name} markers in index.html")
    return match.group(1).strip()


def check_data() -> None:
    """Refuses to bundle data.js that would break the page once it ships.

    Everything the deck shows is generated from data.js, so a bad field only
    shows up as a wrong caption or an unanswerable matching board long after the
    build. Cheaper to catch it here. Skipped with a warning if node is missing,
    since the bundler itself does not need it.
    """
    checker = ROOT / "tools" / "check-data.js"
    try:
        result = subprocess.run(["node", str(checker)], text=True, capture_output=True)
    except FileNotFoundError:
        sys.stderr.write("node not found, skipping the data check\n")
        return
    sys.stdout.write(result.stdout)
    if result.returncode != 0:
        sys.stderr.write(result.stderr)
        raise SystemExit("data.js failed validation; nothing was built")


def main() -> int:
    check_data()
    source = read("index.html")
    bundled = inline(source)

    DIST.mkdir(exist_ok=True)
    (DIST / "index.html").write_text(bundled, encoding="utf-8")

    fragment = section(bundled, "HEAD") + "\n\n" + section(bundled, "BODY")
    fragment = fragment.replace('<link rel="stylesheet" href="assets/css/styles.css">', "")
    (DIST / "artifact.html").write_text(fragment + "\n", encoding="utf-8")

    for name in ("index.html", "artifact.html"):
        size = (DIST / name).stat().st_size
        print(f"dist/{name:<14} {size / 1024:6.1f} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
