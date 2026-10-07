#!/usr/bin/env python3
"""
Automated Verification Suite for VocabuLab (SQLite + FTS5 + FSRS + OMW CILI)
"""

import sqlite3
import os
import unittest
from datetime import datetime, timezone, timedelta

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "assets", "seed-vocab.sqlite")

class TestVocabuLabVault(unittest.TestCase):
    def setUp(self):
        self.assertTrue(os.path.exists(DB_PATH), f"Database must exist at {DB_PATH}")
        self.conn = sqlite3.connect(DB_PATH)
        self.conn.row_factory = sqlite3.Row
        self.cursor = self.conn.cursor()

    def tearDown(self):
        self.conn.close()

    def test_tables_exist(self):
        self.cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = {row["name"] for row in self.cursor.fetchall()}
        required = {"Domains", "Concepts", "Lexemes", "Lexemes_FTS", "Concept_Lexeme", "User_Cards", "Review_Logs"}
        for table in required:
            self.assertIn(table, tables, f"Missing required table: {table}")

    def test_fts5_full_text_search(self):
        # Querying Spanish term 'espada'
        self.cursor.execute("SELECT * FROM Lexemes_FTS WHERE Lexemes_FTS MATCH 'espada*';")
        rows = self.cursor.fetchall()
        self.assertGreater(len(rows), 0, "FTS5 should find 'espada*'")
        self.assertEqual(rows[0]["language"], "es")

        # Querying English term 'banquet'
        self.cursor.execute("SELECT * FROM Lexemes_FTS WHERE Lexemes_FTS MATCH 'banquet*';")
        rows = self.cursor.fetchall()
        self.assertGreater(len(rows), 0, "FTS5 should find 'banquet*'")

    def test_domain_hierarchy(self):
        self.cursor.execute("SELECT count(*) as cnt FROM Domains WHERE parent_id IS NULL;")
        top_domains = self.cursor.fetchone()["cnt"]
        self.assertGreaterEqual(top_domains, 5, "Must have top-level domains")

        self.cursor.execute("SELECT count(*) as cnt FROM Domains WHERE parent_id IS NOT NULL;")
        sub_domains = self.cursor.fetchone()["cnt"]
        self.assertGreaterEqual(sub_domains, 5, "Must have subdomains")

    def test_cefr_levels_representation(self):
        self.cursor.execute("SELECT DISTINCT cefr_level FROM Lexemes;")
        levels = {row["cefr_level"] for row in self.cursor.fetchall()}
        expected_levels = {"A1", "A2", "B1", "B2", "C1", "C2"}
        for lvl in expected_levels:
            self.assertIn(lvl, levels, f"CEFR level {lvl} must be represented in lexemes")

    def test_user_cards_and_fsrs_state(self):
        self.cursor.execute("SELECT * FROM User_Cards LIMIT 5;")
        cards = self.cursor.fetchall()
        self.assertGreater(len(cards), 0, "Initial learned cards must exist")
        for card in cards:
            self.assertIn("stability", card.keys())
            self.assertIn("difficulty", card.keys())
            self.assertIn("due_date", card.keys())
            self.assertIn("state", card.keys())

    def test_fts_triggers_on_insert(self):
        # Insert a new test lexeme and ensure FTS5 automatically indexes it
        self.cursor.execute("""
            INSERT INTO Lexemes (language, term, pos, cefr_level, frequency_rank)
            VALUES ('es', 'catapulta', 'noun', 'B2', 500);
        """)
        self.conn.commit()

        self.cursor.execute("SELECT * FROM Lexemes_FTS WHERE Lexemes_FTS MATCH 'catapulta*';")
        match = self.cursor.fetchall()
        self.assertEqual(len(match), 1, "FTS trigger should auto-index newly inserted lexeme")

        # Clean up test row
        self.cursor.execute("DELETE FROM Lexemes WHERE term = 'catapulta';")
        self.conn.commit()

        self.cursor.execute("SELECT * FROM Lexemes_FTS WHERE Lexemes_FTS MATCH 'catapulta*';")
        match_after = self.cursor.fetchall()
        self.assertEqual(len(match_after), 0, "FTS trigger should remove deleted lexeme")

    def test_review_logs_and_activity_aggregation(self):
        self.cursor.execute("SELECT count(*) as count FROM Review_Logs;")
        cnt = self.cursor.fetchone()["count"]
        self.assertGreater(cnt, 0, "Review_Logs should contain seeded review logs")

        # Test daily grouping query used by the GitHub activity matrix
        self.cursor.execute("""
            SELECT date(reviewed_at) as day, count(*) as daily_cnt 
            FROM Review_Logs 
            GROUP BY date(reviewed_at) 
            ORDER BY day DESC;
        """)
        daily_rows = self.cursor.fetchall()
        self.assertGreater(len(daily_rows), 10, "Should have multiple distinct active review days")
        self.assertGreater(daily_rows[0]["daily_cnt"], 0)

    def test_progressive_difficulty_decks(self):
        # Verify themes and their sub-decks order ascending by difficulty_level
        self.cursor.execute("SELECT id, name, difficulty_level FROM Domains WHERE parent_id IS NULL ORDER BY difficulty_level ASC;")
        themes = self.cursor.fetchall()
        self.assertGreaterEqual(len(themes), 6, "Should have 6 themes")

        for theme in themes:
            self.cursor.execute(
                "SELECT id, name, difficulty_level FROM Domains WHERE parent_id = ? ORDER BY difficulty_level ASC;",
                (theme["id"],)
            )
            decks = self.cursor.fetchall()
            self.assertGreaterEqual(len(decks), 1, f"Theme {theme['id']} should have decks")
            prev_diff = 0
            for deck in decks:
                self.assertIsNotNone(deck["difficulty_level"])
                self.assertGreaterEqual(deck["difficulty_level"], prev_diff, f"Deck {deck['id']} must be ordered progressively (got {deck['difficulty_level']} after {prev_diff})")
                prev_diff = deck["difficulty_level"]

    def test_settings_and_ad_free_persistence(self):
        # Verify Settings table exists and handles key-value upserts
        now = datetime.now(timezone.utc).isoformat()
        self.cursor.execute(
            "INSERT INTO Settings (key, value, updated_at) VALUES ('is_ad_free', 'true', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at;",
            (now,)
        )
        self.conn.commit()

        self.cursor.execute("SELECT value FROM Settings WHERE key = 'is_ad_free';")
        row = self.cursor.fetchone()
        self.assertIsNotNone(row)
        self.assertEqual(row["value"], "true")

        # Test updating to false
        self.cursor.execute(
            "INSERT INTO Settings (key, value, updated_at) VALUES ('is_ad_free', 'false', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at;",
            (now,)
        )
        self.conn.commit()

        self.cursor.execute("SELECT value FROM Settings WHERE key = 'is_ad_free';")
        row = self.cursor.fetchone()
        self.assertEqual(row["value"], "false")


if __name__ == "__main__":
    unittest.main()
