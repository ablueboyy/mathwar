// 傷害結算：套用傷害上限、扣除對手防禦值、處理穿透傷害
// 回傳 { rawDamage, capped, defenseAbsorbed, actualDamage }
export function resolveDamage(rawDamage, attacker, defender, opts = {}) {
  const cap = opts.damageCap ?? attacker.flags?.damageCapOverride ?? 100;
  const capped = Math.max(0, Math.min(rawDamage, cap));

  // 穿透傷害：無視防禦值
  if (opts.piercing || attacker.flags?.piercing) {
    return { rawDamage, capped, defenseAbsorbed: 0, actualDamage: capped, piercing: true };
  }

  // 無視防禦值（歐拉定理／原理宣言：穿透防禦值但非穿透傷害）
  if (opts.ignoreDefense) {
    return { rawDamage, capped, defenseAbsorbed: 0, actualDamage: capped, piercing: false };
  }

  // 對手防禦值（可能被「防禦干擾」本回合降上限為 50）
  let defValue = defender.defense.value;
  if (defender.flags?.defenseCapThisTurn != null) {
    defValue = Math.min(defValue, defender.flags.defenseCapThisTurn);
  }
  const actualDamage = Math.max(0, capped - defValue);
  return { rawDamage, capped, defenseAbsorbed: capped - actualDamage, actualDamage, piercing: false };
}
