/**
 * "common" namespace: copy shared by several screens. `en` is the reference: its strings must
 * equal the English UI copy exactly. The other languages are typed `typeof en`.
 */
export const en = {
  /** Merchant categories are data ids; show `t.common.category[c] ?? c`. English shows the id itself. */
  category: { meal: "meal", transport: "transport", supplies: "supplies", alcohol: "alcohol", gift: "gift" } as Record<string, string>,
};

export const ko: typeof en = {
  category: { meal: "식사", transport: "교통", supplies: "소모품", alcohol: "주류", gift: "선물" },
};

export const ja: typeof en = {
  category: { meal: "食事", transport: "交通", supplies: "消耗品", alcohol: "酒類", gift: "ギフト" },
};

export const zh: typeof en = {
  category: { meal: "餐饮", transport: "交通", supplies: "办公用品", alcohol: "酒类", gift: "礼品" },
};
