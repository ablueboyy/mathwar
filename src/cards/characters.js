// 8 位數學家角色的牌庫組成
// numberDeck：{ v, count }  v 為 0~9 的數字，或 'a30'..'a360' 的角度卡
// skillDeck ：{ id, count } id 對應 symbols / formulas / fields / signatures 的卡牌 id
//   每份牌庫經規則書 v5.0 驗證：數字牌庫 100 張、技能牌庫 60 張

import { SYMBOL_BY_NAME } from './symbols.js';
import { FORMULA_BY_NAME } from './formulas.js';
import { FIELD_BY_NAME } from './fields.js';
import { SIGNATURE_BY_NAME } from './signatures.js';

// 以中文名建構技能牌庫項目，找不到時丟錯（避免拼字錯誤悄悄帶過）
function sym(name, count) { const id = SYMBOL_BY_NAME[name]; if (!id) throw new Error(`未知符號卡：${name}`); return { id, count }; }
function fml(name, count) { const id = FORMULA_BY_NAME[name]; if (!id) throw new Error(`未知公式卡：${name}`); return { id, count }; }
function fld(name, count) { const id = FIELD_BY_NAME[name]; if (!id) throw new Error(`未知場地卡：${name}`); return { id, count }; }
function sig(name, count) { const id = SIGNATURE_BY_NAME[name]; if (!id) throw new Error(`未知簽名卡：${name}`); return { id, count }; }

export const CHARACTERS = {
  euclid: {
    id: 'euclid', name: '歐幾里得', en: 'Euclid', era: '古希臘 ~300 BC',
    style: '幾何精算流',
    numberDeck: [
      { v: 1, count: 6 }, { v: 2, count: 6 }, { v: 3, count: 8 }, { v: 4, count: 8 }, { v: 5, count: 8 },
      { v: 6, count: 6 }, { v: 7, count: 6 }, { v: 8, count: 6 }, { v: 9, count: 6 }, { v: 0, count: 4 },
      { v: 'a30', count: 10 }, { v: 'a45', count: 10 }, { v: 'a60', count: 10 }, { v: 'a90', count: 6 },
    ],
    skillDeck: [
      sym('根號', 4), sym('除法', 4), sym('加法', 3), sym('減法', 2), sym('次方', 3),
      sym('反正弦', 2), sym('反正切', 2), sym('正弦', 2),
      fml('畢達哥拉斯定理', 3), fml('餘弦定理', 3), fml('正弦定理', 2), fml('歐拉多面體公式', 2),
      fml('排列組合定理', 2), fml('AM-GM不等式', 3), fml('四色定理', 2), fml('貝祖定理', 3), fml('韋達定理', 2),
      fld('非歐幾里得空間', 2), fld('射影幾何', 2), fld('三角空間', 2),
      sig('第五公設', 1), sig('輾轉相除法', 1), sig('幾何原本', 1),
      fml('堅固算式', 2), fml('防守反擊', 1), fml('算式解構', 1), fml('防禦增幅', 1),
      fml('柯西-施瓦茨不等式', 2),
    ],
  },

  archimedes: {
    id: 'archimedes', name: '阿基米德', en: 'Archimedes', era: '古希臘 ~287–212 BC',
    style: '窮竭積累流',
    numberDeck: [
      { v: 1, count: 8 }, { v: 2, count: 8 }, { v: 3, count: 10 }, { v: 4, count: 6 }, { v: 5, count: 6 },
      { v: 6, count: 6 }, { v: 7, count: 6 }, { v: 8, count: 6 }, { v: 9, count: 6 }, { v: 0, count: 4 },
      { v: 'a45', count: 6 }, { v: 'a90', count: 8 }, { v: 'a180', count: 8 }, { v: 'a270', count: 6 }, { v: 'a360', count: 6 },
    ],
    skillDeck: [
      sym('圓周率', 4), sym('積分', 4), sym('極限', 4), sym('下取整', 3), sym('根號', 3), sym('乘法', 3),
      fml('積分基本定理', 3), fml('極限定義', 3), fml('洛必達法則', 3), fml('中間值定理', 3), fml('均值定理', 2),
      fml('畢達哥拉斯定理', 2), fml('羅爾定理', 3), fml('泰勒展開式', 2), fml('大數法則', 2),
      fld('黎曼球面', 2), fld('超實數域', 2), fld('三角空間', 2),
      sig('窮竭法', 1), sig('阿基米德螺線', 1), sig('尤里卡！', 1),
      fml('防守反擊', 2), fml('防禦干擾', 1), fml('算式解構', 1), fml('防禦增幅', 1),
      fml('中央極限定理', 2),
    ],
  },

  newton: {
    id: 'newton', name: '牛頓', en: 'Newton', era: '英格蘭 1643–1727',
    style: '微分爆發流',
    numberDeck: [
      { v: 0, count: 8 }, { v: 1, count: 14 }, { v: 2, count: 14 }, { v: 3, count: 12 }, { v: 4, count: 10 },
      { v: 5, count: 10 }, { v: 6, count: 8 }, { v: 7, count: 8 }, { v: 8, count: 8 }, { v: 9, count: 8 },
    ],
    skillDeck: [
      sym('微分', 4), sym('次方', 4), sym('乘法', 4), sym('積分', 3), sym('加法', 3), sym('指數函數', 3),
      fml('二項式定理', 3), fml('積分基本定理', 3), fml('萬有引力定律', 3), fml('泰勒展開式', 3),
      fml('均值定理', 3), fml('羅爾定理', 3), fml('費馬小定理', 2), fml('韋達定理', 2),
      fld('希爾伯特空間', 2), fld('無限維空間', 2), fld('黃金比例空間', 2),
      sig('牛頓的流數記法', 1), sig('稜鏡分解', 1), sig('原理宣言', 1),
      fml('防守反擊', 2), fml('算式解構', 1), fml('防禦增幅', 1), fml('堅固算式', 1),
      fml('極限定義', 2), fml('洛必達法則', 1),
    ],
  },

  euler: {
    id: 'euler', name: '歐拉', en: 'Euler', era: '瑞士 1707–1783',
    style: '全域均衡流',
    numberDeck: [
      { v: 0, count: 6 }, { v: 1, count: 8 }, { v: 2, count: 8 }, { v: 3, count: 8 }, { v: 4, count: 8 },
      { v: 5, count: 8 }, { v: 6, count: 8 }, { v: 7, count: 8 }, { v: 8, count: 8 }, { v: 9, count: 8 },
      { v: 'a30', count: 6 }, { v: 'a45', count: 5 }, { v: 'a60', count: 6 }, { v: 'a90', count: 5 },
    ],
    skillDeck: [
      sym('自然常數', 4), sym('圓周率', 4), sym('虛數單位', 3), sym('歐拉函數', 3), sym('求和', 3),
      sym('最大公因數', 3), sym('正弦', 2),
      fml('歐拉公式', 3), fml('巴塞爾問題', 3), fml('圖論握手定理', 3), fml('費馬小定理', 3), fml('歐拉定理', 3),
      fml('傅立葉變換', 3), fml('棣美弗定理', 3), fml('完全數定理', 1), fml('AM-GM不等式', 1),
      fld('複數平面', 2), fld('希爾伯特空間', 2), fld('黃金比例空間', 2),
      sig('柯尼斯堡七橋', 1), sig('歐拉恆等式特攻', 1), sig('遍歷引理', 1),
      fml('防禦增幅', 1), fml('算式解構', 1), fml('防守反擊', 1), fml('堅固算式', 1), fml('防禦干擾', 1),
      fml('費波那契數列', 1),
    ],
  },

  gauss: {
    id: 'gauss', name: '高斯', en: 'Gauss', era: '德意志 1777–1855',
    style: '數論精算流',
    numberDeck: [
      { v: 2, count: 16 }, { v: 3, count: 16 }, { v: 5, count: 14 }, { v: 7, count: 14 }, { v: 1, count: 10 },
      { v: 4, count: 8 }, { v: 6, count: 6 }, { v: 8, count: 6 }, { v: 9, count: 4 }, { v: 0, count: 6 },
    ],
    skillDeck: [
      sym('取模 p', 4), sym('歐拉函數', 4), sym('最大公因數', 4), sym('取模', 4), sym('次方', 3), sym('最小公倍數', 3),
      fml('質數定理', 3), fml('中國剩餘定理', 3), fml('費馬小定理', 3), fml('完全數定理', 2), fml('歐拉定理', 3),
      fml('貝祖定理', 3), fml('鴿巢原理', 3), fml('排列組合定理', 2),
      fld('複數平面', 2), fld('有限體GF(p)', 2), fld('模運算場地', 2),
      sig('高斯求和公式', 1), sig('高斯整數', 1), sig('皇族天賦', 1),
      fml('防禦增幅', 2), fml('數值篡改', 1), fml('堅固算式', 1), fml('算式解構', 1),
      fml('費馬最後定理', 2),
    ],
  },

  riemann: {
    id: 'riemann', name: '黎曼', en: 'Riemann', era: '德意志 1826–1866',
    style: '極限穿透流',
    numberDeck: [
      { v: 1, count: 10 }, { v: 2, count: 10 }, { v: 3, count: 10 }, { v: 4, count: 10 }, { v: 5, count: 10 },
      { v: 6, count: 8 }, { v: 7, count: 8 }, { v: 8, count: 8 }, { v: 9, count: 8 }, { v: 0, count: 6 },
      { v: 'a30', count: 3 }, { v: 'a45', count: 3 }, { v: 'a60', count: 3 }, { v: 'a90', count: 3 },
    ],
    skillDeck: [
      sym('積分', 4), sym('極限', 4), sym('偏微分', 4), sym('微分', 3), sym('自然常數', 3), sym('虛數單位', 3),
      fml('黎曼假設', 3), fml('積分基本定理', 3), fml('極限定義', 3), fml('洛必達法則', 3), fml('中間值定理', 2),
      fml('羅爾定理', 3), fml('柯西-施瓦茨不等式', 3), fml('拉普拉斯變換', 2), fml('均值定理', 2),
      fld('黎曼球面', 2), fld('非歐幾里得空間', 2), fld('超實數域', 2),
      sig('黎曼積分', 1), sig('解析延拓', 1), sig('黎曼遺願', 1),
      fml('符號污染', 1), fml('防禦干擾', 2), fml('防守反擊', 1), fml('算式解構', 1),
      fml('歐拉公式', 1),
    ],
  },

  poincare: {
    id: 'poincare', name: '龐加萊', en: 'Poincaré', era: '法國 1854–1912',
    style: '逆境翻盤流',
    numberDeck: [
      { v: 0, count: 12 }, { v: 1, count: 10 }, { v: 2, count: 10 }, { v: 3, count: 10 }, { v: 4, count: 10 },
      { v: 5, count: 10 }, { v: 6, count: 8 }, { v: 7, count: 8 }, { v: 8, count: 8 }, { v: 9, count: 14 },
    ],
    skillDeck: [
      sym('連鎖驚嘆', 4), sym('不等', 4), sym('絕對值', 3), sym('無限', 3), sym('極限', 3), sym('最大值', 2),
      fml('龐加萊猜想', 3), fml('莫比烏斯帶', 3), fml('混沌理論', 3), fml('薛丁格方程式', 3), fml('賽局理論', 3),
      fml('四色定理', 3), fml('熱力學第二定律', 3), fml('洛必達法則', 1), fml('中間值定理', 1),
      fld('拓撲空間', 2), fld('混沌邊緣', 2), fld('分形宇宙', 2),
      sig('龐加萊回歸定理', 1), sig('相空間折疊', 1), sig('拓撲切換', 1),
      fml('防守反擊', 2), fml('算式解構', 1), fml('防禦干擾', 1), fml('符號污染', 1),
      fml('康托爾對角論證', 2), fml('貝氏定理', 2),
    ],
  },

  hilbert: {
    id: 'hilbert', name: '希爾伯特', en: 'Hilbert', era: '德意志 1862–1943',
    style: '焚燒控制流',
    numberDeck: [
      { v: 1, count: 12 }, { v: 2, count: 12 }, { v: 3, count: 11 }, { v: 4, count: 11 }, { v: 5, count: 11 },
      { v: 6, count: 10 }, { v: 7, count: 10 }, { v: 8, count: 10 }, { v: 9, count: 9 }, { v: 0, count: 4 },
    ],
    skillDeck: [
      sym('求和', 4), sym('連乘', 4), sym('張量積', 3), sym('全稱量詞', 2), sym('存在量詞', 2),
      sym('次方', 3), sym('差分', 3),
      fml('秩-零化度定理', 3), fml('康托爾對角論證', 3), fml('特徵值定理', 3), fml('行列式定理', 3),
      fml('克拉瑪公式', 3), fml('大數法則', 3), fml('中央極限定理', 3), fml('伽羅瓦理論', 1), fml('費波那契數列', 2),
      fld('希爾伯特空間', 2), fld('無限維空間', 2), fld('矩陣空間', 2),
      sig('希爾伯特旅館', 1), sig('無矛盾性', 1), sig('23問', 1),
      fml('堅固算式', 2), fml('防線崩潰', 1), fml('防守反擊', 1), fml('算式解構', 1),
      fml('熱力學第二定律', 1),
    ],
  },
};

export const CHARACTER_LIST = Object.values(CHARACTERS);

// 已完整實作功能卡、可實際對戰的角色；其餘角色保留設計但「尚未開放」
export const READY_CHARACTERS = new Set(['euclid', 'archimedes', 'newton', 'gauss']);
