"""Generate monogram avatar SVGs for every person/event and fill `imageUrl`.

Surgical + idempotent:
- Only fills entities whose `imageUrl` is empty (existing hand-made images kept).
- Avatar = the name's first character on a role-colored radial gradient.
- File path convention: public/images/<dynastySlug>/<persons|events>/<slug>.svg
Run: python3 scripts/enrich/avatars.py
"""
import json
import os
import glob

ROOT = os.path.join(os.path.dirname(__file__), "..", "..")
DATA_DIR = os.path.join(ROOT, "data")
IMG_DIR = os.path.join(ROOT, "public", "images")

# Role -> base color (white char on top). Unknown roles fall back to slate.
ROLE_COLOR = {
    "emperor": "#F59E0B", "empress": "#F472B6", "regent": "#FBBF24",
    "warlord": "#FB923C", "general": "#34D399", "minister": "#60A5FA",
    "official": "#38BDF8", "eunuch": "#64748B", "strategist": "#A78BFA",
    "royalty": "#F472B6", "consort": "#F9A8D4", "noble": "#E879F9",
    "rebel": "#EF4444", "assassin": "#DC2626", "spy": "#F87171",
    "philosopher": "#818CF8", "scholar": "#6366F1", "monk": "#A5B4FC",
    "educator": "#7DD3FC", "writer": "#FB7185", "poet": "#FB7185",
    "playwright": "#F472B6", "artist": "#F0ABFC",
    "scientist": "#2DD4BF", "engineer": "#14B8A6", "inventor": "#5EEAD4",
    "explorer": "#22D3EE", "traveler": "#67E8F9",
    "reformer": "#4ADE80", "revolutionary": "#F87171", "president": "#FACC15",
    "politician": "#93C5FD", "leader": "#FBBF24", "beauty": "#F9A8D4",
    "other": "#94A3B8",
}
EVENT_COLOR = "#D97706"  # amber/sepia, distinct from persons


def lighten(hex_color, amt=0.42):
    """Mix a hex color toward white by `amt` (0..1)."""
    h = hex_color.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    r = round(r + (255 - r) * amt)
    g = round(g + (255 - g) * amt)
    b = round(b + (255 - b) * amt)
    return f"#{r:02x}{g:02x}{b:02x}"


def svg(char, base, char_fill="#ffffff"):
    light = lighten(base)
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
        f'<defs><radialGradient id="g" cx="34%" cy="28%" r="85%">'
        f'<stop offset="0%" stop-color="{light}"/>'
        f'<stop offset="100%" stop-color="{base}"/></radialGradient></defs>'
        '<rect width="100" height="100" fill="url(#g)"/>'
        f'<text x="50" y="54" font-size="52" font-weight="700" '
        f'font-family="&quot;Noto Serif SC&quot;,Georgia,serif" '
        f'fill="{char_fill}" fill-opacity="0.95" text-anchor="middle" '
        f'dominant-baseline="central">{char}</text>'
        "</svg>"
    )


def write(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)


def main():
    made = filled = skipped = 0
    for fp in sorted(glob.glob(os.path.join(DATA_DIR, "*.json"))):
        d = json.load(open(fp, encoding="utf-8"))
        dyn = d["dynasty"]["slug"]

        for p in d.get("persons", []):
            if p.get("imageUrl"):
                skipped += 1
                continue
            name = (p.get("name") or "").strip()
            if not name:
                continue
            base = ROLE_COLOR.get(p.get("primaryRole"), ROLE_COLOR["other"])
            rel = f"/images/{dyn}/persons/{p['slug']}.svg"
            write(os.path.join(IMG_DIR, dyn, "persons", f"{p['slug']}.svg"),
                  svg(name[0], base))
            p["imageUrl"] = rel
            made += 1
            filled += 1

        for e in d.get("events", []):
            if e.get("imageUrl"):
                skipped += 1
                continue
            name = (e.get("name") or "").strip()
            if not name:
                continue
            rel = f"/images/{dyn}/events/{e['slug']}.svg"
            write(os.path.join(IMG_DIR, dyn, "events", f"{e['slug']}.svg"),
                  svg(name[0], EVENT_COLOR, char_fill="#FFFBEB"))
            e["imageUrl"] = rel
            made += 1
            filled += 1

        with open(fp, "w", encoding="utf-8") as f:
            json.dump(d, f, ensure_ascii=False, indent=2)

    print(f"avatars written: {made} | imageUrl filled: {filled} | kept existing: {skipped}")


if __name__ == "__main__":
    main()
