// 房間建立、加入、清理
import { Game } from '../game/Game.js';

function genRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export class RoomManager {
  constructor() {
    this.rooms = new Map(); // roomId -> room
  }

  createRoom(socketId, character) {
    let id;
    do { id = genRoomId(); } while (this.rooms.has(id));
    const room = {
      id,
      players: [{ socketId, slot: 'p1', character, connected: true }],
      game: null,
      cleanupTimer: null,
    };
    this.rooms.set(id, room);
    return room;
  }

  joinRoom(roomId, socketId, character) {
    const room = this.rooms.get(roomId);
    if (!room) return { error: '房間不存在' };
    if (room.players.length >= 2) return { error: '房間已滿' };
    room.players.push({ socketId, slot: 'p2', character, connected: true });
    // 兩人齊備，開局
    const first = Math.random() < 0.5 ? 'p1' : 'p2';
    room.game = new Game(roomId, room.players[0].character, room.players[1].character, first);
    return { room };
  }

  getRoom(roomId) { return this.rooms.get(roomId); }

  findRoomBySocket(socketId) {
    for (const room of this.rooms.values()) {
      if (room.players.some((p) => p.socketId === socketId)) return room;
    }
    return null;
  }

  slotOf(room, socketId) {
    const p = room.players.find((x) => x.socketId === socketId);
    return p ? p.slot : null;
  }

  deleteRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (room?.cleanupTimer) clearTimeout(room.cleanupTimer);
    this.rooms.delete(roomId);
  }

  markDisconnected(socketId) {
    const room = this.findRoomBySocket(socketId);
    if (!room) return null;
    const p = room.players.find((x) => x.socketId === socketId);
    if (p) p.connected = false;
    return room;
  }
}
