"""Shared helper to enrich a dynasty JSON file in place, surgically.

Only adds: person `content`, event `content` overrides, and appends new
persons/events/relations/timelines. Never removes or renames existing data.
Run: python3 scripts/enrich/<wave>.py
"""
import json
import os

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data")


def enrich(filename, *, person_content=None, event_content=None,
           new_persons=None, new_events=None, new_relations=None,
           new_timelines=None):
    path = os.path.join(DATA_DIR, filename)
    with open(path, encoding="utf-8") as f:
        d = json.load(f)

    person_content = person_content or {}
    event_content = event_content or {}

    existing_p = {p["slug"] for p in d.get("persons", [])}
    existing_e = {e["slug"] for e in d.get("events", [])}

    # Append new persons / events first (skip if slug already present)
    for p in (new_persons or []):
        if p["slug"] not in existing_p:
            d.setdefault("persons", []).append(p)
            existing_p.add(p["slug"])
    for e in (new_events or []):
        if e["slug"] not in existing_e:
            d.setdefault("events", []).append(e)
            existing_e.add(e["slug"])

    # Fill / override person content (covers newly appended persons too)
    miss = []
    for p in d.get("persons", []):
        if p["slug"] in person_content:
            p["content"] = person_content[p["slug"]]
        elif not p.get("content"):
            miss.append(p["slug"])

    # Override/extend event content
    for e in d.get("events", []):
        if e["slug"] in event_content:
            e["content"] = event_content[e["slug"]]

    for r in (new_relations or []):
        d.setdefault("relations", []).append(r)
    for t in (new_timelines or []):
        d.setdefault("timelines", []).append(t)

    # Dedup relations (by from/to/type) and timelines (by eventSlug/year/label)
    # so re-running a wave script stays idempotent.
    seen_r, rels = set(), []
    for r in d.get("relations", []):
        k = (r["from"], r["to"], r["type"])
        if k not in seen_r:
            seen_r.add(k); rels.append(r)
    d["relations"] = rels

    seen_t, tls = set(), []
    for t in d.get("timelines", []):
        k = (t["eventSlug"], t["year"], t["label"])
        if k not in seen_t:
            seen_t.add(k); tls.append(t)
    d["timelines"] = sorted(tls, key=lambda x: x["year"])

    with open(path, "w", encoding="utf-8") as f:
        json.dump(d, f, ensure_ascii=False, indent=2)
        f.write("\n")

    pc = sum(1 for p in d.get("persons", []) if p.get("content"))
    ec = sum(1 for e in d.get("events", []) if e.get("content"))
    print(f"{filename}: persons={len(d['persons'])} (content {pc}), "
          f"events={len(d['events'])} (content {ec}), "
          f"relations={len(d['relations'])}, timelines={len(d['timelines'])}"
          + (f"  STILL MISSING content: {miss}" if miss else ""))
