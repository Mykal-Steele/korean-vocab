/**
 * Validates assets/js/data.js before anything is built from it.
 *
 * Adding a word set means editing data.js and nothing else: the deck headings,
 * the filter chips, the practice set picker, the masthead subtitle and every
 * count are all generated from CATEGORIES and WORDS. That convenience is also
 * the risk, because a typo in one field surfaces somewhere far away -- a `syl`
 * array one short leaves a handwriting pad without its caption, and two words
 * sharing an English gloss puts two identical tiles on a matching board with
 * only one right answer. This catches all of it up front.
 *
 *   node tools/check-data.js
 *
 * build.py runs it first and refuses to bundle if it fails.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7a3;

/** Runs a browser script in a throwaway context and hands back the globals it declared. */
function loadGlobals(relative, names) {
  const source = fs.readFileSync(path.join(ROOT, relative), 'utf8');
  const context = vm.createContext({ window: {}, document: undefined });
  vm.runInContext(`${source}\n;({ ${names.join(', ')} })`, context, { filename: relative });
  return vm.runInContext(`({ ${names.join(', ')} })`, context);
}

const problems = [];
const note = (where, message) => problems.push(`${where}: ${message}`);

const { CATEGORIES, WORDS } = loadGlobals('assets/js/data.js', ['CATEGORIES', 'WORDS']);
const { Hangul } = loadGlobals('assets/js/hangul.js', ['Hangul']);

/* ------------------------------------------------------------ categories */
const ids = new Set();
CATEGORIES.forEach((cat, i) => {
  const where = `CATEGORIES[${i}]`;
  for (const key of ['id', 'ko', 'en', 'th']) {
    if (typeof cat[key] !== 'string' || !cat[key].trim()) note(where, `missing ${key}`);
  }
  if (ids.has(cat.id)) note(where, `duplicate id ${cat.id}`);
  ids.add(cat.id);
  if (!/^[a-z][a-z0-9]*$/.test(cat.id || '')) note(where, `id ${cat.id} should be lowercase letters`);
});

/* ----------------------------------------------------------------- words */
const seenKo = new Map();
const seenGloss = new Map();

WORDS.forEach((word, i) => {
  const where = `WORDS[${i}] ${word.ko || '(no ko)'}`;

  // A backslash in a string literal is an escape, so the page shows different text than the
  // file says. Write apostrophes as ’ or as \' once, and check the value, not the source.
  const texts = [
    ['ko', word.ko], ['rom', word.rom], ['en', word.en], ['th', word.th],
    ['example.ko', word.example?.ko], ['example.en', word.example?.en],
    ...(word.accept || []).map((a) => ['accept', a]),
  ];
  for (const [field, text] of texts) {
    if (typeof text === 'string' && text.includes('\\')) {
      note(where, `${field} contains a backslash (${text}); the page would show it`);
    }
  }

  for (const key of ['ko', 'rom', 'en', 'th', 'category']) {
    if (typeof word[key] !== 'string' || !word[key].trim()) note(where, `missing ${key}`);
  }
  if (!ids.has(word.category)) note(where, `unknown category ${word.category}`);

  const syllables = [...(word.ko || '')];
  if (!syllables.length || !syllables.every((c) => c.codePointAt(0) >= HANGUL_START
      && c.codePointAt(0) <= HANGUL_END)) {
    note(where, 'ko must be a bare run of Hangul syllables');
  }

  if (seenKo.has(word.ko)) note(where, `duplicate of WORDS[${seenKo.get(word.ko)}]`);
  seenKo.set(word.ko, i);

  // Two words with the same gloss make a matching board unanswerable.
  const gloss = (word.en || '').trim().toLowerCase();
  if (seenGloss.has(gloss)) note(where, `English gloss "${word.en}" already used by ${seenGloss.get(gloss)}`);
  seenGloss.set(gloss, word.ko);

  // syl labels the handwriting pads one per block, so it has to line up exactly.
  if (!Array.isArray(word.syl)) note(where, 'syl must be an array');
  else if (word.syl.length !== syllables.length) {
    note(where, `syl has ${word.syl.length} entries for ${syllables.length} syllables`);
  } else if (word.syl.some((s) => typeof s !== 'string' || !/^[a-z]+$/.test(s))) {
    note(where, 'syl entries must be lowercase romanization');
  }

  if (word.say !== undefined) {
    const said = [...word.say];
    if (said.length !== syllables.length) {
      note(where, `say "${word.say}" has ${said.length} syllables, ko has ${syllables.length}`);
    }
    if (word.say === word.ko) note(where, 'say repeats ko, so it says nothing; drop it');
  }

  if (!Array.isArray(word.accept) || !word.accept.length) note(where, 'accept must be a non-empty array');
  else {
    if (word.accept.some((a) => typeof a !== 'string' || a !== a.toLowerCase())) {
      note(where, 'accept entries must be lowercase strings');
    }
    if (new Set(word.accept).size !== word.accept.length) note(where, 'accept has duplicates');
  }

  if (!word.example || !word.example.ko || !word.example.en) note(where, 'example needs both ko and en');
  else if (!/[.!?]$/.test(word.example.ko)) note(where, 'example.ko should end in punctuation');

  // Every block gets drawn from jamo stroke data, including the example text.
  const drawn = new Set(syllables);
  for (const char of word.example?.ko || '') {
    if (char.codePointAt(0) >= HANGUL_START && char.codePointAt(0) <= HANGUL_END) drawn.add(char);
  }
  for (const char of drawn) {
    let strokes;
    try {
      strokes = Hangul.strokesFor(char);
    } catch (error) {
      note(where, `no stroke data for ${char} (${error.message})`);
      continue;
    }
    if (!strokes || !strokes.length) note(where, `no stroke data for ${char}`);
  }
});

CATEGORIES.forEach((cat) => {
  if (!WORDS.some((w) => w.category === cat.id)) note(`CATEGORIES ${cat.id}`, 'has no words');
});

/* ----------------------------------------------------------------- audio */
// Only a warning: the clips are regenerated after data.js changes, so a fresh
// word is expected to be missing until tools/build-audio.py has run.
const missingAudio = [];
const audioPath = path.join(ROOT, 'assets', 'js', 'audio.js');
if (fs.existsSync(audioPath)) {
  const source = fs.readFileSync(audioPath, 'utf8');
  const match = source.match(/const AUDIO = (\{[\s\S]*?\});/);
  if (match) {
    const table = JSON.parse(match[1]);
    const wanted = new Set();
    for (const word of WORDS) {
      wanted.add(word.ko);
      wanted.add(word.en);
      wanted.add(word.example.ko);
      for (const char of word.ko) wanted.add(char);
    }
    for (const text of wanted) if (!(text in table)) missingAudio.push(text);
  }
}

/* ---------------------------------------------------------------- report */
const counts = CATEGORIES.map((c) => `${c.ko} ${WORDS.filter((w) => w.category === c.id).length}`);
console.log(`${WORDS.length} words in ${CATEGORIES.length} sets (${counts.join(', ')})`);

if (missingAudio.length) {
  console.log(`${missingAudio.length} string(s) have no clip yet; run tools/build-audio.py: `
    + missingAudio.slice(0, 6).join(', ') + (missingAudio.length > 6 ? ' ...' : ''));
}

if (problems.length) {
  console.error(`\n${problems.length} problem(s) in data.js:`);
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}
console.log('data.js looks good');
