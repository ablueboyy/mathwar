// 完整遊戲狀態：牌庫、手牌、防禦區、HP、傷害記錄
import { buildNumberDeck, buildOperatorDeck, buildSkillDeck } from '../cards/index.js';
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
  const operatorDeck = shuffle(buildOperatorDeck(characterId));
  const skillDeck = shuffle(buildSkillDeck(characterId));   // = formulaDeck 內部仍沿用 skillDeck 欄位名
  // 起始手牌：數字 4 + 運算子 2 + 公式/場地 1
  const hand = [];
  for (let i = 0; i < 4; i++) hand.push(numberDeck.pop());
  for (let i = 0; i < 2 && operatorDeck.length; i++) hand.push(operatorDeck.pop());
  for (let i = 0; i < 1 && skillDeck.length; i++) hand.push(skillDeck.pop());
  return {
    slot, character: characterId, hp: START_HP,
    numberDeck, operatorDeck, skillDeck,
    numberGrave: [], operatorGrave: [], skillGrave: [],
    hand,
    defense: { cards: [], value: 0, durability: 0, maxValue: 100, baseMax: 100 },
    damageHistory: [],
    flags: {},
    skillDrawDone: false,
  };
}

export class GameState {
  constructor(roomId, p1Char, p2Char, firstPlayer = 'p1') {
    this.roomId = roomId;
    this.phase = 'main';
    this.turn = 1;
    this.currentPlayer = firstPlayer;
    this.players = { p1: newPlayer('p1', p1Char), p2: newPlayer('p2', p2Char) };
    this.field = null;
    this.chain = [];
    this.log = [];
    this.winner = null;
    this.winReason = null;
    this.battledThisTurn = false;
  }

  opponentOf(slot) { return slot === 'p1' ? 'p2' : 'p1'; }

  addLog(text) {
    this.log.push({ turn: this.turn, text });
    if (this.log.length > 200) this.log.shift();
  }

  // 回合開始自動抽牌：只抽 2 張數字；技能抽牌選擇由玩家手動觸發
  drawForTurn(slot, nNum = 2) {
    const p = this.players[slot];
    if (p.numberDeck.length === 0) {
      this.declareWinner(this.opponentOf(slot), '對手數字牌庫耗盡');
      return [];
    }
    // 康托爾對角論證：對手待命中 → 取消本次抽牌，改由對手抽 2 張公式卡
    const opp = this.opponentOf(slot);
    if (this.players[opp].flags.cantorArmed) {
      this.players[opp].flags.cantorArmed = false;
      this.drawSkills(opp, 2);
      this.addLog(`${opp} 康托爾對角論證：取消 ${slot} 本回合抽牌，改抽 2 張公式卡`);
      p.skillDrawDone = true; // 抽牌被取消，技能抽牌選擇也跳過
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
    p.skillDrawDone = false;
    this.enforceHandLimit(slot);
    return drawn;
  }

  drawNumbers(slot, n) {
    const p = this.players[slot]; const drawn = [];
    for (let i = 0; i < n && p.numberDeck.length; i++) { const c = p.numberDeck.pop(); p.hand.push(c); drawn.push(c); }
    this.enforceHandLimit(slot); return drawn;
  }

  // 從公式/場地牌庫抽牌（內部沿用 skillDeck）
  drawSkills(slot, n) {
    const p = this.players[slot]; const drawn = [];
    for (let i = 0; i < n && p.skillDeck.length; i++) { const c = p.skillDeck.pop(); p.hand.push(c); drawn.push(c); }
    this.enforceHandLimit(slot); return drawn;
  }

  // 從運算子牌庫抽牌
  drawOperators(slot, n) {
    const p = this.players[slot]; const drawn = [];
    for (let i = 0; i < n && p.operatorDeck.length; i++) { const c = p.operatorDeck.pop(); p.hand.push(c); drawn.push(c); }
    this.enforceHandLimit(slot); return drawn;
  }

  // 玩家主動選擇本回合技能抽牌（1 張，只能選一次）
  drawSkillChoice(slot, deckType = 'formula') {
    if (slot !== this.currentPlayer) return { ok: false, error: '尚未輪到你' };
    const p = this.players[slot];
    if (p.skillDrawDone) return { ok: false, error: '本回合已選擇過技能抽牌' };
    if (deckType === 'operator') {
      if (p.operatorDeck.length === 0) return { ok: false, error: '運算子牌庫已空' };
      const c = p.operatorDeck.pop(); p.hand.push(c);
      this.addLog(`${slot} 從運算子牌庫抽了 1 張`);
    } else {
      if (p.skillDeck.length === 0) return { ok: false, error: '公式/場地牌庫已空' };
      const c = p.skillDeck.pop(); p.hand.push(c);
      this.addLog(`${slot} 從公式/場地牌庫抽了 1 張`);
    }
    p.skillDrawDone = true;
    this.enforceHandLimit(slot);
    return { ok: true };
  }

  enforceHandLimit(slot) {
    const p = this.players[slot];
    while (p.hand.length > HAND_LIMIT) { const c = p.hand.shift(); this.toGrave(slot, c); }
  }

  // 將卡牌依類型送入對應墓地
  toGrave(slot, card) {
    const p = this.players[slot];
    if (card.type === 'number' || card.type === 'angle') p.numberGrave.push(card);
    else if (card.type === 'symbol') p.operatorGrave.push(card);
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
    const picked = [];
    for (const uid of uids) {
      const c = p.hand.find((x) => x.uid === uid);
      if (!c) return { ok: false, error: '指定的卡不在手牌中' };
      if (!(c.type === 'number' || c.type === 'angle' || c.type === 'symbol')) {
        return { ok: false, error: '防禦區僅能放數字卡與符號卡' };
      }
      picked.push(c);
    }
    for (const c of p.defense.cards) this.toGrave(slot, c);
    p.defense.cards = [];
    for (const c of picked) { this.takeFromHand(slot, c.uid); p.defense.cards.push(c); }
    this.recomputeDefense(slot, true); // resetDurability = true：重新建立防禦時重置耐久
    return { ok: true };
  }

  // 重新計算防禦值；resetDurability=true 時將耐久值重置為當前防禦值（初建或重建防禦時）
  recomputeDefense(slot, resetDurability = false) {
    const p = this.players[slot];
    if (p.defense.cards.length === 0) {
      p.defense.value = 0;
      p.defense.durability = 0;
      return;
    }
    const r = calculate(p.defense.cards);
    let v = (r.ok && r.value > 0) ? r.value : 0;
    p.defense.value = Math.min(v, p.defense.maxValue);
    p.defense.invalid = !r.ok;
    if (resetDurability) {
      p.defense.durability = p.defense.value;
    } else {
      // 防禦值下降時，耐久不可超過新的防禦值
      p.defense.durability = Math.min(p.defense.durability, p.defense.value);
    }
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
        numberDeckCount: p.numberDeck.length,
        operatorDeckCount: p.operatorDeck.length,
        formulaDeckCount: p.skillDeck.length,
        numberGrave: p.numberGrave, skillGrave: p.skillGrave, operatorGrave: p.operatorGrave,
        defense: {
          cards: p.defense.cards, value: p.defense.value,
          durability: p.defense.durability, maxValue: p.defense.maxValue,
        },
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
      you: { ...pub(slot), hand: this.players[slot].hand, skillDrawDone: this.players[slot].skillDrawDone },
      opponent: pub(opp),
    };
  }
}
