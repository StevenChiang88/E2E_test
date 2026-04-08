# Playwright 測試說明

## 有頭模式 vs 無頭模式

- `headless`（無頭）
  - 不會顯示瀏覽器視窗，於背景執行
  - 速度通常較快，適合 CI/CD 或批次測試
- `headed`（有頭）
  - 會顯示瀏覽器畫面，方便觀察操作流程
  - 較適合本機除錯 UI 與互動問題

- `ui偵錯`
  - 除了可開瀏覽器，還多了整個互動式測試面板（除錯效率更高）

## 常用指令

- 無頭模式：`npm test`
- 有頭模式：`npm run test:headed`
- UI 偵錯模式：`npm run test:ui`

## 建議使用方式

- 本機開發/除錯：優先使用 `headed` 或 `ui`
- 自動化回歸/CI：使用 `headless`

## 測試目錄分層（建議）

- `tests/smoke`：核心冒煙流程（快速確認可用）
- `tests/features`：按功能分組（popup、profile...）
- `tests/regression`：回歸清單（完整檢查項）
- `tests/helpers`：共用流程（例如登入）

## 分組執行指令

- 只跑 smoke：`npm run test:smoke`
- 只跑 features：`npm run test:features`
- 只跑 regression：`npm run test:regression`
- 列出所有測試（不執行）：`npm run test:list`
