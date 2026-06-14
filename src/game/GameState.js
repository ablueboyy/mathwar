// 完整遊戲狀態：牌庫、手牌、防禦區、HP、傷害記錄
import { buildNumberDeck, buildSkillDeck } from '../cards/index.js';
import { calculate } from './Calculator.js';

const START_HP = 500;
const HAND_LIMIT = 10;
const DEFENSE_LIMIT = 5;

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function newPlayer(slot, characterId) {
  const numberDeck = shuffle(buildNumberDeck(characterId));
  const skillDeck = shuffle(buildSkillDeck(characterId));
  // 起始手牌：數字 4 + 技能 3
  const hand = [];
  for (let i = 0; i < 4; i++) hand.push(numberDeck.pop());
  for (let i = 0; i < 3; i++) hand.push(skillDeck.pop());
  return {
    slot, character: characterId, hp: START_HP,
    numberDeck, skillDeck, numberGrave: [], skillGrave: [],
    hand,
    defense: { cards: [], value: 0, maxValue: 100, baseMax: 100 },
    damageHistory: [],
    flags: {},           // 一次性/持續效果旗標
  };
}

export class GameState {
  constructor(roomId, p1Char, p2Char, firstPlayer = 'p1') {
    this.roomId = roomId;
    this.phase = 'main';
    this.turn = 1;
    this.currentPlayer = firstPlayer;
    this.players = { p1: newPlayer('p1', p1Char), p2: newPlayer('p2', p2Char) };
    this.field = null;          // { cardId, name, owner }
    this.chain = [];
    this.log = [];
    this.winner = null;         // 'p1' | 'p2' | 'draw' | null
    this.winReason = null;
    this.battledThisTurn = false;
  }

  opponentOf(slot) { return slot === 'p1' ? 'p2' : 'p1'; }

  addLog(text) {
    this.log.push({ turn: this.turn, text });
    if (this.log.length > 200) this.log.shift();
  }

  // 抽牌：數字 n 張 + 技能 m 張；牌庫空則判敗
  drawForTurn(slot, nNum = 2, nSkill = 1) {
    const p = this.players[slot];
    if (p.numberDeck.length === 0 || p.skillDeck.length === 0) {
      this.declareWinner(this.opponentOf(slot), '對手牌庫耗盡');
      return [];
    }
    // 康托爾對角論證：對手待命中 → 取消本次抽牌，改由對手抽 2 張技能
    const opp = this.opponentOf(slot);
    if (this.players[opp].flags.cantorArmed) {
      this.players[opp].flags.cantorArmed = false;
      this.drawSkills(opp, 2);
      this.addLog(`${opp} 康托爾對角論證：取消 ${slot} 本回合抽牌，改抽 2 張技能`);
      return [];
    }
    const drawn = [];
    for (let i = 0; i < nNum && p.numberDeck.length; i++) { const c = p.numberDeck.pop(); p.hand.push(c); drawn.push(c); }
    // 質數定理：本批抽到的 2/3/5/7 各額外抽 1 張數字卡（單次，不連鎖）
    if (p.flags.primeTheorem) {
      const primes = new Set([2, 3, 5, 7]);
      const extra = drawn.filter((c) => c.type === 'number' && primes.has(c.v)).length;
      for (let i = 0; i < extra && p.numberDeck.length; i++) { const c = p.numberDeck.pop(); p.hand.push(c); drawn.push(c); }
      if (extra > 0) this.addLog(`${slot} 質數定理：抽到質數，額外抽 ${extra} 張數字卡`);
    }
    for (let i = 0; i < nSkill && p.skillDeck.length; i++) { const c = p.skillDeck.pop(); p.hand.push(c); drawn.push(c); }
    this.enforceHandLimit(slot);
    return drawn;
  }

  drawNumbers(slot, n) {
    const p = this.players[slot]; const drawn = [];
    for (let i = 0; i < n && p.numberDeck.length; i++) { const c = p.numberDeck.pop(); p.hand.push(c); drawn.push(c); }
    this.enforceHandLimit(slot); return drawn;
  }
  drawSkills(slot, n) {
    const p = this.players[slot]; const drawn = [];
    for (let i = 0; i < n && p.skillDeck.length; i++) { const c = p.skillDeck.pop(); p.hand.push(c); drawn.push(c); }
    this.enforceHandLimit(slot); return drawn;
  }

  enforceHandLimit(slot) {
    const p = this.players[slot];
    while (p.hand.length > HAND_LIMIT) { const c = p.hand.shift(); this.toGrave(slot, c); }
  }

  // 將卡牌依類型送入對應墓地
  toGrave(slot, card) {
    const p = this.players[slot];
    if (card.type === 'number' || card.type === 'angle') p.numberGrave.push(card);
    else p.skillGrave.push(card);
  }

  // 從手牌取出指定 uid 的卡（回傳卡或 null）
  takeFromHand(slot, uid) {
    const p = this.players[slot];
    const idx = p.hand.findIndex((c) => c.uid === uid);
    if (idx === -1) return null;
    return p.hand.splice(idx, 1)[0];
  }

  // 佈置防禦區：用手牌 uid 列表設定（先把舊的退回墓地，再放新的）
  setDefense(slot, uids) {
    const p = this.players[slot];
    if (uids.length > DEFENSE_LIMIT) return { ok: false, error: `防禦區最多 ${DEFENSE_LIMIT} 張` };
    // 取出指定手牌
    const picked = [];
    for (const uid of uids) {
      const c = p.hand.find((x) => x.uid === uid);
      if (!c) return { ok: false, error: '指定的卡不在手牌中' };
      if (!(c.type === 'number' || c.type === 'angle' || c.type === 'symbol')) {
        return { ok: false, error: '防禦區僅能放數字卡與符號卡' };
      }
      picked.push(c);
    }
    // 舊防禦牌退回對應墓地
    for (const c of p.defense.cards) this.toGrave(slot, c);
    p.defense.cards = [];
    // 從手牌移除並放入防禦區
    for (const c of picked) { this.takeFromHand(slot, c.uid); p.defense.cards.push(c); }
    this.recomputeDefense(slot);
    return { ok: true };
  }

  // 重新計算防禦值
  recomputeDefense(slot) {
    const p = this.players[slot];
    if (p.defense.cards.length === 0) { p.defense.value = 0; return; }
    const r = calculate(p.defense.cards);
    let v = (r.ok && r.value > 0) ? r.value : 0;
    p.defense.value = Math.min(v, p.defense.maxValue);
    p.defense.invalid = !r.ok;
  }

  recordDamage(slot, dmg) {
    this.players[slot].damageHistory.push(dmg);
  }

  applyDamage(targetSlot, amount) {
    const p = this.players[targetSlot];
    p.hp = Math.max(0, p.hp - amount);
    if (p.hp <= 0 && !this.winner) this.declareWinner(this.opponentOf(targetSlot), 'HP 歸零');
  }

  declareWinner(slot, reason) {
    if (this.winner) return;
    this.winner = slot; this.winReason = reason;
    this.addLog(`遊戲結束：${slot} 勝（${reason}）`);
  }

  // 產生給某玩家看的狀態（隱藏對手手牌內容、牌庫內容；只露數量）
  viewFor(slot) {
    const opp = this.opponentOf(slot);
    const pub = (s) => {
      const p = this.players[s];
      return {
        character: p.character, hp: p.hp,
        numberDeckCount: p.numberDeck.length, skillDeckCount: p.skillDeck.length,
        numberGrave: p.numberGrave, skillGrave: p.skillGrave,
        defense: { cards: p.defense.cards, value: p.defense.value, maxValue: p.defense.maxValue },
        damageHistory: p.damageHistory,
        handCount: p.hand.length,
      };
    };
    return {
      roomId: this.roomId, phase: this.phase, turn: this.turn,
      currentPlayer: this.currentPlayer, youAre: slot,
      field: this.field, chain: this.chain.map((c) => ({ glyph: c.glyph, name: c.name })),
      log: this.log.slice(-30),
      winner: this.winner, winReason: this.winReason,
      you: { ...pub(slot), hand: this.players[slot].hand },
      opponent: pub(opp),
    };
  }
}
