// 簽名卡定義（24 種，每角色 3 張，各 1 份）
// owner：所屬角色 id；只有對應角色可使用
export const SIGNATURES = [
  // ① 歐幾里得
  { id: 'sig_fifth_postulate', owner: 'euclid', name: '第五公設', timing: 'persistent', effect: 'sig_fifth_postulate',
    desc: '🔁3 回合。幾何類公式卡不受場地限制，傷害上限提升至 150。' },
  { id: 'sig_euclidean_algo', owner: 'euclid', name: '輾轉相除法', timing: 'main', effect: 'sig_euclidean_algo',
    desc: '選兩張數字卡計算 gcd，以 gcd×10 作傷害；互質額外抽 2 張技能。' },
  { id: 'sig_elementae', owner: 'euclid', name: '幾何原本', timing: 'cost', effect: 'sig_elementae',
    desc: '💀棄 2 張手牌。從技能墓地取至多 3 張公式卡入手；本回合公式使用上限 +1。' },

  // ② 阿基米德
  { id: 'sig_exhaustion', owner: 'archimedes', name: '窮竭法', timing: 'main', effect: 'sig_exhaustion',
    desc: '宣告 T(25~80) 與 n(1~5)，造成 ⌊T(1-1/2ⁿ)⌋ 傷害；n=5 為穿透傷害。' },
  { id: 'sig_spiral', owner: 'archimedes', name: '阿基米德螺線', timing: 'main', effect: 'sig_spiral',
    desc: '選數字卡 a 與角度卡 θ(弧度)，造成 ⌊a×θ×2⌋ 傷害，抽 2 張數字。' },
  { id: 'sig_eureka', owner: 'archimedes', name: '尤里卡！', timing: 'cost', effect: 'sig_eureka',
    desc: '💀扣自身 50HP。移除對手場地，造成 70 穿透傷害；HP 低於對手則改為 100。' },

  // ③ 牛頓
  { id: 'sig_fluxion', owner: 'newton', name: '牛頓的流數記法', timing: 'main', effect: 'sig_fluxion',
    desc: '選兩數 s、t，造成 ⌊(s÷t)×20⌋ 傷害；整除再 +25 並抽 1 張技能。' },
  { id: 'sig_prism', owner: 'newton', name: '稜鏡分解', timing: 'persistent', effect: 'sig_prism',
    desc: '本回合算式傷害依原始結果分解質因數，每個不重複質因數 +15（上限 +60）。' },
  { id: 'sig_principia', owner: 'newton', name: '原理宣言', timing: 'cost', effect: 'sig_principia',
    desc: '💀棄 2 張手牌。本回合算式無視對手防禦且上限提至 150；對手技能牌庫焚燒頂 8 張。' },

  // ④ 歐拉
  { id: 'sig_konigsberg', owner: 'euler', name: '柯尼斯堡七橋', timing: 'main', effect: 'sig_konigsberg',
    desc: '選數字卡 n；偶數造成 n×8，奇數造成 n×5 並抽 2 張技能。' },
  { id: 'sig_euler_identity', owner: 'euler', name: '歐拉恆等式特攻', timing: 'main', effect: 'sig_euler_identity',
    desc: '打出 e、i、π 各一，造成 100 穿透傷害；使用後可再戰鬥一次。' },
  { id: 'sig_euler_tour', owner: 'euler', name: '遍歷引理', timing: 'cost',
    desc: '💀棄 2 張手牌。從技能牌庫搜尋 3 張入手並抽 2 張數字；公式使用上限 +1。' },

  // ⑤ 高斯
  { id: 'sig_gauss_sum', owner: 'gauss', name: '高斯求和公式', timing: 'main', effect: 'sig_gauss_sum',
    desc: '選最大數字卡 n，計算 n(n+1) 作傷害；n 為質數額外抽 3 張數字。' },
  { id: 'sig_gauss_integer', owner: 'gauss', name: '高斯整數', timing: 'main', effect: 'sig_gauss_integer',
    desc: '複數平面下選 a、b，造成 ⌊√(a²+b²)⌋×6 傷害；a=b 則限制對手手牌。' },
  { id: 'sig_royal_talent', owner: 'gauss', name: '皇族天賦', timing: 'main', effect: 'sig_royal_talent',
    desc: '從技能牌庫搜尋 1 張公式卡入手並洗牌；本回合公式使用上限 +1。' },

  // ⑥ 黎曼
  { id: 'sig_riemann_integral', owner: 'riemann', name: '黎曼積分', timing: 'main', effect: 'sig_riemann_integral',
    desc: '選上下界 b>a 與分割 n，造成 ⌊(b-a)·n/(n+1)·25⌋ 傷害。' },
  { id: 'sig_analytic_cont', owner: 'riemann', name: '解析延拓', timing: 'instant',
    desc: '⚡啟動技能墓地一張場地卡效果至本回合結束（不替換當前場地），抽 1 張。' },
  { id: 'sig_riemann_legacy', owner: 'riemann', name: '黎曼遺願', timing: 'cost',
    desc: '💀棄 2 張手牌。從技能牌庫搜尋 2 張場地卡入手，對手技能牌庫焚燒頂 10 張。' },

  // ⑦ 龐加萊
  { id: 'sig_recurrence', owner: 'poincare', name: '龐加萊回歸定理', timing: 'persistent',
    desc: 'HP 曾低於 150 且當前 ≥250 時，本次傷害 +50(上限提至 150)。每場限 1 次。' },
  { id: 'sig_phase_fold', owner: 'poincare', name: '相空間折疊', timing: 'instant',
    desc: '⚡對手傷害 ≥ 你上回合傷害時，你受傷 -25 並以上回合傷害反擊對手。' },
  { id: 'sig_topo_swap', owner: 'poincare', name: '拓撲切換', timing: 'main',
    desc: '反轉對手當前場地效果，持續 1 回合；無場地則抽 1 張技能。' },

  // ⑧ 希爾伯特
  { id: 'sig_hilbert_hotel', owner: 'hilbert', name: '希爾伯特旅館', timing: 'main', effect: 'sig_hilbert_hotel',
    desc: '對手棄最高值數字卡並焚燒數字牌庫頂 8 張，清除其防禦區最高數字卡，你抽 1 張。' },
  { id: 'sig_consistency', owner: 'hilbert', name: '無矛盾性', timing: 'main',
    desc: '宣告算式無矛盾；對手異議則驗算(對 +50/錯 -75HP)，不異議則 +30 並焚燒對手 8 張。' },
  { id: 'sig_23_problems', owner: 'hilbert', name: '23問', timing: 'cost', effect: 'sig_23_problems',
    desc: '💀棄 1 張手牌。宣告 N(1~23) 造成 N×4 傷害並觸發對應附加效果。' },
];

export const SIGNATURE_BY_ID = Object.fromEntries(SIGNATURES.map((s) => [s.id, s]));
export const SIGNATURE_BY_NAME = Object.fromEntries(SIGNATURES.map((s) => [s.name, s.id]));
