#!/usr/bin/env python3
"""Serves the site at the URLs adorio.space uses, so a change can be checked locally.

Builds the hosted layout into dist/local with asset URLs under /learn-korean/,
then serves it:

  /learn-korean          the entry page (the URL Adorio's /learn-korean route answers)
  /learn-korean/...      CSS, JS and audio, as they are hosted on R2
  /                      redirects to /learn-korean

Run:  python3 tools/serve.py            then open http://localhost:8000/learn-korean
      python3 tools/serve.py --port 8080
"""
from __future__ import annotations

import argparse
import functools
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import build  # noqa: E402

OUT = ROOT / "dist" / "local"
PAGE = "/learn-korean"
ASSET_BASE = "/learn-korean/"


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self) -> None:
        path = self.path.split("?", 1)[0]
        if path == "/":
            self.send_response(302)
            self.send_header("Location", PAGE)
            self.end_headers()
            return
        if path == PAGE:
            self.path = "/learn-korean.html"
        elif not path.startswith(ASSET_BASE):
            self.send_error(404)
            return
        super().do_GET()


def make_server(port: int) -> ThreadingHTTPServer:
    build.check_data()
    build.build_site(ASSET_BASE, OUT)
    handler = functools.partial(Handler, directory=str(OUT))
    return ThreadingHTTPServer(("127.0.0.1", port), handler)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()

    server = make_server(args.port)
    print(f"serving {OUT} at http://localhost:{args.port}{PAGE}  (Ctrl+C to stop)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
