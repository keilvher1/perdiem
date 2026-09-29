/**
 * "install" namespace: the desktop-app install control (components/perdiem/install-app.tsx).
 * `en` is the reference; the other languages are typed `typeof en`, so a missing key is a compile
 * error. The component reads this module directly (`INSTALL[useLocale()]`), outside MESSAGES.
 *
 * Menu names are the ones Safari shows in each macOS language (File > Add to Dock…), so a viewer
 * can find them verbatim; "Dock" is 程序坞 in Simplified Chinese macOS.
 */
export const en = {
  /** Visible label on the slim left-edge tab. */
  button: "Install app",
  /** Appended to the visible label for screen readers (the name starts with the visible text). */
  buttonSr: " (PerDiem desktop app)",
  dismiss: "Hide the install button for 7 days",
  installed: {
    title: "PerDiem is installed",
    description: "It opens in its own window from the Start menu, the taskbar or the Dock.",
  },
  promptError: {
    title: "The install dialog did not open",
    description: "Use the install icon in the address bar instead.",
  },
  dismissed: {
    title: "Install button hidden for 7 days",
    chromium: "You can still install PerDiem from the install icon in the address bar.",
    safari: "You can still add PerDiem with File > Add to Dock… in Safari.",
  },
  safari: {
    title: "Add PerDiem to the Dock",
    intro: "Safari can keep PerDiem as an app that opens in its own window.",
    /** Step 1 lead-in; the menu path is shown after it. */
    step1: "In the menu bar, choose:",
    menuPath: ["File", "Add to Dock…"],
    step2: "Keep the name “PerDiem” and click Add.",
    step3: "Open PerDiem from the Dock. It runs in its own window.",
    share: "The toolbar’s Share button offers Add to Dock… too.",
    requirement: "Requires Safari 17 on macOS Sonoma or later.",
    close: "Close",
  },
};

export const ko: typeof en = {
  button: "앱 설치",
  buttonSr: " (PerDiem 데스크톱 앱)",
  dismiss: "설치 버튼을 7일 동안 숨기기",
  installed: {
    title: "PerDiem을 설치했습니다",
    description: "시작 메뉴, 작업 표시줄 또는 Dock에서 별도 창으로 열 수 있습니다.",
  },
  promptError: {
    title: "설치 창을 열지 못했습니다",
    description: "주소창의 설치 아이콘을 사용하세요.",
  },
  dismissed: {
    title: "설치 버튼을 7일 동안 숨겼습니다",
    chromium: "주소창의 설치 아이콘으로 언제든 PerDiem을 설치할 수 있습니다.",
    safari: "Safari의 파일 > Dock에 추가…로 언제든 PerDiem을 추가할 수 있습니다.",
  },
  safari: {
    title: "PerDiem을 Dock에 추가",
    intro: "Safari에서 PerDiem을 별도 창으로 열리는 앱으로 추가할 수 있습니다.",
    step1: "메뉴 막대에서 다음을 선택하세요:",
    menuPath: ["파일", "Dock에 추가…"],
    step2: "이름을 ‘PerDiem’ 그대로 두고 추가를 클릭하세요.",
    step3: "Dock에서 PerDiem을 여세요. 별도 창에서 실행됩니다.",
    share: "도구 막대의 공유 버튼에도 ‘Dock에 추가…’가 있습니다.",
    requirement: "macOS Sonoma 이상의 Safari 17 이상이 필요합니다.",
    close: "닫기",
  },
};

export const ja: typeof en = {
  button: "アプリをインストール",
  buttonSr: "（PerDiem デスクトップアプリ）",
  dismiss: "インストールボタンを7日間非表示にする",
  installed: {
    title: "PerDiem をインストールしました",
    description: "スタートメニュー、タスクバー、Dock から専用ウィンドウで開けます。",
  },
  promptError: {
    title: "インストール画面を開けませんでした",
    description: "アドレスバーのインストールアイコンを使ってください。",
  },
  dismissed: {
    title: "インストールボタンを7日間非表示にしました",
    chromium: "アドレスバーのインストールアイコンから、いつでも PerDiem をインストールできます。",
    safari: "Safari の「ファイル」>「Dockに追加…」から、いつでも PerDiem を追加できます。",
  },
  safari: {
    title: "PerDiem を Dock に追加",
    intro: "Safari では、PerDiem を専用ウィンドウで開くアプリとして追加できます。",
    step1: "メニューバーで次を選択してください：",
    menuPath: ["ファイル", "Dockに追加…"],
    step2: "名前は「PerDiem」のまま、「追加」をクリックしてください。",
    step3: "Dock から PerDiem を開くと、専用ウィンドウで動作します。",
    share: "ツールバーの共有ボタンからも「Dockに追加…」を選べます。",
    requirement: "macOS Sonoma 以降の Safari 17 以降が必要です。",
    close: "閉じる",
  },
};

export const zh: typeof en = {
  button: "安装应用",
  buttonSr: "（PerDiem 桌面应用）",
  dismiss: "隐藏安装按钮 7 天",
  installed: {
    title: "PerDiem 已安装",
    description: "可从开始菜单、任务栏或程序坞在独立窗口中打开。",
  },
  promptError: {
    title: "无法打开安装对话框",
    description: "请改用地址栏中的安装图标。",
  },
  dismissed: {
    title: "已隐藏安装按钮 7 天",
    chromium: "仍可随时通过地址栏中的安装图标安装 PerDiem。",
    safari: "仍可随时通过 Safari 的“文件 > 添加到程序坞…”添加 PerDiem。",
  },
  safari: {
    title: "将 PerDiem 添加到程序坞",
    intro: "在 Safari 中，可将 PerDiem 添加为在独立窗口中打开的应用。",
    step1: "在菜单栏中选择：",
    menuPath: ["文件", "添加到程序坞…"],
    step2: "保留名称“PerDiem”，然后点按“添加”。",
    step3: "从程序坞打开 PerDiem，它会在独立窗口中运行。",
    share: "工具栏中的“共享”按钮也提供“添加到程序坞…”。",
    requirement: "需要 macOS Sonoma 或更高版本上的 Safari 17 或更高版本。",
    close: "关闭",
  },
};
