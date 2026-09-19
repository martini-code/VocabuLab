#!/usr/bin/env python3
"""
ETL Pipeline script for Vocab Keep (Medieval Theme).
Generates the SQLite master payload with:
- Hierarchical Domains (Castle Grounds, Royal Alchemy, Grand Scriptorium, Knight Armory, Mystic Forest, etc.)
- OMW V2 CILI Concepts
- Multilingual Lexemes with CEFR ratings (A1 to C2)
- FTS5 virtual table & synchronization triggers
- Concept_Lexeme junction solving polysemy
- Initial User_Cards for immediate SRS review
"""

import os
import sqlite3
import datetime
from pathlib import Path

def create_database(db_path: str):
    # Ensure directory exists
    os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)
    if os.path.exists(db_path):
        os.remove(db_path)

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    cursor.execute("PRAGMA foreign_keys = ON;")
    cursor.execute("PRAGMA journal_mode = WAL;")

    # 1. Domains Table (Themes and Difficulty-Ordered Decks)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS Domains (
        id TEXT PRIMARY KEY,
        parent_id TEXT,
        name TEXT NOT NULL,
        description TEXT,
        difficulty_level INTEGER DEFAULT 1,
        icon_name TEXT,
        FOREIGN KEY(parent_id) REFERENCES Domains(id)
    );
    """)

    # 2. Concepts Table (OMW V2 CILI Anchors)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS Concepts (
        id TEXT PRIMARY KEY,
        domain_id TEXT,
        description TEXT NOT NULL,
        FOREIGN KEY(domain_id) REFERENCES Domains(id)
    );
    """)

    # 3. Lexemes Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS Lexemes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        language TEXT NOT NULL,
        term TEXT NOT NULL,
        pos TEXT,
        cefr_level TEXT,
        frequency_rank INTEGER
    );
    """)

    # 4. FTS5 Virtual Table
    cursor.execute("""
    CREATE VIRTUAL TABLE IF NOT EXISTS Lexemes_FTS USING fts5(
        term,
        language,
        content='Lexemes',
        content_rowid='id'
    );
    """)

    # Triggers for FTS sync
    cursor.execute("""
    CREATE TRIGGER IF NOT EXISTS lexemes_ai AFTER INSERT ON Lexemes BEGIN
        INSERT INTO Lexemes_FTS(rowid, term, language) VALUES (new.id, new.term, new.language);
    END;
    """)
    cursor.execute("""
    CREATE TRIGGER IF NOT EXISTS lexemes_ad AFTER DELETE ON Lexemes BEGIN
        INSERT INTO Lexemes_FTS(Lexemes_FTS, rowid, term, language) VALUES('delete', old.id, old.term, old.language);
    END;
    """)
    cursor.execute("""
    CREATE TRIGGER IF NOT EXISTS lexemes_au AFTER UPDATE ON Lexemes BEGIN
        INSERT INTO Lexemes_FTS(Lexemes_FTS, rowid, term, language) VALUES('delete', old.id, old.term, old.language);
        INSERT INTO Lexemes_FTS(rowid, term, language) VALUES (new.id, new.term, new.language);
    END;
    """)

    # 5. Concept_Lexeme Junction Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS Concept_Lexeme (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        concept_id TEXT NOT NULL,
        lexeme_id INTEGER NOT NULL,
        FOREIGN KEY(concept_id) REFERENCES Concepts(id),
        FOREIGN KEY(lexeme_id) REFERENCES Lexemes(id)
    );
    """)

    # 6. User_Cards Table (FSRS State)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS User_Cards (
        id TEXT PRIMARY KEY,
        front_lexeme_id INTEGER NOT NULL,
        back_lexeme_id INTEGER NOT NULL,
        due_date DATETIME NOT NULL,
        state INTEGER NOT NULL,
        stability REAL NOT NULL,
        difficulty REAL NOT NULL,
        elapsed_days INTEGER NOT NULL,
        scheduled_days INTEGER NOT NULL,
        reps INTEGER NOT NULL,
        lapses INTEGER NOT NULL,
        updated_at DATETIME NOT NULL,
        FOREIGN KEY(front_lexeme_id) REFERENCES Lexemes(id),
        FOREIGN KEY(back_lexeme_id) REFERENCES Lexemes(id)
    );
    """)

    # 7. Review_Logs Table (Activity & Contribution History)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS Review_Logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        card_id TEXT NOT NULL,
        rating INTEGER NOT NULL,
        reviewed_at DATETIME NOT NULL,
        FOREIGN KEY(card_id) REFERENCES User_Cards(id)
    );
    """)

    # 8. Settings Table (Local Entitlements & App State)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS Settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME NOT NULL
    );
    """)

    # Indexes
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_due_date ON User_Cards(due_date);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_lexeme_lang ON Lexemes(language);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_concept_lexeme ON Concept_Lexeme(concept_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_concepts_domain ON Concepts(domain_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_reviewed_at ON Review_Logs(reviewed_at);")

    # Seed Domains & Themes
    # (id, parent_id, name, description, difficulty_level, icon_name)
    domains = [
        # Top-level Themes
        ("domain_castle", None, "The Castle Keep & Court", "Palace etiquette, pantry provisions, and festival banquets", 1, "castle"),
        ("domain_wilderness", None, "The Enchanted Forest & Nature", "Wayfaring trails, tempest storms, and wild beasts", 2, "tree"),
        ("domain_market", None, "The Merchant Guild & Trade", "Royal currency, marketplace barter, and commerce contracts", 2, "coins"),
        ("domain_armory", None, "The Royal Armory & Strategy", "Bladed armaments, shield defenses, and battlefield valor", 3, "swords"),
        ("domain_academy", None, "The Grand Scriptorium & Lore", "Celestial stars, epistemology, hypotheses, and logic axioms", 3, "book"),
        ("domain_forbidden", None, "The Forbidden Royal Archives (Pro)", "High court statecraft, incorporeal metaphysics, and ancient mazes", 5, "crown"),

        # Theme 1: Castle Keep & Court (Progressive Decks)
        ("sub_castle_daily", "domain_castle", "Everyday Courtesies & Greetings", "Essential greetings and bonds of friendship", 1, "handshake"),
        ("sub_castle_dining", "domain_castle", "Pantry & Dining Provisions", "Daily meals, sweet sugar crystals, and provisions", 2, "utensils"),
        ("sub_castle_feasts", "domain_castle", "Royal Banquets & Celebrations", "Grand feast dining and vintage wine toasts", 3, "goblet"),

        # Theme 2: Enchanted Forest & Nature (Progressive Decks)
        ("sub_wild_creatures", "domain_wilderness", "Beasts & Royal Menagerie", "Carnivorous lions and fierce creatures of the woods", 2, "paw"),
        ("sub_wild_weather", "domain_wilderness", "Wayfaring & Tempest Storms", "Surviving violent gale squalls and tempest rains", 3, "cloud-lightning"),
        ("sub_wild_travel", "domain_wilderness", "Untamed Wilderness & Badlands", "Misty rugged terrain and mysterious badlands", 4, "compass"),

        # Theme 3: Merchant Guild & Trade (Progressive Decks)
        ("sub_market_goods", "domain_market", "Coinage & Royal Mint", "Stamped currency coins and standard traded wares", 2, "coins"),
        ("sub_market_trade", "domain_market", "Guild Bargains & Trade Pacts", "Merchant exchange agreements and trade transactions", 3, "scale"),

        # Theme 4: Royal Armory & Strategy (Progressive Decks)
        ("sub_armory_weapons", "domain_armory", "Steel Blades & Armaments", "Forged swords and bladed melee weaponry", 2, "sword"),
        ("sub_armory_defenses", "domain_armory", "Shields & Defensive Plate", "Personal defense shields and protective heraldic armor", 2, "shield"),
        ("sub_armory_combat", "domain_armory", "Martial Valor & Battlefield Courage", "Chivalric courage, tactics, and battlefield valor", 4, "award"),

        # Theme 5: Grand Scriptorium & Lore (Progressive Decks)
        ("sub_script_astronomy", "domain_academy", "Celestial Stars & Heavens", "Luminous stellar bodies and the celestial sphere", 1, "sparkles"),
        ("sub_script_philosophy", "domain_academy", "Truth & Foundational Epistemology", "The pursuit of genuine reality, veracity, and wisdom", 3, "scroll"),
        ("sub_script_science", "domain_academy", "Natural Hypotheses & Deduction", "Formulating provisional suppositions and theories", 4, "microscope"),
        ("sub_script_logic", "domain_academy", "First Principles & Axioms", "Propositions accepted as self-evidently true", 5, "brain"),

        # Theme 6: Forbidden Royal Archives (Progressive Decks)
        ("sub_forbid_diplomacy", "domain_forbidden", "Statecraft & High Intrigue", "Secret political maneuvers and oratorical eloquence", 5, "landmark"),
        ("sub_forbid_arcana", "domain_forbidden", "Incorporeal Metaphysics & Arcana", "Non-physical ideas, spirits, and abstract doctrines", 6, "flame"),
        ("sub_forbid_labyrinth", "domain_forbidden", "Labyrinthine Riddles of Antiquity", "Intricate, deceptive conceptual mazes of the ancients", 6, "network"),
    ]
    cursor.executemany("INSERT INTO Domains (id, parent_id, name, description, difficulty_level, icon_name) VALUES (?, ?, ?, ?, ?, ?);", domains)

    # Rich Multilingual Corpus with CILI concepts & CEFR levels
    # Format: concept_id, domain_id, description, [ (lang, term, pos, cefr, rank) ]
    sample_corpus = [
        # --- Castle Keep Decks ---
        ("cili_001", "sub_castle_daily", "A greeting of goodwill exchanged upon meeting", [
            ("en", "greeting", "noun", "A1", 10),
            ("es", "saludo", "noun", "A1", 12),
            ("fr", "salutation", "noun", "A1", 15),
            ("de", "Begrüßung", "noun", "A1", 14),
            ("ja", "挨拶", "noun", "A1", 20),
            ("it", "saluto", "noun", "A1", 13),
        ]),
        ("cili_002", "sub_castle_daily", "The time of day between morning and night when the sun shines", [
            ("en", "day", "noun", "A1", 1),
            ("es", "día", "noun", "A1", 2),
            ("fr", "jour", "noun", "A1", 3),
            ("de", "Tag", "noun", "A1", 2),
            ("ja", "日", "noun", "A1", 1),
            ("it", "giorno", "noun", "A1", 2),
        ]),
        ("cili_003", "sub_castle_daily", "A person with whom one has a bond of mutual affection and loyalty", [
            ("en", "friend", "noun", "A1", 8),
            ("es", "amigo", "noun", "A1", 9),
            ("fr", "ami", "noun", "A1", 8),
            ("de", "Freund", "noun", "A1", 7),
            ("ja", "友達", "noun", "A1", 11),
            ("it", "amico", "noun", "A1", 8),
        ]),
        ("cili_004", "sub_castle_dining", "A sweet crystalline substance obtained from sugarcane or beet", [
            ("en", "sugar", "noun", "A2", 45),
            ("es", "azúcar", "noun", "A2", 40),
            ("fr", "sucre", "noun", "A2", 38),
            ("de", "Zucker", "noun", "A2", 42),
            ("ja", "砂糖", "noun", "A2", 50),
            ("it", "zucchero", "noun", "A2", 41),
        ]),
        ("cili_005", "sub_castle_feasts", "A grand celebration meal accompanied by music and speeches", [
            ("en", "banquet", "noun", "B1", 180),
            ("es", "banquete", "noun", "B1", 175),
            ("fr", "banquet", "noun", "B1", 170),
            ("de", "Bankett", "noun", "B1", 190),
            ("ja", "宴会", "noun", "B1", 210),
            ("it", "banchetto", "noun", "B1", 185),
        ]),
        ("cili_006", "sub_castle_feasts", "Fermented beverage made from pressed grape juice", [
            ("en", "wine", "noun", "B1", 60),
            ("es", "vino", "noun", "B1", 55),
            ("fr", "vin", "noun", "B1", 50),
            ("de", "Wein", "noun", "B1", 58),
            ("ja", "ワイン", "noun", "B1", 65),
            ("it", "vino", "noun", "B1", 52),
        ]),

        # --- Grand Scriptorium Decks ---
        ("cili_009", "sub_script_astronomy", "The luminous celestial body around which the Earth and planets orbit", [
            ("en", "star", "noun", "A1", 30),
            ("es", "estrella", "noun", "A1", 28),
            ("fr", "étoile", "noun", "A1", 27),
            ("de", "Stern", "noun", "A1", 32),
            ("ja", "星", "noun", "A1", 29),
            ("it", "stella", "noun", "A1", 28),
        ]),
        ("cili_007", "sub_script_philosophy", "The quality of being true, genuine, or actual", [
            ("en", "truth", "noun", "B1", 85),
            ("es", "verdad", "noun", "B1", 80),
            ("fr", "vérité", "noun", "B1", 82),
            ("de", "Wahrheit", "noun", "B1", 84),
            ("ja", "真理", "noun", "B1", 95),
            ("it", "verità", "noun", "B1", 81),
        ]),
        ("cili_010", "sub_script_science", "A provisional supposition made in order to draw out logical consequences", [
            ("en", "hypothesis", "noun", "B2", 230),
            ("es", "hipótesis", "noun", "B2", 225),
            ("fr", "hypothèse", "noun", "B2", 220),
            ("de", "Hypothese", "noun", "B2", 235),
            ("ja", "仮説", "noun", "B2", 240),
            ("it", "ipotesi", "noun", "B2", 222),
        ]),
        ("cili_008", "sub_script_logic", "A proposition accepted as self-evidently true without need of proof", [
            ("en", "axiom", "noun", "C1", 420),
            ("es", "axioma", "noun", "C1", 410),
            ("fr", "axiome", "noun", "C1", 415),
            ("de", "Axiom", "noun", "C1", 430),
            ("ja", "公理", "noun", "C1", 450),
            ("it", "assioma", "noun", "C1", 418),
        ]),

        # --- Enchanted Forest Decks ---
        ("cili_011", "sub_wild_creatures", "A large carnivorous feline of the genus Panthera with a regal mane", [
            ("en", "lion", "noun", "A2", 90),
            ("es", "león", "noun", "A2", 88),
            ("fr", "lion", "noun", "A2", 87),
            ("de", "Löwe", "noun", "A2", 92),
            ("ja", "ライオン", "noun", "A2", 95),
            ("it", "leone", "noun", "A2", 89),
        ]),
        ("cili_012", "sub_wild_weather", "A sudden violent burst of wind often accompanied by rain or tempest", [
            ("en", "storm", "noun", "B1", 70),
            ("es", "tormenta", "noun", "B1", 68),
            ("fr", "tempête", "noun", "B1", 72),
            ("de", "Sturm", "noun", "B1", 69),
            ("ja", "嵐", "noun", "B1", 75),
            ("it", "tempesta", "noun", "B1", 71),
        ]),
        ("cili_013", "sub_wild_travel", "An expanse of rugged terrain shrouded in mystery and mist", [
            ("en", "wilderness", "noun", "B2", 310),
            ("es", "naturaleza salvaje", "noun", "B2", 320),
            ("fr", "contrée sauvage", "noun", "B2", 315),
            ("de", "Wildnis", "noun", "B2", 305),
            ("ja", "荒野", "noun", "B2", 330),
            ("it", "natura selvaggia", "noun", "B2", 318),
        ]),

        # --- Royal Armory Decks ---
        ("cili_014", "sub_armory_weapons", "A bladed weapon consisting of a steel blade fitted with a hilt", [
            ("en", "sword", "noun", "A2", 110),
            ("es", "espada", "noun", "A2", 105),
            ("fr", "épée", "noun", "A2", 108),
            ("de", "Schwert", "noun", "A2", 112),
            ("ja", "剣", "noun", "A2", 115),
            ("it", "spada", "noun", "A2", 106),
        ]),
        ("cili_015", "sub_armory_defenses", "A piece of personal defensive armor carried on the arm", [
            ("en", "shield", "noun", "A2", 120),
            ("es", "escudo", "noun", "A2", 118),
            ("fr", "bouclier", "noun", "A2", 122),
            ("de", "Schild", "noun", "A2", 124),
            ("ja", "盾", "noun", "A2", 128),
            ("it", "scudo", "noun", "A2", 119),
        ]),
        ("cili_016", "sub_armory_combat", "Great courage in the face of imminent danger and battle", [
            ("en", "valor", "noun", "B2", 280),
            ("es", "valentía", "noun", "B2", 270),
            ("fr", "vaillance", "noun", "B2", 275),
            ("de", "Tapferkeit", "noun", "B2", 285),
            ("ja", "勇気", "noun", "B2", 260),
            ("it", "valore", "noun", "B2", 272),
        ]),

        # --- Merchant Guild Decks ---
        ("cili_017", "sub_market_goods", "A flat rounded piece of metal stamped by royal authority used as money", [
            ("en", "coin", "noun", "A2", 130),
            ("es", "moneda", "noun", "A2", 128),
            ("fr", "pièce de monnaie", "noun", "A2", 135),
            ("de", "Münze", "noun", "A2", 132),
            ("ja", "硬貨", "noun", "A2", 140),
            ("it", "moneta", "noun", "A2", 129),
        ]),
        ("cili_018", "sub_market_trade", "An agreement between merchants to exchange goods and wares", [
            ("en", "bargain", "noun", "B1", 195),
            ("es", "regateo", "noun", "B1", 200),
            ("fr", "marchandage", "noun", "B1", 198),
            ("de", "Feilschen", "noun", "B1", 205),
            ("ja", "取引", "noun", "B1", 190),
            ("it", "affare", "noun", "B1", 192),
        ]),

        # --- Forbidden Royal Archives Decks ---
        ("cili_019", "sub_forbid_diplomacy", "Secret art of political maneuvering and cunning negotiation", [
            ("en", "statecraft", "noun", "C1", 490),
            ("es", "arte de gobierno", "noun", "C1", 485),
            ("fr", "art de gouverner", "noun", "C1", 488),
            ("de", "Staatskunst", "noun", "C1", 495),
            ("ja", "経国", "noun", "C1", 510),
            ("it", "arte di governo", "noun", "C1", 487),
        ]),
        ("cili_020", "sub_forbid_diplomacy", "The art of persuasive or impressive speaking or writing with elegance", [
            ("en", "eloquence", "noun", "C1", 460),
            ("es", "elocuencia", "noun", "C1", 455),
            ("fr", "éloquence", "noun", "C1", 458),
            ("de", "Beredsamkeit", "noun", "C1", 465),
            ("ja", "雄弁", "noun", "C1", 470),
            ("it", "eloquenza", "noun", "C1", 456),
        ]),
        ("cili_021", "sub_forbid_arcana", "Existing in thought or as an idea but having no physical or concrete existence", [
            ("en", "incorporeal", "adj", "C2", 650),
            ("es", "incorpóreo", "adj", "C2", 645),
            ("fr", "incorporel", "adj", "C2", 648),
            ("de", "unteilig", "adj", "C2", 655),
            ("ja", "無形の", "adj", "C2", 660),
            ("it", "incorporeo", "adj", "C2", 646),
        ]),
        ("cili_022", "sub_forbid_labyrinth", "An intricate or deceptive labyrinth of interconnected ideas", [
            ("en", "labyrinthine", "adj", "C2", 720),
            ("es", "laberíntico", "adj", "C2", 710),
            ("fr", "labyrinthique", "adj", "C2", 715),
            ("de", "verschlungen", "adj", "C2", 725),
            ("ja", "迷宮のような", "adj", "C2", 730),
            ("it", "labirintico", "adj", "C2", 712),
        ]),
    ]

    lexeme_id_counter = 1
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

    # Spanish (front) -> English (back) user study cards
    user_cards_to_create = []

    for concept_id, domain_id, description, lexemes in sample_corpus:
        # Insert Concept
        cursor.execute("INSERT INTO Concepts (id, domain_id, description) VALUES (?, ?, ?);",
                       (concept_id, domain_id, description))

        en_id = None
        es_id = None

        for lang, term, pos, cefr, rank in lexemes:
            curr_id = lexeme_id_counter
            lexeme_id_counter += 1

            cursor.execute("""
            INSERT INTO Lexemes (id, language, term, pos, cefr_level, frequency_rank)
            VALUES (?, ?, ?, ?, ?, ?);
            """, (curr_id, lang, term, pos, cefr, rank))

            # Junction
            cursor.execute("""
            INSERT INTO Concept_Lexeme (concept_id, lexeme_id) VALUES (?, ?);
            """, (concept_id, curr_id))

            if lang == "es":
                es_id = curr_id
            elif lang == "en":
                en_id = curr_id

        # Seed initial user cards
        if es_id and en_id and len(user_cards_to_create) < 10:
            user_cards_to_create.append((
                f"card_{concept_id}",
                es_id,
                en_id,
                now_iso,
                0,    # State.New
                0.0,  # stability
                0.0,  # difficulty
                0,    # elapsed_days
                0,    # scheduled_days
                0,    # reps
                0,    # lapses
                now_iso
            ))

    cursor.executemany("""
    INSERT INTO User_Cards (
        id, front_lexeme_id, back_lexeme_id, due_date, state,
        stability, difficulty, elapsed_days, scheduled_days, reps, lapses, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    """, user_cards_to_create)

    # Seed realistic study activity logs over past 60 days
    sample_logs = []
    card_ids = [c[0] for c in user_cards_to_create]
    now_dt = datetime.datetime.now(datetime.timezone.utc)

    for i in range(60, -1, -1):
        day_date = now_dt - datetime.timedelta(days=i)
        weekday = day_date.weekday()

        # Skip a few days earlier to keep streak realistic, but preserve last 4 consecutive days
        if i > 4 and (i % 7 == 2 or (i % 11 == 0 and weekday == 6)):
            continue

        # Activity count between 2 and 16 reviews
        count = (4 + (i * 3) % 12) if i <= 4 else ((i * 7 + weekday * 5) % 15) + 2
        for r in range(count):
            c_id = card_ids[r % len(card_ids)]
            rating = (r % 4) + 1
            log_time = day_date.replace(hour=9 + (r % 12), minute=(r * 7) % 60, second=0).isoformat()
            sample_logs.append((c_id, rating, log_time))

    cursor.executemany("""
    INSERT INTO Review_Logs (card_id, rating, reviewed_at) VALUES (?, ?, ?);
    """, sample_logs)

    conn.commit()
    conn.close()
    print(f"Database successfully created at {db_path} with {lexeme_id_counter - 1} lexemes, {len(user_cards_to_create)} learned cards, and {len(sample_logs)} activity review logs.")

if __name__ == "__main__":
    base_dir = Path(__file__).resolve().parent.parent
    assets_target = base_dir / "assets" / "seed-vocab.sqlite"
    dist_target = base_dir / "dist" / "vocab-keep.sqlite"

    create_database(str(assets_target))
    create_database(str(dist_target))
