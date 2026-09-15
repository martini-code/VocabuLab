#!/usr/bin/env python3
"""
Sync Locales from Lexicon Database
Vocab Keep

This script synchronizes deck names (and categories) and card names from the
master SQLite lexicon database into the app's localization files (src/locales/<lang>/common.json).

Features:
- Detects newly added decks and persists their translated names and themes.
- Detects and removes decks that have been deleted from the database.
- Detects newly added cards and persists their translated terms.
- Detects and removes cards that have been deleted from the database.
- Updates translations when they change in the database.
- Preserves all existing application UI strings.
"""

import os
import sys
import json
import sqlite3
from pathlib import Path

# Paths
ROOT_DIR = Path(__file__).resolve().parent.parent
LOCALES_DIR = ROOT_DIR / "src" / "locales"
DEFAULT_DB_PATH = ROOT_DIR / "assets" / "lexicon_v1.0.0.db"
if not DEFAULT_DB_PATH.exists():
    DEFAULT_DB_PATH = ROOT_DIR / "lexicon_v1.0.0.db"

# Language code to DB language candidate names mapping
LANGUAGE_CANDIDATES = {
    "en": ["English", "en"],
    "es": ["Spanish", "es"],
    "fr": ["French", "French (Canada)", "fr"],
    "pt": ["Portuguese (Brazil)", "Portuguese", "Portuguese (Portugal)", "pt", "pt-br"],
    "ar": ["Arabic", "ar"],
    "de": ["German", "de"],
    "it": ["Italian", "it"],
    "ja": ["Japanese", "ja"],
    "ko": ["Korean", "ko"],
    "ru": ["Russian", "ru"],
    "zh": ["Chinese (Simplified)", "Chinese (Traditional)", "Chinese", "zh", "zh-cn"],
}

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

def get_candidates_for_lang(lang_code: str) -> list:
    code = lang_code.lower()
    if code in LANGUAGE_CANDIDATES:
        return LANGUAGE_CANDIDATES[code]
    return [lang_code]

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

    # 3. Check which languages to process
    available_locales = [
        d.name for d in LOCALES_DIR.iterdir()
        if d.is_dir() and (d / "common.json").exists()
    ]

    langs_to_process = target_langs if target_langs else available_locales

    for lang in sorted(langs_to_process):
        locale_file = LOCALES_DIR / lang / "common.json"
        if not locale_file.exists():
            print(f"[{lang}] Skipping: {locale_file} does not exist.")
            continue

        try:
            with open(locale_file, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            print(f"[{lang}] Error reading {locale_file}: {e}", file=sys.stderr)
            continue

        candidates = get_candidates_for_lang(lang)
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
        updated_decks = 0
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
            elif existing_decks[k] != deck_entry:
                updated_decks += 1

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
        updated_cards = 0
        new_cards_dict = {}

        for card_id, primary_term in db_card_map.items():
            k = str(card_id)
            translation = card_trans.get(card_id, primary_term)

            if k not in existing_card_keys:
                added_cards += 1
            elif existing_cards[k] != translation:
                updated_cards += 1

            new_cards_dict[k] = translation

        # Update data dictionary
        data["db_decks"] = new_decks_dict
        data["db_cards"] = new_cards_dict

        # Write back to common.json with clean formatting
        with open(locale_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")

        print(
            f"[{lang}] Synced -> "
            f"Decks: +{added_decks} added, -{len(removed_deck_keys)} removed, ~{updated_decks} updated (total {len(new_decks_dict)}) | "
            f"Cards: +{added_cards} added, -{len(removed_card_keys)} removed, ~{updated_cards} updated (total {len(new_cards_dict)})"
        )

    conn.close()
    print("Localization sync complete.")

if __name__ == "__main__":
    db_file = DEFAULT_DB_PATH
    if len(sys.argv) > 1 and sys.argv[1].endswith(".db"):
        db_file = Path(sys.argv[1])
        target_languages = sys.argv[2:] if len(sys.argv) > 2 else None
    else:
        target_languages = sys.argv[1:] if len(sys.argv) > 1 else None

    sync_locales(db_file, target_languages)
