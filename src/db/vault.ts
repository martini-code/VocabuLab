import * as SQLite from 'expo-sqlite';
import { SCHEMA_SQL } from './schema';
import { Domain, CardWithDetails, Lexeme, VaultStats } from '../types';

let dbInstance: SQLite.SQLiteDatabase | null = null;
const DB_NAME = 'vocab-keep.sqlite';

/**
 * Returns the open SQLite database instance, creating it if needed.
 */
export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync(DB_NAME);
    await dbInstance.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
    `);
  }
  return dbInstance;
}

/**
 * Initializes the database schema and seeds initial data if tables are empty.
 */
export async function initVault(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync(SCHEMA_SQL);

  // Check if we need to seed initial kingdom data
  const check = await db.getFirstAsync<{ count: number }>('SELECT count(*) as count FROM Domains;');
  if (!check || check.count === 0) {
    console.log('[Vault] Seeding fortress archives and kingdom lore...');
    await seedFortressData(db);
  }
}

/**
 * Seeds initial domain taxonomy, CILI concepts, multilingual lexemes, and user cards.
 */
async function seedFortressData(db: SQLite.SQLiteDatabase): Promise<void> {
  // 1. Domains
  const domains = [
    { id: 'domain_castle', parent_id: null, name: 'The Castle Keep & Court' },
    { id: 'domain_academy', parent_id: null, name: 'The Grand Scriptorium & Lore' },
    { id: 'domain_wilderness', parent_id: null, name: 'The Enchanted Forest & Nature' },
    { id: 'domain_armory', parent_id: null, name: 'The Royal Armory & Strategy' },
    { id: 'domain_market', parent_id: null, name: 'The Merchant Guild & Trade' },
    { id: 'domain_forbidden', parent_id: null, name: 'The Forbidden Royal Archives (Pro)' },

    { id: 'sub_castle_daily', parent_id: 'domain_castle', name: 'Everyday Courtesies & Greeting' },
    { id: 'sub_castle_feasts', parent_id: 'domain_castle', name: 'Royal Banquets & Dining' },
    { id: 'sub_script_philosophy', parent_id: 'domain_academy', name: 'Ancient Philosophy & Epistemology' },
    { id: 'sub_script_science', parent_id: 'domain_academy', name: 'Natural Philosophy & Astronomy' },
    { id: 'sub_wild_creatures', parent_id: 'domain_wilderness', name: 'Beasts & Herbology' },
    { id: 'sub_wild_travel', parent_id: 'domain_wilderness', name: 'Wayfaring & Weather' },
    { id: 'sub_armory_combat', parent_id: 'domain_armory', name: 'Combat, Tactics & Valor' },
    { id: 'sub_market_goods', parent_id: 'domain_market', name: 'Coin, Goods & Barter' },
    { id: 'sub_forbid_diplomacy', parent_id: 'domain_forbidden', name: 'Statecraft & High Intrigue (C1-C2)' },
    { id: 'sub_forbid_arcana', parent_id: 'domain_forbidden', name: 'Abstract Metaphysics & Arcana (C2)' },
  ];

  for (const d of domains) {
    await db.runAsync('INSERT OR IGNORE INTO Domains (id, parent_id, name) VALUES (?, ?, ?);', [
      d.id,
      d.parent_id,
      d.name,
    ]);
  }

  // 2. Sample Multilingual Corpus (OMW CILI style)
  const corpus = [
    {
      cId: 'cili_001',
      domainId: 'sub_castle_daily',
      desc: 'A greeting of goodwill exchanged upon meeting',
      lexemes: [
        { lang: 'en', term: 'greeting', pos: 'noun', cefr: 'A1', rank: 10 },
        { lang: 'es', term: 'saludo', pos: 'noun', cefr: 'A1', rank: 12 },
        { lang: 'fr', term: 'salutation', pos: 'noun', cefr: 'A1', rank: 15 },
        { lang: 'de', term: 'Begrüßung', pos: 'noun', cefr: 'A1', rank: 14 },
      ],
    },
    {
      cId: 'cili_002',
      domainId: 'sub_castle_daily',
      desc: 'The time of day between morning and night when the sun shines',
      lexemes: [
        { lang: 'en', term: 'day', pos: 'noun', cefr: 'A1', rank: 1 },
        { lang: 'es', term: 'día', pos: 'noun', cefr: 'A1', rank: 2 },
        { lang: 'fr', term: 'jour', pos: 'noun', cefr: 'A1', rank: 3 },
        { lang: 'de', term: 'Tag', pos: 'noun', cefr: 'A1', rank: 2 },
      ],
    },
    {
      cId: 'cili_003',
      domainId: 'sub_castle_daily',
      desc: 'A person with whom one has a bond of mutual affection and loyalty',
      lexemes: [
        { lang: 'en', term: 'friend', pos: 'noun', cefr: 'A1', rank: 8 },
        { lang: 'es', term: 'amigo', pos: 'noun', cefr: 'A1', rank: 9 },
        { lang: 'fr', term: 'ami', pos: 'noun', cefr: 'A1', rank: 8 },
        { lang: 'de', term: 'Freund', pos: 'noun', cefr: 'A1', rank: 7 },
      ],
    },
    {
      cId: 'cili_004',
      domainId: 'sub_castle_feasts',
      desc: 'A sweet crystalline substance obtained from sugarcane or beet',
      lexemes: [
        { lang: 'en', term: 'sugar', pos: 'noun', cefr: 'A1', rank: 45 },
        { lang: 'es', term: 'azúcar', pos: 'noun', cefr: 'A1', rank: 40 },
        { lang: 'fr', term: 'sucre', pos: 'noun', cefr: 'A1', rank: 38 },
        { lang: 'de', term: 'Zucker', pos: 'noun', cefr: 'A1', rank: 42 },
      ],
    },
    {
      cId: 'cili_005',
      domainId: 'sub_castle_feasts',
      desc: 'A grand celebration meal accompanied by music and speeches',
      lexemes: [
        { lang: 'en', term: 'banquet', pos: 'noun', cefr: 'B1', rank: 180 },
        { lang: 'es', term: 'banquete', pos: 'noun', cefr: 'B1', rank: 175 },
        { lang: 'fr', term: 'banquet', pos: 'noun', cefr: 'B1', rank: 170 },
        { lang: 'de', term: 'Bankett', pos: 'noun', cefr: 'B1', rank: 190 },
      ],
    },
    {
      cId: 'cili_006',
      domainId: 'sub_castle_feasts',
      desc: 'Fermented beverage made from pressed grape juice',
      lexemes: [
        { lang: 'en', term: 'wine', pos: 'noun', cefr: 'A2', rank: 60 },
        { lang: 'es', term: 'vino', pos: 'noun', cefr: 'A2', rank: 55 },
        { lang: 'fr', term: 'vin', pos: 'noun', cefr: 'A2', rank: 50 },
        { lang: 'de', term: 'Wein', pos: 'noun', cefr: 'A2', rank: 58 },
      ],
    },
    {
      cId: 'cili_007',
      domainId: 'sub_armory_combat',
      desc: 'A bladed weapon consisting of a steel blade fitted with a hilt',
      lexemes: [
        { lang: 'en', term: 'sword', pos: 'noun', cefr: 'A2', rank: 110 },
        { lang: 'es', term: 'espada', pos: 'noun', cefr: 'A2', rank: 105 },
        { lang: 'fr', term: 'épée', pos: 'noun', cefr: 'A2', rank: 108 },
        { lang: 'de', term: 'Schwert', pos: 'noun', cefr: 'A2', rank: 112 },
      ],
    },
    {
      cId: 'cili_008',
      domainId: 'sub_armory_combat',
      desc: 'A piece of personal defensive armor carried on the arm',
      lexemes: [
        { lang: 'en', term: 'shield', pos: 'noun', cefr: 'A2', rank: 120 },
        { lang: 'es', term: 'escudo', pos: 'noun', cefr: 'A2', rank: 118 },
        { lang: 'fr', term: 'bouclier', pos: 'noun', cefr: 'A2', rank: 122 },
        { lang: 'de', term: 'Schild', pos: 'noun', cefr: 'A2', rank: 124 },
      ],
    },
    {
      cId: 'cili_009',
      domainId: 'sub_armory_combat',
      desc: 'Great courage in the face of imminent danger and battle',
      lexemes: [
        { lang: 'en', term: 'valor', pos: 'noun', cefr: 'B2', rank: 280 },
        { lang: 'es', term: 'valentía', pos: 'noun', cefr: 'B2', rank: 270 },
        { lang: 'fr', term: 'vaillance', pos: 'noun', cefr: 'B2', rank: 275 },
        { lang: 'de', term: 'Tapferkeit', pos: 'noun', cefr: 'B2', rank: 285 },
      ],
    },
    {
      cId: 'cili_010',
      domainId: 'sub_script_philosophy',
      desc: 'The quality of being true, genuine, or actual',
      lexemes: [
        { lang: 'en', term: 'truth', pos: 'noun', cefr: 'B1', rank: 85 },
        { lang: 'es', term: 'verdad', pos: 'noun', cefr: 'B1', rank: 80 },
        { lang: 'fr', term: 'vérité', pos: 'noun', cefr: 'B1', rank: 82 },
        { lang: 'de', term: 'Wahrheit', pos: 'noun', cefr: 'B1', rank: 84 },
      ],
    },
    {
      cId: 'cili_011',
      domainId: 'sub_forbid_diplomacy',
      desc: 'Secret art of political maneuvering and cunning negotiation',
      lexemes: [
        { lang: 'en', term: 'statecraft', pos: 'noun', cefr: 'C1', rank: 490 },
        { lang: 'es', term: 'arte de gobierno', pos: 'noun', cefr: 'C1', rank: 485 },
        { lang: 'fr', term: 'art de gouverner', pos: 'noun', cefr: 'C1', rank: 488 },
        { lang: 'de', term: 'Staatskunst', pos: 'noun', cefr: 'C1', rank: 495 },
      ],
    },
    {
      cId: 'cili_012',
      domainId: 'sub_forbid_arcana',
      desc: 'An intricate or deceptive labyrinth of interconnected ideas',
      lexemes: [
        { lang: 'en', term: 'labyrinthine', pos: 'adj', cefr: 'C2', rank: 720 },
        { lang: 'es', term: 'laberíntico', pos: 'adj', cefr: 'C2', rank: 710 },
        { lang: 'fr', term: 'labyrinthique', pos: 'adj', cefr: 'C2', rank: 715 },
        { lang: 'de', term: 'verschlungen', pos: 'adj', cefr: 'C2', rank: 725 },
      ],
    },
  ];

  const now = new Date().toISOString();

  for (const item of corpus) {
    await db.runAsync('INSERT OR IGNORE INTO Concepts (id, domain_id, description) VALUES (?, ?, ?);', [
      item.cId,
      item.domainId,
      item.desc,
    ]);

    let esId: number | null = null;
    let enId: number | null = null;

    for (const lex of item.lexemes) {
      const res = await db.runAsync(
        'INSERT INTO Lexemes (language, term, pos, cefr_level, frequency_rank) VALUES (?, ?, ?, ?, ?);',
        [lex.lang, lex.term, lex.pos, lex.cefr, lex.rank]
      );
      const lexId = res.lastInsertRowId;

      await db.runAsync('INSERT INTO Concept_Lexeme (concept_id, lexeme_id) VALUES (?, ?);', [
        item.cId,
        lexId,
      ]);

      if (lex.lang === 'es') esId = lexId;
      if (lex.lang === 'en') enId = lexId;
    }

    // Initialize user cards for study
    if (esId && enId) {
      await db.runAsync(
        `INSERT OR IGNORE INTO User_Cards (
          id, front_lexeme_id, back_lexeme_id, due_date, state,
          stability, difficulty, elapsed_days, scheduled_days, reps, lapses, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [`card_${item.cId}`, esId, enId, now, 0, 0.0, 0.0, 0, 0, 0, 0, now]
      );
    }
  }
}

/**
 * Retrieves cards due for review or new cards in the queue, joined with full lexeme details.
 */
export async function getDueCards(): Promise<CardWithDetails[]> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  const query = `
    SELECT 
      c.id, c.front_lexeme_id, c.back_lexeme_id, c.due_date, c.state,
      c.stability, c.difficulty, c.elapsed_days, c.scheduled_days, c.reps, c.lapses, c.updated_at,
      f.term as front_term, f.language as front_lang, f.pos as front_pos, f.cefr_level as front_cefr,
      b.term as back_term, b.language as back_lang, b.pos as back_pos, b.cefr_level as back_cefr,
      con.description as concept_desc
    FROM User_Cards c
    JOIN Lexemes f ON c.front_lexeme_id = f.id
    JOIN Lexemes b ON c.back_lexeme_id = b.id
    JOIN Concept_Lexeme cl ON cl.lexeme_id = f.id
    JOIN Concepts con ON con.id = cl.concept_id
    WHERE c.due_date <= ? OR c.state = 0
    ORDER BY c.due_date ASC
    LIMIT 50;
  `;

  return await db.getAllAsync<CardWithDetails>(query, [now]);
}

/**
 * Updates a card's FSRS spaced repetition state after user grading.
 */
export async function updateCardFSRS(
  cardId: string,
  data: {
    due_date: string;
    state: number;
    stability: number;
    difficulty: number;
    elapsed_days: number;
    scheduled_days: number;
    reps: number;
    lapses: number;
  }
): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE User_Cards SET
      due_date = ?,
      state = ?,
      stability = ?,
      difficulty = ?,
      elapsed_days = ?,
      scheduled_days = ?,
      reps = ?,
      lapses = ?,
      updated_at = ?
    WHERE id = ?;`,
    [
      data.due_date,
      data.state,
      data.stability,
      data.difficulty,
      data.elapsed_days,
      data.scheduled_days,
      data.reps,
      data.lapses,
      now,
      cardId,
    ]
  );
}

/**
 * Ultra-fast FTS5 full-text search across all lexemes.
 */
export async function searchLexemesFTS(searchTerm: string): Promise<(Lexeme & { concept_desc: string; concept_id: string })[]> {
  const db = await getDatabase();
  const cleanTerm = searchTerm.trim().replace(/['"*;]/g, '');
  if (!cleanTerm) return [];

  const ftsQuery = `
    SELECT 
      l.id, l.language, l.term, l.pos, l.cefr_level, l.frequency_rank,
      con.description as concept_desc, con.id as concept_id
    FROM Lexemes_FTS fts
    JOIN Lexemes l ON fts.rowid = l.id
    JOIN Concept_Lexeme cl ON cl.lexeme_id = l.id
    JOIN Concepts con ON con.id = cl.concept_id
    WHERE Lexemes_FTS MATCH ?
    LIMIT 30;
  `;

  return await db.getAllAsync<Lexeme & { concept_desc: string; concept_id: string }>(ftsQuery, [`${cleanTerm}*`]);
}

/**
 * Returns kingdom domains and subdomains hierarchy with card counts.
 */
export async function getDomainsHierarchy(): Promise<Domain[]> {
  const db = await getDatabase();
  const allDomains = await db.getAllAsync<{ id: string; parent_id: string | null; name: string }>(
    'SELECT id, parent_id, name FROM Domains ORDER BY name ASC;'
  );

  const topLevel: Domain[] = [];
  const domainMap = new Map<string, Domain>();

  for (const d of allDomains) {
    const isPro = d.id.includes('forbidden');
    const domainObj: Domain = { ...d, subdomains: [], isPro };
    domainMap.set(d.id, domainObj);
    if (!d.parent_id) {
      topLevel.push(domainObj);
    }
  }

  for (const d of allDomains) {
    if (d.parent_id && domainMap.has(d.parent_id)) {
      domainMap.get(d.parent_id)!.subdomains!.push(domainMap.get(d.id)!);
    }
  }

  return topLevel;
}

/**
 * Returns lexemes belonging to a domain or subdomain, with optional CEFR filter.
 */
export async function getLexemesByDomain(domainId: string, cefrFilter?: string): Promise<Lexeme[]> {
  const db = await getDatabase();
  let query = `
    SELECT DISTINCT l.id, l.language, l.term, l.pos, l.cefr_level, l.frequency_rank
    FROM Lexemes l
    JOIN Concept_Lexeme cl ON cl.lexeme_id = l.id
    JOIN Concepts c ON c.id = cl.concept_id
    WHERE (c.domain_id = ? OR c.domain_id IN (SELECT id FROM Domains WHERE parent_id = ?))
  `;
  const params: any[] = [domainId, domainId];

  if (cefrFilter && cefrFilter !== 'ALL') {
    query += ' AND l.cefr_level = ?';
    params.push(cefrFilter);
  }

  query += ' ORDER BY l.frequency_rank ASC LIMIT 60;';
  return await db.getAllAsync<Lexeme>(query, params);
}

/**
 * Garrisons a lexeme into User_Cards for active FSRS training.
 */
export async function garrisonCard(frontLexemeId: number, backLexemeId: number): Promise<string> {
  const db = await getDatabase();
  const cardId = `card_custom_${Date.now()}`;
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO User_Cards (
      id, front_lexeme_id, back_lexeme_id, due_date, state,
      stability, difficulty, elapsed_days, scheduled_days, reps, lapses, updated_at
    ) VALUES (?, ?, ?, ?, 0, 0.0, 0.0, 0, 0, 0, 0, ?);`,
    [cardId, frontLexemeId, backLexemeId, now, now]
  );

  return cardId;
}

/**
 * Fetches high-level Fortress & SRS stats for the kingdom dashboard.
 */
export async function getVaultStats(): Promise<VaultStats> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  const total = await db.getFirstAsync<{ count: number }>('SELECT count(*) as count FROM User_Cards;');
  const due = await db.getFirstAsync<{ count: number }>(
    'SELECT count(*) as count FROM User_Cards WHERE due_date <= ? OR state = 0;',
    [now]
  );
  const newC = await db.getFirstAsync<{ count: number }>('SELECT count(*) as count FROM User_Cards WHERE state = 0;');
  const mastered = await db.getFirstAsync<{ count: number }>(
    'SELECT count(*) as count FROM User_Cards WHERE stability >= 10.0;'
  );

  const totalCards = total?.count || 0;
  const dueCards = due?.count || 0;
  const newCards = newC?.count || 0;
  const masteredCards = mastered?.count || 0;

  return {
    totalCards,
    dueCards,
    newCards,
    masteredCards,
    streakDays: 4, // 4-day kingdom defense streak
    xpPoints: masteredCards * 50 + (totalCards - dueCards) * 15 + 120,
  };
}
