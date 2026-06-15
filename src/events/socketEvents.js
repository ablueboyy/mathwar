// 所有 Socket.io 事件處理
import { RoomManager } from '../room/RoomManager.js';
import { READY_CHARACTERS } from '../cards/index.js';

// 只有已開放（功能卡完整）的角色可進入對戰
const VALID_CHARS = READY_CHARACTERS;

export function registerSocketEvents(io) {
  const rm = new RoomManager();

  // 把最新狀態送給房間內兩位玩家（各自視角）
  function broadcastState(room) {
    if (!room.game) return;
    for (const p of room.players) {
      io.to(p.socketId).emit('state', room.game.viewFor(p.slot));
    }
    if (room.game.winner) {
      for (const p of room.players) {
        io.to(p.socketId).emit('game_over', { winner: room.game.winner, reason: room.game.winReason, youAre: p.slot });
      }
    }
  }

  io.on('connection', (socket) => {
    socket.on('create_room', ({ character }) => {
      if (!VALID_CHARS.has(character)) return socket.emit('room_error', { error: '此角色尚未開放' });
      const room = rm.createRoom(socket.id, character);
      socket.join(room.id);
      socket.emit('room_created', { roomId: room.id, slot: 'p1' });
    });

    socket.on('join_room', ({ roomId, character }) => {
      if (!VALID_CHARS.has(character)) return socket.emit('room_error', { error: '此角色尚未開放' });
      const res = rm.joinRoom((roomId || '').toUpperCase(), socket.id, character);
      if (res.error) return socket.emit('room_error', { error: res.error });
      socket.join(res.room.id);
      socket.emit('room_joined', { roomId: res.room.id, slot: 'p2' });
      // 通知雙方開局
      for (const p of res.room.players) io.to(p.socketId).emit('game_start', { roomId: res.room.id, youAre: p.slot });
      broadcastState(res.room);
    });

    // 統一的遊戲動作入口
    // eventBuilder(game, slot, payload)：在動作執行「前」擷取動畫所需資訊（如卡名、算式），可為 null
    function withGame(handler, eventBuilder) {
      return (payload = {}) => {
        const room = rm.findRoomBySocket(socket.id);
        if (!room || !room.game) return socket.emit('action_error', { error: '不在遊戲中' });
        const slot = rm.slotOf(room, socket.id);
        const game = room.game;
        const pre = eventBuilder ? eventBuilder(game, slot, payload) : null;
        const hpBefore = { p1: game.players.p1.hp, p2: game.players.p2.hp };
        const result = handler(game, slot, payload);
        if (result && result.error) { socket.emit('action_error', { error: result.error }); broadcastState(room); return; }
        if (result && result.note) socket.emit('action_note', { note: result.note });
        // 廣播動作事件（含血量變化），供雙方播放動畫
        if (pre) {
          const event = {
            ...pre, actor: slot, actorChar: game.players[slot].character,
            dmg: { p1: hpBefore.p1 - game.players.p1.hp, p2: hpBefore.p2 - game.players.p2.hp },
          };
          for (const pl of room.players) io.to(pl.socketId).emit('action_event', { ...event, youAre: pl.slot });
        }
        broadcastState(room);
      };
    }

    // 算式/防禦「佈置進行中」：把草稿張數轉送給對手（以牌背呈現，不公開內容）
    socket.on('draft', ({ attack = 0, defense = 0 } = {}) => {
      const room = rm.findRoomBySocket(socket.id);
      if (!room) return;
      const me = rm.slotOf(room, socket.id);
      const opp = room.players.find((pl) => pl.slot !== me);
      if (opp) io.to(opp.socketId).emit('opponent_draft', {
        attack: Math.max(0, Math.min(6, attack | 0)),
        defense: Math.max(0, Math.min(5, defense | 0)),
      });
    });

    // 取手牌某 uid 的卡牌（事件建構用）
    const cardOf = (game, slot, uid) => game.players[slot].hand.find((c) => c.uid === uid);

    socket.on('set_defense', withGame(
      (game, slot, p) => game.setDefense(slot, p.uids || []),
      () => ({ kind: 'defense' }),
    ));
    socket.on('play_field', withGame(
      (game, slot, p) => game.playField(slot, p.uid, p.param),
      (game, slot, p) => { const c = cardOf(game, slot, p.uid); return { kind: 'field', card: c ? c.name : '場地卡' }; },
    ));
    socket.on('use_skill', withGame(
      (game, slot, p) => game.useSkill(slot, p.uid, p.payload || {}),
      (game, slot, p) => { const c = cardOf(game, slot, p.uid); return { kind: 'skill', card: c ? c.name : '技能卡', glyph: c ? c.glyph : '' }; },
    ));
    socket.on('attack', withGame(
      (game, slot, p) => game.attack(slot, p.uids || []),
      (game, slot, p) => { const cs = (p.uids || []).map((u) => cardOf(game, slot, u)).filter(Boolean); return { kind: 'attack', expr: cs.map((c) => c.glyph).join(' ') }; },
    ));
    socket.on('end_turn', withGame((game, slot) => game.endTurn(slot)));
    socket.on('draw_skill', withGame(
      (game, slot, p) => game.drawSkillChoice(slot, p.deckType || 'formula'),
    ));

    // 算式預覽（不改變狀態）
    socket.on('attack_preview', ({ uids }) => {
      const room = rm.findRoomBySocket(socket.id);
      if (!room || !room.game) return;
      const slot = rm.slotOf(room, socket.id);
      const p = room.game.players[slot];
      const cards = (uids || []).map((uid) => p.hand.find((c) => c.uid === uid)).filter(Boolean);
      // 動態載入計算器以避免循環依賴
      import('../game/Calculator.js').then(({ calculate }) => {
        const trigMult = (room.game.field && room.game.field.cardId === 'trig_space') ? 60 : 50;
        socket.emit('attack_preview', calculate(cards, { trigMult }));
      });
    });

    socket.on('disconnect', () => {
      const room = rm.markDisconnected(socket.id);
      if (!room) return;
      io.to(room.id).emit('opponent_disconnected', {});
      // 5 分鐘後若雙方都離線則清理房間
      room.cleanupTimer = setTimeout(() => {
        if (room.players.every((p) => !p.connected)) rm.deleteRoom(room.id);
      }, 5 * 60 * 1000);
    });
  });
}
