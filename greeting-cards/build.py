#!/usr/bin/env python3
"""Inline Keepsake's sources into one page.

app.html   — artifact form: no <!doctype>/<html>/<head>/<body>; starts with <title>.
index.html — the same page wrapped in a standalone document for opening locally.
"""
import pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent
SRC = ROOT / "src"
ORDER = ["lily-stars", "cherry-blossom", "mothers-day", "bunny-space", "pearl-moon"]
FONTS = ("https://fonts.googleapis.com/css2?family=Caveat:wght@400..700"
         "&family=Instrument+Sans:wght@400..600&family=Josefin+Sans:wght@300..600&display=swap")


def read(p):
    return (SRC / p).read_text(encoding="utf-8")


def guard(js, name):
    # a literal "</script" inside JS would end the inline script early
    if re.search(r"</script", js, re.I):
        raise SystemExit(f"{name} contains '</script' — split the string")
    return js


def main():
    cards = []
    for cid in ORDER:
        f = SRC / "cards" / f"{cid}.js"
        if f.exists():
            cards.append(f"/* ---- card: {cid} ---- */\n" + guard(f.read_text(encoding="utf-8"), f.name))
        else:
            print(f"warning: src/cards/{cid}.js missing — placeholder will be used")
    # one <script> per source: a card that throws (or fails to parse) only loses that card, which the
    # shell then replaces with a placeholder, instead of aborting everything after it
    chunks = [guard(read("core.js"), "core.js"), *cards, guard(read("shell.js"), "shell.js")]
    scripts = "".join(f"<script>\n{c}\n</script>\n" for c in chunks)
    body = read("shell.html")
    css = read("shell.css")
    app = (
        "<title>Keepsake</title>\n"
        '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
        '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
        f'<link rel="stylesheet" href="{FONTS}">\n'
        f"<style>\n{css}\n</style>\n{body}\n{scripts}"
    )
    (ROOT / "app.html").write_text(app, encoding="utf-8")
    index = (
        '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        "</head>\n<body>\n" + app + "</body>\n</html>\n"
    )
    (ROOT / "index.html").write_text(index, encoding="utf-8")
    print(f"built app.html ({len(app)/1024:.0f} KB) and index.html with {len(cards)} card(s)")


if __name__ == "__main__":
    main()
