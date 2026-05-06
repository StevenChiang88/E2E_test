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
- 只跑 smoke（自動版，排除 manual）：`npm run test:smoke:auto`
- 跑 smoke 並發 Telegram 通知：`npm run test:smoke:notify`
- 只跑 features：`npm run test:features`
- 只跑 regression：`npm run test:regression`
- 列出所有測試（不執行）：`npm run test:list`

## Telegram 通知設定

- 在 `.env` 設定：
  - `TG_BOT_TOKEN=你的 bot token`
  - `TG_CHAT_ID=你的 chat id`
- `test:smoke:notify` 預設執行：`npx playwright test tests/smoke --grep-invert @manual`
- 若要自訂執行指令，可設定 `SMOKE_COMMAND`

## 排程自動跑 smoke

- 設定 `.env`：`SMOKE_SCHEDULE_MINUTES=30`
- 啟動排程：`npm run schedule:smoke`
- 排程會在啟動時先跑一次，之後每 N 分鐘執行一次 `test:smoke:notify`

## Telegram 雙向指令（由 TG 觸發 server 測試）

- 啟動機器人輪詢服務：`npm run bot:telegram`
- 可用指令：
  - `/help`
  - `/status`
  - `/run smoke`
  - `/run features`
  - `/run regression`
  - `/run all`
- 機器人只接受 `.env` 裡 `TG_CHAT_ID` 指定的 chat 發出的指令

## Docker 化部署

- 建立並背景啟動（排程 + TG 雙向 bot）：
  - `docker compose up -d --build`
- 查看服務狀態：
  - `docker compose ps`
- 查看 bot logs：
  - `docker compose logs -f telegram-bot`
- 查看排程 logs：
  - `docker compose logs -f smoke-scheduler`
- 停止服務：
  - `docker compose down`
