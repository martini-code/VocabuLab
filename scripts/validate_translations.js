#!/usr/bin/env node
/**
 * Translation Validation & Scaffolding Tool for Vocab Keep
 *
 * Usage:
 *   node scripts/validate_translations.js check [lang]
 *   node scripts/validate_translations.js generate <lang_code>
 */

const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '..', 'src', 'locales');
const EN_PATH = path.join(LOCALES_DIR, 'en', 'common.json');

if (!fs.existsSync(EN_PATH)) {
  console.error('Master English file not found at:', EN_PATH);
  process.exit(1);
}

const enJson = JSON.parse(fs.readFileSync(EN_PATH, 'utf-8'));

function getFlatKeys(obj, prefix = '') {
  let keys = [];
  for (const k of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
      keys = keys.concat(getFlatKeys(obj[k], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

const masterKeys = new Set(getFlatKeys(enJson));

const action = process.argv[2] || 'check';

if (action === 'check') {
  const targetLang = process.argv[3];
  const langDirs = fs.readdirSync(LOCALES_DIR).filter((f) => {
    return fs.statSync(path.join(LOCALES_DIR, f)).isDirectory() && f !== 'en';
  });

  const checkLangs = targetLang ? [targetLang] : langDirs;

  console.log(`Checking ${checkLangs.length} language(s) against master template (${masterKeys.size} keys)...`);

  let hasError = false;
  for (const lang of checkLangs) {
    const langFile = path.join(LOCALES_DIR, lang, 'common.json');
    if (!fs.existsSync(langFile)) {
      console.warn(`[WARN] ${lang}: common.json missing`);
      continue;
    }

    try {
      const data = JSON.parse(fs.readFileSync(langFile, 'utf-8'));
      const langKeys = new Set(getFlatKeys(data));

      const missing = [...masterKeys].filter((k) => !langKeys.has(k));
      const extra = [...langKeys].filter((k) => !masterKeys.has(k));

      if (missing.length > 0) {
        console.error(`[FAIL] ${lang}: ${missing.length} missing keys:`);
        missing.forEach((k) => console.error(`   - ${k}`));
        hasError = true;
      } else {
        console.log(`[PASS] ${lang}: 100% complete (${langKeys.size}/${masterKeys.size} keys)`);
      }

      if (extra.length > 0) {
        console.warn(`[NOTE] ${lang}: ${extra.length} extra keys not in en:`, extra.join(', '));
      }
    } catch (err) {
      console.error(`[ERROR] ${lang}: Failed to parse JSON:`, err.message);
      hasError = true;
    }
  }

  process.exit(hasError ? 1 : 0);
} else if (action === 'generate') {
  const newLang = process.argv[3];
  if (!newLang) {
    console.error('Please specify language code. Example: node scripts/validate_translations.js generate fr');
    process.exit(1);
  }

  const targetDir = path.join(LOCALES_DIR, newLang);
  const targetFile = path.join(targetDir, 'common.json');

  if (fs.existsSync(targetFile)) {
    console.error(`Language file already exists at: ${targetFile}`);
    process.exit(1);
  }

  fs.mkdirSync(targetDir, { recursive: true });

  // Clone template structure with empty or English fallback strings
  function cloneTemplate(obj) {
    const res = {};
    for (const k of Object.keys(obj)) {
      if (typeof obj[k] === 'object' && obj[k] !== null && !Array.isArray(obj[k])) {
        res[k] = cloneTemplate(obj[k]);
      } else {
        res[k] = obj[k]; // Keep original as reference for translators
      }
    }
    return res;
  }

  const template = cloneTemplate(enJson);
  fs.writeFileSync(targetFile, JSON.stringify(template, null, 2), 'utf-8');
  console.log(`Successfully generated new translation scaffold for '${newLang}':`);
  console.log(`   -> ${targetFile}`);
} else {
  console.log('Unknown action. Use "check" or "generate <lang_code>".');
}
