#!/usr/bin/env python3
"""Builds the site.

  dist/index.html        standalone page, no external files, open it from disk
  dist/artifact.html     head + body fragment for hosts that supply their own shell
  dist/site/             the hosted build: a small entry page plus content-hashed
                         CSS, JS and audio under learn-korean/, uploaded to R2

Run:  python3 build.py                 (standalone and artifact copies)
      python3 build.py --site          (hosted build, base URL on R2)
      python3 build.py --site --base /learn-korean/ --out dist/local
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DIST = ROOT / "dist"
SITE_OUT = DIST / "site"
SITE_BASE = "https://files.adorio.space/learn-korean/"


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


def hashed_name(stem: str, ext: str, data: bytes) -> str:
    return f"{stem}.{hashlib.sha256(data).hexdigest()[:12]}{ext}"


def site_audio(js_source: str, base: str, out: Path) -> str:
    """Copies every clip to out/audio/<hash of its bytes>.mp3 and points the table at them.

    The clip names from tools/build-audio.py hash the text and the voice, not the
    audio. A re-rendered clip keeps its name, so a year-long cache would keep the
    old sound. Naming the copy by its bytes makes a changed clip a new URL.
    """
    match = re.search(r"const AUDIO = (\{.*?\});", js_source, re.S)
    if not match:
        raise SystemExit("audio.js has no AUDIO table; run tools/build-audio.py first")

    table = json.loads(match.group(1))
    audio_out = out / "audio"
    audio_out.mkdir(parents=True, exist_ok=True)
    hosted = {}
    for text, name in table.items():
        clip = ROOT / "assets" / "audio" / name
        if not clip.exists():
            raise SystemExit(f"missing audio clip {clip}")
        raw = clip.read_bytes()
        target = f"{hashlib.sha256(raw).hexdigest()[:12]}.mp3"
        if not (audio_out / target).exists():
            (audio_out / target).write_bytes(raw)
        hosted[text] = target

    js_source = (
        js_source[:match.start(1)]
        + json.dumps(hosted, ensure_ascii=False)
        + js_source[match.end(1):]
    )
    return js_source.replace("const AUDIO_BASE = 'assets/audio/';", f"const AUDIO_BASE = '{base}audio/';")


def build_site(base: str, out: Path) -> None:
    """Writes out/learn-korean.html (the entry) and out/learn-korean/ (everything else)."""
    if not base.endswith("/"):
        base += "/"
    assets = out / "learn-korean"
    if assets.exists():
        shutil.rmtree(assets)
    for sub in ("css", "js", "audio"):
        (assets / sub).mkdir(parents=True)

    def publish(sub: str, src: str, data: bytes) -> str:
        name = hashed_name(Path(src).stem, Path(src).suffix, data)
        (assets / sub / name).write_bytes(data)
        return f"{base}{sub}/{name}"

    def css(match: re.Match[str]) -> str:
        href = match.group(1)
        if href.startswith("http"):
            return match.group(0)
        url = publish("css", href, (ROOT / href).read_bytes())
        return f'<link rel="stylesheet" href="{url}">'

    def js(match: re.Match[str]) -> str:
        src = match.group(1)
        if src.startswith("http"):
            return match.group(0)
        body = read(src)
        if src.endswith("audio.js"):
            body = site_audio(body, base, assets)
        url = publish("js", src, body.encode("utf-8"))
        return f'<script src="{url}"></script>'

    entry = read("index.html")
    entry = re.sub(r'<link rel="stylesheet" href="([^"]+)">', css, entry)
    entry = re.sub(r'<script src="([^"]+)"></script>', js, entry)
    (out / "learn-korean.html").write_text(entry, encoding="utf-8")

    files = [p for p in assets.rglob("*") if p.is_file()]
    total = sum(p.stat().st_size for p in files)
    print(f"{out}/learn-korean.html  {(out / 'learn-korean.html').stat().st_size / 1024:6.1f} KB")
    print(f"{assets}/  {len(files)} files, {total / 1024 / 1024:.1f} MB")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--site", action="store_true", help="build the hosted site instead")
    parser.add_argument("--base", default=SITE_BASE, help="URL the assets are served from")
    parser.add_argument("--out", default=str(SITE_OUT), help="output folder for --site")
    args = parser.parse_args(argv)

    check_data()
    if args.site:
        build_site(args.base, Path(args.out))
        return 0

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
