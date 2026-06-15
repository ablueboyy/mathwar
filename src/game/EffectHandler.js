// 公式卡 / 簽名卡效果處理器
// 每個 handler：(game, slot, payload) => { ok, error }
// 需要造成傷害者，呼叫 game.dealDamage(slot, raw, { piercing })
// payload 由前端帶入（例如選擇的手牌 uid、宣告的數值等）

import { getSkillMeta } from '../cards/index.js';

function isPrime(n) { if (n < 2) return false; for (let d = 2; d * d <= n; d++) if (n % d === 0) return false; return true; }
function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a; }
function comb(n, k) { if (k < 0 || k > n) return 0; k = Math.min(k, n - k); let r = 1; for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1); return Math.round(r); }
const deg2rad = (d) => (d * Math.PI) / 180;
// 從某牌庫墓地依 uid 取卡
function graveVals(game, slot, uids, pile) {
  const arr = game.players[slot][pile];
  return (uids || []).map((uid) => arr.find((c) => c.uid === uid)).filter(Boolean);
}

// 從 payload.uids 取手牌數字卡的數值（不消耗，僅讀取）；消耗交給呼叫端
function handVals(game, slot, uids) {
  const p = game.players[slot];
  return (uids || []).map((uid) => p.hand.find((c) => c.uid === uid)).filter(Boolean);
}

export const EFFECTS = {
  // ───── 公式卡 ─────
  basel(game, slot) {
    game.dealDamage(slot, 50, {});
    game.drawSkills(slot, 1);
    game.addLog(`${slot} 巴塞爾問題：造成 50 傷害並抽 1 張技能`);
    return { ok: true };
  },
  gravitation(game, slot) {
    const opp = game.opponentOf(slot);
    const raw = Math.min(80, Math.floor((game.players[opp].hp * game.players[slot].hp) / 1000));
    game.dealDamage(slot, raw, { damageCap: 80 });
    game.addLog(`${slot} 萬有引力定律：造成 ${raw} 傷害`);
    return { ok: true };
  },
  goldbach(game, slot) {
    const opp = game.opponentOf(slot);
    game.dealDamage(slot, 50, { piercing: true });
    let burn = 5;
    if (game.players[opp].hp % 2 === 0) burn = 10;
    game.burnNumberDeck(opp, burn);
    game.addLog(`${slot} 哥德巴赫猜想：50 穿透傷害並焚燒對手數字牌庫 ${burn} 張`);
    return { ok: true };
  },
  mvt(game, slot) {
    const h = game.players[slot].damageHistory;
    const last3 = h.slice(-3);
    const raw = last3.length < 3 ? 30 : Math.round(last3.reduce((a, b) => a + b, 0) / last3.length);
    game.dealDamage(slot, raw, {});
    game.addLog(`${slot} 均值定理：以平均 ${raw} 作為傷害`);
    return { ok: true };
  },
  lln(game, slot) {
    const h = game.players[slot].damageHistory;
    if (h.length < 4) return { ok: false, error: '大數法則需至少 4 回合傷害記錄' };
    const raw = Math.round(h.reduce((a, b) => a + b, 0) / h.length);
    game.dealDamage(slot, raw, {});
    game.addLog(`${slot} 大數法則：以歷史平均 ${raw} 作為傷害`);
    return { ok: true };
  },
  draw_vieta(game, slot) {
    game.drawNumbers(slot, 3);
    game.addLog(`${slot} 韋達定理：抽 3 張數字卡`);
    return { ok: true };
  },

  // ───── 歐幾里得：幾何・代數公式 ─────
  pythagoras(game, slot, payload = {}) {
    const cards = handVals(game, slot, payload.uids).filter((c) => c.type === 'number' || c.type === 'angle');
    if (cards.length < 2) return { ok: false, error: '需選擇兩張數字卡 a、b' };
    if (game.field && game.field.cardId === 'non_euclidean' && !game.players[slot].flags.fifthPostulate)
      return { ok: false, error: '非歐幾里得空間下畢達哥拉斯定理失效' };
    const [a, b] = cards;
    const base = Math.min(100, Math.floor(Math.sqrt(a.v * a.v + b.v * b.v)) * 5);
    game.consumeCards(slot, [a.uid, b.uid]);
    const res = game.dealModified(slot, base, { geometry: true }, { isAttack: false });
    game.drawNumbers(slot, 1);
    game.addLog(`${slot} 畢達哥拉斯定理：造成 ${res.actualDamage} 傷害並抽 1 張數字`);
    return { ok: true };
  },
  law_cosines(game, slot, payload = {}) {
    const cards = handVals(game, slot, payload.uids);
    const nums = cards.filter((c) => c.type === 'number');
    let angle = cards.find((c) => c.type === 'angle');
    // 三角空間下可用普通數字卡作為角度
    if (!angle && game.field && game.field.cardId === 'trig_space' && nums.length >= 3) angle = nums.pop();
    if (nums.length < 2 || !angle) return { ok: false, error: '需 2 張數字卡與 1 張角度卡（三角空間下可用數字卡作角度）' };
    const [a, b] = nums;
    const inside = a.v * a.v + b.v * b.v - 2 * a.v * b.v * Math.cos(deg2rad(angle.v));
    if (inside < 0) return { ok: false, error: '餘弦定理計算結果無效' };
    const base = Math.min(100, Math.floor(Math.sqrt(inside) * 5));
    game.consumeCards(slot, cards.map((c) => c.uid));
    const res = game.dealModified(slot, base, { geometry: true }, { isAttack: false });
    game.addLog(`${slot} 餘弦定理：造成 ${res.actualDamage} 傷害`);
    return { ok: true };
  },
  law_sines(game, slot, payload = {}) {
    const cards = handVals(game, slot, payload.uids);
    const angles = cards.filter((c) => c.type === 'angle');
    const nums = cards.filter((c) => c.type === 'number');
    if (angles.length < 2 || nums.length < 1) return { ok: false, error: '需兩張角度卡(A、B)與一張數字卡(邊長 a)' };
    const [A, B] = angles; const a = nums[0];
    const sinA = Math.sin(deg2rad(A.v));
    if (Math.abs(sinA) < 1e-9) return { ok: false, error: '角度 A 的 sin 為 0，無法計算' };
    const base = Math.min(100, Math.floor((a.v * Math.sin(deg2rad(B.v)) / sinA) * 5));
    if (base <= 0) return { ok: false, error: '正弦定理計算結果無效' };
    game.consumeCards(slot, [A.uid, B.uid, a.uid]);
    const res = game.dealModified(slot, base, { geometry: true }, { isAttack: false });
    game.addLog(`${slot} 正弦定理：造成 ${res.actualDamage} 傷害`);
    return { ok: true };
  },
  euler_polyhedron(game, slot, payload = {}) {
    const cards = handVals(game, slot, payload.uids).filter((c) => c.type === 'number');
    if (cards.length < 3) return { ok: false, error: '需選擇三張數字卡 V、E、F' };
    const [V, E, F] = cards;
    game.consumeCards(slot, [V.uid, E.uid, F.uid]);
    if (V.v - E.v + F.v === 2) {
      const res = game.dealModified(slot, (V.v + E.v + F.v) * 5, { geometry: true }, { isAttack: false });
      game.drawNumbers(slot, 1);
      game.addLog(`${slot} 歐拉多面體公式：V-E+F=2，造成 ${res.actualDamage} 傷害並抽 1 張`);
    } else {
      game.players[slot].hp = Math.max(0, game.players[slot].hp - 25);
      game.addLog(`${slot} 歐拉多面體公式：V-E+F≠2，扣自身 25 HP`);
    }
    return { ok: true };
  },
  permcomb(game, slot, payload = {}) {
    const n = payload.n | 0, k = payload.k | 0;
    if (n < 0 || n > 9 || k < 0 || k > n) return { ok: false, error: '需宣告 n≤9 且 0≤k≤n' };
    const res = game.dealModified(slot, Math.min(100, comb(n, k)), {}, { isAttack: false });
    game.addLog(`${slot} 排列組合定理：C(${n},${k})，造成 ${res.actualDamage} 傷害`);
    return { ok: true };
  },
  amgm(game, slot, payload = {}) {
    const cards = handVals(game, slot, payload.uids).filter((c) => c.type === 'number' || c.type === 'angle');
    const vals = cards.map((c) => c.v);
    if (vals.length < 2 || vals.length > 3) return { ok: false, error: '需選擇 2～3 張數字卡' };
    if (new Set(vals).size !== vals.length) return { ok: false, error: '所選數字卡需互不相同' };
    const am = vals.reduce((a, b) => a + b, 0) / vals.length;
    const gm = Math.pow(vals.reduce((a, b) => a * b, 1), 1 / vals.length);
    const dmg = Math.min(50, Math.floor((am - gm) * 15));
    game.consumeCards(slot, cards.map((c) => c.uid));
    const res = game.dealDamage(slot, Math.max(0, dmg), { isAttack: false });
    game.addLog(`${slot} AM-GM 不等式：造成 ${res.actualDamage} 傷害`);
    return { ok: true };
  },
  bezout(game, slot, payload = {}) {
    const cards = graveVals(game, slot, payload.graveUids, 'numberGrave').filter((c) => c.type === 'number' || c.type === 'angle');
    if (cards.length < 2) return { ok: false, error: '需從你的數字墓地選擇兩張卡' };
    const g = gcd(cards[0].v, cards[1].v);
    const res = game.dealDamage(slot, g * 15, { damageCap: 999, isAttack: false });
    game.addLog(`${slot} 貝祖定理：gcd=${g}，造成 ${res.actualDamage} 傷害`);
    return { ok: true };
  },
  four_color(game, slot) {
    game.players[slot].flags.fourColor = { turnsLeft: 4, step: 0 };
    game.addLog(`${slot} 四色定理：未來 4 回合傷害依序 +5/+10/+15/+20`);
    return { ok: true };
  },
  cauchy_schwarz(game, slot, payload = {}) {
    const cards = handVals(game, slot, payload.uids).filter((c) => c.type === 'number' || c.type === 'angle');
    if (cards.length < 2) return { ok: false, error: '需選擇手牌中 2 張數字卡（a₁, a₂）作為向量分量' };
    const [a1, a2] = cards;
    const v = Math.floor(Math.sqrt(a1.v ** 2 + a2.v ** 2));
    const reduction = v * 3;
    game.consumeCards(slot, [a1.uid, a2.uid]);
    game.players[slot].flags.cauchyReduction = reduction;
    let extra = '';
    if (v >= 10) { game.drawSkills(slot, 1); extra = '，模長 ≥ 10，額外抽 1 張技能'; }
    game.addLog(`${slot} 柯西-施瓦茨：⌊√(${a1.v}²+${a2.v}²)⌋=${v}，對手下次算式傷害 −${reduction}${extra}`);
    return { ok: true };
  },

  // ───── 阿基米德：分析・統計公式 ─────
  ftc(game, slot) {
    game.players[slot].flags.ftcTurns = 3;
    game.addLog(`${slot} 積分基本定理：3 回合內算式攻擊傷害 +⌊防禦值×25%⌋（上限 +25）`);
    return { ok: true };
  },
  rolle(game, slot) {
    game.players[slot].flags.rolleArmed = true;
    game.addLog(`${slot} 羅爾定理：待命中（本次傷害等於對手上回合傷害則可再戰一次）`);
    return { ok: true };
  },
  taylor(game, slot) {
    const p = game.players[slot];
    const symbols = p.hand.filter((c) => c.type === 'symbol');
    for (const c of symbols) { game.takeFromHand(slot, c.uid); game.toGrave(slot, c); }
    if (symbols.length === 0) { game.addLog(`${slot} 泰勒展開式：手牌無符號卡，無傷害`); return { ok: true }; }
    const per = (game.field && game.field.cardId === 'infinite_dim') ? 25 : 20; // 無限維空間每張 +5
    const res = game.dealModified(slot, symbols.length * per, {}, { isAttack: false });
    game.addLog(`${slot} 泰勒展開式：棄 ${symbols.length} 張符號卡，造成 ${res.actualDamage} 傷害`);
    return { ok: true };
  },
  ivt(game, slot, payload = {}) {
    const h = game.players[slot].damageHistory;
    if (h.length < 2) return { ok: false, error: '中間值定理需至少 2 次傷害記錄' };
    const lo = Math.min(...h), hi = Math.max(...h);
    const c = payload.c | 0;
    if (c < lo || c > hi) return { ok: false, error: `需宣告 ${lo}～${hi} 之間的整數` };
    const res = game.dealModified(slot, c, {}, { isAttack: false });
    game.addLog(`${slot} 中間值定理：宣告 ${c}，造成 ${res.actualDamage} 傷害`);
    return { ok: true };
  },
  limit_def(game, slot) {
    game.players[slot].flags.limitDef = true;
    game.addLog(`${slot} 極限定義：本回合算式攻擊傷害上限提升至 150`);
    return { ok: true };
  },
  lhopital(game, slot) {
    game.players[slot].flags.lhopital = true;
    game.addLog(`${slot} 洛必達法則：本回合不定式算式可改以 50 點傷害結算`);
    return { ok: true };
  },
  clt(game, slot) {
    game.players[slot].flags.clt = true;
    game.addLog(`${slot} 中央極限定理：穩定輸出時（近 3 次傷害標準差 <25）攻擊傷害 +30`);
    return { ok: true };
  },

  // ───── 牛頓・高斯：代數／數論公式 ─────
  binomial(game, slot) {
    game.players[slot].flags.binomial = 2;
    game.addLog(`${slot} 二項式定理：2 回合內含 ^ 的算式成功攻擊後，以指數 n 自動計算 C(n,⌊n/2⌋) 作為額外傷害（上限 +60，不受 cap 限制）`);
    return { ok: true };
  },
  fermat_little(game, slot, payload = {}) {
    const discard = (payload.discardUids || []).slice(0, 2);
    if (discard.length < 2) return { ok: false, error: '需棄置 2 張手牌作為代價' };
    const p = [2, 3, 5, 7].includes(payload.p) ? payload.p : null;
    if (!p) return { ok: false, error: '需選擇質數 p（2、3、5、7）' };
    const aCard = handVals(game, slot, [payload.aUid])[0];
    if (!aCard) return { ok: false, error: '需選擇一張數字卡 a' };
    for (const uid of discard) { const c = game.takeFromHand(slot, uid); if (c) game.toGrave(slot, c); }
    // a^p mod p
    let r = 1, base = Math.round(aCard.v) % p; for (let i = 0; i < p; i++) r = (r * base) % p;
    game.consumeCards(slot, [aCard.uid]);
    const res = game.dealModified(slot, r * 15, {}, { isAttack: false });
    game.addLog(`${slot} 費馬小定理：a=${aCard.v}, p=${p}，a^p mod p=${r}，造成 ${res.actualDamage} 傷害`);
    return { ok: true };
  },
  crt(game, slot) {
    game.players[slot].flags.crtArmed = true;
    game.addLog(`${slot} 中國剩餘定理：待命中（對手下次算式傷害改為 mod2+mod3+mod5）`);
    return { ok: true };
  },
  pigeonhole(game, slot) {
    const opp = game.opponentOf(slot);
    const oh = game.players[opp].hand;
    if (oh.length <= 8) return { ok: false, error: '對手手牌需大於 8 張才能發動' };
    const seen = new Map();
    for (const c of oh) if (c.type === 'number' || c.type === 'angle') seen.set(c.v, (seen.get(c.v) || 0) + 1);
    let discarded = 0;
    for (const [v, cnt] of seen) {
      if (cnt >= 2) { const card = game.players[opp].hand.find((c) => (c.type === 'number' || c.type === 'angle') && c.v === v); if (card) { game.takeFromHand(opp, card.uid); game.toGrave(opp, card); discarded++; } }
    }
    game.drawSkills(slot, 1);
    game.addLog(`${slot} 鴿巢原理：對手棄置 ${discarded} 張重複數字卡，你抽 1 張技能`);
    return { ok: true };
  },
  prime_theorem(game, slot) {
    game.players[slot].flags.primeTheorem = true;
    game.addLog(`${slot} 質數定理：之後抽到 2/3/5/7 時額外抽 1 張數字卡`);
    return { ok: true };
  },
  perfect_number(game, slot) {
    game.players[slot].flags.perfectNumber = true;
    game.addLog(`${slot} 完全數定理：本回合算式結果為 6/28/496 時 +50 並令對手跳過下回合戰鬥`);
    return { ok: true };
  },
  euler_theorem(game, slot) {
    game.players[slot].flags.eulerTheorem = 2;
    game.addLog(`${slot} 歐拉定理：2 回合內算式傷害無視對手防禦且不被防禦技能減少`);
    return { ok: true };
  },
  fermat_last(game, slot) {
    game.players[slot].flags.fermatLastArmed = true;
    game.addLog(`${slot} 費馬最後定理：待命中（對手下次含 ^ 的攻擊將被取消並反擊 50）`);
    return { ok: true };
  },

  // ───── 牛頓簽名卡 ─────
  sig_prism(game, slot) {
    game.players[slot].flags.prism = true;
    game.addLog(`${slot} 稜鏡分解：本回合算式傷害依質因數加成（每不重複質因數 +15，上限 +60）`);
    return { ok: true };
  },
  sig_principia(game, slot, payload = {}) {
    const discard = (payload.discardUids || []).slice(0, 2);
    if (discard.length < 2) return { ok: false, error: '需棄置 2 張手牌作為代價' };
    for (const uid of discard) { const c = game.takeFromHand(slot, uid); if (c) game.toGrave(slot, c); }
    game.players[slot].flags.principia = true;
    game.burnSkillDeck(game.opponentOf(slot), 8);
    game.addLog(`${slot} 原理宣言：本回合算式無視防禦、上限 150，對手技能牌庫焚燒 8 張`);
    return { ok: true };
  },

  // ───── 歐拉・希爾伯特：公式 ─────
  euler_formula(game, slot) {
    const find = (cid) => game.players[slot].hand.find((c) => c.cardId === cid);
    const e = find('const_e'), i = find('const_i'), pi = find('const_pi');
    if (!e || !i || !pi) return { ok: false, error: '需手牌中有 e、i、π 各一張' };
    game.consumeCards(slot, [e.uid, i.uid, pi.uid]);
    if (!(game.field && game.field.cardId === 'complex_plane')) game.players[slot].hp = Math.max(0, game.players[slot].hp - 25);
    game.dealDamage(slot, 100, { piercing: true });
    game.battledThisTurn = false; // 本回合可再進行一次普通戰鬥
    game.addLog(`${slot} 歐拉公式：造成 100 點穿透傷害（本回合可再戰一次）`);
    return { ok: true };
  },
  handshake(game, slot, payload = {}) {
    const cards = handVals(game, slot, payload.uids).filter((c) => c.type === 'number' || c.type === 'angle');
    if (cards.length !== 2 && cards.length !== 4) return { ok: false, error: '需選擇 2 或 4 張數字卡' };
    let dmg = 0; for (let i = 0; i < cards.length; i += 2) dmg += Math.max(cards[i].v, cards[i + 1].v);
    game.consumeCards(slot, cards.map((c) => c.uid));
    const res = game.dealModified(slot, Math.min(100, Math.round(dmg)), {}, { isAttack: false });
    game.addLog(`${slot} 圖論握手定理：造成 ${res.actualDamage} 傷害`);
    return { ok: true };
  },
  fourier(game, slot) {
    game.players[slot].flags.fourier = 2;
    game.addLog(`${slot} 傅立葉變換：2 回合內含 sin/cos 的算式攻擊 +20`);
    return { ok: true };
  },
  de_moivre(game, slot) {
    game.players[slot].flags.deMoivre = true;
    game.addLog(`${slot} 棣美弗定理：本回合複數平面下三角算式 +32`);
    return { ok: true };
  },
  fibonacci(game, slot) {
    game.players[slot].flags.fibonacci = { turnsLeft: 3, step: 0 };
    game.addLog(`${slot} 費波那契數列：未來 3 回合傷害依序加成`);
    return { ok: true };
  },
  rank_nullity(game, slot) {
    const d = game.players[slot].skillDeck;
    for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
    game.addLog(`${slot} 秩-零化度定理：重新整理技能牌庫`);
    return { ok: true };
  },
  cantor(game, slot) {
    game.players[slot].flags.cantorArmed = true;
    game.addLog(`${slot} 康托爾對角論證：待命中（取消對手下次抽牌，你改抽 2 張技能）`);
    return { ok: true };
  },
  eigenvalue(game, slot) {
    game.players[slot].flags.eigenvalue = true;
    game.addLog(`${slot} 特徵值定理：下一次算式攻擊獲得加成`);
    return { ok: true };
  },
  determinant(game, slot, payload = {}) {
    const hv = handVals(game, slot, payload.uids).filter((c) => c.type === 'number' || c.type === 'angle');
    const gv = graveVals(game, slot, payload.graveUids, 'numberGrave').filter((c) => c.type === 'number' || c.type === 'angle');
    if (hv.length < 2 || gv.length < 2) return { ok: false, error: '需手牌 2 張數字卡與數字墓地 2 張' };
    const [a, b] = hv, [c, d] = gv;
    const dmg = Math.min(100, Math.abs(a.v * d.v - b.v * c.v));
    game.consumeCards(slot, [a.uid, b.uid]);
    const res = game.dealModified(slot, dmg, {}, { isAttack: false });
    game.addLog(`${slot} 行列式定理：|ad-bc|，造成 ${res.actualDamage} 傷害`);
    return { ok: true };
  },
  cramer(game, slot, payload = {}) {
    const p = game.players[slot];
    const discard = (payload.discardUids || []).slice(0, 3);
    if (discard.length < 3) return { ok: false, error: '需棄置 3 張手牌作為代價' };
    for (const uid of discard) { const c = game.takeFromHand(slot, uid); if (c) game.toGrave(slot, c); }
    const take = (game.field && game.field.cardId === 'matrix_space') ? 4 : 3;
    let got = 0; for (let i = 0; i < take && p.skillDeck.length; i++) { p.hand.push(p.skillDeck.pop()); got++; }
    game.enforceHandLimit(slot);
    game.addLog(`${slot} 克拉瑪公式：棄 3 張、取得 ${got} 張技能卡`);
    return { ok: true };
  },
  galois(game, slot) {
    const p = game.players[slot];
    const all = [...p.hand];
    for (const c of all) { game.takeFromHand(slot, c.uid); game.toGrave(slot, c); }
    game.drawSkills(slot, 6);
    game.addLog(`${slot} 伽羅瓦理論：棄掉全部手牌，抽 6 張技能`);
    return { ok: true };
  },

  // ───── 歐拉・希爾伯特：簽名卡 ─────
  sig_euler_tour(game, slot, payload = {}) {
    const p = game.players[slot];
    const discard = (payload.discardUids || []).slice(0, 2);
    if (discard.length < 2) return { ok: false, error: '需棄置 2 張手牌作為代價' };
    for (const uid of discard) { const c = game.takeFromHand(slot, uid); if (c) game.toGrave(slot, c); }
    let got = 0; for (let i = 0; i < 3 && p.skillDeck.length; i++) { p.hand.push(p.skillDeck.pop()); got++; }
    game.drawNumbers(slot, 2);
    game.enforceHandLimit(slot);
    game.formulaBonusThisTurn = (game.formulaBonusThisTurn || 0) + 1;
    game.addLog(`${slot} 遍歷引理：棄 2 張、取得 ${got} 張技能並抽 2 張數字，本回合公式使用上限 +1`);
    return { ok: true };
  },
  sig_consistency(game, slot) {
    game.players[slot].flags.consistencyBonus = true;
    game.burnSkillDeck(game.opponentOf(slot), 8);
    game.addLog(`${slot} 無矛盾性：本回合下次算式攻擊 +30，對手技能牌庫焚燒 8 張`);
    return { ok: true };
  },

  // ───── 歐幾里得簽名卡 ─────
  sig_fifth_postulate(game, slot) {
    game.players[slot].flags.fifthPostulate = { turnsLeft: 3 };
    game.addLog(`${slot} 第五公設：3 回合內幾何公式不受場地限制、上限提升至 150`);
    return { ok: true };
  },
  sig_elementae(game, slot, payload = {}) {
    const p = game.players[slot];
    const discard = (payload.discardUids || []).slice(0, 2);
    if (discard.length < 2) return { ok: false, error: '需棄置 2 張手牌作為代價' };
    for (const uid of discard) { const c = game.takeFromHand(slot, uid); if (c) game.toGrave(slot, c); }
    const picks = (payload.graveUids || []).slice(0, 3);
    let got = 0;
    for (const uid of picks) {
      const idx = p.skillGrave.findIndex((c) => c.uid === uid && c.type === 'formula');
      if (idx !== -1) { p.hand.push(p.skillGrave.splice(idx, 1)[0]); got++; }
    }
    game.enforceHandLimit(slot);
    game.formulaBonusThisTurn = (game.formulaBonusThisTurn || 0) + 1;
    game.addLog(`${slot} 幾何原本：棄 2 張、自技能墓地取回 ${got} 張公式卡，本回合公式使用上限 +1`);
    return { ok: true };
  },

  // ───── 防禦干擾類 ─────
  def_deconstruct(game, slot, payload = {}) {
    const opp = game.opponentOf(slot);
    if (game.players[opp].flags.fortify) return { ok: false, error: '對手「堅固算式」生效中，無法移除其防禦區' };
    const uids = (payload.uids || []).slice(0, 2);
    const removed = game.removeDefenseCards(opp, uids);
    game.recomputeDefense(opp);
    game.addLog(`${slot} 算式解構：移除對手防禦區 ${removed} 張牌`);
    return { ok: true };
  },
  def_collapse(game, slot, payload = {}) {
    const opp = game.opponentOf(slot);
    if (game.players[opp].flags.fortify) return { ok: false, error: '對手「堅固算式」生效中，無法移除其防禦區' };
    if (payload.discardUid) { const c = game.takeFromHand(slot, payload.discardUid); if (c) game.toGrave(slot, c); }
    const n = game.players[opp].defense.cards.length;
    for (const c of game.players[opp].defense.cards) game.toGrave(opp, c);
    game.players[opp].defense.cards = [];
    game.recomputeDefense(opp);
    game.addLog(`${slot} 防線崩潰：清空對手防禦區（${n} 張）`);
    return { ok: true };
  },
  def_pollute(game, slot) {
    const opp = game.opponentOf(slot);
    game.players[opp].flags.pollute = 1;
    game.recomputeDefense(opp);
    game.addLog(`${slot} 符號污染：對手防禦區算符本回合改為加法`);
    return { ok: true };
  },
  def_tamper(game, slot, payload = {}) {
    const opp = game.opponentOf(slot);
    const card = game.players[opp].defense.cards.find((c) => c.uid === payload.uid && (c.type === 'number' || c.type === 'angle'));
    if (!card) return { ok: false, error: '指定的對手防禦數字卡不存在' };
    card.v = 1; card.glyph = '1'; card.tampered = true;
    game.recomputeDefense(opp);
    game.drawNumbers(slot, 1);
    game.addLog(`${slot} 數值篡改：將對手一張防禦數字卡改為 1`);
    return { ok: true };
  },
  def_jam(game, slot) {
    const opp = game.opponentOf(slot);
    game.players[opp].flags.defenseCapThisTurn = 50;
    game.addLog(`${slot} 防禦干擾：本回合對手防禦值上限降為 50`);
    return { ok: true };
  },

  // ───── 防禦強化類 ─────
  def_amplify(game, slot) {
    const p = game.players[slot];
    p.defense.maxValue = 150; p.flags.amplifyTurns = 2;
    game.recomputeDefense(slot);
    game.addLog(`${slot} 防禦增幅：防禦值上限提升至 150（2 回合）`);
    return { ok: true };
  },
  def_fortify(game, slot) {
    game.players[slot].flags.fortify = 2;
    game.addLog(`${slot} 堅固算式：防禦區 2 回合內不被技能移除`);
    return { ok: true };
  },
  def_counter(game, slot) {
    game.players[slot].flags.counterReady = true;
    game.addLog(`${slot} 防守反擊：待命中（傷害被完全吸收時反擊 20 穿透）`);
    return { ok: true };
  },

  // ───── 簽名卡 ─────
  sig_euclidean_algo(game, slot, payload = {}) {
    const cards = handVals(game, slot, payload.uids);
    if (cards.length < 2) return { ok: false, error: '需選擇兩張數字卡' };
    const [a, b] = cards;
    const g = gcd(a.v, b.v);
    game.consumeCards(slot, [a.uid, b.uid]);
    game.dealDamage(slot, g * 10, {});
    if (g === 1) game.drawSkills(slot, 2);
    game.addLog(`${slot} 輾轉相除法：gcd=${g}，造成 ${g * 10} 傷害${g === 1 ? '（互質，抽 2 張技能）' : ''}`);
    return { ok: true };
  },
  sig_exhaustion(game, slot, payload = {}) {
    const T = Math.max(25, Math.min(80, payload.T | 0));
    const n = Math.max(1, Math.min(5, payload.n | 0));
    const raw = Math.floor(T * (1 - 1 / Math.pow(2, n)));
    game.dealDamage(slot, raw, { piercing: n === 5 });
    game.addLog(`${slot} 窮竭法：T=${T}, n=${n}，造成 ${raw} 傷害${n === 5 ? '（穿透）' : ''}`);
    return { ok: true };
  },
  sig_spiral(game, slot, payload = {}) {
    const cards = handVals(game, slot, payload.uids);
    const aCard = cards.find((c) => c.type === 'number');
    const thetaCard = cards.find((c) => c.type === 'angle');
    if (!aCard || !thetaCard) return { ok: false, error: '需一張數字卡作 a、一張角度卡作 θ' };
    const theta = (thetaCard.v * Math.PI) / 180;
    const raw = Math.floor(aCard.v * theta * 2);
    game.consumeCards(slot, [aCard.uid, thetaCard.uid]);
    game.dealDamage(slot, raw, {});
    game.drawNumbers(slot, 2);
    game.addLog(`${slot} 阿基米德螺線：造成 ${raw} 傷害並抽 2 張數字`);
    return { ok: true };
  },
  sig_eureka(game, slot) {
    const opp = game.opponentOf(slot);
    game.players[slot].hp = Math.max(0, game.players[slot].hp - 50);
    if (game.field && game.field.owner === opp) { game.players[opp].skillGrave.push({ name: game.field.name, type: 'field' }); game.field = null; }
    else if (game.field) { game.players[game.field.owner].skillGrave.push({ name: game.field.name, type: 'field' }); game.field = null; }
    const raw = game.players[slot].hp < game.players[opp].hp ? 100 : 70;
    game.dealDamage(slot, raw, { piercing: true });
    game.addLog(`${slot} 尤里卡！：扣自身 50HP，移除場地，造成 ${raw} 穿透傷害`);
    return { ok: true };
  },
  sig_fluxion(game, slot, payload = {}) {
    const cards = handVals(game, slot, payload.uids);
    if (cards.length < 2) return { ok: false, error: '需選擇兩張數字卡作 s、t' };
    const [s, t] = cards;
    if (t.v === 0) return { ok: false, error: 't 不可為 0' };
    let raw = Math.floor((s.v / t.v) * 20);
    const integer = s.v % t.v === 0;
    if (integer) raw += 25;
    game.consumeCards(slot, [s.uid, t.uid]);
    game.dealDamage(slot, raw, {});
    if (integer) game.drawSkills(slot, 1);
    game.addLog(`${slot} 流數記法：造成 ${raw} 傷害${integer ? '（整除 +25，抽 1 技能）' : ''}`);
    return { ok: true };
  },
  sig_konigsberg(game, slot, payload = {}) {
    const cards = handVals(game, slot, payload.uids);
    const n = cards[0];
    if (!n) return { ok: false, error: '需選擇一張數字卡 n' };
    const even = n.v % 2 === 0;
    const raw = even ? n.v * 8 : n.v * 5;
    game.consumeCards(slot, [n.uid]);
    game.dealDamage(slot, raw, {});
    if (!even) game.drawSkills(slot, 2);
    game.addLog(`${slot} 柯尼斯堡七橋：n=${n.v}，造成 ${raw} 傷害${even ? '' : '（奇數，抽 2 技能）'}`);
    return { ok: true };
  },
  sig_euler_identity(game, slot) {
    game.dealDamage(slot, 100, { piercing: true });
    game.addLog(`${slot} 歐拉恆等式特攻：造成 100 穿透傷害`);
    game.battledThisTurn = false; // 可再進行一次普通戰鬥
    return { ok: true };
  },
  sig_gauss_sum(game, slot, payload = {}) {
    const cards = handVals(game, slot, payload.uids);
    const n = cards.length ? Math.max(...cards.map((c) => c.v)) : 0;
    if (!n) return { ok: false, error: '需選擇數字卡（取最大值）' };
    const raw = Math.min(100, n * (n + 1));
    game.consumeCards(slot, cards.map((c) => c.uid));
    game.dealDamage(slot, raw, {});
    if (isPrime(n)) game.drawNumbers(slot, 3);
    game.addLog(`${slot} 高斯求和公式：n=${n}，造成 ${raw} 傷害${isPrime(n) ? '（質數，抽 3 數字）' : ''}`);
    return { ok: true };
  },
  sig_gauss_integer(game, slot, payload = {}) {
    if (!game.field || game.field.cardId !== 'complex_plane') return { ok: false, error: '需在複數平面場地下使用' };
    const cards = handVals(game, slot, payload.uids);
    if (cards.length < 2) return { ok: false, error: '需選擇兩張數字卡 a、b' };
    const [a, b] = cards;
    const raw = Math.min(100, Math.floor(Math.sqrt(a.v * a.v + b.v * b.v)) * 6);
    game.consumeCards(slot, [a.uid, b.uid]);
    game.dealDamage(slot, raw, {});
    game.addLog(`${slot} 高斯整數：造成 ${raw} 傷害`);
    return { ok: true };
  },
  sig_royal_talent(game, slot) {
    const p = game.players[slot];
    const idx = p.skillDeck.findIndex((c) => c.type === 'formula');
    if (idx === -1) return { ok: false, error: '技能牌庫中無公式卡' };
    const [card] = p.skillDeck.splice(idx, 1);
    p.hand.push(card);
    game.enforceHandLimit(slot);
    game.formulaBonusThisTurn = (game.formulaBonusThisTurn || 0) + 1;
    game.addLog(`${slot} 皇族天賦：取出公式卡「${card.name}」，本回合公式使用上限 +1`);
    return { ok: true };
  },
  sig_riemann_integral(game, slot, payload = {}) {
    const cards = handVals(game, slot, payload.uids);
    if (cards.length < 3) return { ok: false, error: '需選擇上界 b、下界 a、分割 n 三張數字卡' };
    const vals = cards.map((c) => c.v).sort((x, y) => x - y);
    const a = vals[0], b = vals[2], n = Math.max(1, Math.min(5, vals[1]));
    const raw = Math.floor((b - a) * (n / (n + 1)) * 25);
    game.consumeCards(slot, cards.map((c) => c.uid));
    game.dealDamage(slot, raw, {});
    game.addLog(`${slot} 黎曼積分：a=${a}, b=${b}, n=${n}，造成 ${raw} 傷害`);
    return { ok: true };
  },
  sig_hilbert_hotel(game, slot) {
    const opp = game.opponentOf(slot);
    const oh = game.players[opp].hand.filter((c) => c.type === 'number' || c.type === 'angle');
    if (oh.length) {
      const highest = oh.reduce((m, c) => (c.v > m.v ? c : m), oh[0]);
      game.takeFromHand(opp, highest.uid); game.toGrave(opp, highest);
    }
    game.burnNumberDeck(opp, 8);
    const od = game.players[opp].defense.cards.filter((c) => c.type === 'number' || c.type === 'angle');
    if (od.length) {
      const highest = od.reduce((m, c) => (c.v > m.v ? c : m), od[0]);
      game.removeDefenseCards(opp, [highest.uid]); game.recomputeDefense(opp);
    }
    game.drawNumbers(slot, 1);
    game.addLog(`${slot} 希爾伯特旅館：對手棄最高數字卡、焚燒數字牌庫 8 張、清除最高防禦數字卡`);
    return { ok: true };
  },
  sig_23_problems(game, slot, payload = {}) {
    if (payload.discardUid) { const c = game.takeFromHand(slot, payload.discardUid); if (c) game.toGrave(slot, c); }
    const opp = game.opponentOf(slot);
    const N = Math.max(1, Math.min(23, payload.N | 0));
    const raw = Math.min(92, N * 4);
    game.dealDamage(slot, raw, {});
    let extra = '';
    if (N <= 5) { game.players[opp].flags.skipBattle = true; extra = '對手跳過下回合戰鬥'; }
    else if (N <= 10) { game.drawSkills(slot, 3); extra = '抽 3 張技能'; }
    else if (N <= 15) { game.burnNumberDeck(opp, 8); extra = '焚燒對手數字牌庫 8 張'; }
    else if (N <= 20) { game.dealDamage(slot, 25, {}); extra = '額外 +25 傷害'; }
    else { game.burnSkillDeck(opp, 10); game.players[opp].flags.skipBattle = true; extra = '焚燒對手技能牌庫 10 張且跳過戰鬥'; }
    game.addLog(`${slot} 23問：N=${N}，造成 ${raw} 傷害（${extra}）`);
    return { ok: true };
  },
};

// 取得某效果是否已實作
export function hasEffect(effectId) { return effectId && !!EFFECTS[effectId]; }

export function runEffect(effectId, game, slot, payload) {
  const fn = EFFECTS[effectId];
  if (!fn) return { ok: false, error: '此效果尚未實作' };
  return fn(game, slot, payload);
}

// 給未實作效果的提示文字
export function effectStatus(cardId) {
  const meta = getSkillMeta(cardId);
  if (!meta) return null;
  return meta.effect && EFFECTS[meta.effect] ? 'implemented' : 'pending';
}
