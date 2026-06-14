# MathWar 線上遊戲開發規劃

## 概覽

目標：將 MathWar 做成可常駐運行的線上雙人對戰網頁遊戲。玩家開網頁、輸入房間號碼即可對戰，無需自行啟動伺服器。

---

## 技術架構

### 核心選型

| 層次 | 技術 | 理由 |
|------|------|------|
| 後端 | Node.js + Express | 生態成熟，Socket.io 整合簡單 |
| 即時通訊 | Socket.io | 雙向即時事件，房間管理內建支援 |
| 前端 | 原生 HTML/CSS/JS | 無需框架，降低複雜度；後期可換 React |
| 托管 | Render.com（免費方案） | 常駐伺服器，連 GitHub 自動部署，不用手動執行 |
| 版本控制 | GitHub | CI/CD 串接 Render，push 即部署 |
| 狀態儲存 | 伺服器記憶體（Map） | MVP 階段夠用；房間斷線自動清理 |

### 運作方式

```
玩家 A 開瀏覽器
  → 輸入房間號碼，點擊「建立/加入」
  → 瀏覽器透過 Socket.io 連到 Render 上的伺服器
  → 玩家 B 輸入同一房間號碼加入
  → 伺服器管理整場遊戲狀態，雙方即時同步
```

---

## 檔案結構

```
mathwar/
├── package.json                  # 根目錄（Render 從這裡啟動）
├── server.js                     # 伺服器入口（Express + Socket.io）
├── src/
│   ├── room/
│   │   └── RoomManager.js        # 房間建立、加入、清理
│   ├── game/
│   │   ├── GameState.js          # 完整遊戲狀態（HP、手牌、防禦區…）
│   │   ├── TurnEngine.js         # 回合流程控制
│   │   ├── Calculator.js         # 算式計算（eval 替代，安全解析）
│   │   ├── DamageResolver.js     # 傷害計算 + 防禦值扣除
│   │   └── EffectHandler.js      # 公式卡/簽名卡效果執行
│   ├── cards/
│   │   ├── index.js              # 卡牌總入口（匯出所有卡牌定義）
│   │   ├── symbols.js            # 符號卡定義（37 種）
│   │   ├── formulas.js           # 公式卡定義（54 種）
│   │   ├── fields.js             # 場地卡定義（21 種）
│   │   ├── signatures.js         # 簽名卡定義（24 種）
│   │   └── characters.js         # 8 位角色牌庫組成
│   └── events/
│       └── socketEvents.js       # 所有 Socket.io 事件定義
├── public/
│   ├── index.html                # 首頁（選擇角色 + 輸入房間號）
│   ├── game.html                 # 對戰畫面
│   ├── css/
│   │   ├── main.css              # 通用樣式、字型
│   │   └── game.css              # 遊戲盤面樣式（防禦區、手牌、HP 條）
│   └── js/
│       ├── lobby.js              # 首頁邏輯（建立/加入房間）
│       ├── game.js               # 對戰主邏輯
│       ├── socket.js             # Socket.io 客戶端連線管理
│       ├── ui/
│       │   ├── board.js          # 遊戲盤面渲染（牌庫、場地、防禦區）
│       │   ├── hand.js           # 手牌顯示與拖拉互動
│       │   ├── defense.js        # 防禦區操作 UI
│       │   ├── formula.js        # 算式區拖拉與計算預覽
│       │   └── log.js            # 行動記錄面板
│       └── cards/
│           └── cardData.js       # 前端用卡牌資料（名稱、圖示、說明）
└── rulebook.md                   # 規則書（v5.0）
```

---

## 伺服器端核心邏輯

### Socket.io 事件清單

#### 大廳（Lobby）

| 事件名稱 | 方向 | 說明 |
|----------|------|------|
| `create_room` | 客→服 | 建立新房間，帶入選擇的角色 |
| `room_created` | 服→客 | 回傳房間號碼 |
| `join_room` | 客→服 | 加入現有房間，帶入角色 |
| `room_joined` | 服→客 | 加入成功，回傳初始遊戲狀態 |
| `room_error` | 服→客 | 房間不存在或已滿 |
| `game_start` | 服→雙方 | 兩人齊備，發送起始手牌與先攻方 |

#### 遊戲中（In-Game）

| 事件名稱 | 方向 | 說明 |
|----------|------|------|
| `set_defense` | 客→服 | 放置/調整防禦區（帶入卡牌列表） |
| `defense_updated` | 服→雙方 | 同步防禦區變動與新防禦值 |
| `play_field` | 客→服 | 打出場地卡 |
| `use_formula` | 客→服 | 使用公式卡（帶入卡牌 ID + 目標參數） |
| `attack` | 客→服 | 宣告算式攻擊（帶入算式卡牌組合） |
| `attack_preview` | 服→客 | 即時回傳算式計算結果預覽 |
| `damage_resolved` | 服→雙方 | 傷害結算結果（算式傷害、防禦扣除、實際傷害、HP 更新） |
| `end_turn` | 客→服 | 結束回合 |
| `turn_start` | 服→當前玩家 | 新回合開始，附抽到的牌 |
| `chain_play` | 客→服 | 速效卡加入連鎖 |
| `chain_resolved` | 服→雙方 | 連鎖結算結果 |
| `game_over` | 服→雙方 | 遊戲結束（勝者、勝利條件） |
| `dispute` | 客→服 | 提出算式異議 |
| `dispute_result` | 服→雙方 | 異議驗算結果 |

### GameState 資料結構

```js
{
  roomId: "ABCD",
  phase: "main" | "battle" | "end",  // 當前階段
  turn: 0,                            // 回合數
  currentPlayer: "p1" | "p2",
  players: {
    p1: {
      character: "euler",
      hp: 500,
      numberDeck: [...],    // 剩餘數字牌庫
      skillDeck: [...],     // 剩餘技能牌庫
      numberGrave: [...],
      skillGrave: [...],
      hand: [...],          // 手牌（最多10張）
      defense: {
        cards: [...],       // 防禦區卡牌（最多5張）
        value: 56,          // 當前防禦值
        maxValue: 100       // 防禦值上限（技能可調整）
      },
      damageHistory: [...]  // 每回合傷害紀錄
    },
    p2: { /* 同上 */ }
  },
  field: null | { card: ..., owner: "p1" },  // 當前場地
  chain: [],                // 連鎖堆疊
  log: []                   // 行動記錄
}
```

---

## 前端對戰畫面佈局

```
┌─────────────────────────────────────────────────────────┐
│  [對手角色] 歐拉        HP ████████░░ 350/500            │
│  [牌庫: 數字 72 | 技能 41]  [墓地]   [手牌背面 ×6]       │
│  ┌──────────── 對手防禦區 ──────────┐                    │
│  │  [9] [×] [9] [+] [9]  =  90 點  │  🛡️              │
│  └─────────────────────────────────┘                    │
│  ━━━━━━━━━━━━ 場地：複數平面 ━━━━━━━━━━━━               │
│  ┌──────────── 我方防禦區 ──────────┐                    │
│  │  [2] [+] [6] [×] [9]  =  56 點  │  🛡️              │
│  └─────────────────────────────────┘                    │
│  ┌──────── 算式區 ────────────────────────────────┐     │
│  │  [  ] [  ] [  ] [  ] [  ] [  ]    結果: ??    │     │
│  └────────────────────────────────────────────────┘     │
│  ─────────────── 我方手牌 ──────────────────────────    │
│  [3] [7] [+] [×] [sin] [∫] [畢式] [AM-GM]              │
│                                                          │
│  [我方角色] 牛頓   HP ██████████ 500/500                │
│  [佈置防禦] [使用技能] [計算！] [結束回合]               │
└─────────────────────────────────────────────────────────┘
```

---

## 部署步驟

### 1. 本地開發設定

```bash
# 初始化專案
mkdir mathwar && cd mathwar
npm init -y

# 安裝依賴
npm install express socket.io

# 開發時執行
node server.js
# 開啟 http://localhost:3000
```

### 2. GitHub 設定

```bash
git init
git add .
git commit -m "Initial MathWar online game"
git remote add origin https://github.com/<你的帳號>/mathwar.git
git push -u origin main
```

`.gitignore` 內容：
```
node_modules/
.env
```

### 3. Render.com 部署

1. 前往 [render.com](https://render.com) 註冊帳號
2. 點擊 **New → Web Service**
3. 連接 GitHub repo（選 mathwar）
4. 設定：
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: Free（常駐，不需付費）
5. 點擊 **Create Web Service**

完成後 Render 提供一個永久網址（如 `https://mathwar.onrender.com`），任何人開瀏覽器即可連線，無需雙方各自啟動伺服器。

### 4. 自動部署

每次 `git push origin main` 後，Render 自動重新部署，約 1-2 分鐘後生效。

---

## 開發里程碑

### Phase 1：基礎框架（約 1 週）
- [ ] 伺服器設定（Express + Socket.io）
- [ ] 房間建立與加入系統
- [ ] 首頁 UI（角色選擇 + 房間號碼輸入）
- [ ] 遊戲基本盤面 HTML/CSS
- [ ] 部署到 Render，確認可從網路連線

### Phase 2：遊戲核心（約 2 週）
- [ ] 牌庫生成與洗牌（依角色組成）
- [ ] 抽牌與手牌系統
- [ ] 算式區拖拉放卡 + Calculator.js 安全解析算式
- [ ] 防禦區放卡與防禦值計算
- [ ] 傷害計算流程（算式傷害 → 扣防禦 → 扣 HP）
- [ ] 回合流程控制（抽牌/主要/戰鬥/結束）
- [ ] 勝負判定（HP = 0 或牌庫耗盡）

### Phase 3：技能系統（約 2-3 週）
- [ ] 公式卡效果系統（優先常用的 20 張）
- [ ] 速效卡連鎖系統
- [ ] 場地卡系統
- [ ] 簽名卡效果（每角色 3 張）
- [ ] 防禦干擾類與防禦強化類卡牌

### Phase 4：完整化（約 1 週）
- [ ] 所有 54 張公式卡效果
- [ ] 行動記錄面板
- [ ] 算式合法性驗算 + 異議系統
- [ ] 斷線重連（儲存 roomId 到 localStorage）
- [ ] 手機響應式版面

---

## 技術注意事項

### 算式安全計算
不能用 JavaScript `eval()` 直接計算玩家輸入的算式，需自行實作安全解析器：
```js
// src/game/Calculator.js
// 使用 math.js 套件或自行實作 tokenizer + parser
// 安裝：npm install mathjs
import { evaluate } from 'mathjs'

function safeCalculate(expression) {
  try {
    const result = evaluate(expression)
    if (!isFinite(result)) return null
    return Math.round(result)
  } catch {
    return null  // 無效算式
  }
}
```

### 防禦值計算範例
```js
// src/game/DamageResolver.js
function resolveAttack(rawDamage, attackerState, defenderState) {
  const dmgCap = attackerState.damageCapOverride ?? 100
  const capped = Math.min(rawDamage, dmgCap)
  
  // 穿透傷害不受防禦值影響
  if (attackerState.isPiercing) {
    return { actualDamage: capped, defenseAbsorbed: 0 }
  }
  
  const defValue = Math.min(defenderState.defense.value, defenderState.defense.maxValue)
  const actualDamage = Math.max(0, capped - defValue)
  return { actualDamage, defenseAbsorbed: capped - actualDamage }
}
```

### 房間清理
```js
// 玩家斷線超過 5 分鐘自動清理房間，避免記憶體洩漏
socket.on('disconnect', () => {
  setTimeout(() => {
    if (room.players.every(p => !p.connected)) {
      RoomManager.deleteRoom(roomId)
    }
  }, 5 * 60 * 1000)
})
```

---

## 後續擴展（非 MVP）

- **觀戰模式**：第三方可用 `/spectate/<roomId>` 旁觀對局
- **對局記錄**：使用 SQLite 或 Supabase 儲存完整對局記錄
- **排行榜**：依勝率/場次排名
- **AI 對手**：離線單人模式，訓練簡易規則型 AI

---

*規劃版本 v1.0 | 2026-06-14*
