#!/usr/bin/env python3
"""Derive Kira's word-to-topic table from Princeton WordNet 3.0 (noun hierarchy).

The table only helps choose which conversation topic a word belongs to. It is never used
as ontology or as a source of memories. Usage:

    python3 tools/wordnet_topics.py PATH/TO/dict [--anchors]   # --anchors prints the chosen senses
"""

from argparse import ArgumentParser
from collections import defaultdict
from pathlib import Path
import json
import re
import sys

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "src" / "model" / "wordnet-topics.js"
MAX_DISTANCE = 7
# Broad anchors (every animal, every chemical) reach many obscure words; stay closer for those.
TOPIC_DISTANCE = {"nature": 4, "science": 5, "travel": 6}

# topic -> WordNet noun senses (lemma#sense number). Order is the tie-break priority.
ANCHORS = {
    "music": ["music#1", "musical_instrument#1", "musician#1", "song#1", "musical_notation#1"],
    "sports": ["sport#1", "athlete#1", "athletic_game#1", "stadium#1", "exercise#1"],
    "gaming": ["video_game#1", "board_game#1", "card_game#1"],
    "screen": ["movie#1", "television#1", "actor#1", "film_maker#1", "television_program#1", "cinema#2"],
    "pets": ["pet#1", "domestic_animal#1", "dog#1", "domestic_cat#1", "cat#1"],
    "people": ["relative#1", "family#1", "friend#1", "child#1", "wedding#1", "birthday#1"],
    "travel": ["travel#1", "vehicle#1", "journey#1", "vacation#1", "hotel#1", "airport#1", "island#1"],
    "weather": ["weather#1", "season#2", "atmospheric_phenomenon#1", "precipitation#3", "cloud#1"],
    "school": ["school#1", "student#1", "teacher#1", "education#1", "course#1", "college#1", "university#1"],
    "work": ["job#1", "occupation#1", "profession#1", "employee#1", "workplace#1", "business#1"],
    "hobbies": ["hobby#1", "handicraft#1", "gardening#1", "fishing#1"],
    "home": ["home#1", "dwelling#1", "room#1", "furniture#1", "home_appliance#1", "bedclothes#1"],
    "cooking": ["food#1", "food#2", "beverage#1", "meal#1", "cooking#1", "kitchen#1", "dish#2"],
    "coffee": ["coffee#1", "tea#1"],
    "coding": ["computer#1", "software#1", "programming_language#1", "computer_science#1", "electronic_device#1"],
    "art": ["art#1", "painting#1", "sculpture#1", "artist#1", "photograph#1"],
    "reading": ["book#1", "literature#1", "reading#1"],
    "writing": ["writing#1", "writer#1", "poem#1"],
    "nature": ["animal#1", "plant#2", "natural_object#1", "tree#1", "flower#1", "mammal#1", "bird#1", "fish#1", "insect#1",
               "reptile#1", "amphibian#3", "feline#1", "carnivore#1", "primate#2", "rodent#1", "arthropod#1", "shrub#1", "herb#1", "mollusk#1", "ungulate#1"],
    "science": ["science#1", "natural_science#1", "scientist#1", "chemical_element#1"],
    "hiking": ["hike#1", "mountain#1", "geological_formation#1", "walking#1", "outdoors#1"],
    "feelings": ["feeling#1", "emotion#1"],
}
# A word may be dropped when it is too ordinary for its topic to be meaningful.
STOP = {"thing", "things", "something", "anything", "everything", "person", "people", "time", "way", "part", "place",
        "kind", "type", "sort", "lot", "bit", "life", "world", "man", "woman", "day", "year", "work", "form",
        "state", "area", "case", "point", "case", "number", "group", "set", "end", "side", "back", "head",
        "line", "name", "word", "fact", "idea", "need", "use", "good", "bad", "level", "power", "order",
        "body", "hair", "corpse", "female", "male", "queen", "return", "play", "title", "bill", "check", "papers",
        "contract", "bank", "light", "heat", "energy", "pressure", "data", "law", "act", "feed", "variety", "content",
        "section", "chapter", "services", "firm", "report", "smoke", "earth", "pair", "category", "traffic"}


def load(dict_dir):
    synsets = {}
    for line in (dict_dir / "data.noun").read_text(encoding="utf-8").splitlines():
        if line.startswith("  "):
            continue
        head = line.split("|")[0].split()
        offset, count = head[0], int(head[3], 16)
        words = [head[4 + 2 * i] for i in range(count)]
        rest = head[4 + 2 * count:]
        pointer_count, hypernyms = int(rest[0]), []
        for i in range(pointer_count):
            symbol, target, pos = rest[1 + 4 * i: 4 + 4 * i]
            if symbol in ("@", "@i") and pos == "n":
                hypernyms.append(target)
        synsets[offset] = (words, hypernyms)
    senses = {}  # (lemma, offset) -> (sense number, tag count)
    for line in (dict_dir / "index.sense").read_text(encoding="utf-8").splitlines():
        key, offset, number, tags = line.split()
        lemma, _, rest = key.partition("%")
        if rest.startswith("1:"):
            senses[(lemma, offset)] = (int(number), int(tags))
    return synsets, senses


def main():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("dict_dir", type=Path)
    parser.add_argument("--anchors", action="store_true")
    args = parser.parse_args()
    synsets, senses = load(args.dict_dir)

    by_sense = {}
    for (lemma, offset), (number, _) in senses.items():
        by_sense[(lemma, number)] = offset
    anchor_at, problems = {}, []
    for rank, (topic, names) in enumerate(ANCHORS.items()):
        for name in names:
            lemma, _, number = name.partition("#")
            offset = by_sense.get((lemma, int(number)))
            if offset is None:
                problems.append(name)
                continue
            anchor_at.setdefault(offset, (topic, rank))
            if args.anchors:
                gloss = ""
                for line in (args.dict_dir / "data.noun").read_text(encoding="utf-8").splitlines():
                    if line.startswith(offset):
                        gloss = line.split("|", 1)[1].strip()[:90]
                        break
                print(f"{topic:9} {name:28} {gloss}")
    if problems:
        print("Missing anchors: " + ", ".join(problems), file=sys.stderr)
        return 1
    if args.anchors:
        return 0

    cache = {}

    def nearest(offset, seen=()):
        """(distance, rank, topic) of the closest anchor at or above this synset."""
        if offset in cache:
            return cache[offset]
        best = (0, *anchor_at[offset][::-1]) if offset in anchor_at else None
        if offset not in seen:
            for parent in synsets[offset][1]:
                found = nearest(parent, seen + (offset,))
                if found and (best is None or (found[0] + 1, found[1]) < (best[0], best[1])):
                    best = (found[0] + 1, found[1], found[2])
        cache[offset] = best
        return best

    table = defaultdict(list)
    for offset, (words, _) in synsets.items():
        found = nearest(offset)
        if not found or found[0] > TOPIC_DISTANCE.get(found[2], MAX_DISTANCE):
            continue
        for word in words:
            lemma = word.lower()
            number, tags = senses.get((lemma, offset), (99, 0))
            # Only a word's most common sense decides its topic, so rare senses cannot pull it away.
            if number != 1 or not re.fullmatch(r"[a-z]{3,}(?:_[a-z]{2,})?", lemma) or lemma in STOP:
                continue
            table[found[2]].append((found[0], -tags, lemma.replace("_", " ")))
    out = {}
    for topic, rows in sorted(table.items()):
        rows.sort()
        out[topic] = ",".join(sorted({w for _, _, w in rows}))
    total = sum(len(v.split(",")) for v in out.values())
    license_text = (ROOT / "docs" / "WORDNET-LICENSE.txt").read_text(encoding="utf-8").rstrip("\n").replace("*/", "* /")
    header = ("'use strict';\n"
              "/* Generated by tools/wordnet_topics.py from the Princeton WordNet 3.0 noun hierarchy.\n"
              "   Topic cues choose conversation questions only; they never create ontology claims or memories.\n\n"
              + license_text + "\n*/\n")
    OUTPUT.write_text(header + "Kira.WORDNET_TOPICS=" + json.dumps(out, separators=(",", ":"), ensure_ascii=True) + ";\n", encoding="utf-8")
    print(f"Wrote {OUTPUT.relative_to(ROOT)}: {total:,} words in {len(out)} topics, {OUTPUT.stat().st_size:,} bytes.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
