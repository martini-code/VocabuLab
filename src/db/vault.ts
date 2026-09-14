import * as SQLite from 'expo-sqlite';
import { SCHEMA_SQL } from './schema';
import {
  Domain,
  CardWithDetails,
  Lexeme,
  VaultStats,
  ProgressOverview,
  ActivityWeek,
  ActivityDay,
  DeckWithProgress,
  ThemeGroup,
  DeckCardDetail,
  DifficultyWordItem,
  DifficultyStat,
  MasteryWordItem,
  MasterySummary,
  MasteryStage,
  CEFRLevel,
} from '../types';

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

  // Column migration check for Domains
  try {
    const tableInfo = await db.getAllAsync<{ name: string }>('PRAGMA table_info(Domains);');
    const colNames = new Set(tableInfo.map((c) => c.name));
    if (!colNames.has('description')) {
      await db.execAsync('ALTER TABLE Domains ADD COLUMN description TEXT;');
    }
    if (!colNames.has('difficulty_level')) {
      await db.execAsync('ALTER TABLE Domains ADD COLUMN difficulty_level INTEGER DEFAULT 1;');
    }
    if (!colNames.has('icon_name')) {
      await db.execAsync('ALTER TABLE Domains ADD COLUMN icon_name TEXT;');
    }
  } catch (err) {
    console.warn('[Vault] Column migration notice:', err);
  }

  // Check if we need to seed initial kingdom data
  const check = await db.getFirstAsync<{ count: number }>('SELECT count(*) as count FROM Domains;');
  if (!check || check.count === 0) {
    console.log('[Vault] Seeding fortress archives and kingdom lore...');
    await seedFortressData(db);
  } else {
    const conceptCheck = await db.getFirstAsync<{ count: number }>('SELECT count(*) as count FROM Concepts;');
    if (!conceptCheck || conceptCheck.count < 20) {
      console.log('[Vault] Synchronizing enriched vocabulary concepts across all tiers...');
      await seedFortressData(db);
    }
  }

  // Check if Review_Logs has initial activity logs
  const logCheck = await db.getFirstAsync<{ count: number }>('SELECT count(*) as count FROM Review_Logs;');
  if (!logCheck || logCheck.count === 0) {
    console.log('[Vault] Inscribing past campaign logs into the Battle Chronicles...');
    await seedSampleReviewLogs(db);
  }
}

/**
 * Seeds initial domain taxonomy, CILI concepts, multilingual lexemes, and user cards.
 */
async function seedFortressData(db: SQLite.SQLiteDatabase): Promise<void> {
  // 1. Domains & Progressive Decks
  const domains = [
    // Top-level Themes
    { id: 'domain_castle', parent_id: null, name: 'The Castle Keep & Court', description: 'Palace etiquette, pantry provisions, and festival banquets', difficulty_level: 1, icon_name: 'castle' },
    { id: 'domain_wilderness', parent_id: null, name: 'The Enchanted Forest & Nature', description: 'Wayfaring trails, tempest storms, and wild beasts', difficulty_level: 2, icon_name: 'tree' },
    { id: 'domain_market', parent_id: null, name: 'The Merchant Guild & Trade', description: 'Royal currency, marketplace barter, and commerce contracts', difficulty_level: 2, icon_name: 'coins' },
    { id: 'domain_armory', parent_id: null, name: 'The Royal Armory & Strategy', description: 'Bladed armaments, shield defenses, and battlefield valor', difficulty_level: 3, icon_name: 'swords' },
    { id: 'domain_academy', parent_id: null, name: 'The Grand Scriptorium & Lore', description: 'Celestial stars, epistemology, hypotheses, and logic axioms', difficulty_level: 3, icon_name: 'book' },
    { id: 'domain_forbidden', parent_id: null, name: 'The Forbidden Royal Archives (Pro)', description: 'High court statecraft, incorporeal metaphysics, and ancient mazes', difficulty_level: 5, icon_name: 'crown' },

    // Theme 1: Castle Keep & Court
    { id: 'sub_castle_daily', parent_id: 'domain_castle', name: 'Everyday Courtesies & Greetings', description: 'Essential greetings and bonds of friendship', difficulty_level: 1, icon_name: 'handshake' },
    { id: 'sub_castle_dining', parent_id: 'domain_castle', name: 'Pantry & Dining Provisions', description: 'Daily meals, sweet sugar crystals, and provisions', difficulty_level: 2, icon_name: 'utensils' },
    { id: 'sub_castle_feasts', parent_id: 'domain_castle', name: 'Royal Banquets & Celebrations', description: 'Grand feast dining and vintage wine toasts', difficulty_level: 3, icon_name: 'goblet' },

    // Theme 2: Enchanted Forest & Nature
    { id: 'sub_wild_creatures', parent_id: 'domain_wilderness', name: 'Beasts & Royal Menagerie', description: 'Carnivorous lions and fierce creatures of the woods', difficulty_level: 2, icon_name: 'paw' },
    { id: 'sub_wild_weather', parent_id: 'domain_wilderness', name: 'Wayfaring & Tempest Storms', description: 'Surviving violent gale squalls and tempest rains', difficulty_level: 3, icon_name: 'cloud-lightning' },
    { id: 'sub_wild_travel', parent_id: 'domain_wilderness', name: 'Untamed Wilderness & Badlands', description: 'Misty rugged terrain and mysterious badlands', difficulty_level: 4, icon_name: 'compass' },

    // Theme 3: Merchant Guild & Trade
    { id: 'sub_market_goods', parent_id: 'domain_market', name: 'Coinage & Royal Mint', description: 'Stamped currency coins and standard traded wares', difficulty_level: 2, icon_name: 'coins' },
    { id: 'sub_market_trade', parent_id: 'domain_market', name: 'Guild Bargains & Trade Pacts', description: 'Merchant exchange agreements and trade transactions', difficulty_level: 3, icon_name: 'scale' },

    // Theme 4: Royal Armory & Strategy
    { id: 'sub_armory_weapons', parent_id: 'domain_armory', name: 'Steel Blades & Armaments', description: 'Forged swords and bladed melee weaponry', difficulty_level: 2, icon_name: 'sword' },
    { id: 'sub_armory_defenses', parent_id: 'domain_armory', name: 'Shields & Defensive Plate', description: 'Personal defense shields and protective heraldic armor', difficulty_level: 2, icon_name: 'shield' },
    { id: 'sub_armory_combat', parent_id: 'domain_armory', name: 'Martial Valor & Battlefield Courage', description: 'Chivalric courage, tactics, and battlefield valor', difficulty_level: 4, icon_name: 'award' },

    // Theme 5: Grand Scriptorium & Lore
    { id: 'sub_script_astronomy', parent_id: 'domain_academy', name: 'Celestial Stars & Heavens', description: 'Luminous stellar bodies and the celestial sphere', difficulty_level: 1, icon_name: 'sparkles' },
    { id: 'sub_script_philosophy', parent_id: 'domain_academy', name: 'Truth & Foundational Epistemology', description: 'The pursuit of genuine reality, veracity, and wisdom', difficulty_level: 3, icon_name: 'scroll' },
    { id: 'sub_script_science', parent_id: 'domain_academy', name: 'Natural Hypotheses & Deduction', description: 'Formulating provisional suppositions and theories', difficulty_level: 4, icon_name: 'microscope' },
    { id: 'sub_script_logic', parent_id: 'domain_academy', name: 'First Principles & Axioms', description: 'Propositions accepted as self-evidently true', difficulty_level: 5, icon_name: 'brain' },

    // Theme 6: Forbidden Royal Archives
    { id: 'sub_forbid_diplomacy', parent_id: 'domain_forbidden', name: 'Statecraft & High Intrigue', description: 'Secret political maneuvers and oratorical eloquence', difficulty_level: 5, icon_name: 'landmark' },
    { id: 'sub_forbid_arcana', parent_id: 'domain_forbidden', name: 'Incorporeal Metaphysics & Arcana', description: 'Non-physical ideas, spirits, and abstract doctrines', difficulty_level: 6, icon_name: 'flame' },
    { id: 'sub_forbid_labyrinth', parent_id: 'domain_forbidden', name: 'Labyrinthine Riddles of Antiquity', description: 'Intricate, deceptive conceptual mazes of the ancients', difficulty_level: 6, icon_name: 'network' },
  ];

  for (const d of domains) {
    await db.runAsync(
      'INSERT OR REPLACE INTO Domains (id, parent_id, name, description, difficulty_level, icon_name) VALUES (?, ?, ?, ?, ?, ?);',
      [d.id, d.parent_id, d.name, d.description, d.difficulty_level, d.icon_name]
    );
  }

  // 2. Comprehensive Multilingual Corpus (OMW CILI style across all tiers and decks)
  const corpus = [
    // sub_castle_daily (A1)
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
      cId: 'cili_013',
      domainId: 'sub_castle_daily',
      desc: 'Expression of politeness used when asking for something',
      lexemes: [
        { lang: 'en', term: 'please', pos: 'adv', cefr: 'A1', rank: 5 },
        { lang: 'es', term: 'por favor', pos: 'adv', cefr: 'A1', rank: 6 },
        { lang: 'fr', term: 's’il vous plaît', pos: 'adv', cefr: 'A1', rank: 5 },
        { lang: 'de', term: 'bitte', pos: 'adv', cefr: 'A1', rank: 4 },
      ],
    },

    // sub_castle_dining (A1 / A2)
    {
      cId: 'cili_014',
      domainId: 'sub_castle_dining',
      desc: 'Clear liquid essential for plant and animal life',
      lexemes: [
        { lang: 'en', term: 'water', pos: 'noun', cefr: 'A1', rank: 4 },
        { lang: 'es', term: 'agua', pos: 'noun', cefr: 'A1', rank: 5 },
        { lang: 'fr', term: 'eau', pos: 'noun', cefr: 'A1', rank: 4 },
        { lang: 'de', term: 'Wasser', pos: 'noun', cefr: 'A1', rank: 5 },
      ],
    },
    {
      cId: 'cili_015',
      domainId: 'sub_castle_dining',
      desc: 'Food made of flour, water, and yeast baked in an oven',
      lexemes: [
        { lang: 'en', term: 'bread', pos: 'noun', cefr: 'A1', rank: 16 },
        { lang: 'es', term: 'pan', pos: 'noun', cefr: 'A1', rank: 15 },
        { lang: 'fr', term: 'pain', pos: 'noun', cefr: 'A1', rank: 14 },
        { lang: 'de', term: 'Brot', pos: 'noun', cefr: 'A1', rank: 15 },
      ],
    },
    {
      cId: 'cili_016',
      domainId: 'sub_castle_dining',
      desc: 'Edible seeds and produce of plants eaten as food',
      lexemes: [
        { lang: 'en', term: 'vegetable', pos: 'noun', cefr: 'A2', rank: 52 },
        { lang: 'es', term: 'verdura', pos: 'noun', cefr: 'A2', rank: 48 },
        { lang: 'fr', term: 'légume', pos: 'noun', cefr: 'A2', rank: 50 },
        { lang: 'de', term: 'Gemüse', pos: 'noun', cefr: 'A2', rank: 52 },
      ],
    },

    // sub_castle_feasts (A1 / A2 / B1)
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

    // Theme 2: Enchanted Forest & Nature
    {
      cId: 'cili_017',
      domainId: 'sub_wild_creatures',
      desc: 'A large tawny-colored cat that lives in prides',
      lexemes: [
        { lang: 'en', term: 'lion', pos: 'noun', cefr: 'A2', rank: 75 },
        { lang: 'es', term: 'león', pos: 'noun', cefr: 'A2', rank: 72 },
        { lang: 'fr', term: 'lion', pos: 'noun', cefr: 'A2', rank: 70 },
        { lang: 'de', term: 'Löwe', pos: 'noun', cefr: 'A2', rank: 74 },
      ],
    },
    {
      cId: 'cili_018',
      domainId: 'sub_wild_creatures',
      desc: 'A wild carnivorous mammal of the dog family living in packs',
      lexemes: [
        { lang: 'en', term: 'wolf', pos: 'noun', cefr: 'B1', rank: 140 },
        { lang: 'es', term: 'lobo', pos: 'noun', cefr: 'B1', rank: 135 },
        { lang: 'fr', term: 'loup', pos: 'noun', cefr: 'B1', rank: 132 },
        { lang: 'de', term: 'Wolf', pos: 'noun', cefr: 'B1', rank: 138 },
      ],
    },
    {
      cId: 'cili_019',
      domainId: 'sub_wild_weather',
      desc: 'Moisture condensed from the atmosphere that falls in drops',
      lexemes: [
        { lang: 'en', term: 'rain', pos: 'noun', cefr: 'A1', rank: 25 },
        { lang: 'es', term: 'lluvia', pos: 'noun', cefr: 'A1', rank: 24 },
        { lang: 'fr', term: 'pluie', pos: 'noun', cefr: 'A1', rank: 22 },
        { lang: 'de', term: 'Regen', pos: 'noun', cefr: 'A1', rank: 26 },
      ],
    },
    {
      cId: 'cili_020',
      domainId: 'sub_wild_weather',
      desc: 'A violent disturbance of the atmosphere with strong winds',
      lexemes: [
        { lang: 'en', term: 'storm', pos: 'noun', cefr: 'B1', rank: 155 },
        { lang: 'es', term: 'tormenta', pos: 'noun', cefr: 'B1', rank: 150 },
        { lang: 'fr', term: 'tempête', pos: 'noun', cefr: 'B1', rank: 148 },
        { lang: 'de', term: 'Sturm', pos: 'noun', cefr: 'B1', rank: 152 },
      ],
    },
    {
      cId: 'cili_021',
      domainId: 'sub_wild_weather',
      desc: 'A violent windy storm accompanied by thunder and lightning',
      lexemes: [
        { lang: 'en', term: 'tempest', pos: 'noun', cefr: 'B2', rank: 310 },
        { lang: 'es', term: 'tempestad', pos: 'noun', cefr: 'B2', rank: 305 },
        { lang: 'fr', term: 'ouragan', pos: 'noun', cefr: 'B2', rank: 300 },
        { lang: 'de', term: 'Unwetter', pos: 'noun', cefr: 'B2', rank: 315 },
      ],
    },
    {
      cId: 'cili_022',
      domainId: 'sub_wild_travel',
      desc: 'A track laid down for walking or made by continual treading',
      lexemes: [
        { lang: 'en', term: 'path', pos: 'noun', cefr: 'A2', rank: 90 },
        { lang: 'es', term: 'sendero', pos: 'noun', cefr: 'A2', rank: 88 },
        { lang: 'fr', term: 'sentier', pos: 'noun', cefr: 'A2', rank: 85 },
        { lang: 'de', term: 'Pfad', pos: 'noun', cefr: 'A2', rank: 92 },
      ],
    },
    {
      cId: 'cili_023',
      domainId: 'sub_wild_travel',
      desc: 'An uncultivated, uninhabited, and inhospitable region',
      lexemes: [
        { lang: 'en', term: 'wilderness', pos: 'noun', cefr: 'B2', rank: 330 },
        { lang: 'es', term: 'páramo', pos: 'noun', cefr: 'B2', rank: 325 },
        { lang: 'fr', term: 'désert', pos: 'noun', cefr: 'B2', rank: 320 },
        { lang: 'de', term: 'Wildnis', pos: 'noun', cefr: 'B2', rank: 335 },
      ],
    },

    // Theme 3: Merchant Guild & Trade
    {
      cId: 'cili_024',
      domainId: 'sub_market_goods',
      desc: 'A flat, typically round piece of metal with an official stamp',
      lexemes: [
        { lang: 'en', term: 'coin', pos: 'noun', cefr: 'A2', rank: 95 },
        { lang: 'es', term: 'moneda', pos: 'noun', cefr: 'A2', rank: 92 },
        { lang: 'fr', term: 'pièce', pos: 'noun', cefr: 'A2', rank: 90 },
        { lang: 'de', term: 'Münze', pos: 'noun', cefr: 'A2', rank: 96 },
      ],
    },
    {
      cId: 'cili_025',
      domainId: 'sub_market_goods',
      desc: 'A yellow precious metal valued especially for coin and trade',
      lexemes: [
        { lang: 'en', term: 'gold', pos: 'noun', cefr: 'A2', rank: 65 },
        { lang: 'es', term: 'oro', pos: 'noun', cefr: 'A2', rank: 62 },
        { lang: 'fr', term: 'or', pos: 'noun', cefr: 'A2', rank: 60 },
        { lang: 'de', term: 'Gold', pos: 'noun', cefr: 'A2', rank: 66 },
      ],
    },
    {
      cId: 'cili_026',
      domainId: 'sub_market_trade',
      desc: 'A person who buys and sells commodities for profit',
      lexemes: [
        { lang: 'en', term: 'merchant', pos: 'noun', cefr: 'B1', rank: 195 },
        { lang: 'es', term: 'comerciante', pos: 'noun', cefr: 'B1', rank: 190 },
        { lang: 'fr', term: 'marchand', pos: 'noun', cefr: 'B1', rank: 185 },
        { lang: 'de', term: 'Kaufmann', pos: 'noun', cefr: 'B1', rank: 198 },
      ],
    },
    {
      cId: 'cili_027',
      domainId: 'sub_market_trade',
      desc: 'A written or spoken agreement enforceable by law',
      lexemes: [
        { lang: 'en', term: 'contract', pos: 'noun', cefr: 'B2', rank: 260 },
        { lang: 'es', term: 'contrato', pos: 'noun', cefr: 'B2', rank: 255 },
        { lang: 'fr', term: 'contrat', pos: 'noun', cefr: 'B2', rank: 250 },
        { lang: 'de', term: 'Vertrag', pos: 'noun', cefr: 'B2', rank: 265 },
      ],
    },

    // Theme 4: Royal Armory & Strategy
    {
      cId: 'cili_007',
      domainId: 'sub_armory_weapons',
      desc: 'A bladed weapon consisting of a steel blade fitted with a hilt',
      lexemes: [
        { lang: 'en', term: 'sword', pos: 'noun', cefr: 'A2', rank: 110 },
        { lang: 'es', term: 'espada', pos: 'noun', cefr: 'A2', rank: 105 },
        { lang: 'fr', term: 'épée', pos: 'noun', cefr: 'A2', rank: 108 },
        { lang: 'de', term: 'Schwert', pos: 'noun', cefr: 'A2', rank: 112 },
      ],
    },
    {
      cId: 'cili_028',
      domainId: 'sub_armory_weapons',
      desc: 'A weapon consisting of a curved piece of wood used to shoot arrows',
      lexemes: [
        { lang: 'en', term: 'bow', pos: 'noun', cefr: 'A2', rank: 115 },
        { lang: 'es', term: 'arco', pos: 'noun', cefr: 'A2', rank: 112 },
        { lang: 'fr', term: 'arc', pos: 'noun', cefr: 'A2', rank: 110 },
        { lang: 'de', term: 'Bogen', pos: 'noun', cefr: 'A2', rank: 118 },
      ],
    },
    {
      cId: 'cili_008',
      domainId: 'sub_armory_defenses',
      desc: 'A piece of personal defensive armor carried on the arm',
      lexemes: [
        { lang: 'en', term: 'shield', pos: 'noun', cefr: 'A2', rank: 120 },
        { lang: 'es', term: 'escudo', pos: 'noun', cefr: 'A2', rank: 118 },
        { lang: 'fr', term: 'bouclier', pos: 'noun', cefr: 'A2', rank: 122 },
        { lang: 'de', term: 'Schild', pos: 'noun', cefr: 'A2', rank: 124 },
      ],
    },
    {
      cId: 'cili_029',
      domainId: 'sub_armory_defenses',
      desc: 'Protective metal covering worn by warriors in battle',
      lexemes: [
        { lang: 'en', term: 'armor', pos: 'noun', cefr: 'B1', rank: 210 },
        { lang: 'es', term: 'armadura', pos: 'noun', cefr: 'B1', rank: 205 },
        { lang: 'fr', term: 'armure', pos: 'noun', cefr: 'B1', rank: 200 },
        { lang: 'de', term: 'Rüstung', pos: 'noun', cefr: 'B1', rank: 215 },
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
      cId: 'cili_030',
      domainId: 'sub_armory_combat',
      desc: 'An act of defeating an enemy or opponent in a contest',
      lexemes: [
        { lang: 'en', term: 'victory', pos: 'noun', cefr: 'B1', rank: 165 },
        { lang: 'es', term: 'victoria', pos: 'noun', cefr: 'B1', rank: 160 },
        { lang: 'fr', term: 'victoire', pos: 'noun', cefr: 'B1', rank: 158 },
        { lang: 'de', term: 'Sieg', pos: 'noun', cefr: 'B1', rank: 168 },
      ],
    },

    // Theme 5: Grand Scriptorium & Lore
    {
      cId: 'cili_031',
      domainId: 'sub_script_astronomy',
      desc: 'A fixed luminous point in the night sky',
      lexemes: [
        { lang: 'en', term: 'star', pos: 'noun', cefr: 'A1', rank: 30 },
        { lang: 'es', term: 'estrella', pos: 'noun', cefr: 'A1', rank: 28 },
        { lang: 'fr', term: 'étoile', pos: 'noun', cefr: 'A1', rank: 25 },
        { lang: 'de', term: 'Stern', pos: 'noun', cefr: 'A1', rank: 32 },
      ],
    },
    {
      cId: 'cili_032',
      domainId: 'sub_script_astronomy',
      desc: 'An obscuring of the light from one celestial body by another',
      lexemes: [
        { lang: 'en', term: 'eclipse', pos: 'noun', cefr: 'B2', rank: 350 },
        { lang: 'es', term: 'eclipse', pos: 'noun', cefr: 'B2', rank: 345 },
        { lang: 'fr', term: 'éclipse', pos: 'noun', cefr: 'B2', rank: 340 },
        { lang: 'de', term: 'Finsternis', pos: 'noun', cefr: 'B2', rank: 355 },
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
      cId: 'cili_033',
      domainId: 'sub_script_philosophy',
      desc: 'Moral principles that govern a person’s behavior',
      lexemes: [
        { lang: 'en', term: 'ethics', pos: 'noun', cefr: 'C1', rank: 460 },
        { lang: 'es', term: 'ética', pos: 'noun', cefr: 'C1', rank: 455 },
        { lang: 'fr', term: 'éthique', pos: 'noun', cefr: 'C1', rank: 450 },
        { lang: 'de', term: 'Ethik', pos: 'noun', cefr: 'C1', rank: 465 },
      ],
    },
    {
      cId: 'cili_034',
      domainId: 'sub_script_science',
      desc: 'A proposed explanation made as a starting point for investigation',
      lexemes: [
        { lang: 'en', term: 'hypothesis', pos: 'noun', cefr: 'C1', rank: 470 },
        { lang: 'es', term: 'hipótesis', pos: 'noun', cefr: 'C1', rank: 465 },
        { lang: 'fr', term: 'hypothèse', pos: 'noun', cefr: 'C1', rank: 460 },
        { lang: 'de', term: 'Hypothese', pos: 'noun', cefr: 'C1', rank: 475 },
      ],
    },
    {
      cId: 'cili_035',
      domainId: 'sub_script_logic',
      desc: 'A statement or proposition on which an abstractly defined structure is based',
      lexemes: [
        { lang: 'en', term: 'axiom', pos: 'noun', cefr: 'C2', rank: 680 },
        { lang: 'es', term: 'axioma', pos: 'noun', cefr: 'C2', rank: 675 },
        { lang: 'fr', term: 'axiome', pos: 'noun', cefr: 'C2', rank: 670 },
        { lang: 'de', term: 'Axiom', pos: 'noun', cefr: 'C2', rank: 685 },
      ],
    },
    {
      cId: 'cili_036',
      domainId: 'sub_script_logic',
      desc: 'A seemingly self-contradictory proposition that may prove to be true',
      lexemes: [
        { lang: 'en', term: 'paradox', pos: 'noun', cefr: 'C1', rank: 480 },
        { lang: 'es', term: 'paradoja', pos: 'noun', cefr: 'C1', rank: 475 },
        { lang: 'fr', term: 'paradoxe', pos: 'noun', cefr: 'C1', rank: 470 },
        { lang: 'de', term: 'Paradoxon', pos: 'noun', cefr: 'C1', rank: 485 },
      ],
    },

    // Theme 6: Forbidden Royal Archives
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
    {
      cId: 'cili_037',
      domainId: 'sub_forbid_arcana',
      desc: 'Extremely delicate and light in a way that seems otherworldly',
      lexemes: [
        { lang: 'en', term: 'ethereal', pos: 'adj', cefr: 'C2', rank: 740 },
        { lang: 'es', term: 'etéreo', pos: 'adj', cefr: 'C2', rank: 735 },
        { lang: 'fr', term: 'éthéré', pos: 'adj', cefr: 'C2', rank: 730 },
        { lang: 'de', term: 'ätherisch', pos: 'adj', cefr: 'C2', rank: 745 },
      ],
    },
    {
      cId: 'cili_038',
      domainId: 'sub_forbid_labyrinth',
      desc: 'A person or thing that is mysterious, puzzling, or difficult to understand',
      lexemes: [
        { lang: 'en', term: 'enigma', pos: 'noun', cefr: 'C1', rank: 505 },
        { lang: 'es', term: 'enigma', pos: 'noun', cefr: 'C1', rank: 500 },
        { lang: 'fr', term: 'énigme', pos: 'noun', cefr: 'C1', rank: 495 },
        { lang: 'de', term: 'Rätsel', pos: 'noun', cefr: 'C1', rank: 510 },
      ],
    },
    {
      cId: 'cili_039',
      domainId: 'sub_forbid_labyrinth',
      desc: 'The most perfect or typical example of a quality or class',
      lexemes: [
        { lang: 'en', term: 'quintessence', pos: 'noun', cefr: 'C2', rank: 760 },
        { lang: 'es', term: 'quintaesencia', pos: 'noun', cefr: 'C2', rank: 750 },
        { lang: 'fr', term: 'quintessence', pos: 'noun', cefr: 'C2', rank: 745 },
        { lang: 'de', term: 'Quintessenz', pos: 'noun', cefr: 'C2', rank: 765 },
      ],
    },
  ];

  const now = new Date();
  const nowIso = now.toISOString();

  // Pre-seed realistic SRS stage profiles for initial training cards:
  // - Mastered (stability >= 10): cili_001, cili_002
  // - Learning (stability < 10, reps > 0): cili_003, cili_004
  // - Slipping (lapses > 0, due today/past): cili_005, cili_006
  // - New in Queue (state = 0, reps = 0): cili_007, cili_008
  // Remaining concepts are unqueued and available to adopt!
  const initialCardProfiles: Record<string, {
    state: number;
    stability: number;
    difficulty: number;
    elapsed_days: number;
    scheduled_days: number;
    reps: number;
    lapses: number;
    due_offset_hours: number;
  }> = {
    cili_001: { state: 2, stability: 16.5, difficulty: 2.2, elapsed_days: 10, scheduled_days: 18, reps: 5, lapses: 0, due_offset_hours: 18 * 24 },
    cili_002: { state: 2, stability: 12.0, difficulty: 2.5, elapsed_days: 8, scheduled_days: 14, reps: 4, lapses: 0, due_offset_hours: 14 * 24 },
    cili_003: { state: 2, stability: 4.5, difficulty: 3.5, elapsed_days: 2, scheduled_days: 5, reps: 2, lapses: 0, due_offset_hours: 4 * 24 },
    cili_004: { state: 1, stability: 2.8, difficulty: 3.8, elapsed_days: 1, scheduled_days: 3, reps: 2, lapses: 0, due_offset_hours: 3 * 24 },
    cili_005: { state: 3, stability: 1.1, difficulty: 6.2, elapsed_days: 2, scheduled_days: 1, reps: 4, lapses: 2, due_offset_hours: -4 },
    cili_006: { state: 2, stability: 1.4, difficulty: 5.5, elapsed_days: 3, scheduled_days: 1, reps: 3, lapses: 1, due_offset_hours: -2 },
    cili_007: { state: 0, stability: 0.0, difficulty: 0.0, elapsed_days: 0, scheduled_days: 0, reps: 0, lapses: 0, due_offset_hours: 0 },
    cili_008: { state: 0, stability: 0.0, difficulty: 0.0, elapsed_days: 0, scheduled_days: 0, reps: 0, lapses: 0, due_offset_hours: 0 },
  };

  for (const item of corpus) {
    await db.runAsync('INSERT OR IGNORE INTO Concepts (id, domain_id, description) VALUES (?, ?, ?);', [
      item.cId,
      item.domainId,
      item.desc,
    ]);

    let esId: number | null = null;
    let enId: number | null = null;

    for (const lex of item.lexemes) {
      // Check if lexeme exists
      const existing = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM Lexemes WHERE language = ? AND term = ? LIMIT 1;',
        [lex.lang, lex.term]
      );
      let lexId: number;
      if (existing) {
        lexId = existing.id;
      } else {
        const res = await db.runAsync(
          'INSERT INTO Lexemes (language, term, pos, cefr_level, frequency_rank) VALUES (?, ?, ?, ?, ?);',
          [lex.lang, lex.term, lex.pos, lex.cefr, lex.rank]
        );
        lexId = res.lastInsertRowId;
      }

      await db.runAsync('INSERT OR IGNORE INTO Concept_Lexeme (concept_id, lexeme_id) VALUES (?, ?);', [
        item.cId,
        lexId,
      ]);

      if (lex.lang === 'es') esId = lexId;
      if (lex.lang === 'en') enId = lexId;
    }

    // Initialize user cards for study queue if in initial profile
    const profile = initialCardProfiles[item.cId];
    if (profile && esId && enId) {
      const dueDate = new Date(now.getTime() + profile.due_offset_hours * 3600 * 1000).toISOString();
      await db.runAsync(
        `INSERT OR IGNORE INTO User_Cards (
          id, front_lexeme_id, back_lexeme_id, due_date, state,
          stability, difficulty, elapsed_days, scheduled_days, reps, lapses, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          `card_${item.cId}`,
          esId,
          enId,
          dueDate,
          profile.state,
          profile.stability,
          profile.difficulty,
          profile.elapsed_days,
          profile.scheduled_days,
          profile.reps,
          profile.lapses,
          nowIso,
        ]
      );
    }
  }
}

/**
 * Retrieves cards due for review or new cards in the queue, joined with full lexeme details.
 * Can be optionally filtered by a specific deck/subdomain ID.
 */
export async function getDueCards(filterDeckId?: string): Promise<CardWithDetails[]> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  let query = `
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
    WHERE (c.due_date <= ? OR c.state = 0)
  `;
  const params: any[] = [now];

  if (filterDeckId) {
    query += ' AND con.domain_id = ?';
    params.push(filterDeckId);
  }

  query += `
    ORDER BY c.due_date ASC
    LIMIT 50;
  `;

  return await db.getAllAsync<CardWithDetails>(query, params);
}

/**
 * Retrieves all garrisoned cards belonging to a deck for study practice,
 * prioritizing due cards first.
 */
export async function getDeckCardsForReview(deckId: string): Promise<CardWithDetails[]> {
  const db = await getDatabase();
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
    WHERE con.domain_id = ?
    ORDER BY c.due_date ASC
    LIMIT 50;
  `;
  return await db.getAllAsync<CardWithDetails>(query, [deckId]);
}

const LEVEL_CONFIG: Record<number, { label: string; cefr: string }> = {
  1: { label: 'Novice', cefr: 'A1' },
  2: { label: 'Apprentice', cefr: 'A2' },
  3: { label: 'Adept', cefr: 'B1' },
  4: { label: 'Expert', cefr: 'B2' },
  5: { label: 'Master', cefr: 'C1' },
  6: { label: 'Grandmaster', cefr: 'C2' },
};

/**
 * Retrieves themes and their decks ordered by progressive difficulty (easy to hard).
 */
export async function getThemesWithProgressiveDecks(): Promise<ThemeGroup[]> {
  const db = await getDatabase();

  // 1. Fetch top-level themes
  const themes = await db.getAllAsync<{
    id: string;
    name: string;
    description: string | null;
    difficulty_level: number;
    icon_name: string | null;
  }>(`
    SELECT id, name, description, difficulty_level, icon_name
    FROM Domains
    WHERE parent_id IS NULL
    ORDER BY difficulty_level ASC, id ASC;
  `);

  // 2. Fetch progressive decks with card & mastery counts
  const decks = await db.getAllAsync<{
    id: string;
    parent_id: string;
    name: string;
    description: string | null;
    difficulty_level: number;
    icon_name: string | null;
    card_count: number;
    garrisoned_count: number;
    mastered_count: number;
  }>(`
    SELECT 
      d.id,
      d.parent_id,
      d.name,
      d.description,
      d.difficulty_level,
      d.icon_name,
      COUNT(DISTINCT c.id) as card_count,
      COUNT(DISTINCT uc.id) as garrisoned_count,
      COUNT(DISTINCT CASE WHEN uc.stability >= 10.0 THEN uc.id END) as mastered_count
    FROM Domains d
    LEFT JOIN Concepts c ON c.domain_id = d.id
    LEFT JOIN Concept_Lexeme cl ON cl.concept_id = c.id
    LEFT JOIN User_Cards uc ON uc.front_lexeme_id = cl.lexeme_id
    WHERE d.parent_id IS NOT NULL
    GROUP BY d.id
    ORDER BY d.difficulty_level ASC, d.name ASC;
  `);

  const deckMap = new Map<string, DeckWithProgress[]>();
  for (const d of decks) {
    const diffLevel = d.difficulty_level || 1;
    const cfg = LEVEL_CONFIG[diffLevel] || { label: 'Novice', cefr: 'A1' };
    const isPro = d.id.includes('forbidden') || d.parent_id.includes('forbidden');

    const deckObj: DeckWithProgress = {
      id: d.id,
      theme_id: d.parent_id,
      name: d.name,
      description: d.description || '',
      difficulty_level: diffLevel,
      difficulty_label: cfg.label,
      cefr_level: cfg.cefr,
      icon_name: d.icon_name || 'book',
      card_count: d.card_count,
      garrisoned_count: d.garrisoned_count,
      mastered_count: d.mastered_count,
      is_pro: isPro,
    };

    if (!deckMap.has(d.parent_id)) {
      deckMap.set(d.parent_id, []);
    }
    deckMap.get(d.parent_id)!.push(deckObj);
  }

  const result: ThemeGroup[] = [];
  for (const t of themes) {
    const isPro = t.id.includes('forbidden');
    const themeDecks = deckMap.get(t.id) || [];
    // Sort decks ascending by difficulty level
    themeDecks.sort((a, b) => a.difficulty_level - b.difficulty_level);

    result.push({
      id: t.id,
      name: t.name,
      description: t.description || '',
      icon_name: t.icon_name || 'castle',
      is_pro: isPro,
      decks: themeDecks,
    });
  }

  return result;
}

/**
 * Retrieves the vocabulary items for a given deck.
 */
export async function getCardsByDeck(deckId: string, targetLang = 'es'): Promise<DeckCardDetail[]> {
  const db = await getDatabase();
  const query = `
    SELECT 
      con.id as concept_id,
      con.description as concept_desc,
      lf.id as front_lexeme_id,
      lf.term as front_term,
      lf.language as front_lang,
      lf.pos as front_pos,
      lf.cefr_level as front_cefr,
      lb.id as back_lexeme_id,
      lb.term as back_term,
      lb.language as back_lang,
      uc.id as user_card_id,
      uc.stability,
      uc.reps
    FROM Concepts con
    JOIN Concept_Lexeme clf ON clf.concept_id = con.id
    JOIN Lexemes lf ON lf.id = clf.lexeme_id AND lf.language = ?
    JOIN Concept_Lexeme clb ON clb.concept_id = con.id
    JOIN Lexemes lb ON lb.id = clb.lexeme_id AND lb.language = 'en'
    LEFT JOIN User_Cards uc ON uc.front_lexeme_id = lf.id
    WHERE con.domain_id = ?
    ORDER BY lf.frequency_rank ASC, lf.term ASC;
  `;
  const rows = await db.getAllAsync<any>(query, [targetLang, deckId]);
  return rows.map((r) => ({
    concept_id: r.concept_id,
    concept_desc: r.concept_desc,
    front_lexeme_id: r.front_lexeme_id,
    front_term: r.front_term,
    front_lang: r.front_lang,
    front_pos: r.front_pos,
    front_cefr: r.front_cefr,
    back_lexeme_id: r.back_lexeme_id,
    back_term: r.back_term,
    back_lang: r.back_lang,
    is_garrisoned: Boolean(r.user_card_id),
    user_card_id: r.user_card_id || undefined,
    stability: r.stability,
    reps: r.reps,
  }));
}

/**
 * Garrisons all ungarrisoned cards in a deck in one tap.
 */
export async function garrisonEntireDeck(deckId: string, targetLang = 'es'): Promise<number> {
  const db = await getDatabase();
  const pairs = await db.getAllAsync<{ front_id: number; back_id: number; concept_id: string }>(
    `SELECT lf.id as front_id, lb.id as back_id, con.id as concept_id
     FROM Concepts con
     JOIN Concept_Lexeme clf ON clf.concept_id = con.id
     JOIN Lexemes lf ON lf.id = clf.lexeme_id AND lf.language = ?
     JOIN Concept_Lexeme clb ON clb.concept_id = con.id
     JOIN Lexemes lb ON lb.id = clb.lexeme_id AND lb.language = 'en'
     LEFT JOIN User_Cards uc ON uc.front_lexeme_id = lf.id
     WHERE con.domain_id = ? AND uc.id IS NULL;`,
    [targetLang, deckId]
  );

  const now = new Date().toISOString();
  let count = 0;
  for (const p of pairs) {
    const cardId = `card_${p.concept_id}_${p.front_id}`;
    await db.runAsync(
      `INSERT OR IGNORE INTO User_Cards (
        id, front_lexeme_id, back_lexeme_id, due_date, state,
        stability, difficulty, elapsed_days, scheduled_days, reps, lapses, updated_at
      ) VALUES (?, ?, ?, ?, 0, 0.0, 0.0, 0, 0, 0, 0, ?);`,
      [cardId, p.front_id, p.back_id, now, now]
    );
    count++;
  }
  return count;
}

/**
 * Adds a single word (front & back lexeme pair) to the user's SRS review queue.
 */
export async function addWordToQueue(
  frontLexemeId: number,
  backLexemeId: number,
  conceptId?: string
): Promise<string> {
  const db = await getDatabase();
  const cardId = `card_${conceptId || 'word'}_${frontLexemeId}`;
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT OR IGNORE INTO User_Cards (
      id, front_lexeme_id, back_lexeme_id, due_date, state,
      stability, difficulty, elapsed_days, scheduled_days, reps, lapses, updated_at
    ) VALUES (?, ?, ?, ?, 0, 0.0, 0.0, 0, 0, 0, 0, ?);`,
    [cardId, frontLexemeId, backLexemeId, now, now]
  );
  return cardId;
}

/**
 * Adds a lexeme to the SRS queue by looking up its English pair.
 */
export async function addLexemeToQueue(frontLexemeId: number): Promise<string | null> {
  const db = await getDatabase();
  const pair = await db.getFirstAsync<{ front_id: number; back_id: number; concept_id: string }>(
    `SELECT lf.id as front_id, lb.id as back_id, con.id as concept_id
     FROM Concept_Lexeme clf
     JOIN Concepts con ON con.id = clf.concept_id
     JOIN Lexemes lf ON lf.id = clf.lexeme_id
     JOIN Concept_Lexeme clb ON clb.concept_id = con.id
     JOIN Lexemes lb ON lb.id = clb.lexeme_id AND lb.language = 'en'
     WHERE lf.id = ?
     LIMIT 1;`,
    [frontLexemeId]
  );

  if (!pair) return null;
  return await addWordToQueue(pair.front_id, pair.back_id, pair.concept_id);
}

/**
 * Removes a card from the user's SRS queue.
 */
export async function removeWordFromQueue(cardId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM User_Cards WHERE id = ?;', [cardId]);
}

/**
 * Retrieves words categorized by difficulty (CEFR level), with SRS queue status.
 */
export async function getWordsByDifficulty(
  cefrLevel?: string,
  targetLang = 'es'
): Promise<DifficultyWordItem[]> {
  const db = await getDatabase();
  let query = `
    SELECT 
      con.id as concept_id,
      con.description as concept_desc,
      lf.id as front_lexeme_id,
      lf.term as front_term,
      lf.language as front_lang,
      lf.pos as front_pos,
      lf.cefr_level as front_cefr,
      lf.frequency_rank,
      lb.id as back_lexeme_id,
      lb.term as back_term,
      lb.language as back_lang,
      COALESCE(d.name, 'General') as deck_name,
      COALESCE(parent_d.name, 'Topics') as theme_name,
      uc.id as user_card_id,
      uc.stability,
      uc.reps,
      uc.lapses,
      uc.due_date,
      uc.state
    FROM Concepts con
    JOIN Concept_Lexeme clf ON clf.concept_id = con.id
    JOIN Lexemes lf ON lf.id = clf.lexeme_id AND lf.language = ?
    JOIN Concept_Lexeme clb ON clb.concept_id = con.id
    JOIN Lexemes lb ON lb.id = clb.lexeme_id AND lb.language = 'en'
    LEFT JOIN Domains d ON d.id = con.domain_id
    LEFT JOIN Domains parent_d ON parent_d.id = d.parent_id
    LEFT JOIN User_Cards uc ON uc.front_lexeme_id = lf.id
  `;
  const params: any[] = [targetLang];

  if (cefrLevel && cefrLevel !== 'ALL') {
    query += ' WHERE lf.cefr_level = ?';
    params.push(cefrLevel);
  }

  query += ' ORDER BY lf.frequency_rank ASC, lf.term ASC LIMIT 100;';

  const rows = await db.getAllAsync<any>(query, params);
  return rows.map((r) => ({
    concept_id: r.concept_id,
    concept_desc: r.concept_desc,
    front_lexeme_id: r.front_lexeme_id,
    front_term: r.front_term,
    front_lang: r.front_lang,
    front_pos: r.front_pos,
    front_cefr: r.front_cefr,
    frequency_rank: r.frequency_rank,
    back_lexeme_id: r.back_lexeme_id,
    back_term: r.back_term,
    back_lang: r.back_lang,
    deck_name: r.deck_name,
    theme_name: r.theme_name,
    is_queued: Boolean(r.user_card_id),
    user_card_id: r.user_card_id || undefined,
    stability: r.stability,
    reps: r.reps,
    lapses: r.lapses,
    due_date: r.due_date,
    state: r.state,
  }));
}

/**
 * Returns breakdown statistics across CEFR levels.
 */
export async function getDifficultyStats(targetLang = 'es'): Promise<DifficultyStat[]> {
  const db = await getDatabase();
  const levels: { cefr: CEFRLevel; label: string; tier: number }[] = [
    { cefr: 'A1', label: 'Novice', tier: 1 },
    { cefr: 'A2', label: 'Apprentice', tier: 2 },
    { cefr: 'B1', label: 'Adept', tier: 3 },
    { cefr: 'B2', label: 'Expert', tier: 4 },
    { cefr: 'C1', label: 'Master', tier: 5 },
    { cefr: 'C2', label: 'Grandmaster', tier: 6 },
  ];

  const rows = await db.getAllAsync<{
    cefr_level: string;
    total_count: number;
    queued_count: number;
    mastered_count: number;
  }>(`
    SELECT 
      lf.cefr_level,
      COUNT(DISTINCT lf.id) as total_count,
      COUNT(DISTINCT uc.id) as queued_count,
      COUNT(DISTINCT CASE WHEN uc.stability >= 10.0 THEN uc.id END) as mastered_count
    FROM Concepts con
    JOIN Concept_Lexeme clf ON clf.concept_id = con.id
    JOIN Lexemes lf ON lf.id = clf.lexeme_id AND lf.language = ?
    LEFT JOIN User_Cards uc ON uc.front_lexeme_id = lf.id
    GROUP BY lf.cefr_level;
  `, [targetLang]);

  const map = new Map<string, { total_count: number; queued_count: number; mastered_count: number }>();
  for (const r of rows) {
    map.set(r.cefr_level, r);
  }

  return levels.map((lvl) => {
    const data = map.get(lvl.cefr) || { total_count: 0, queued_count: 0, mastered_count: 0 };
    return {
      cefr: lvl.cefr,
      label: lvl.label,
      tier: lvl.tier,
      total_count: data.total_count,
      queued_count: data.queued_count,
      mastered_count: data.mastered_count,
      available_count: Math.max(0, data.total_count - data.queued_count),
    };
  });
}

/**
 * Adds all unqueued words of a given CEFR tier into the SRS queue.
 */
export async function addWordsByDifficultyToQueue(
  cefrLevel: string,
  targetLang = 'es'
): Promise<number> {
  const db = await getDatabase();
  const pairs = await db.getAllAsync<{ front_id: number; back_id: number; concept_id: string }>(
    `SELECT lf.id as front_id, lb.id as back_id, con.id as concept_id
     FROM Concepts con
     JOIN Concept_Lexeme clf ON clf.concept_id = con.id
     JOIN Lexemes lf ON lf.id = clf.lexeme_id AND lf.language = ?
     JOIN Concept_Lexeme clb ON clb.concept_id = con.id
     JOIN Lexemes lb ON lb.id = clb.lexeme_id AND lb.language = 'en'
     LEFT JOIN User_Cards uc ON uc.front_lexeme_id = lf.id
     WHERE lf.cefr_level = ? AND uc.id IS NULL;`,
    [targetLang, cefrLevel]
  );

  const now = new Date().toISOString();
  let count = 0;
  for (const p of pairs) {
    const cardId = `card_${p.concept_id}_${p.front_id}`;
    await db.runAsync(
      `INSERT OR IGNORE INTO User_Cards (
        id, front_lexeme_id, back_lexeme_id, due_date, state,
        stability, difficulty, elapsed_days, scheduled_days, reps, lapses, updated_at
      ) VALUES (?, ?, ?, ?, 0, 0.0, 0.0, 0, 0, 0, 0, ?);`,
      [cardId, p.front_id, p.back_id, now, now]
    );
    count++;
  }
  return count;
}

/**
 * Returns overall mastery counts across SRS retention stages.
 */
export async function getMasterySummary(targetLang = 'es'): Promise<MasterySummary> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  const totalLib = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(DISTINCT lf.id) as count
     FROM Concepts con
     JOIN Concept_Lexeme clf ON clf.concept_id = con.id
     JOIN Lexemes lf ON lf.id = clf.lexeme_id AND lf.language = ?;`,
    [targetLang]
  );
  const total_library_count = totalLib?.count || 0;

  const stats = await db.getAllAsync<{
    is_mastered: number;
    is_slipping: number;
    is_learning: number;
    is_new: number;
    total_queued: number;
  }>(`
    SELECT 
      COUNT(DISTINCT CASE WHEN uc.stability >= 10.0 THEN uc.id END) as is_mastered,
      COUNT(DISTINCT CASE WHEN (uc.lapses > 0 OR (uc.due_date <= ? AND uc.state > 0)) AND uc.stability < 10.0 THEN uc.id END) as is_slipping,
      COUNT(DISTINCT CASE WHEN uc.state IN (1, 2, 3) AND uc.stability < 10.0 AND (uc.lapses = 0 OR uc.lapses IS NULL) AND uc.due_date > ? THEN uc.id END) as is_learning,
      COUNT(DISTINCT CASE WHEN uc.state = 0 THEN uc.id END) as is_new,
      COUNT(DISTINCT uc.id) as total_queued
    FROM User_Cards uc
    JOIN Lexemes lf ON lf.id = uc.front_lexeme_id AND lf.language = ?;
  `, [now, now, targetLang]);

  const row = stats[0] || { is_mastered: 0, is_slipping: 0, is_learning: 0, is_new: 0, total_queued: 0 };
  const available_count = Math.max(0, total_library_count - row.total_queued);

  return {
    slipping_count: row.is_slipping,
    learning_count: row.is_learning,
    mastered_count: row.is_mastered,
    new_queue_count: row.is_new,
    available_count,
    total_library_count,
  };
}

/**
 * Retrieves words belonging to a specific SRS mastery/retention stage.
 */
export async function getMasteryWords(
  stage: MasteryStage,
  targetLang = 'es'
): Promise<MasteryWordItem[]> {
  const db = await getDatabase();
  const now = new Date().toISOString();

  let whereClause = '';
  if (stage === 'available') {
    whereClause = 'WHERE uc.id IS NULL';
  } else if (stage === 'mastered') {
    whereClause = 'WHERE uc.stability >= 10.0';
  } else if (stage === 'slipping') {
    whereClause = 'WHERE (uc.lapses > 0 OR (uc.due_date <= ? AND uc.state > 0)) AND uc.stability < 10.0';
  } else if (stage === 'learning') {
    whereClause = 'WHERE uc.state IN (1, 2, 3) AND uc.stability < 10.0 AND (uc.lapses = 0 OR uc.lapses IS NULL) AND uc.due_date > ?';
  } else if (stage === 'new_in_queue') {
    whereClause = 'WHERE uc.state = 0';
  }

  const query = `
    SELECT 
      con.id as concept_id,
      con.description as concept_desc,
      lf.id as front_lexeme_id,
      lf.term as front_term,
      lf.language as front_lang,
      lf.pos as front_pos,
      lf.cefr_level as front_cefr,
      lb.id as back_lexeme_id,
      lb.term as back_term,
      lb.language as back_lang,
      COALESCE(d.name, 'General') as deck_name,
      COALESCE(parent_d.name, 'Topics') as theme_name,
      uc.id as user_card_id,
      uc.stability,
      uc.scheduled_days,
      uc.reps,
      uc.lapses,
      uc.due_date,
      uc.state
    FROM Concepts con
    JOIN Concept_Lexeme clf ON clf.concept_id = con.id
    JOIN Lexemes lf ON lf.id = clf.lexeme_id AND lf.language = ?
    JOIN Concept_Lexeme clb ON clb.concept_id = con.id
    JOIN Lexemes lb ON lb.id = clb.lexeme_id AND lb.language = 'en'
    LEFT JOIN Domains d ON d.id = con.domain_id
    LEFT JOIN Domains parent_d ON parent_d.id = d.parent_id
    LEFT JOIN User_Cards uc ON uc.front_lexeme_id = lf.id
    ${whereClause}
    ORDER BY 
      CASE WHEN uc.due_date IS NOT NULL THEN uc.due_date ELSE '9999' END ASC,
      lf.frequency_rank ASC
    LIMIT 60;
  `;

  const params = stage === 'slipping' || stage === 'learning' ? [targetLang, now] : [targetLang];
  const rows = await db.getAllAsync<any>(query, params);

  return rows.map((r) => ({
    concept_id: r.concept_id,
    concept_desc: r.concept_desc,
    front_lexeme_id: r.front_lexeme_id,
    front_term: r.front_term,
    front_lang: r.front_lang,
    front_pos: r.front_pos,
    front_cefr: r.front_cefr,
    back_lexeme_id: r.back_lexeme_id,
    back_term: r.back_term,
    back_lang: r.back_lang,
    deck_name: r.deck_name,
    theme_name: r.theme_name,
    is_queued: Boolean(r.user_card_id),
    user_card_id: r.user_card_id || undefined,
    stage,
    stability: r.stability,
    scheduled_days: r.scheduled_days,
    reps: r.reps,
    lapses: r.lapses,
    due_date: r.due_date,
    state: r.state,
  }));
}

/**
 * Adopts/queues a batch of available words into the SRS queue.
 */
export async function addAvailableWordsToQueue(limit = 10, targetLang = 'es'): Promise<number> {
  const db = await getDatabase();
  const pairs = await db.getAllAsync<{ front_id: number; back_id: number; concept_id: string }>(
    `SELECT lf.id as front_id, lb.id as back_id, con.id as concept_id
     FROM Concepts con
     JOIN Concept_Lexeme clf ON clf.concept_id = con.id
     JOIN Lexemes lf ON lf.id = clf.lexeme_id AND lf.language = ?
     JOIN Concept_Lexeme clb ON clb.concept_id = con.id
     JOIN Lexemes lb ON lb.id = clb.lexeme_id AND lb.language = 'en'
     LEFT JOIN User_Cards uc ON uc.front_lexeme_id = lf.id
     WHERE uc.id IS NULL
     ORDER BY lf.frequency_rank ASC
     LIMIT ?;`,
    [targetLang, limit]
  );

  const now = new Date().toISOString();
  let count = 0;
  for (const p of pairs) {
    const cardId = `card_${p.concept_id}_${p.front_id}`;
    await db.runAsync(
      `INSERT OR IGNORE INTO User_Cards (
        id, front_lexeme_id, back_lexeme_id, due_date, state,
        stability, difficulty, elapsed_days, scheduled_days, reps, lapses, updated_at
      ) VALUES (?, ?, ?, ?, 0, 0.0, 0.0, 0, 0, 0, 0, ?);`,
      [cardId, p.front_id, p.back_id, now, now]
    );
    count++;
  }
  return count;
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
 * Logs a study/review event for a card into Review_Logs.
 */
export async function logReviewEvent(cardId: string, rating: number): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    'INSERT INTO Review_Logs (card_id, rating, reviewed_at) VALUES (?, ?, ?);',
    [cardId, rating, now]
  );
}

/**
 * Seeds realistic historical activity logs across past 60 days if empty.
 */
export async function seedSampleReviewLogs(db: SQLite.SQLiteDatabase): Promise<void> {
  const cards = await db.getAllAsync<{ id: string }>('SELECT id FROM User_Cards LIMIT 10;');
  if (!cards || cards.length === 0) return;

  const now = new Date();
  const insertStmt = 'INSERT INTO Review_Logs (card_id, rating, reviewed_at) VALUES (?, ?, ?);';

  for (let i = 60; i >= 0; i--) {
    const dayDate = new Date(now);
    dayDate.setDate(now.getDate() - i);
    const dayOfWeek = dayDate.getDay();

    // Preserve 4-day current streak while having realistic rest days in past
    if (i > 4 && (i % 7 === 2 || (i % 11 === 0 && dayOfWeek === 0))) {
      continue;
    }

    const count = i <= 4 ? 4 + ((i * 3) % 12) : ((i * 7 + dayOfWeek * 5) % 15) + 2;
    for (let r = 0; r < count; r++) {
      const card = cards[r % cards.length];
      const rating = (r % 4) + 1;
      const reviewTime = new Date(dayDate);
      reviewTime.setHours(9 + (r % 12), (r * 7) % 60, 0, 0);
      await db.runAsync(insertStmt, [card.id, rating, reviewTime.toISOString()]);
    }
  }
}

/**
 * Returns complete GitHub-style commit activity grid and progress statistics.
 */
export async function getProgressOverview(weeksCount = 18): Promise<ProgressOverview> {
  const db = await getDatabase();
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // End on Saturday of the current week
  const todayDow = today.getDay(); // 0 = Sun ... 6 = Sat
  const endOfCurrentWeek = new Date(today);
  endOfCurrentWeek.setDate(today.getDate() + (6 - todayDow));
  endOfCurrentWeek.setHours(23, 59, 59, 999);

  // Total days in grid
  const totalDays = weeksCount * 7;
  const startDate = new Date(endOfCurrentWeek);
  startDate.setDate(endOfCurrentWeek.getDate() - (totalDays - 1));
  startDate.setHours(0, 0, 0, 0);
  const startDateStr = startDate.toISOString().split('T')[0];

  // Fetch daily review counts
  const rows = await db.getAllAsync<{ review_date: string; count: number }>(
    `SELECT date(reviewed_at) as review_date, count(*) as count 
     FROM Review_Logs 
     WHERE date(reviewed_at) >= date(?) 
     GROUP BY date(reviewed_at);`,
    [startDateStr]
  );

  const countMap = new Map<string, number>();
  for (const r of rows) {
    countMap.set(r.review_date, r.count);
  }

  // Build weeks matrix
  const gridWeeks: ActivityWeek[] = [];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthLabels: { weekIndex: number; label: string }[] = [];
  let lastMonth = -1;

  for (let w = 0; w < weeksCount; w++) {
    const days: (ActivityDay | null)[] = [];

    for (let d = 0; d < 7; d++) {
      const cellDate = new Date(startDate);
      cellDate.setDate(startDate.getDate() + (w * 7 + d));
      const cellStr = cellDate.toISOString().split('T')[0];

      // Track month transitions
      if (d === 0) {
        const monthIdx = cellDate.getMonth();
        if (monthIdx !== lastMonth && w < weeksCount - 1) {
          monthLabels.push({ weekIndex: w, label: monthNames[monthIdx] });
          lastMonth = monthIdx;
        }
      }

      if (cellStr > todayStr) {
        // Future day in the current week
        days.push(null);
      } else {
        const count = countMap.get(cellStr) || 0;
        let level: 0 | 1 | 2 | 3 | 4 = 0;
        if (count >= 15) level = 4;
        else if (count >= 8) level = 3;
        else if (count >= 4) level = 2;
        else if (count >= 1) level = 1;

        days.push({
          date: cellStr,
          count,
          level,
        });
      }
    }

    gridWeeks.push({ days });
  }

  // Calculate current streak
  let currentStreak = 0;
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const todayCount = countMap.get(todayStr) || 0;
  let checkDate = new Date(today);
  if (todayCount === 0 && (countMap.get(yesterdayStr) || 0) > 0) {
    checkDate = new Date(yesterday);
  }

  while (true) {
    const dateKey = checkDate.toISOString().split('T')[0];
    const cnt = countMap.get(dateKey) || 0;
    if (cnt > 0) {
      currentStreak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  // Calculate longest streak & total reviews from all logs
  const allLogs = await db.getAllAsync<{ review_date: string }>(
    `SELECT DISTINCT date(reviewed_at) as review_date 
     FROM Review_Logs 
     ORDER BY review_date ASC;`
  );

  let longestStreak = 0;
  let tempStreak = 0;
  let prevTime: number | null = null;

  for (const item of allLogs) {
    const d = new Date(item.review_date);
    if (prevTime !== null) {
      const diffDays = Math.round((d.getTime() - prevTime) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        tempStreak++;
      } else {
        tempStreak = 1;
      }
    } else {
      tempStreak = 1;
    }
    prevTime = d.getTime();
    if (tempStreak > longestStreak) {
      longestStreak = tempStreak;
    }
  }
  if (currentStreak > longestStreak) {
    longestStreak = currentStreak;
  }

  const totalReviewsRes = await db.getFirstAsync<{ count: number }>(
    'SELECT count(*) as count FROM Review_Logs;'
  );
  const totalReviews = totalReviewsRes?.count || 0;

  // Mastered & total cards
  const totalCardsRes = await db.getFirstAsync<{ count: number }>('SELECT count(*) as count FROM User_Cards;');
  const masteredRes = await db.getFirstAsync<{ count: number }>(
    'SELECT count(*) as count FROM User_Cards WHERE stability >= 10.0;'
  );

  // Weekly distribution (Sun=0 to Sat=6)
  const dowRows = await db.getAllAsync<{ dow: string; count: number }>(
    `SELECT strftime('%w', reviewed_at) as dow, count(*) as count 
     FROM Review_Logs 
     GROUP BY strftime('%w', reviewed_at);`
  );
  const dowMap = new Map<number, number>();
  for (const r of dowRows) {
    dowMap.set(parseInt(r.dow, 10), r.count);
  }

  const dowNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weeklyDistribution = dowNames.map((name, idx) => ({
    day: name,
    count: dowMap.get(idx) || 0,
  }));

  return {
    currentStreak,
    longestStreak: Math.max(longestStreak, currentStreak),
    totalReviews,
    todayReviews: todayCount,
    masteredCards: masteredRes?.count || 0,
    totalCards: totalCardsRes?.count || 0,
    gridWeeks,
    monthLabels,
    weeklyDistribution,
  };
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

  // Get active streak from Review_Logs
  const progress = await getProgressOverview(4);

  const totalCards = total?.count || 0;
  const dueCards = due?.count || 0;
  const newCards = newC?.count || 0;
  const masteredCards = mastered?.count || 0;

  return {
    totalCards,
    dueCards,
    newCards,
    masteredCards,
    streakDays: Math.max(progress.currentStreak, 1),
    xpPoints: masteredCards * 50 + (totalCards - dueCards) * 15 + progress.totalReviews * 10,
  };
}

/**
 * Retrieves a key-value setting from the local fortress Settings table.
 */
export async function getSetting(key: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM Settings WHERE key = ?;',
    [key]
  );
  return row ? row.value : null;
}

/**
 * Persists a key-value setting to the local fortress Settings table (offline-first).
 */
export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO Settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;`,
    [key, value, now]
  );
}

/**
 * Checks if the user is entitled to ad-free status (persisted locally in SQLite).
 */
export async function isAdFreeUser(): Promise<boolean> {
  const val = await getSetting('is_ad_free');
  return val === 'true';
}

/**
 * Updates the user's ad-free entitlement status in SQLite.
 */
export async function setAdFreeUser(adFree: boolean): Promise<void> {
  await setSetting('is_ad_free', adFree ? 'true' : 'false');
}

