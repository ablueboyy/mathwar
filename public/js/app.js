/* MathWar 前端主程式（單頁：大廳 + 對戰） */
const socket = io();

let selectedChar = null;
let myRoom = null;
let mySlot = null;
let lastState = null;
let CARD_INFO = {};            // cardId -> { name, desc, timing, ... }

let attackSel = [];            // 算式區草稿（手牌 uid，有序）
let defenseSel = [];           // 防禦區草稿（手牌 uid，有序）
let oppDraft = { attack: 0, defense: 0 }; // 對手正在佈置的算式/防禦張數（以牌背顯示）

// 把我目前的算式/防禦草稿張數告知對手（顯示牌背用）
function emitDraft() { socket.emit('draft', { attack: attackSel.length, defense: defenseSel.length }); }
function isMyTurn() { return !!(lastState && lastState.currentPlayer === lastState.youAre && !lastState.winner); }

const $ = (id) => document.getElementById(id);
function toast(msg, danger = true) {
  const t = $('toast');
  t.textContent = msg;
  t.style.background = danger ? 'var(--danger)' : 'var(--accent)';
  t.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add('hidden'), 2600);
}

/* ───── tooltip ───── */
const tip = $('tooltip');
function infoFor(card) {
  if (card.type === 'number') return { name: card.name, desc: '數字卡：數值 ' + card.v + '。不可串接，兩個數值之間必須有運算子。' };
  if (card.type === 'angle') return { name: card.name, desc: '角度卡：作三角函數輸入時為 ' + card.v + '°；作一般數值時為 ' + card.v + '÷10 = ' + (card.v / 10) + '。' };
  return CARD_INFO[card.cardId] || { name: card.name, desc: '' };
}
const TIMING_TXT = { instant: '⚡速效', persistent: '🔁持續', cost: '💀代價', main: '主要階段' };
function showTooltip(card, x, y) {
  const info = infoFor(card);
  let meta = '';
  const t = CARD_INFO[card.cardId]?.timing || card.timing;
  if (t && TIMING_TXT[t]) meta += TIMING_TXT[t];
  if (CARD_INFO[card.cardId]?.owner) meta += '（簽名卡）';
  tip.innerHTML = `<span class="tt-name">${info.name}</span>${info.desc || ''}` + (meta ? `<div class="tt-meta">${meta}</div>` : '');
  positionTooltip(x, y);
  tip.classList.remove('hidden');
}
function showFieldTooltip(x, y) {
  if (!lastState?.field) return;
  const info = CARD_INFO[lastState.field.cardId];
  if (!info) return;
  tip.innerHTML = `<span class="tt-name">場地：${info.name}</span>${info.desc || ''}`;
  positionTooltip(x, y); tip.classList.remove('hidden');
}
function positionTooltip(x, y) {
  tip.style.left = '0px'; tip.style.top = '0px';
  const w = 260, h = tip.offsetHeight || 120;
  let nx = x + 14, ny = y + 14;
  if (nx + w > window.innerWidth) nx = x - w - 14;
  if (ny + h > window.innerHeight) ny = y - h - 14;
  tip.style.left = Math.max(4, nx) + 'px';
  tip.style.top = Math.max(4, ny) + 'px';
}
function hideTooltip() { tip.classList.add('hidden'); }

/* ───── 大廳 ───── */
async function loadCharacters() {
  const [chars, cards] = await Promise.all([
    fetch('/api/characters').then((r) => r.json()),
    fetch('/api/cards').then((r) => r.json()),
  ]);
  CARD_INFO = cards;
  const grid = $('character-grid');
  grid.innerHTML = '';
  for (const c of chars) {
    const el = document.createElement('div');
    el.className = 'char-card' + (c.ready ? '' : ' locked');
    el.innerHTML = `<div class="cname">${c.name}</div><div class="cen">${c.en}</div>
      <div class="cera">${c.era}</div><div class="cstyle">${c.style}</div>`
      + (c.ready ? '' : '<div class="lock-badge">尚未開放</div>');
    if (c.ready) {
      el.onclick = () => {
        selectedChar = c.id;
        document.querySelectorAll('.char-card').forEach((x) => x.classList.remove('selected'));
        el.classList.add('selected');
      };
    } else {
      el.onclick = () => toast('此角色尚未開放，敬請期待');
    }
    grid.appendChild(el);
  }
}

$('btn-create').onclick = () => {
  if (!selectedChar) return toast('請先選擇一位數學家');
  socket.emit('create_room', { character: selectedChar });
};
$('btn-join').onclick = () => {
  if (!selectedChar) return toast('請先選擇一位數學家');
  const roomId = $('room-input').value.trim().toUpperCase();
  if (roomId.length !== 4) return toast('請輸入 4 碼房間號碼');
  socket.emit('join_room', { roomId, character: selectedChar });
};

socket.on('room_created', ({ roomId, slot }) => {
  myRoom = roomId; mySlot = slot;
  $('lobby-status').textContent = `房間已建立！房號：${roomId}　等待對手加入…`;
});
socket.on('room_joined', ({ roomId, slot }) => { myRoom = roomId; mySlot = slot; });
socket.on('room_error', ({ error }) => toast(error));
socket.on('action_error', ({ error }) => toast(error));
socket.on('action_note', ({ note }) => toast(note, false));
socket.on('opponent_disconnected', () => toast('對手已離線', true));

socket.on('game_start', ({ youAre }) => {
  mySlot = youAre;
  $('lobby').classList.add('hidden');
  $('game').classList.remove('hidden');
});

socket.on('game_over', ({ winner, reason, youAre }) => {
  const win = winner === youAre;
  toast(`${win ? '🎉 你獲勝了！' : '💀 你落敗了'}（${reason}）`, !win);
});

socket.on('attack_preview', (r) => {
  $('preview').textContent = r.ok ? `算式結果：${r.value}` : `（${r.error}）`;
});

// ───── 動作動畫：出招/用卡瞬間雙方都看到實際發生什麼 ─────
const EV_ICON = { attack: '⚔️', skill: '✨', field: '🌐', defense: '🛡️' };
function showEvent(ev) {
  const mine = ev.actor === ev.youAre;
  const who = mine ? '你' : '對手';
  const name = charName(ev.actorChar);
  let title = '', sub = '';
  if (ev.kind === 'attack') { title = `${who}（${name}）算式攻擊`; sub = ev.expr || ''; }
  else if (ev.kind === 'skill') { title = `${who}（${name}）使用技能`; sub = ev.card || ''; }
  else if (ev.kind === 'field') { title = `${who}（${name}）發動場地`; sub = ev.card || ''; }
  else if (ev.kind === 'defense') { title = `${who}（${name}）佈置防禦`; sub = ''; }

  const dmgToMe = ev.dmg[ev.youAre] || 0;
  const dmgToOpp = ev.dmg[ev.youAre === 'p1' ? 'p2' : 'p1'] || 0;
  if (ev.kind === 'attack' && dmgToMe <= 0 && dmgToOpp <= 0) sub += '（被防禦吸收）';

  const ov = $('event-overlay');
  ov.classList.toggle('opp', !mine);
  $('ev-icon').textContent = EV_ICON[ev.kind] || '✨';
  $('ev-title').textContent = title;
  $('ev-sub').textContent = sub;
  ov.classList.remove('hidden', 'show');
  void ov.offsetWidth;        // 重啟動畫
  ov.classList.add('show');
  clearTimeout(showEvent._t);
  showEvent._t = setTimeout(() => ov.classList.add('hidden'), 1900);

  // 受擊：HP 條抖動 + 浮動傷害數字（HP 減少的一方）
  if (dmgToMe > 0) hitBar('my-hp-fill', 'my-hp-bar', dmgToMe);
  if (dmgToOpp > 0) hitBar('opp-hp-fill', 'opp-hp-bar', dmgToOpp);
}
function hitBar(fillId, barId, amount) {
  const bar = document.getElementById(barId);
  if (!bar) return;
  bar.classList.remove('hit'); void bar.offsetWidth; bar.classList.add('hit');
  const f = document.createElement('div'); f.className = 'dmg-float'; f.textContent = '-' + amount;
  bar.appendChild(f);
  setTimeout(() => f.remove(), 1300);
}
socket.on('action_event', showEvent);

socket.on('state', (st) => {
  lastState = st;
  oppDraft = { attack: 0, defense: 0 }; // 任何正式狀態更新都清除對手佈置中的牌背
  const handUids = new Set(st.you.hand.map((c) => c.uid));
  attackSel = attackSel.filter((u) => handUids.has(u));
  defenseSel = defenseSel.filter((u) => handUids.has(u));
  // 非我方回合時清空自己的草稿（不能操作）
  if (st.currentPlayer !== st.youAre) { attackSel = []; defenseSel = []; }
  render(st);
});

// 對手佈置算式/防禦中：顯示對應張數的牌背
socket.on('opponent_draft', ({ attack = 0, defense = 0 }) => {
  oppDraft = { attack: Math.max(0, Math.min(6, attack | 0)), defense: Math.max(0, Math.min(5, defense | 0)) };
  if (lastState) render(lastState);
});

function hpPercent(hp) { return Math.max(0, Math.min(100, (hp / 500) * 100)); }
function charName(id) {
  const map = { euclid: '歐幾里得', archimedes: '阿基米德', newton: '牛頓', euler: '歐拉', gauss: '高斯', riemann: '黎曼', poincare: '龐加萊', hilbert: '希爾伯特' };
  return map[id] || id;
}

function cardEl(card, onClick, selected = false, opts = {}) {
  const el = document.createElement('div');
  el.className = `card ${card.type}` + (selected ? ' selected' : '') + (opts.pending ? ' selected' : '');
  el.innerHTML = `<span class="glyph">${card.glyph}</span><span class="label">${card.name}</span>`;
  if (onClick) el.onclick = () => onClick(card);
  // tooltip
  el.addEventListener('mouseenter', (e) => showTooltip(card, e.clientX, e.clientY));
  el.addEventListener('mousemove', (e) => positionTooltip(e.clientX, e.clientY));
  el.addEventListener('mouseleave', hideTooltip);
  // 拖曳：僅數字/角度/符號卡可拖入算式區或防禦區
  if (opts.draggable && (card.type === 'number' || card.type === 'angle' || card.type === 'symbol')) {
    el.draggable = true;
    el.addEventListener('dragstart', (ev) => {
      ev.dataTransfer.setData('text/plain', card.uid);
      ev.dataTransfer.effectAllowed = 'copy';
      el.classList.add('dragging'); hideTooltip();
    });
    el.addEventListener('dragend', () => el.classList.remove('dragging'));
  }
  return el;
}

function cardBackEl() {
  const el = document.createElement('div');
  el.className = 'card back';
  el.innerHTML = '<span class="glyph">?</span><span class="label">未公開</span>';
  el.addEventListener('mouseenter', (e) => { tip.innerHTML = '<span class="tt-name">對手佈置中</span>對手正在佈置防禦，確認前不公開內容。'; positionTooltip(e.clientX, e.clientY); tip.classList.remove('hidden'); });
  el.addEventListener('mousemove', (e) => positionTooltip(e.clientX, e.clientY));
  el.addEventListener('mouseleave', hideTooltip);
  return el;
}

function render(st) {
  const myTurn = st.currentPlayer === st.youAre && !st.winner;

  // 對手
  $('opp-name').textContent = charName(st.opponent.character);
  $('opp-hp-fill').style.width = hpPercent(st.opponent.hp) + '%';
  $('opp-hp-text').textContent = `${st.opponent.hp}/500`;
  $('opp-numdeck').textContent = st.opponent.numberDeckCount;
  $('opp-skilldeck').textContent = st.opponent.skillDeckCount;
  $('opp-numgrave').textContent = st.opponent.numberGrave.length;
  $('opp-skillgrave').textContent = st.opponent.skillGrave.length;
  $('opp-hand').textContent = st.opponent.handCount;
  $('opp-defval').textContent = st.opponent.defense.value;
  const oppDef = $('opp-defense'); oppDef.innerHTML = '';
  st.opponent.defense.cards.forEach((c) => oppDef.appendChild(cardEl(c, null)));
  // 對手正在佈置的防禦牌（未公開，以牌背呈現）
  if (oppDraft.defense > 0) {
    const sep = document.createElement('span'); sep.className = 'zone-label'; sep.textContent = '｜佈置中：';
    oppDef.appendChild(sep);
    for (let i = 0; i < oppDraft.defense; i++) oppDef.appendChild(cardBackEl());
  }

  // 場地 / 回合
  $('field-text').textContent = '場地：' + (st.field ? `${st.field.name}（${st.field.owner === st.youAre ? '我方' : '對手'}）` : '無') + (st.field ? '　🛈 懸停查看效果' : '');
  $('turn-text').textContent = (st.winner ? '遊戲結束' : (myTurn ? '🟢 你的回合' : '⏳ 對手回合')) + `　第 ${st.turn} 回合`;

  // 我方
  $('my-name').textContent = charName(st.you.character);
  $('my-hp-fill').style.width = hpPercent(st.you.hp) + '%';
  $('my-hp-text').textContent = `${st.you.hp}/500`;
  $('my-numdeck').textContent = st.you.numberDeckCount;
  $('my-skilldeck').textContent = st.you.skillDeckCount;
  $('my-numgrave').textContent = st.you.numberGrave.length;
  $('my-skillgrave').textContent = st.you.skillGrave.length;
  $('my-defval').textContent = st.you.defense.value;

  // 我方防禦區：已佈置的牌 + 草稿（pending）
  const myDef = $('my-defense'); myDef.innerHTML = '';
  st.you.defense.cards.forEach((c) => myDef.appendChild(cardEl(c, null)));
  const handMap = Object.fromEntries(st.you.hand.map((c) => [c.uid, c]));
  if (defenseSel.length) {
    const sep = document.createElement('span'); sep.className = 'zone-label'; sep.textContent = '｜待確認：';
    myDef.appendChild(sep);
    defenseSel.forEach((uid) => { const c = handMap[uid]; if (c) myDef.appendChild(cardEl(c, () => { defenseSel = defenseSel.filter((u) => u !== uid); emitDraft(); render(lastState); }, false, { pending: true })); });
  }

  // 手牌
  const hand = $('my-hand'); hand.innerHTML = '';
  st.you.hand.forEach((c) => {
    const isSel = attackSel.includes(c.uid) || defenseSel.includes(c.uid);
    hand.appendChild(cardEl(c, onHandCardClick, isSel, { draggable: true }));
  });

  // 算式區草稿
  const row = $('selection-row'); row.innerHTML = '';
  const wt = $('work-title');
  if (!myTurn) {
    // 對手回合：顯示對手算式佈置中的牌背
    if (wt) wt.textContent = '⚔️ 算式區（對手回合，僅能查看卡片效果）';
    if (oppDraft.attack > 0) for (let i = 0; i < oppDraft.attack; i++) row.appendChild(cardBackEl());
    $('preview').textContent = '';
  } else {
    if (wt) wt.textContent = '⚔️ 算式區（點擊或拖曳手牌至此）';
    attackSel.forEach((uid) => { const c = handMap[uid]; if (c) row.appendChild(cardEl(c, () => { attackSel = attackSel.filter((u) => u !== uid); emitDraft(); render(lastState); }, true)); });
    if (attackSel.length) socket.emit('attack_preview', { uids: attackSel });
    else $('preview').textContent = '';
  }

  // 行動記錄
  const log = $('log'); log.innerHTML = '';
  (st.log || []).forEach((e) => { const d = document.createElement('div'); d.textContent = `[第${e.turn}回合] ${e.text}`; log.appendChild(d); });

  $('game').classList.toggle('not-your-turn', !myTurn);
}

function onHandCardClick(card) {
  if (!isMyTurn()) return toast('尚未輪到你，僅能查看卡片效果');
  if (card.type === 'number' || card.type === 'angle' || card.type === 'symbol') {
    if (attackSel.includes(card.uid)) attackSel = attackSel.filter((u) => u !== card.uid);
    else { attackSel.push(card.uid); defenseSel = defenseSel.filter((u) => u !== card.uid); }
    emitDraft();
    render(lastState);
  } else {
    useSkillFlow(card);
  }
}

/* ───── 技能發動流程 ───── */
const NEEDS_SELECTION = new Set([
  'sig_euclidean_algo', 'sig_spiral', 'sig_fluxion', 'sig_konigsberg', 'sig_gauss_sum', 'sig_gauss_integer', 'sig_riemann_integral',
  'pythagoras', 'law_cosines', 'law_sines', 'euler_polyhedron', 'amgm', 'handshake',
]);
function useSkillFlow(card) {
  if (!isMyTurn()) return toast('尚未輪到你，僅能查看卡片效果');
  if (card.type === 'field') {
    let param;
    if (card.cardId === 'finite_field') {
      param = parseInt(prompt('有限體 GF(p)：宣告模數 p（2、3、5、7、11、13）：', '5'), 10);
      if (![2, 3, 5, 7, 11, 13].includes(param)) return toast('p 必須是 2、3、5、7、11、13');
    }
    socket.emit('play_field', { uid: card.uid, param });
    return;
  }
  let payload = {};
  const cid = card.cardId;
  if (NEEDS_SELECTION.has(cid)) {
    if (!attackSel.length) return toast('請先在手牌點選此技能需要的數字/角度卡');
    payload.uids = [...attackSel];
  } else if (cid === 'permcomb') {
    const n = parseInt(prompt('宣告 n（≤9）：', '5'), 10);
    const k = parseInt(prompt('宣告 k（0≤k≤n）：', '2'), 10);
    if (isNaN(n) || isNaN(k)) return; payload = { n, k };
  } else if (cid === 'ivt') {
    const c = parseInt(prompt('宣告傷害值 c（需在你歷史傷害 min~max 之間）：', '30'), 10);
    if (isNaN(c)) return; payload = { c };
  } else if (cid === 'bezout') {
    const grave = lastState.you.numberGrave;
    if (grave.length < 2) return toast('你的數字墓地不足兩張');
    const list = grave.map((c, i) => `${i}: ${c.glyph}`).join('\n');
    const raw = prompt('輸入要取用的數字墓地卡編號（2 個，逗號分隔）：\n' + list, '0,1');
    if (raw == null) return;
    const idxs = raw.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n) && grave[n]);
    if (idxs.length < 2) return toast('需選兩張');
    payload = { graveUids: idxs.slice(0, 2).map((i) => grave[i].uid) };
  } else if (cid === 'determinant') {
    if (attackSel.length < 2) return toast('請先在手牌點選 2 張數字卡 (a,b)');
    const grave = lastState.you.numberGrave;
    if (grave.length < 2) return toast('你的數字墓地不足兩張');
    const list = grave.map((c, i) => `${i}: ${c.glyph}`).join('\n');
    const raw = prompt('輸入數字墓地 2 張編號 (c,d，逗號分隔)：\n' + list, '0,1');
    if (raw == null) return;
    const idxs = raw.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n) && grave[n]);
    if (idxs.length < 2) return toast('需選兩張墓地卡');
    payload = { uids: attackSel.slice(0, 2), graveUids: idxs.slice(0, 2).map((i) => grave[i].uid) };
  } else if (cid === 'cramer') {
    if (attackSel.length < 3) return toast('請先在手牌點選 3 張要棄置的卡（代價）');
    payload = { discardUids: attackSel.slice(0, 3) };
  } else if (cid === 'sig_euler_tour') {
    if (attackSel.length < 2) return toast('請先在手牌點選 2 張要棄置的卡（代價）');
    payload = { discardUids: attackSel.slice(0, 2) };
  } else if (cid === 'fermat_little') {
    if (attackSel.length < 1) return toast('請先在手牌點選 1 張數字卡 a');
    const pp = parseInt(prompt('選擇質數 p（2、3、5、7）：', '3'), 10);
    if (![2, 3, 5, 7].includes(pp)) return toast('p 必須是 2、3、5、7');
    const aUid = attackSel[0];
    const discardUids = lastState.you.hand.filter((c) => c.uid !== aUid && c.uid !== card.uid).slice(0, 2).map((c) => c.uid);
    if (discardUids.length < 2) return toast('手牌不足以支付棄置 2 張的代價');
    payload = { aUid, p: pp, discardUids };
  } else if (cid === 'sig_principia') {
    if (attackSel.length < 2) return toast('請先在手牌點選 2 張要棄置的卡（代價）');
    payload = { discardUids: attackSel.slice(0, 2) };
  } else if (cid === 'sig_elementae') {
    if (attackSel.length < 2) return toast('請先在手牌點選 2 張要棄置的卡（代價）');
    const formulas = lastState.you.skillGrave.filter((c) => c.type === 'formula' && c.uid);
    let graveUids = [];
    if (formulas.length) {
      const list = formulas.map((c, i) => `${i}: ${c.name}`).join('\n');
      const raw = prompt('從技能墓地取回公式卡（至多 3 個，逗號分隔；可留空）：\n' + list, '');
      if (raw) { const idxs = raw.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n) && formulas[n]); graveUids = idxs.slice(0, 3).map((i) => formulas[i].uid); }
    }
    payload = { discardUids: attackSel.slice(0, 2), graveUids };
  } else if (cid === 'sig_exhaustion') {
    const T = parseInt(prompt('宣告目標值 T（25~80）：', '50'), 10);
    const n = parseInt(prompt('宣告分割數 n（1~5）：', '3'), 10);
    if (!T || !n) return; payload = { T, n };
  } else if (cid === 'sig_23_problems') {
    const N = parseInt(prompt('宣告整數 N（1~23）：', '12'), 10);
    if (!N) return;
    payload = { N, discardUid: attackSel[0] || lastState.you.hand.find((c) => c.uid !== card.uid)?.uid };
  } else if (cid === 'def_collapse') {
    payload = { discardUid: attackSel[0] || lastState.you.hand.find((c) => c.uid !== card.uid)?.uid };
  } else if (cid === 'def_deconstruct' || cid === 'def_tamper') {
    const oppDef = lastState.opponent.defense.cards;
    if (!oppDef.length) return toast('對手防禦區沒有牌');
    const list = oppDef.map((c, i) => `${i}: ${c.glyph}`).join('\n');
    const raw = prompt(`輸入要指定的對手防禦卡編號${cid === 'def_deconstruct' ? '（最多 2 個，逗號分隔）' : ''}：\n${list}`, '0');
    if (raw == null) return;
    const idxs = raw.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n) && oppDef[n]);
    if (!idxs.length) return;
    if (cid === 'def_deconstruct') payload = { uids: idxs.slice(0, 2).map((i) => oppDef[i].uid) };
    else payload = { uid: oppDef[idxs[0]].uid };
  }
  socket.emit('use_skill', { uid: card.uid, payload });
  if (payload.uids || payload.discardUids) attackSel = [];
  render(lastState);
}

/* ───── 拖曳放置 ───── */
function setupDropZone(el, addFn) {
  el.addEventListener('dragover', (ev) => { ev.preventDefault(); ev.dataTransfer.dropEffect = 'copy'; el.classList.add('drag-over'); });
  el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
  el.addEventListener('drop', (ev) => {
    ev.preventDefault(); el.classList.remove('drag-over');
    if (!isMyTurn()) return toast('尚未輪到你，僅能查看卡片效果');
    const uid = ev.dataTransfer.getData('text/plain');
    if (uid) { addFn(uid); emitDraft(); render(lastState); }
  });
}
setupDropZone($('selection-row'), (uid) => {
  if (!attackSel.includes(uid)) attackSel.push(uid);
  defenseSel = defenseSel.filter((u) => u !== uid);
});
setupDropZone($('my-defense-drop'), (uid) => {
  if (!defenseSel.includes(uid)) defenseSel.push(uid);
  attackSel = attackSel.filter((u) => u !== uid);
});

/* ───── 場地 tooltip ───── */
$('field-bar').addEventListener('mouseenter', (e) => showFieldTooltip(e.clientX, e.clientY));
$('field-bar').addEventListener('mousemove', (e) => positionTooltip(e.clientX, e.clientY));
$('field-bar').addEventListener('mouseleave', hideTooltip);

/* ───── 控制按鈕 ───── */
$('btn-calc').onclick = () => {
  if (!isMyTurn()) return toast('尚未輪到你');
  if (!attackSel.length) return toast('請先選擇算式卡牌');
  socket.emit('attack', { uids: attackSel });
  attackSel = []; emitDraft();
};
$('btn-set-def').onclick = () => {
  if (!isMyTurn()) return toast('尚未輪到你');
  const uids = defenseSel.length ? defenseSel : attackSel;
  if (!uids.length) return toast('請先把要設為防禦的卡放入防禦區或算式區');
  socket.emit('set_defense', { uids });
  attackSel = []; defenseSel = []; emitDraft();
};
$('btn-clear').onclick = () => { attackSel = []; defenseSel = []; emitDraft(); render(lastState); };
$('btn-endturn').onclick = () => { if (!isMyTurn()) return toast('尚未輪到你'); socket.emit('end_turn', {}); };

loadCharacters();
