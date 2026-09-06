#!/usr/bin/env python3
"""
Automated Verification Suite for Vocab Keep (SQLite + FTS5 + FSRS + OMW CILI)
"""

import sqlite3
import os
import unittest
from datetime import datetime, timezone, timedelta

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "assets", "seed-vocab.sqlite")

class TestVocabKeepVault(unittest.TestCase):
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
        required = {"Domains", "Concepts", "Lexemes", "Lexemes_FTS", "Concept_Lexeme", "User_Cards"}
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
        self.assertGreater(len(cards), 0, "Initial garrison cards must exist")
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

if __name__ == "__main__":
    unittest.main()
