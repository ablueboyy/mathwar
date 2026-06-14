// 隨機對戰模擬器 + 不變式驗證
// 用法：node test/simulate.mjs [遊戲場數]
import { Game } from '../src/game/Game.js';
import { READY_CHARACTERS } from '../src/cards/characters.js';

const CHARS = [...READY_CHARACTERS];
const GAMES = parseInt(process.argv[2] || '600', 10);
const TURN_CAP = 400;

let violations = [];
function fail(msg, ctx) { violations.push(`${msg} | ${ctx}`); if (violations.length <= 20) console.error('✗', msg, '|', ctx); }

// 每位玩家在所有區域的卡牌總數應恆為 160（場上場地卡歸其擁有者計 1）
function checkInvariants(game, where) {
  for (const slot of ['p1', 'p2']) {
    const p = game.players[slot];
    const ctx = `${where} ${slot} t${game.turn}`;
    if (!(p.hp >= 0 && p.hp <= 500)) fail(`HP 越界 ${p.hp}`, ctx);
    if (p.hand.length > 10) fail(`手牌超過 10 (${p.hand.length})`, ctx);
    if (p.defense.cards.length > 5) fail(`防禦區超過 5 (${p.defense.cards.length})`, ctx);
    if (p.numberDeck.length < 0 || p.skillDeck.length < 0) fail('牌庫負數', ctx);
    if (p.defense.value > p.defense.maxValue) fail(`防禦值超過上限 ${p.defense.value}/${p.defense.maxValue}`, ctx);
    const fieldOwned = game.field && game.field.owner === slot ? 1 : 0;
    const total = p.numberDeck.length + p.skillDeck.length + p.hand.length
      + p.numberGrave.length + p.skillGrave.length + p.defense.cards.length + fieldOwned;
    if (total !== 160) fail(`卡牌守恆破壞 total=${total}`, ctx);
    const uids = [...p.numberDeck, ...p.skillDeck, ...p.hand, ...p.numberGrave, ...p.skillGrave, ...p.defense.cards]
      .filter((c) => c && c.uid).map((c) => c.uid);
    if (new Set(uids).size !== uids.length) fail('uid 重複', ctx);
  }
}

const rnd = (n) => Math.floor(Math.random() * n);
const pickUids = (arr, n) => arr.slice(0, n).map((c) => c.uid);

function genPayload(game, slot, card) {
  const p = game.players[slot];
  const opp = game.players[game.opponentOf(slot)];
  const nums = p.hand.filter((c) => (c.type === 'number' || c.type === 'angle') && c.uid !== card.uid);
  const plainNums = p.hand.filter((c) => c.type === 'number' && c.uid !== card.uid);
  const angles = p.hand.filter((c) => c.type === 'angle' && c.uid !== card.uid);
  const handOther = p.hand.filter((c) => c.uid !== card.uid);
  switch (card.cardId) {
    case 'pythagoras': case 'amgm': case 'sig_euclidean_algo': case 'sig_fluxion':
    case 'sig_gauss_integer': return { uids: pickUids(nums, 2) };
    case 'sig_gauss_sum': case 'sig_riemann_integral': case 'euler_polyhedron': return { uids: pickUids(plainNums, 3) };
    case 'sig_konigsberg': return { uids: pickUids(nums, 1) };
    case 'law_cosines': return { uids: [...pickUids(plainNums, 2), ...pickUids(angles, 1)] };
    case 'law_sines': return { uids: [...pickUids(angles, 2), ...pickUids(plainNums, 1)] };
    case 'sig_spiral': return { uids: [...pickUids(plainNums, 1), ...pickUids(angles, 1)] };
    case 'permcomb': return { n: 5, k: 2 };
    case 'ivt': return { c: 30 };
    case 'bezout': return { graveUids: pickUids(p.numberGrave, 2) };
    case 'sig_elementae': return { discardUids: pickUids(handOther, 2), graveUids: pickUids(p.skillGrave.filter((c) => c.type === 'formula'), 2) };
    case 'sig_exhaustion': return { T: 25 + rnd(56), n: 1 + rnd(5) };
    case 'sig_23_problems': return { N: 1 + rnd(23), discardUid: handOther[0] && handOther[0].uid };
    case 'fermat_little': return { aUid: nums[0] && nums[0].uid, p: [2, 3, 5, 7][rnd(4)], discardUids: pickUids(handOther.filter((c) => !nums[0] || c.uid !== nums[0].uid), 2) };
    case 'sig_principia': return { discardUids: pickUids(handOther, 2) };
    case 'def_collapse': return { discardUid: handOther[0] && handOther[0].uid };
    case 'def_deconstruct': return { uids: pickUids(opp.defense.cards, 2) };
    case 'def_tamper': { const t = opp.defense.cards.find((c) => c.type === 'number' || c.type === 'angle'); return { uid: t && t.uid }; }
    default: return {};
  }
}

function botAttack(game, slot) {
  if (game.winner || game.battledThisTurn) return;
  const p = game.players[slot];
  const nums = p.hand.filter((c) => c.type === 'number');
  const ops = p.hand.filter((c) => c.type === 'symbol' && ['add', 'sub', 'mul'].includes(c.cardId));
  const pre = ['sqrt', 'abs', 'floor', 'ceil', 'sin', 'cos'].map((id) => p.hand.find((c) => c.cardId === id)).filter(Boolean);
  // 嘗試 [n op n]
  if (nums.length >= 2 && ops.length >= 1) { if (game.attack(slot, [nums[0].uid, ops[0].uid, nums[1].uid]).ok) return; }
  // 嘗試前綴函式 [pre n]
  if (pre.length && nums.length) { if (game.attack(slot, [pre[0].uid, nums[0].uid]).ok) return; }
  // 嘗試單一正數
  const pos = nums.find((c) => c.v > 0); if (pos) game.attack(slot, [pos.uid]);
}

function botTurn(game, slot) {
  if (game.winner) return;
  // 佈置防禦（30%）
  if (Math.random() < 0.3) {
    const p = game.players[slot];
    const cards = p.hand.filter((c) => c.type === 'number' || c.type === 'symbol').slice(0, 1 + rnd(3));
    if (cards.length) game.setDefense(slot, cards.map((c) => c.uid));
    checkInvariants(game, 'after setDefense');
  }
  // 使用技能（70%）
  if (!game.winner && Math.random() < 0.7) {
    const p = game.players[slot];
    const skills = p.hand.filter((c) => ['formula', 'signature', 'field'].includes(c.type));
    if (skills.length) {
      const card = skills[rnd(skills.length)];
      if (card.type === 'field') game.playField(slot, card.uid, 5);
      else game.useSkill(slot, card.uid, genPayload(game, slot, card));
      checkInvariants(game, 'after useSkill');
    }
  }
  // 攻擊
  if (!game.winner) { botAttack(game, slot); checkInvariants(game, 'after attack'); }
  // 結束回合
  if (!game.winner) { game.endTurn(slot); checkInvariants(game, 'after endTurn'); }
}

const outcomes = { hp: 0, deck: 0, cap: 0, crash: 0 };
for (let g = 0; g < GAMES; g++) {
  const c1 = CHARS[rnd(CHARS.length)], c2 = CHARS[rnd(CHARS.length)];
  const game = new Game(`SIM${g}`, c1, c2, Math.random() < 0.5 ? 'p1' : 'p2');
  try {
    checkInvariants(game, 'init');
    let guard = 0;
    while (!game.winner && game.turn < TURN_CAP && guard < 2000) {
      botTurn(game, game.currentPlayer);
      guard++;
    }
    if (game.winner) outcomes[game.winReason && game.winReason.includes('牌庫') ? 'deck' : 'hp']++;
    else outcomes.cap++;
  } catch (e) {
    outcomes.crash++;
    if (outcomes.crash <= 10) console.error(`✗ 例外 (${c1} vs ${c2}):`, e.message, '\n', e.stack.split('\n').slice(1, 3).join('\n'));
  }
}

console.log('\n=== 模擬結果 ===');
console.log(`場數: ${GAMES}`);
console.log(`勝負分布: HP歸零=${outcomes.hp}, 牌庫耗盡=${outcomes.deck}, 達回合上限=${outcomes.cap}, 例外=${outcomes.crash}`);
console.log(`不變式違反: ${violations.length}`);
if (violations.length === 0 && outcomes.crash === 0) console.log('✓ 全部通過');
else process.exitCode = 1;
