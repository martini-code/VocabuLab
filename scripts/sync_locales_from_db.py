#!/usr/bin/env python3
"""
Sync Locales from Lexicon Database
VocabuLab

This script synchronizes deck names (and themes/categories) and card terms from the
master SQLite lexicon database into the app's localization files (src/locales/<lang>/common.json).

Features:
- Supports ALL 123 languages defined in src/locales/languages.ts (plus 'pt').
- Creates missing language directories and initializes them with the base static
  translations template from en/common.json.
- Queries the SQLite lexicon database for each language's deck, subdeck, and card translations.
- Capitalizes deck and subdeck titles properly.
- Persists deck translations in `db_decks` and card translations in `db_cards`.
- Preserves custom UI strings for existing languages (e.g. en, es, fr, pt).
- Removes obsolete cards and decks from common.json if deleted from the DB.
"""

import os
import sys
import json
import re
import sqlite3
from pathlib import Path

# Paths
ROOT_DIR = Path(__file__).resolve().parent.parent
LOCALES_DIR = ROOT_DIR / "src" / "locales"
DEFAULT_DB_PATH = ROOT_DIR / "assets" / "lexicon_v1.0.0.db"
if not DEFAULT_DB_PATH.exists():
    DEFAULT_DB_PATH = ROOT_DIR / "lexicon_v1.0.0.db"

def capitalize_title(text: str) -> str:
    if not text:
        return ""
    words = text.split(" ")
    capitalized = []
    for w in words:
        if w.startswith("("):
            capitalized.append("(" + w[1:].capitalize())
        else:
            capitalized.append(w.capitalize())
    return " ".join(capitalized)

def load_supported_languages() -> dict:
    """Extracts code -> name from src/locales/languages.ts."""
    languages_file = LOCALES_DIR / "languages.ts"
    code_to_name = {}
    if languages_file.exists():
        text = languages_file.read_text(encoding="utf-8")
        matches = re.findall(r"\{\s*code:\s*'([^']+)',\s*name:\s*'([^']+)'", text)
        for code, name in matches:
            code_to_name[code] = name
    if "pt" not in code_to_name:
        code_to_name["pt"] = "Portuguese"
    return code_to_name

def get_candidates_for_lang(lang_code: str, code_to_name: dict) -> list:
    name = code_to_name.get(lang_code)
    code_lower = lang_code.lower()
    candidates = []
    if name:
        candidates.append(name)
    candidates.append(lang_code)
    if code_lower != lang_code:
        candidates.append(code_lower)

    # Specific regional aliases & dialect fallbacks
    if lang_code == "pt":
        candidates.extend(["Portuguese", "Portuguese (Brazil)", "Portuguese (Portugal)", "pt", "pt-br"])
    elif lang_code == "pt-BR":
        candidates.extend(["Portuguese (Brazil)", "Portuguese", "pt-br", "pt"])
    elif lang_code == "pt-PT":
        candidates.extend(["Portuguese (Portugal)", "Portuguese", "pt-pt", "pt"])
    elif lang_code == "fr":
        candidates.extend(["French", "French (Canada)", "fr"])
    elif lang_code == "fr-CA":
        candidates.extend(["French (Canada)", "French", "fr-ca", "fr"])
    elif lang_code == "zh-CN":
        candidates.extend(["Chinese (Simplified)", "Chinese", "zh-cn", "zh"])
    elif lang_code == "zh-TW":
        candidates.extend(["Chinese (Traditional)", "Chinese", "zh-tw", "zh"])
    elif lang_code == "es":
        candidates.extend(["Spanish", "es"])
    elif lang_code == "en":
        candidates.extend(["English", "en"])

    # Remove duplicates while preserving priority order
    seen = set()
    result = []
    for c in candidates:
        if c.lower() not in seen:
            seen.add(c.lower())
            result.append(c)
    return result

def sync_locales(db_path: Path, target_langs: list = None):
    if not db_path.exists():
        print(f"Error: Database file not found at {db_path}", file=sys.stderr)
        sys.exit(1)

    print(f"Connecting to database: {db_path.name}")
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    # 1. Fetch all decks currently in database
    cur.execute("SELECT deck_id, category, subcategory FROM decks ORDER BY deck_id ASC")
    db_decks = cur.fetchall()
    db_deck_ids = {str(d[0]) for d in db_decks}
    db_deck_map = {d[0]: (d[1], d[2]) for d in db_decks}

    # 2. Fetch all cards currently in database
    cur.execute("SELECT card_id, primary_term FROM cards ORDER BY card_id ASC")
    db_cards = cur.fetchall()
    db_card_ids = {str(c[0]) for c in db_cards}
    db_card_map = {c[0]: c[1] for c in db_cards}

    print(f"Database contains: {len(db_decks)} active decks, {len(db_cards)} active cards.")

    # 3. Load base template from en/common.json
    en_file = LOCALES_DIR / "en" / "common.json"
    if not en_file.exists():
        print(f"Error: Master English template not found at {en_file}", file=sys.stderr)
        sys.exit(1)

    with open(en_file, "r", encoding="utf-8") as f:
        en_template = json.load(f)

    # Static UI keys template (everything except db_decks and db_cards)
    static_template = {k: v for k, v in en_template.items() if k not in ("db_decks", "db_cards")}

    # 4. Determine languages to process
    code_to_name = load_supported_languages()

    if target_langs:
        langs_to_process = target_langs
    else:
        # Default: sync ALL supported languages from languages.ts + any existing locale dirs
        all_langs = set(code_to_name.keys())
        for d in LOCALES_DIR.iterdir():
            if d.is_dir() and (d / "common.json").exists():
                all_langs.add(d.name)
        langs_to_process = sorted(list(all_langs))

    print(f"Syncing localization for {len(langs_to_process)} language(s)...")

    created_count = 0
    updated_count = 0

    for lang in langs_to_process:
        locale_dir = LOCALES_DIR / lang
        locale_file = locale_dir / "common.json"

        is_new = not locale_file.exists()
        locale_dir.mkdir(parents=True, exist_ok=True)

        if not is_new:
            try:
                with open(locale_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
            except Exception as e:
                print(f"[{lang}] Warning reading existing file, resetting to base template: {e}")
                data = json.loads(json.dumps(static_template))
        else:
            # Start off with basic static translations template
            data = json.loads(json.dumps(static_template))
            created_count += 1

        # Ensure any missing top-level static sections from en_template exist (fallback)
        for section, content in static_template.items():
            if section not in data:
                data[section] = content
            elif isinstance(content, dict) and isinstance(data[section], dict):
                for k, v in content.items():
                    if k not in data[section]:
                        data[section][k] = v

        candidates = get_candidates_for_lang(lang, code_to_name)
        cand_placeholders = ",".join(["?"] * len(candidates))

        # --- Decks Sync ---
        existing_decks = data.get("db_decks", {})
        existing_deck_keys = set(existing_decks.keys())

        # Find removed decks
        removed_deck_keys = existing_deck_keys - db_deck_ids
        for k in removed_deck_keys:
            del existing_decks[k]

        # Fetch deck translations from deck_translations
        cur.execute(
            f"""
            SELECT deck_id, lang_name, category_translation, subcategory_translation
            FROM deck_translations
            WHERE lang_name IN ({cand_placeholders})
            """,
            candidates
        )
        deck_trans_rows = cur.fetchall()
        deck_trans = {}
        for r in deck_trans_rows:
            d_id = r[0]
            if d_id not in deck_trans or r[1].lower() == candidates[0].lower():
                deck_trans[d_id] = (r[2], r[3])

        added_decks = 0
        updated_decks_count = 0
        new_decks_dict = {}

        for deck_id, (def_cat, def_sub) in db_deck_map.items():
            k = str(deck_id)
            if deck_id in deck_trans:
                theme = capitalize_title(deck_trans[deck_id][0])
                name = capitalize_title(deck_trans[deck_id][1])
            else:
                theme = capitalize_title(def_cat)
                name = capitalize_title(def_sub)

            deck_entry = {
                "theme": theme,
                "name": name
            }

            if k not in existing_deck_keys:
                added_decks += 1
            elif existing_decks.get(k) != deck_entry:
                updated_decks_count += 1

            new_decks_dict[k] = deck_entry

        # --- Cards Sync ---
        existing_cards = data.get("db_cards", {})
        existing_card_keys = set(existing_cards.keys())

        # Find removed cards
        removed_card_keys = existing_card_keys - db_card_ids
        for k in removed_card_keys:
            del existing_cards[k]

        # Fetch card translations from card_translations
        cur.execute(
            f"""
            SELECT card_id, lang_name, translation
            FROM card_translations
            WHERE lang_name IN ({cand_placeholders})
            """,
            candidates
        )
        card_trans_rows = cur.fetchall()
        card_trans = {}
        for r in card_trans_rows:
            c_id = r[0]
            if c_id not in card_trans or r[1].lower() == candidates[0].lower():
                card_trans[c_id] = r[2]

        added_cards = 0
        updated_cards_count = 0
        new_cards_dict = {}

        for card_id, primary_term in db_card_map.items():
            k = str(card_id)
            translation = card_trans.get(card_id, primary_term)

            if k not in existing_card_keys:
                added_cards += 1
            elif existing_cards.get(k) != translation:
                updated_cards_count += 1

            new_cards_dict[k] = translation

        # Update data dictionary
        data["db_decks"] = new_decks_dict
        data["db_cards"] = new_cards_dict

        # Write back to common.json with clean formatting
        with open(locale_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")

        if not is_new:
            updated_count += 1

        lang_name = code_to_name.get(lang, lang)
        action_desc = "Created" if is_new else "Updated"
        print(
            f"[{lang}] ({lang_name}) {action_desc} -> "
            f"Decks: {len(new_decks_dict)} (DB translated: {len(deck_trans)}) | "
            f"Cards: {len(new_cards_dict)} (DB translated: {len(card_trans)})"
        )

    conn.close()
    print(f"\nLocalization sync complete: {created_count} new locales created, {updated_count} existing updated. Total: {len(langs_to_process)} languages.")

    # Generate registry.ts
    generate_registry()

def generate_registry():
    registry_file = LOCALES_DIR / "registry.ts"
    existing_dirs = sorted([
        d.name for d in LOCALES_DIR.iterdir()
        if d.is_dir() and (d / "common.json").exists()
    ])
    lines = [
        "// Auto-generated by scripts/sync_locales_from_db.py. Do not edit manually.\n",
        "export const localeLoaders: Record<string, () => any> = {",
    ]
    for code in existing_dirs:
        lines.append(f"  '{code}': () => require('./{code}/common.json'),")
    lines.append("};\n")
    with open(registry_file, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(f"Generated {registry_file} with {len(existing_dirs)} locale loaders.")

if __name__ == "__main__":
    db_file = DEFAULT_DB_PATH
    args = sys.argv[1:]
    target_languages = []

    for arg in args:
        if arg.endswith(".db"):
            db_file = Path(arg)
        elif arg == "--all":
            target_languages = None
            break
        elif not arg.startswith("-"):
            target_languages.append(arg)

    if not target_languages:
        target_languages = None

    sync_locales(db_file, target_languages)
