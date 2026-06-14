// 算式計算器：將「數字卡 + 符號卡」的有序序列解析並求值
// 不使用 eval；以自訂 tokenizer + Pratt parser 安全解析。
// MVP 範圍：支援基礎運算、根號/階乘/絕對值/取整、三角、對數指數、求和連乘、數論二元運算與常數。
// 需搭配公式/場地語境的符號（d/dx、∫、∂、∆、lim、mod p、≠、∞、∀、∃、連鎖）暫不支援，會回傳明確錯誤。

import { SYMBOL_BY_ID } from '../cards/symbols.js';

const UNSUPPORTED = new Set(['ddx', 'integ', 'pdiff', 'delta', 'lim', 'modp', 'neq', 'infinity', 'forall', 'exists', 'chain']);

function factorial(n) {
  if (n < 0 || !Number.isInteger(n)) throw new CalcError('階乘需非負整數');
  if (n > 12) throw new CalcError('階乘過大');
  let r = 1; for (let i = 2; i <= n; i++) r *= i; return r;
}
function gcd(a, b) { a = Math.abs(Math.round(a)); b = Math.abs(Math.round(b)); while (b) { [a, b] = [b, a % b]; } return a; }
function lcm(a, b) { a = Math.round(a); b = Math.round(b); if (a === 0 || b === 0) return 0; return Math.abs(a * b) / gcd(a, b); }
function totient(n) { n = Math.round(n); if (n < 1) throw new CalcError('φ(n) 需正整數'); let r = n, x = n; for (let p = 2; p * p <= x; p++) { if (x % p === 0) { while (x % p === 0) x /= p; r -= r / p; } } if (x > 1) r -= r / x; return r; }
function primePi(n) { n = Math.round(n); let c = 0; for (let k = 2; k <= n; k++) { let isP = k > 1; for (let d = 2; d * d <= k; d++) { if (k % d === 0) { isP = false; break; } } if (isP) c++; } return c; }
function sumTo(n) { n = Math.round(n); if (n < 0) throw new CalcError('∑ 需非負'); let s = 0; for (let i = 1; i <= n; i++) s += i; return s; }
function prodTo(n) { n = Math.round(n); if (n < 0 || n > 5) throw new CalcError('∏ 需 0~5'); let p = 1; for (let i = 1; i <= n; i++) p *= i; return p; }
const toRad = (d) => (d * Math.PI) / 180;

export class CalcError extends Error {}

// 將卡牌序列轉為 token 串
// 規則：數字卡「不」串接，每張數字卡各自為一個數值；兩個數值之間必須有運算子
//      （前綴雙參數運算子如 gcd / lcm / max / min 例外，會吃後方兩個數值）
function tokenize(cards) {
  const tokens = [];
  for (const card of cards) {
    if (card.type === 'number') { tokens.push({ t: 'num', v: card.v }); continue; }
    // 角度卡：作三角函數輸入時用原度數(v)；作為一般數值時用度數 ÷10(arith)，避免角度卡當大數字過強
    if (card.type === 'angle') { tokens.push({ t: 'num', v: card.v, arith: card.v / 10, isAngle: true }); continue; }
    // 符號卡
    const meta = SYMBOL_BY_ID[card.cardId];
    if (!meta) throw new CalcError(`未知符號：${card.glyph || card.cardId}`);
    const calc = meta.calc || {};
    if (UNSUPPORTED.has(card.cardId)) throw new CalcError(`「${meta.glyph}」需搭配公式或場地語境，目前版本尚未支援於自由算式`);
    if (calc.role === 'constant') {
      if (calc.value == null) throw new CalcError(`「${meta.glyph}」需特定場地才能使用`);
      tokens.push({ t: 'num', v: calc.value });
    } else if (calc.role === 'binary') tokens.push({ t: 'op', meta: calc, glyph: meta.glyph });
    else if (calc.role === 'binary-prefix') tokens.push({ t: 'pre2', meta: calc, glyph: meta.glyph });
    else if (calc.role === 'unary-prefix') tokens.push({ t: 'pre', meta: calc, glyph: meta.glyph });
    else if (calc.role === 'unary-postfix') tokens.push({ t: 'post', meta: calc, glyph: meta.glyph });
    else if (calc.role === 'trig') tokens.push({ t: 'trig', meta: calc, glyph: meta.glyph });
    else throw new CalcError(`「${meta.glyph}」尚未支援`);
  }
  return tokens;
}

function applyBinary(op, a, b) {
  const m = op.meta;
  if (m.op === '+') return a + b;
  if (m.op === '-') return a - b;
  if (m.op === '*') return a * b;
  if (m.op === '/') { if (b === 0) throw new CalcError('除以 0 無效'); return a / b; }
  if (m.op === '^') return Math.pow(a, b);
  if (m.op === 'mod') { if (b === 0) throw new CalcError('取模 0 無效'); return ((Math.round(a) % Math.round(b)) + Math.round(b)) % Math.round(b); }
  switch (m.fn) {
    case 'nthRoot': { if (a === 0) throw new CalcError('0 次根無效'); const r = Math.pow(b, 1 / a); if (Number.isNaN(r)) throw new CalcError('n 次根無效'); return r; }
    case 'gcd': return gcd(a, b);
    case 'lcm': return lcm(a, b);
    case 'max': return Math.max(a, b);
    case 'min': return Math.min(a, b);
    case 'bitxor': return (Math.round(a) ^ Math.round(b));
    case 'bitandsum': { let v = Math.round(a) & Math.round(b), c = 0; while (v) { c += v & 1; v >>= 1; } return c; }
    default: throw new CalcError(`未支援的二元運算：${op.glyph}`);
  }
}

function applyPrefix(op, x, ctx) {
  const m = op.meta;
  let r;
  switch (m.fn) {
    case 'sqrt': if (x < 0) throw new CalcError('負數開根號無效'); r = Math.sqrt(x); break;
    case 'abs': r = Math.abs(x); break;
    case 'floor': r = Math.floor(x); ctx.roundBonus += 5; break;
    case 'ceil': r = Math.ceil(x); ctx.roundBonus += 5; break;
    case 'exp': r = Math.exp(x); break;
    case 'log10': r = Math.log10(x); break;
    case 'log': r = Math.log(x); break;
    case 'log2': r = Math.log2(x); break;
    case 'asinDeg': if (x < -1 || x > 1) throw new CalcError('arcsin 輸入需在 -1~1'); r = Math.asin(x) * 180 / Math.PI; break;
    case 'atanDeg': r = Math.atan(x) * 180 / Math.PI; break;
    case 'totient': r = totient(x); break;
    case 'primePi': r = primePi(x); break;
    case 'sumTo': r = sumTo(x); break;
    case 'prodTo': r = prodTo(x); break;
    default: throw new CalcError(`未支援的前綴運算：${op.glyph}`);
  }
  if (!Number.isFinite(r)) throw new CalcError(`「${op.glyph}」結果無效`);
  if (m.mult) r *= m.mult;
  return r;
}

function applyTrig(op, deg, ctx) {
  const m = op.meta;
  const rad = toRad(deg);
  let base;
  switch (m.fn) {
    case 'sin': base = Math.sin(rad); break;
    case 'cos': base = Math.cos(rad); break;
    case 'tan': if (Math.abs(Math.cos(rad)) < 1e-9) throw new CalcError('tan 在此角度無效'); base = Math.tan(rad); break;
    case 'cot': if (Math.abs(Math.sin(rad)) < 1e-9) throw new CalcError('cot 在此角度無效'); base = 1 / Math.tan(rad); break;
    case 'sec': if (Math.abs(Math.cos(rad)) < 1e-9) throw new CalcError('sec 在此角度無效'); base = 1 / Math.cos(rad); break;
    case 'csc': if (Math.abs(Math.sin(rad)) < 1e-9) throw new CalcError('csc 在此角度無效'); base = 1 / Math.sin(rad); break;
    default: throw new CalcError(`未支援的三角函數：${op.glyph}`);
  }
  return base * ctx.trigMult;
}

// Pratt parser
function makeParser(tokens, ctx) {
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function parseUnary() {
    const tk = peek();
    if (tk && tk.t === 'pre') { next(); return applyPrefix(tk, parseUnary(), ctx); }
    if (tk && tk.t === 'trig') {
      next();
      const operand = peek();
      // 三角函數以「度數」為輸入：角度卡用原度數，普通數字則視為該度數
      if (operand && operand.t === 'num') { next(); return applyTrig(tk, operand.v, ctx); }
      return applyTrig(tk, parseUnary(), ctx);
    }
    if (tk && tk.t === 'pre2') { next(); const a = parseUnary(); const b = parseUnary(); return applyBinary(tk, a, b); }
    return parseAtom();
  }
  function parseAtom() {
    const tk = next();
    if (!tk) throw new CalcError('算式不完整');
    if (tk.t !== 'num') throw new CalcError(`此處應為數值，卻是「${tk.glyph || '?'}」`);
    let val = tk.isAngle ? tk.arith : tk.v;
    while (peek() && peek().t === 'post') { const p = next(); if (p.meta.fn === 'factorial') val = factorial(val); }
    return val;
  }
  function parseExpr(minPrec) {
    let left = parseUnary();
    while (peek() && peek().t === 'op' && peek().meta.prec >= minPrec) {
      const op = next();
      const nextMin = op.meta.rightAssoc ? op.meta.prec : op.meta.prec + 1;
      const right = parseExpr(nextMin);
      left = applyBinary(op, left, right);
    }
    return left;
  }
  const result = parseExpr(1);
  if (pos !== tokens.length) throw new CalcError('算式語法錯誤（多餘的符號或數字）');
  return result;
}

// 主要入口：回傳 { ok, value, error }
// value 為四捨五入後、加上取整 +5 加成的「原始算式傷害」（尚未套用傷害上限與防禦）
export function calculate(cards, options = {}) {
  const ctx = { trigMult: options.trigMult || 50, roundBonus: 0 };
  try {
    if (!cards || cards.length === 0) return { ok: false, error: '算式為空' };
    const tokens = tokenize(cards);
    if (tokens.length === 0) return { ok: false, error: '算式為空' };
    const raw = makeParser(tokens, ctx);
    if (!Number.isFinite(raw)) return { ok: false, error: '算式結果無效（無限或未定義）' };
    let value = Math.round(raw);
    if (value >= 0 && ctx.roundBonus) value += ctx.roundBonus;
    return { ok: true, value, raw };
  } catch (e) {
    if (e instanceof CalcError) return { ok: false, error: e.message };
    return { ok: false, error: '算式無法計算' };
  }
}
