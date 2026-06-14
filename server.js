// MathWar 伺服器入口（Express + Socket.io）
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { registerSocketEvents } from './src/events/socketEvents.js';
import { CHARACTER_LIST, READY_CHARACTERS, SYMBOLS, FORMULAS, FIELDS, SIGNATURES } from './src/cards/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

app.use(express.static(join(__dirname, 'public')));

// 提供角色清單給前端
app.get('/api/characters', (req, res) => {
  res.json(CHARACTER_LIST.map((c) => ({ id: c.id, name: c.name, en: c.en, era: c.era, style: c.style, ready: READY_CHARACTERS.has(c.id) })));
});

// 提供所有卡牌的說明（供前端 tooltip 使用）：以 cardId 為鍵
app.get('/api/cards', (req, res) => {
  const out = {};
  for (const s of SYMBOLS) out[s.id] = { type: 'symbol', name: s.name, glyph: s.glyph, desc: s.desc };
  for (const f of FORMULAS) out[f.id] = { type: 'formula', name: f.name, desc: f.desc, timing: f.timing };
  for (const f of FIELDS) out[f.id] = { type: 'field', name: f.name, desc: f.desc };
  for (const s of SIGNATURES) out[s.id] = { type: 'signature', name: s.name, desc: s.desc, owner: s.owner, timing: s.timing };
  res.json(out);
});

registerSocketEvents(io);

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`MathWar 伺服器啟動：http://localhost:${PORT}`);
});
