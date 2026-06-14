// 歐拉 + 希爾伯特 效果單元測試
import { Game } from '../src/game/Game.js';
import { runEffect } from '../src/game/EffectHandler.js';
const N = (v) => ({ uid: 'n' + Math.random().toString(36).slice(2), type: 'number', v, glyph: String(v), name: '數字' + v });
const SY = (id) => ({ uid: 's' + Math.random().toString(36).slice(2), type: 'symbol', cardId: id, name: id, glyph: id });
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) pass++; else { fail++; console.error('✗', n); } };

// 歐拉公式：e,i,π → 100 穿透；非複數場地扣 25HP
{
  const g = new Game('T', 'euler', 'hilbert', 'p1');
  const e = SY('const_e'), i = SY('const_i'), pi = SY('const_pi');
  g.players.p1.hand = [e, i, pi];
  const oppHp = g.players.p2.hp, myHp = g.players.p1.hp;
  runEffect('euler_formula', g, 'p1', {});
  ok('歐拉公式 100 穿透', oppHp - g.players.p2.hp === 100);
  ok('歐拉公式 非複數扣 25HP', myHp - g.players.p1.hp === 25);
  ok('歐拉公式 可再戰', g.battledThisTurn === false);
}
// 歐拉公式：複數平面免代價
{
  const g = new Game('T', 'euler', 'hilbert', 'p1');
  g.field = { cardId: 'complex_plane', name: '複數平面', owner: 'p1' };
  g.players.p1.hand = [SY('const_e'), SY('const_i'), SY('const_pi')];
  const myHp = g.players.p1.hp;
  runEffect('euler_formula', g, 'p1', {});
  ok('歐拉公式 複數場地免代價', myHp === g.players.p1.hp);
}
// 圖論握手：max(3,9)=9 (2張)
{
  const g = new Game('T', 'euler', 'hilbert', 'p1');
  const a = N(3), b = N(9); g.players.p1.hand = [a, b];
  const hp = g.players.p2.hp;
  runEffect('handshake', g, 'p1', { uids: [a.uid, b.uid] });
  ok('握手定理 max(3,9)=9', hp - g.players.p2.hp === 9);
}
// 傅立葉：含 sin 攻擊 +20
{
  const g = new Game('T', 'euler', 'hilbert', 'p1');
  g.players.p1.flags.fourier = 2;
  const s = SY('sin'), a = { uid: 'a90', type: 'angle', v: 90, glyph: '90°' };
  g.players.p1.hand = [s, a]; // sin 90 = 50, +20 = 70
  const hp = g.players.p2.hp;
  g.attack('p1', [s.uid, a.uid]);
  ok('傅立葉 sin90(50)+20=70', hp - g.players.p2.hp === 70);
}
// 費波那契跨回合 +5/+5/+10
{
  const g = new Game('T', 'euler', 'hilbert', 'p1');
  runEffect('fibonacci', g, 'p1', {});
  ok('費波那契 step0', g.players.p1.flags.fibonacci.step === 0);
  g.endTurn('p1'); g.endTurn('p2');
  ok('費波那契 step1', g.players.p1.flags.fibonacci.step === 1);
}
// 特徵值：+25；矩陣空間 +40
{
  const g = new Game('T', 'hilbert', 'euler', 'p1');
  g.players.p1.flags.eigenvalue = true;
  const a = N(3), m = SY('mul'), b = N(4); g.players.p1.hand = [a, m, b]; // 12 + 25 = 37
  const hp = g.players.p2.hp;
  g.attack('p1', [a.uid, m.uid, b.uid]);
  ok('特徵值 12+25=37', hp - g.players.p2.hp === 37);
}
// 行列式：手牌 a=3,b=4，墓地 c=1,d=5 → |3*5-4*1|=11
{
  const g = new Game('T', 'hilbert', 'euler', 'p1');
  const a = N(3), b = N(4); g.players.p1.hand = [a, b];
  const c = N(1), d = N(5); g.players.p1.numberGrave = [c, d];
  const hp = g.players.p2.hp;
  runEffect('determinant', g, 'p1', { uids: [a.uid, b.uid], graveUids: [c.uid, d.uid] });
  ok('行列式 |3*5-4*1|=11', hp - g.players.p2.hp === 11);
}
// 伽羅瓦：棄全手牌抽 6 技能
{
  const g = new Game('T', 'hilbert', 'euler', 'p1');
  g.players.p1.hand = [N(1), N(2), N(3)];
  runEffect('galois', g, 'p1', {});
  ok('伽羅瓦 手牌變 6 張', g.players.p1.hand.length === 6);
  ok('伽羅瓦 全為技能卡', g.players.p1.hand.every((c) => ['formula', 'signature', 'field'].includes(c.type)));
}
// 克拉瑪：棄 3 取 3
{
  const g = new Game('T', 'hilbert', 'euler', 'p1');
  const d1 = N(1), d2 = N(2), d3 = N(3); g.players.p1.hand = [d1, d2, d3];
  const before = g.players.p1.skillDeck.length;
  runEffect('cramer', g, 'p1', { discardUids: [d1.uid, d2.uid, d3.uid] });
  ok('克拉瑪 手牌 3 張(換得技能)', g.players.p1.hand.length === 3);
  ok('克拉瑪 技能牌庫 -3', g.players.p1.skillDeck.length === before - 3);
}
// 康托爾：取消對手抽牌
{
  const g = new Game('T', 'hilbert', 'euler', 'p1'); // p1 先手
  g.players.p1.flags.cantorArmed = true; // p1 待命
  const p2HandBefore = g.players.p2.hand.length;
  const p1SkillBefore = g.players.p1.skillDeck.length;
  g.endTurn('p1'); // 換 p2 抽牌 → 被取消
  ok('康托爾 對手手牌未增加', g.players.p2.hand.length === p2HandBefore);
  ok('康托爾 自己抽 2 技能', g.players.p1.skillDeck.length === p1SkillBefore - 2);
}
// 無矛盾性：+30 並焚燒對手 8 張
{
  const g = new Game('T', 'hilbert', 'euler', 'p1');
  const oppSkillBefore = g.players.p2.skillDeck.length;
  runEffect('sig_consistency', g, 'p1', {});
  ok('無矛盾性 焚燒對手 8 張', g.players.p2.skillDeck.length === oppSkillBefore - 8);
  const a = N(2), m = SY('mul'), b = N(3); g.players.p1.hand = [a, m, b]; // 6 + 30 = 36
  const hp = g.players.p2.hp;
  g.attack('p1', [a.uid, m.uid, b.uid]);
  ok('無矛盾性 攻擊 6+30=36', hp - g.players.p2.hp === 36);
}
// 遍歷引理：棄 2 取 3 技能 + 抽 2 數字 + 公式上限 +1
{
  const g = new Game('T', 'euler', 'hilbert', 'p1');
  const d1 = N(1), d2 = N(2); g.players.p1.hand = [d1, d2];
  runEffect('sig_euler_tour', g, 'p1', { discardUids: [d1.uid, d2.uid] });
  ok('遍歷引理 公式上限 +1', g.formulaBonusThisTurn === 1);
  ok('遍歷引理 手牌 5 張(3技能+2數字)', g.players.p1.hand.length === 5);
}

console.log(`\n=== 歐拉+希爾伯特測試 ===\n通過 ${pass}，失敗 ${fail}`);
if (fail > 0) process.exitCode = 1; else console.log('✓ 全部通過');
