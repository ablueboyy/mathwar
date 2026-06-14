// 符號卡定義（37 種）
// id：ASCII 安全識別碼；glyph：顯示符號；calc：計算引擎用的運算子角色
//   role: 'binary' | 'unary-prefix' | 'unary-postfix' | 'constant' | 'trig' | 'special'
//   prec：中綴運算優先序（數字越大越先算）；fn：mathjs / 自訂函式名

export const SYMBOLS = [
  // ── 基礎運算類 ──
  { id: 'add',    glyph: '＋', name: '加法',   cat: 'basic', calc: { role: 'binary', prec: 1, op: '+' } },
  { id: 'sub',    glyph: '－', name: '減法',   cat: 'basic', calc: { role: 'binary', prec: 1, op: '-' } },
  { id: 'mul',    glyph: '×',  name: '乘法',   cat: 'basic', calc: { role: 'binary', prec: 2, op: '*' } },
  { id: 'div',    glyph: '÷',  name: '除法',   cat: 'basic', calc: { role: 'binary', prec: 2, op: '/' } },
  { id: 'pow',    glyph: '^',  name: '次方',   cat: 'basic', calc: { role: 'binary', prec: 3, op: '^', rightAssoc: true } },
  { id: 'sqrt',   glyph: '√',  name: '根號',   cat: 'basic', calc: { role: 'unary-prefix', fn: 'sqrt' } },
  { id: 'nroot',  glyph: 'ⁿ√', name: 'n次根', cat: 'basic', calc: { role: 'binary', prec: 3, fn: 'nthRoot' } },
  { id: 'fact',   glyph: '!',  name: '階乘',   cat: 'basic', calc: { role: 'unary-postfix', fn: 'factorial' } },
  { id: 'mod',    glyph: '%',  name: '取模',   cat: 'basic', calc: { role: 'binary', prec: 2, op: 'mod' } },
  { id: 'abs',    glyph: '|x|', name: '絕對值', cat: 'basic', calc: { role: 'unary-prefix', fn: 'abs' } },

  // ── 取整與比較類 ──
  { id: 'floor',  glyph: '⌊x⌋', name: '下取整', cat: 'round', calc: { role: 'unary-prefix', fn: 'floor', bonus: 5 } },
  { id: 'ceil',   glyph: '⌈x⌉', name: '上取整', cat: 'round', calc: { role: 'unary-prefix', fn: 'ceil', bonus: 5 } },
  { id: 'max',    glyph: 'max', name: '最大值', cat: 'round', calc: { role: 'binary-prefix', fn: 'max' } },
  { id: 'min',    glyph: 'min', name: '最小值', cat: 'round', calc: { role: 'binary-prefix', fn: 'min' } },
  { id: 'neq',    glyph: '≠',  name: '不等',   cat: 'round', calc: { role: 'special' } },

  // ── 三角函數類（結果 ×50 取整）──
  { id: 'sin',    glyph: 'sin', name: '正弦', cat: 'trig', calc: { role: 'trig', fn: 'sin' } },
  { id: 'cos',    glyph: 'cos', name: '餘弦', cat: 'trig', calc: { role: 'trig', fn: 'cos' } },
  { id: 'tan',    glyph: 'tan', name: '正切', cat: 'trig', calc: { role: 'trig', fn: 'tan' } },
  { id: 'cot',    glyph: 'cot', name: '餘切', cat: 'trig', calc: { role: 'trig', fn: 'cot' } },
  { id: 'sec',    glyph: 'sec', name: '正割', cat: 'trig', calc: { role: 'trig', fn: 'sec' } },
  { id: 'csc',    glyph: 'csc', name: '餘割', cat: 'trig', calc: { role: 'trig', fn: 'csc' } },
  { id: 'arcsin', glyph: 'arcsin', name: '反正弦', cat: 'trig', calc: { role: 'unary-prefix', fn: 'asinDeg' } },
  { id: 'arctan', glyph: 'arctan', name: '反正切', cat: 'trig', calc: { role: 'unary-prefix', fn: 'atanDeg' } },

  // ── 對數與指數類（結果 ×50 取整，exp 截斷上限）──
  { id: 'log',    glyph: 'log',  name: '對數',     cat: 'log', calc: { role: 'unary-prefix', fn: 'log10', mult: 50 } },
  { id: 'ln',     glyph: 'ln',   name: '自然對數', cat: 'log', calc: { role: 'unary-prefix', fn: 'log', mult: 50 } },
  { id: 'log2',   glyph: 'log₂', name: '二進對數', cat: 'log', calc: { role: 'unary-prefix', fn: 'log2', mult: 50 } },
  { id: 'exp',    glyph: 'exp',  name: '指數函數', cat: 'log', calc: { role: 'unary-prefix', fn: 'exp' } },

  // ── 微積分類（需公式/場地指定函式，計算引擎特殊處理）──
  { id: 'ddx',    glyph: 'd/dx', name: '微分',   cat: 'calc', calc: { role: 'special' } },
  { id: 'integ',  glyph: '∫',    name: '積分',   cat: 'calc', calc: { role: 'special' } },
  { id: 'pdiff',  glyph: '∂',    name: '偏微分', cat: 'calc', calc: { role: 'special' } },
  { id: 'delta',  glyph: '∆',    name: '差分',   cat: 'calc', calc: { role: 'special' } },
  { id: 'sum',    glyph: '∑',    name: '求和',   cat: 'calc', calc: { role: 'unary-prefix', fn: 'sumTo' } },
  { id: 'prod',   glyph: '∏',    name: '連乘',   cat: 'calc', calc: { role: 'unary-prefix', fn: 'prodTo' } },

  // ── 數論類 ──
  { id: 'gcd',    glyph: 'gcd', name: '最大公因數', cat: 'numtheory', calc: { role: 'binary-prefix', fn: 'gcd' } },
  { id: 'lcm',    glyph: 'lcm', name: '最小公倍數', cat: 'numtheory', calc: { role: 'binary-prefix', fn: 'lcm' } },
  { id: 'phi',    glyph: 'φ(n)', name: '歐拉函數', cat: 'numtheory', calc: { role: 'unary-prefix', fn: 'totient' } },
  { id: 'modp',   glyph: 'mod p', name: '取模 p',  cat: 'numtheory', calc: { role: 'special' } },
  { id: 'primepi', glyph: 'π(n)', name: '質數計數', cat: 'numtheory', calc: { role: 'unary-prefix', fn: 'primePi', mult: 10 } },

  // ── 常數類 ──
  { id: 'const_pi',  glyph: 'π', name: '圓周率',   cat: 'const', calc: { role: 'constant', value: Math.PI } },
  { id: 'const_e',   glyph: 'e', name: '自然常數', cat: 'const', calc: { role: 'constant', value: Math.E } },
  { id: 'const_i',   glyph: 'i', name: '虛數單位', cat: 'const', calc: { role: 'constant', value: null, needsField: 'complex' } },
  { id: 'const_phi', glyph: 'φ', name: '黃金比例', cat: 'const', calc: { role: 'constant', value: (1 + Math.sqrt(5)) / 2 } },
  { id: 'infinity',  glyph: '∞', name: '無限',     cat: 'const', calc: { role: 'special' } },

  // ── 特殊符號類 ──
  { id: 'lim',    glyph: 'lim', name: '極限',     cat: 'special', calc: { role: 'special' } },
  { id: 'chain',  glyph: '!連鎖', name: '連鎖驚嘆', cat: 'special', instant: true, calc: { role: 'special' } },
  { id: 'forall', glyph: '∀',   name: '全稱量詞', cat: 'special', calc: { role: 'special' } },
  { id: 'exists', glyph: '∃',   name: '存在量詞', cat: 'special', calc: { role: 'special' } },
  { id: 'xor',    glyph: '⊕',   name: 'XOR',     cat: 'special', calc: { role: 'binary', prec: 2, fn: 'bitxor' } },
  { id: 'tensor', glyph: '⊗',   name: '張量積',   cat: 'special', calc: { role: 'binary', prec: 2, fn: 'bitandsum' } },
];

// 每張符號卡的效果說明（供前端 tooltip 使用）
const SYMBOL_DESC = {
  add: '兩數相加。', sub: '前數減後數；結果為負時無效。', mul: '兩數相乘。',
  div: '前數除以後數；除以 0 無效（黎曼球面場地除外）。', pow: '前數的後數次方。',
  sqrt: '開平方；負數輸入無效（複數場地除外）。', nroot: '開 n 次方，n 由前方數字決定。',
  fact: '對數字取階乘；0! = 1，傷害受上限截斷。', mod: '取餘數，結果為非負整數。',
  abs: '取絕對值；可將負值結果轉為正傷害。',
  floor: '向下取整；結果 ≥ 0 時額外 +5 傷害。', ceil: '向上取整；結果 ≥ 0 時額外 +5 傷害。',
  max: '前綴：取後方兩個數的最大值（如 max 2 3 = 3）。', min: '前綴：取後方兩個數的最小值（如 min 2 3 = 2）。', neq: '算式兩端不相等則傷害 +25；相等則戰鬥無效。',
  sin: '輸入角度（度），結果 ×50 取整。', cos: '輸入角度（度），結果 ×50 取整。',
  tan: '輸入角度（度），結果 ×50；90° 無效。', cot: '輸入角度，結果 ×50；0° 無效。',
  sec: '輸入角度，結果 ×50；90° 無效。', csc: '輸入角度，結果 ×50；0° 無效。',
  arcsin: '輸入 -1～1，輸出角度（度）。', arctan: '輸入任意值，輸出 -90°～90°。',
  log: '以 10 為底；結果 ×50 取整。', ln: '以 e 為底；結果 ×50 取整。',
  log2: '以 2 為底；結果 ×50 取整。', exp: '計算 e^x；結果截斷至傷害上限 100。',
  ddx: '微分：需公式或場地指定目標多項式（自由算式暫不支援）。',
  integ: '積分：需公式或場地指定函式（自由算式暫不支援）。',
  pdiff: '偏微分：可於複數場地接受複數輸入（自由算式暫不支援）。',
  delta: '差分 f(x+1)-f(x)：需公式指定函式（自由算式暫不支援）。',
  sum: '對 i=1 到 n 連加；上限傷害 100。', prod: '對 i=1 到 n（n≤5）連乘；上限 100。',
  gcd: '前綴：取後方兩個數的最大公因數（如 gcd 6 9 = 3）。', lcm: '前綴：取後方兩個數的最小公倍數（如 lcm 2 3 = 6）。',
  phi: '計算小於 n 且與 n 互質的正整數個數。',
  modp: '對算式結果取模 p（使用時宣告，p≤12；自由算式暫不支援）。',
  primepi: '計算不超過 n 的質數個數，×10 作為傷害。',
  const_pi: '圓周率，作為 3.14159… 使用。', const_e: '自然常數，作為 2.71828… 使用。',
  const_i: '虛數單位，僅在複數場地可用；i² = -1。', const_phi: '黃金比例，作為 1.61803… 使用。',
  infinity: '算式含 ∞ 則無效（黎曼球面除外），但可觸發特定效果。',
  lim: '取算式在指定值趨近時的極限（自由算式暫不支援）。',
  chain: '⚡速效。對手傷害計算後使其 -20，每回合限 1 次。',
  forall: '配合公式卡，使效果對場上所有區域同時生效。',
  exists: '從技能墓地選 1 張符號卡加回手牌。',
  xor: '中綴：對兩數進行位元 XOR 運算（如 6 ⊕ 3）。', tensor: '中綴：兩數位元 AND 後求和；希爾伯特空間 +20 傷害。',
};
for (const s of SYMBOLS) s.desc = SYMBOL_DESC[s.id] || s.name;

export const SYMBOL_BY_ID = Object.fromEntries(SYMBOLS.map((s) => [s.id, s]));

// 規則書用的中文名 → id 對照（建構牌庫用）
export const SYMBOL_BY_NAME = Object.fromEntries(SYMBOLS.map((s) => [s.name, s.id]));
