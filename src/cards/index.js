// 卡牌總入口：統一查詢與牌庫建構工具
import { SYMBOLS, SYMBOL_BY_ID } from './symbols.js';
import { FORMULAS, FORMULA_BY_ID } from './formulas.js';
import { FIELDS, FIELD_BY_ID } from './fields.js';
import { SIGNATURES, SIGNATURE_BY_ID } from './signatures.js';
import { CHARACTERS, CHARACTER_LIST, READY_CHARACTERS } from './characters.js';

export { SYMBOLS, FORMULAS, FIELDS, SIGNATURES, CHARACTERS, CHARACTER_LIST, READY_CHARACTERS };

const ANGLE_DEG = {
  a30: 30, a45: 45, a60: 60, a90: 90, a120: 120,
  a135: 135, a150: 150, a180: 180, a270: 270, a360: 360,
};

// 依 id 取得任一技能卡的中繼資料（附 type 欄位）
export function getSkillMeta(id) {
  if (SYMBOL_BY_ID[id]) return { type: 'symbol', ...SYMBOL_BY_ID[id] };
  if (FORMULA_BY_ID[id]) return { type: 'formula', ...FORMULA_BY_ID[id] };
  if (FIELD_BY_ID[id]) return { type: 'field', ...FIELD_BY_ID[id] };
  if (SIGNATURE_BY_ID[id]) return { type: 'signature', ...SIGNATURE_BY_ID[id] };
  return null;
}

let _uidCounter = 0;
function nextUid(prefix) { return `${prefix}_${(_uidCounter++).toString(36)}`; }

// 將數字牌庫組成展開為卡牌實例陣列
export function buildNumberDeck(characterId) {
  const ch = CHARACTERS[characterId];
  if (!ch) throw new Error(`未知角色：${characterId}`);
  const out = [];
  for (const { v, count } of ch.numberDeck) {
    const isAngle = typeof v === 'string';
    for (let i = 0; i < count; i++) {
      out.push(isAngle
        ? { uid: nextUid('num'), type: 'angle', v: ANGLE_DEG[v], glyph: `${ANGLE_DEG[v]}°`, name: `角度卡 ${ANGLE_DEG[v]}°` }
        : { uid: nextUid('num'), type: 'number', v, glyph: String(v), name: `數字 ${v}` });
    }
  }
  return out;
}

// 將技能牌庫組成展開為卡牌實例陣列
export function buildSkillDeck(characterId) {
  const ch = CHARACTERS[characterId];
  if (!ch) throw new Error(`未知角色：${characterId}`);
  const out = [];
  for (const { id, count } of ch.skillDeck) {
    const meta = getSkillMeta(id);
    if (!meta) throw new Error(`未知技能卡 id：${id}`);
    for (let i = 0; i < count; i++) {
      out.push({
        uid: nextUid('skl'), cardId: id, type: meta.type,
        glyph: meta.glyph || meta.name, name: meta.name,
        timing: meta.timing, instant: meta.instant || meta.timing === 'instant',
      });
    }
  }
  return out;
}

// 驗證所有角色牌庫張數正確（數字 100、技能 60）
export function validateAllDecks() {
  const report = [];
  for (const ch of CHARACTER_LIST) {
    const num = ch.numberDeck.reduce((s, c) => s + c.count, 0);
    const skl = ch.skillDeck.reduce((s, c) => s + c.count, 0);
    const ok = num === 100 && skl === 60;
    report.push({ id: ch.id, name: ch.name, num, skl, ok });
  }
  return report;
}
