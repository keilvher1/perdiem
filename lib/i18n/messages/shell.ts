/**
 * "shell" namespace: header, navigation, footer, language switcher. `en` is the reference: its
 * strings must equal the English UI copy exactly. The other languages are typed `typeof en`.
 */
export const en = {
  footer: {
    event: "Challenge B | FuriosaAI x Bricksum | GWDC 2026 Korea",
    testnet: "Sepolia testnet only · no real money moves",
  },
  language: {
    label: "Language",
  },
};

export const ko: typeof en = {
  footer: {
    event: "Challenge B | FuriosaAI x Bricksum | GWDC 2026 Korea",
    testnet: "Sepolia 테스트넷 전용 · 실제 돈은 오가지 않습니다",
  },
  language: {
    label: "언어",
  },
};

export const ja: typeof en = {
  footer: {
    event: "Challenge B | FuriosaAI x Bricksum | GWDC 2026 Korea",
    testnet: "Sepolia テストネット専用 · 実際のお金は動きません",
  },
  language: {
    label: "言語",
  },
};

export const zh: typeof en = {
  footer: {
    event: "Challenge B | FuriosaAI x Bricksum | GWDC 2026 Korea",
    testnet: "仅限 Sepolia 测试网 · 不涉及真实资金",
  },
  language: {
    label: "语言",
  },
};
