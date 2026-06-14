# MathWar 數學戰爭

雙人數學卡牌對戰網頁遊戲。玩家選擇一位歷史數學家，使用其專屬牌組構築算式攻擊對手。
完整規則見 [`rulebook.md`](rulebook.md)，線上化規劃見 [`online_game_plan.md`](online_game_plan.md)。

## 技術架構

- 後端：Node.js + Express + Socket.io（即時雙人對戰、房間管理）
- 算式計算：自訂安全解析器（`src/game/Calculator.js`，不使用 eval）
- 前端：原生 HTML/CSS/JS（單頁：大廳 + 對戰盤面）

## 本地執行

```bash
npm install
npm start          # 啟動於 http://localhost:3000
# 或開發模式（檔案變動自動重啟）
npm run dev
```

開兩個瀏覽器分頁／兩台裝置：一方「建立新房間」取得 4 碼房號，另一方輸入房號「加入房間」即可對戰。

## 專案結構

```
server.js                 伺服器入口（Express + Socket.io）
src/
  cards/                  卡牌定義（符號/公式/場地/簽名）與角色牌庫組成
  game/                   Calculator / GameState / DamageResolver / EffectHandler / Game
  room/RoomManager.js     房間建立、加入、清理
  events/socketEvents.js  Socket.io 事件
public/                   前端（index.html、css、js/app.js）
```

## 目前進度（MVP）

已完成：
- ✅ 8 位角色完整牌庫（數字 100 張 / 技能 60 張，已驗證張數）
- ✅ 房間建立／加入、開局發牌、回合流程、抽牌與牌庫耗盡判敗
- ✅ 算式區計算（基礎運算、根號/階乘/取整/三角/對數/求和等）與即時預覽
- ✅ 防禦區佈置與防禦值計算、傷害結算（上限／扣防禦／穿透）
- ✅ 部分公式卡與簽名卡效果（傷害型簽名、8 張防禦卡、巴塞爾、萬有引力、哥德巴赫等）

待辦（後續階段）：
- ⬜ 其餘公式卡完整效果、場地卡規則生效
- ⬜ 速效卡連鎖系統、算式異議系統
- ⬜ 斷線重連、手機響應式、部署到 Render.com
