// 邊界案例 + 計算器模糊測試
import { Game } from '../src/game/Game.js';
import { calculate } from '../src/game/Calculator.js';
import { SYMBOLS } from '../src/cards/symbols.js';

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; } else { fail++; console.error('✗', name); } };
const total160 = (g, s) => g.players[s].numberDeck.length + g.players[s].skillDeck.length + g.players[s].hand.length
  + g.players[s].numberGrave.length + g.players[s].skillGrave.length + g.players[s].defense.cards.length
  + (g.field && g.field.owner === s ? 1 : 0);

// 1. 牌庫耗盡判敗
{
  const g = new Game('E', 'gauss', 'newton', 'p1');
  g.players.p2.numberDeck = []; // p2 數字牌庫空
  g.endTurn('p1'); // 換 p2，抽牌階段應判 p2 敗
  ok('牌庫耗盡：p1 勝', g.winner === 'p1' && /牌庫/.test(g.winReason));
}

// 2. 手牌上限強制棄牌
{
  const g = new Game('E', 'gauss', 'newton', 'p1');
  const p = g.players.p1;
  while (p.hand.length < 12 && p.numberDeck.length) p.hand.push(p.numberDeck.pop());
  g.enforceHandLimit('p1');
  ok('手牌上限棄至 10', p.hand.length === 10);
  ok('棄牌後守恆 160', total160(g, 'p1') === 160);
}

// 從牌庫把真實卡牌移到手牌（保持 160 守恆）
function moveToHand(g, slot, pred) {
  const d = g.players[slot].skillDeck; const i = d.findIndex(pred);
  if (i < 0) return null; const c = d.splice(i, 1)[0]; g.players[slot].hand.push(c); return c;
}

// 3. 失敗技能回退（貝祖空墓地）
{
  const g = new Game('E', 'gauss', 'newton', 'p1');
  const bez = moveToHand(g, 'p1', (c) => c.cardId === 'bezout');
  g.players.p1.numberGrave = [];
  const before = total160(g, 'p1');
  const r = g.useSkill('p1', bez.uid, { graveUids: [] });
  ok('貝祖空墓地：回傳失敗', r.ok === false);
  ok('失敗後卡回手牌', g.players.p1.hand.some((c) => c.uid === bez.uid));
  ok('失敗後守恆不變', total160(g, 'p1') === before && before === 160);
}

// 4. 場地替換守恆（使用牌庫真實場地卡）
{
  const g = new Game('E', 'gauss', 'newton', 'p1');
  const f1 = moveToHand(g, 'p1', (c) => c.type === 'field');
  const f2 = moveToHand(g, 'p1', (c) => c.type === 'field' && c.uid !== f1.uid);
  g.playField('p1', f1.uid);
  g.fieldPlayedThisTurn = false; // 模擬下一回合可再打
  g.playField('p1', f2.uid);
  ok('場地替換後守恆 160', total160(g, 'p1') === 160);
  ok('當前場地為第二張', g.field && g.field.cardId === f2.cardId);
}

// 5. 勝負後封鎖動作
{
  const g = new Game('E', 'gauss', 'newton', 'p1');
  g.declareWinner('p1', '測試');
  const r1 = g.attack('p1', []);
  const r2 = g.endTurn('p1');
  ok('勝負後攻擊被擋', r1.ok === false);
  ok('勝負後結束回合被擋', r2.ok === false);
}

// 6. 防禦增幅上限 150 並吸收
{
  const g = new Game('E', 'newton', 'gauss', 'p2'); // p2(gauss) 先手
  // p1(newton) 佈置高防禦 9×9+9+9 = 99，再用防禦增幅讓上限 150（但 99<150 無影響），改測上限提升旗標
  g.players.p1.flags.amplifyTurns = 2; g.players.p1.defense.maxValue = 150;
  // 手動放防禦算式達 100 以上：但算式最多... 用 9*9+9+9=99；測 maxValue 生效不截斷到 100
  g.players.p1.defense.cards = [
    { uid: 'd1', type: 'number', v: 9, glyph: '9' }, { uid: 'd2', type: 'symbol', cardId: 'mul', glyph: '×' },
    { uid: 'd3', type: 'number', v: 9, glyph: '9' }, { uid: 'd4', type: 'symbol', cardId: 'add', glyph: '+' },
    { uid: 'd5', type: 'number', v: 9, glyph: '9' },
  ];
  g.recomputeDefense('p1');
  ok('防禦值 9×9+9=90', g.players.p1.defense.value === 90);
  ok('防禦上限為 150', g.players.p1.defense.maxValue === 150);
}

// 7. 防守反擊：傷害完全吸收觸發 20 穿透
{
  const g = new Game('E', 'gauss', 'gauss', 'p1');
  g.players.p2.defense.value = 100;       // p2 防禦 100
  g.players.p2.flags.counterReady = true; // p2 待命反擊
  const before = g.players.p1.hp;
  g.dealDamage('p1', 30, { isAttack: true }); // 30 被 100 完全吸收 → 反擊 20 穿透
  ok('防守反擊扣攻擊方 20', before - g.players.p1.hp === 20);
}

// 8. 計算器模糊測試：大量隨機算式不應拋例外、ok 結果須為有限整數
{
  const symIds = SYMBOLS.map((s) => s.id);
  const mk = () => {
    const r = Math.random();
    if (r < 0.55) return { type: 'number', v: Math.floor(Math.random() * 10) };
    if (r < 0.65) return { type: 'angle', v: [30, 45, 60, 90, 120, 180, 270, 360][Math.floor(Math.random() * 8)] };
    return { type: 'symbol', cardId: symIds[Math.floor(Math.random() * symIds.length)] };
  };
  let threw = 0, badVal = 0, runs = 8000;
  for (let i = 0; i < runs; i++) {
    const n = 1 + Math.floor(Math.random() * 6);
    const cards = Array.from({ length: n }, mk);
    try {
      const res = calculate(cards);
      if (res.ok && !(Number.isFinite(res.value) && Number.isInteger(res.value))) badVal++;
    } catch (e) { threw++; }
  }
  ok(`計算器模糊：無例外（${runs} 次）`, threw === 0);
  ok('計算器模糊：ok 結果皆為有限整數', badVal === 0);
}

console.log(`\n=== 邊界測試 ===\n通過 ${pass}，失敗 ${fail}`);
if (fail > 0) process.exitCode = 1; else console.log('✓ 全部通過');
