#!/usr/bin/env python3
"""Assemble Kira's offline HTML from its authored source files."""

from argparse import ArgumentParser
from hashlib import sha256
import json
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "src"
OUTPUT = ROOT / "Kira.html"

MODEL = (
    "canonical.js",
    "unicode-data.js",
    "unicode.js",
    "artifact-data.js",
    "artifact-checker.js",
    "query-types.js",
    "query-checker.js",
    "engine.js",
    "parser.js",
    "conversation.js",
    "dialogue-assets.js",
    "dialogue.js",
)
BROWSER = ("persistence.js", "presenter.js", "view.js")


def read_parts(directory: str, names: tuple[str, ...]) -> str:
    return "".join((SOURCE / directory / name).read_text(encoding="utf-8") for name in names)


def build() -> str:
    model = read_parts("model", MODEL)
    model_body, marker, metadata = model.partition("Kira.APP_META=")
    if not marker or model.count(marker) != 1:
        raise ValueError("Expected one Kira.APP_META declaration in the model")
    expected_hash = sha256(model_body.encode("utf-8")).hexdigest()
    if json.loads(metadata.split(";", 1)[0])["modelHash"] != expected_hash:
        raise ValueError(f"Model changed; update APP_META.modelHash to {expected_hash} and the release version")
    browser = read_parts("browser", BROWSER)
    worker = model + (SOURCE / "worker-entry.js").read_text(encoding="utf-8")
    style = (SOURCE / "style.css").read_text(encoding="utf-8")
    html = (SOURCE / "shell.html").read_text(encoding="utf-8")

    for marker, value in (
        ("{{KIRA_STYLE}}", style),
        ("{{KIRA_MODEL}}", model),
        ("{{KIRA_WORKER}}", worker),
        ("{{KIRA_BROWSER}}", browser),
    ):
        if html.count(marker) != 1:
            raise ValueError(f"Expected exactly one {marker} in src/shell.html")
        html = html.replace(marker, value)

    return html


def main() -> int:
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="fail if Kira.html differs from the source")
    args = parser.parse_args()
    html = build()
    if args.check:
        if not OUTPUT.exists() or OUTPUT.read_text(encoding="utf-8") != html:
            print("Kira.html is out of date; run python3 tools/build.py", file=sys.stderr)
            return 1
        print("Kira.html matches the modular source.")
    else:
        OUTPUT.write_text(html, encoding="utf-8")
        print(f"Built {OUTPUT.name} ({OUTPUT.stat().st_size:,} bytes).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
