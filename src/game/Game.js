// 遊戲流程協調器：繼承 GameState，加入回合流程、攻擊、技能、傷害發動等動作
import { GameState } from './GameState.js';
import { calculate } from './Calculator.js';
import { resolveDamage } from './DamageResolver.js';
import { getSkillMeta } from '../cards/index.js';
import { runEffect, hasEffect } from './EffectHandler.js';
import { CHARACTERS } from '../cards/characters.js';

// ── 數論小工具（場地與公式效果用）──
function distinctPrimeFactors(n) {
  n = Math.abs(Math.round(n)); const set = new Set();
  for (let d = 2; d * d <= n; d++) { while (n % d === 0) { set.add(d); n /= d; } }
  if (n > 1) set.add(n);
  return set.size;
}
function isFibNum(n) {
  if (n < 1) return false;
  const isPS = (x) => { const s = Math.round(Math.sqrt(x)); return s * s === x; };
  return isPS(5 * n * n + 4) || isPS(5 * n * n - 4);
}
function _comb(n, k) {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  let r = 1;
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
  return Math.round(r);
}

export class Game extends GameState {
  constructor(roomId, p1Char, p2Char, firstPlayer) {
    super(roomId, p1Char, p2Char, firstPlayer);
    this.fieldPlayedThisTurn = false;
    this.formulaUsedThisTurn = 0;
    this.formulaBonusThisTurn = 0;
    this._beginTurn(this.currentPlayer, true);
  }

  // ───── 攻擊傷害修正管線（持續效果 / 場地 / 特徵值等）─────
  // ctx: { geometry, usedPow, consumeEigen }
  applyAttackModifiers(slot, raw, ctx = {}) {
    const p = this.players[slot];
    let bonus = 0, cap = 100;
    const matrixField = this.field && this.field.cardId === 'matrix_space';
    if (p.flags.fourColor) bonus += [5, 10, 15, 20][Math.min(p.flags.fourColor.step, 3)];
    if (p.flags.eigenvalue) bonus += ctx.usedPow ? (matrixField ? 55 : 40) : (matrixField ? 40 : 25);
    if (p.flags.ftcTurns > 0) bonus += Math.min(25, Math.floor(p.defense.value * 0.25));
    if (p.flags.fourier && ctx.usedTrig) bonus += 20;
    if (p.flags.deMoivre && ctx.usedTrig && this.field && this.field.cardId === 'complex_plane') bonus += 32;
    if (p.flags.fibonacci) bonus += (this.field && this.field.cardId === 'golden_ratio' ? [5, 10, 15] : [5, 5, 10])[Math.min(p.flags.fibonacci.step, 2)];
    if (p.flags.consistencyBonus) bonus += 30;
    if (p.flags.clt && this._cltStable(slot)) bonus += 30;
    if (p.flags.limitDef) cap = Math.max(cap, 150);
    if (p.flags.principia) cap = Math.max(cap, 150);
    if (ctx.geometry && p.flags.fifthPostulate) cap = Math.max(cap, 150);
    if (this.field) {
      if (this.field.cardId === 'projective') bonus += 25;
      if (this.field.cardId === 'non_euclidean' && ctx.geometry) bonus += 15;
    }
    return { raw: Math.max(0, raw + bonus), cap };
  }

  _cltStable(slot) {
    const h = this.players[slot].damageHistory.slice(-3);
    if (h.length < 3) return false;
    const m = h.reduce((a, b) => a + b, 0) / 3;
    const sd = Math.sqrt(h.reduce((a, b) => a + (b - m) ** 2, 0) / 3);
    return sd < 25;
  }

  // 套用修正後發動傷害（公式型傷害與算式攻擊共用）
  dealModified(slot, raw, ctx = {}, opts = {}) {
    const mod = this.applyAttackModifiers(slot, raw, ctx);
    const p = this.players[slot];
    if (p.flags.eigenvalue) p.flags.eigenvalue = false; // 一次性消耗
    return this.dealDamage(slot, mod.raw, { ...opts, damageCap: mod.cap });
  }

  // ───── 傷害發動（供攻擊與效果共用）─────
  dealDamage(slot, raw, opts = {}) {
    const opp = this.opponentOf(slot);
    const att = this.players[slot];
    const def = this.players[opp];
    // 即時防禦反應（歐拉定理生效時不被防禦技能減少）
    if (opts.isAttack && !opts.piercing && !opts.ignoreReactions) {
      // 費馬最後定理：對手算式含次方時取消攻擊並反擊 50
      if (def.flags.fermatLastArmed && opts.usedPow) {
        def.flags.fermatLastArmed = false;
        const cr = resolveDamage(50, def, att, { piercing: true });
        this.applyDamage(slot, cr.actualDamage);
        this.recordDamage(slot, 0);
        this.addLog(`${opp} 費馬最後定理：宣告「無整數解」，取消 ${slot} 的攻擊並反擊 50 點`);
        return { rawDamage: raw, capped: 0, defenseAbsorbed: 0, actualDamage: 0, cancelled: true };
      }
      // 柯西-施瓦茨：傷害降為 60%
      if (def.flags.cauchyReduction != null) {
        const reduction = def.flags.cauchyReduction;
        delete def.flags.cauchyReduction;
        raw = Math.max(0, raw - reduction);
        this.addLog(`${opp} 柯西-施瓦茨：本次傷害減少 ${reduction} 點（剩餘 ${raw}）`);
      }
      // 中國剩餘定理：傷害分別對 2、3、5 取模後相加
      if (def.flags.crtArmed) {
        def.flags.crtArmed = false;
        const d = Math.max(0, Math.round(raw));
        raw = (d % 2) + (d % 3) + (d % 5);
        this.addLog(`${opp} 中國剩餘定理：將 ${slot} 的傷害改為 (mod2+mod3+mod5)=${raw}`);
      }
    }
    const res = resolveDamage(raw, att, def, opts);
    // 消耗制防禦：每次吸收傷害後扣減耐久值
    if (res.defenseAbsorbed > 0 && def.defense.durability != null) {
      def.defense.durability = Math.max(0, def.defense.durability - res.defenseAbsorbed);
    }
    this.applyDamage(opp, res.actualDamage);
    this.recordDamage(slot, res.capped);
    // 防守反擊：傷害被完全吸收時觸發
    if (!res.piercing && res.capped > 0 && res.actualDamage === 0 && def.flags.counterReady) {
      def.flags.counterReady = false;
      const c = resolveDamage(20, def, att, { piercing: true });
      this.applyDamage(slot, c.actualDamage);
      this.addLog(`${opp} 防守反擊：對 ${slot} 造成 20 穿透傷害`);
    }
    return res;
  }

  burnNumberDeck(slot, n) { const p = this.players[slot]; for (let i = 0; i < n && p.numberDeck.length; i++) p.numberGrave.push(p.numberDeck.pop()); }
  burnSkillDeck(slot, n) { const p = this.players[slot]; for (let i = 0; i < n && p.skillDeck.length; i++) p.skillGrave.push(p.skillDeck.pop()); }

  removeDefenseCards(slot, uids) {
    const p = this.players[slot]; let count = 0;
    for (const uid of uids) {
      const idx = p.defense.cards.findIndex((c) => c.uid === uid);
      if (idx !== -1) { this.toGrave(slot, p.defense.cards.splice(idx, 1)[0]); count++; }
    }
    return count;
  }

  consumeCards(slot, uids) {
    for (const uid of uids) { const c = this.takeFromHand(slot, uid); if (c) this.toGrave(slot, c); }
  }

  // ───── 回合流程 ─────
  _beginTurn(slot, isFirst = false) {
    this.currentPlayer = slot;
    this.phase = 'main';
    this.battledThisTurn = false;
    this.fieldPlayedThisTurn = false;
    this.formulaUsedThisTurn = 0;
    this.formulaBonusThisTurn = 0;

    // 清除雙方的一次性／本回合旗標
    for (const s of ['p1', 'p2']) {
      const f = this.players[s].flags;
      delete f.defenseCapThisTurn; delete f.pollute; f.counterReady = false;
      this.recomputeDefense(s);
    }

    // 清除「本回合」進攻旗標（屬於即將行動的玩家，避免延續到下一回合）
    const p = this.players[slot];
    delete p.flags.limitDef; delete p.flags.lhopital; delete p.flags.rolleArmed;
    delete p.flags.prism; delete p.flags.principia; delete p.flags.perfectNumber;
    delete p.flags.deMoivre; delete p.flags.consistencyBonus;

    // 持續效果倒數
    if (p.flags.amplifyTurns > 0) { p.flags.amplifyTurns--; if (p.flags.amplifyTurns === 0) { p.defense.maxValue = p.defense.baseMax; this.recomputeDefense(slot); } }
    if (p.flags.fortify > 0) { p.flags.fortify--; }
    if (p.flags.fifthPostulate) { p.flags.fifthPostulate.turnsLeft--; if (p.flags.fifthPostulate.turnsLeft <= 0) delete p.flags.fifthPostulate; }
    if (p.flags.fourColor && !isFirst) { p.flags.fourColor.turnsLeft--; p.flags.fourColor.step++; if (p.flags.fourColor.turnsLeft <= 0) delete p.flags.fourColor; }
    if (p.flags.binomial > 0) { p.flags.binomial--; }
    if (p.flags.ftcTurns > 0) { p.flags.ftcTurns--; if (!p.flags.ftcTurns) delete p.flags.ftcTurns; }
    if (p.flags.eulerTheorem > 0) { p.flags.eulerTheorem--; }
    if (p.flags.fourier > 0) { p.flags.fourier--; }
    if (p.flags.fibonacci && !isFirst) { p.flags.fibonacci.turnsLeft--; p.flags.fibonacci.step++; if (p.flags.fibonacci.turnsLeft <= 0) delete p.flags.fibonacci; }

    // 場地被動：非歐幾里得空間 → 每回合開始抽 1 張技能
    if (this.field && this.field.cardId === 'non_euclidean' && !isFirst) this.drawSkills(slot, 1);

    // 重置技能抽牌選擇旗標
    p.skillDrawDone = false;

    // 跳過戰鬥旗標
    if (p.flags.skipBattle) { this.battledThisTurn = true; p.flags.skipBattle = false; this.addLog(`${slot} 本回合跳過戰鬥階段`); }

    // 抽牌：自動抽 2 張數字，技能抽牌由玩家透過按鈕選擇
    if (!isFirst) this.drawForTurn(slot, 2);
  }

  endTurn(slot) {
    if (this.winner) return { ok: false, error: '遊戲已結束' };
    if (slot !== this.currentPlayer) return { ok: false, error: '尚未輪到你' };
    this.enforceHandLimit(slot);
    const next = this.opponentOf(slot);
    this.turn++;
    this._beginTurn(next, false);
    return { ok: true };
  }

  // ───── 攻擊（算式戰鬥）─────
  attack(slot, uids) {
    if (this.winner) return { ok: false, error: '遊戲已結束' };
    if (slot !== this.currentPlayer) return { ok: false, error: '尚未輪到你' };
    if (this.battledThisTurn) return { ok: false, error: '本回合已進行過戰鬥' };
    const p = this.players[slot];
    const cards = uids.map((uid) => p.hand.find((c) => c.uid === uid)).filter(Boolean);
    if (cards.length !== uids.length) return { ok: false, error: '部分卡牌不在手牌中' };
    const numCount = cards.filter((c) => c.type === 'number' || c.type === 'angle').length;
    if (numCount > 6) return { ok: false, error: '一次算式最多使用 6 張數字卡' };

    const trigMult = (this.field && this.field.cardId === 'trig_space') ? 60 : 50;
    const calc = calculate(cards, { trigMult });
    let value = calc.value;
    if (!calc.ok) {
      // 除以 0／不定式的場地與洛必達救援
      const divZero = /除以 0|取模 0|0 次根/.test(calc.error || '');
      if (divZero && this.field && this.field.cardId === 'projective') value = 80;
      else if (divZero && this.field && this.field.cardId === 'riemann_sphere') value = 50;
      else if (divZero && p.flags.lhopital) { value = 50; this.addLog(`${slot} 洛必達法則：不定式以 50 點傷害結算`); }
      else return { ok: false, error: `算式無效：${calc.error}` };
    } else if (calc.value <= 0) {
      // 結果為 0 或負數視同無效，不消耗也不造成效果（保留手牌）
      return { ok: false, error: `算式結果為 ${calc.value}，視同無效（不造成傷害）` };
    }

    const rawCalc = value;
    const fid = this.field && this.field.cardId;
    // 場地結果轉換：有限體 GF(p) / 模運算場地（結果取模後 ×20）
    if (fid === 'finite_field') { const pp = this.field.param || 5; value = Math.min(100, (((Math.round(value) % pp) + pp) % pp) * 20); }
    else if (fid === 'modular') { value = Math.min(100, (((Math.round(value) % 12) + 12) % 12) * 20); }

    // 額外加成（稜鏡分解、完全數、黃金比例空間）
    const notes = [];
    if (p.flags.prism) { const pb = Math.min(60, distinctPrimeFactors(rawCalc) * 15); if (pb) { value += pb; notes.push(`稜鏡分解 +${pb}`); } }
    if (p.flags.perfectNumber && [6, 28, 496].includes(rawCalc)) { value += 50; this.players[this.opponentOf(slot)].flags.skipBattle = true; notes.push('完全數 +50（對手跳過下回合戰鬥）'); }
    if (fid === 'golden_ratio') {
      if (cards.some((c) => c.cardId === 'const_phi')) { value += 25; notes.push('φ 算式 +25'); }
      if (isFibNum(value)) { value += 10; notes.push('費氏數 +10'); }
    }
    if (value <= 0) return { ok: false, error: '轉換後算式結果為 0，視同無效' };

    // 消耗算式卡牌入墓地
    this.consumeCards(slot, uids);
    const usedPow = cards.some((c) => c.cardId === 'pow');
    const TRIG = new Set(['sin', 'cos', 'tan', 'cot', 'sec', 'csc']);
    const usedTrig = cards.some((c) => TRIG.has(c.cardId));
    const opts = { isAttack: true, usedPow };
    if (p.flags.eulerTheorem) { opts.ignoreDefense = true; opts.ignoreReactions = true; }
    if (p.flags.principia) { opts.ignoreDefense = true; }
    const res = this.dealModified(slot, value, { usedPow, usedTrig, isExpression: true }, opts);
    this.battledThisTurn = true;
    this.addLog(`${slot} 算式攻擊：算式傷害 ${res.capped}，對手防禦吸收 ${res.defenseAbsorbed}，實際傷害 ${res.actualDamage}` + (notes.length ? `（${notes.join('、')}）` : ''));

    // 二項式定理：含 ^ 時，以指數 n 計算 C(n,⌊n/2⌋) 作為額外不受 cap 限制的傷害
    if (p.flags.binomial > 0 && usedPow && res.actualDamage > 0) {
      const powIdx = cards.findIndex((c) => c.cardId === 'pow');
      if (powIdx !== -1) {
        const expCard = cards.slice(powIdx + 1).find((c) => c.type === 'number' || c.type === 'angle');
        if (expCard && expCard.v >= 1) {
          const n = Math.floor(expCard.v);
          const k = Math.floor(n / 2);
          const bonus = Math.min(60, _comb(n, k));
          if (bonus > 0) {
            this.applyDamage(this.opponentOf(slot), bonus);
            this.addLog(`${slot} 二項式定理：C(${n},${k})=${bonus} 額外傷害（不受 cap 限制）`);
          }
        }
      }
    }

    // 羅爾定理：本次傷害與對手上回合傷害相等 → 允許再戰一次
    if (p.flags.rolleArmed) {
      const oppHist = this.players[this.opponentOf(slot)].damageHistory;
      const oppLast = oppHist.length >= 2 ? oppHist[oppHist.length - 2] : null;
      if (oppLast != null && res.capped === oppLast) { this.battledThisTurn = false; this.addLog(`${slot} 羅爾定理觸發：可再進行一次戰鬥`); }
      p.flags.rolleArmed = false;
    }
    return { ok: true, calc: value, result: res };
  }

  // ───── 打出場地卡 ─────
  playField(slot, uid, param) {
    if (slot !== this.currentPlayer) return { ok: false, error: '尚未輪到你' };
    if (this.fieldPlayedThisTurn) return { ok: false, error: '本回合已打出過場地卡' };
    const card = this.players[slot].hand.find((c) => c.uid === uid);
    if (!card || card.type !== 'field') return { ok: false, error: '此卡不是場地卡' };
    // 舊場地入擁有者墓地
    if (this.field) this.players[this.field.owner].skillGrave.push({ name: this.field.name, type: 'field' });
    this.takeFromHand(slot, uid);
    this.field = { cardId: card.cardId, name: card.name, owner: slot };
    // 有限體 GF(p) 進場時宣告模數 p
    if (card.cardId === 'finite_field') {
      const allowed = [2, 3, 5, 7, 11, 13];
      this.field.param = allowed.includes(param | 0) ? (param | 0) : 5;
    }
    this.fieldPlayedThisTurn = true;
    this.addLog(`${slot} 打出場地卡「${card.name}」` + (this.field.param ? `（p=${this.field.param}）` : ''));
    return { ok: true };
  }

  // ───── 使用公式卡 / 簽名卡 ─────
  useSkill(slot, uid, payload = {}) {
    if (this.winner) return { ok: false, error: '遊戲已結束' };
    const p = this.players[slot];
    const card = p.hand.find((c) => c.uid === uid);
    if (!card) return { ok: false, error: '卡牌不在手牌中' };
    const meta = getSkillMeta(card.cardId);
    if (!meta) return { ok: false, error: '未知卡牌' };

    if (meta.type === 'field') return this.playField(slot, uid);
    if (meta.type === 'symbol') return { ok: false, error: '符號卡須用於算式或防禦區，不能單獨發動' };

    const isInstant = meta.timing === 'instant';
    // 簽名卡：限對應角色
    if (meta.type === 'signature' && meta.owner !== p.character) {
      return { ok: false, error: '簽名卡只能由對應角色使用' };
    }
    // 非速效卡：須在自己回合，且受公式使用次數限制
    if (!isInstant) {
      if (slot !== this.currentPlayer) return { ok: false, error: '非速效卡只能在自己回合使用' };
      const hilbertBonus = (this.field && this.field.cardId === 'hilbert_space') ? 1 : 0;
      const limit = 1 + (this.formulaBonusThisTurn || 0) + hilbertBonus;
      if (this.formulaUsedThisTurn >= limit) return { ok: false, error: `本回合公式卡使用次數已達上限（${limit}）` };
    }

    if (!hasEffect(meta.effect)) {
      // 效果尚未實作：卡牌入墓地並提示（讓遊戲可繼續進行）
      this.takeFromHand(slot, uid); this.toGrave(slot, card);
      if (!isInstant) this.formulaUsedThisTurn++;
      this.addLog(`${slot} 使用「${meta.name}」（效果尚未實作，已入墓地）`);
      return { ok: true, pending: true, note: `「${meta.name}」效果在此版本尚未實作` };
    }

    // 先把卡牌移入墓地，再執行效果（效果內可能操作其他手牌）
    this.takeFromHand(slot, uid); this.toGrave(slot, card);
    const r = runEffect(meta.effect, this, slot, payload);
    if (!r.ok) {
      // 執行失敗：依 uid 精準把該技能卡退回手牌（不依賴墓地堆疊順序）
      const idx = p.skillGrave.findIndex((c) => c.uid === card.uid);
      if (idx !== -1) p.hand.push(p.skillGrave.splice(idx, 1)[0]);
      return r;
    }
    if (!isInstant) this.formulaUsedThisTurn++;
    return r;
  }
}

export function getCharacterMeta(id) { return CHARACTERS[id]; }
