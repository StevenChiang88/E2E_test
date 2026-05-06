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
- 只跑 regression（自動版，排除 manual）：
  `./node_modules/.bin/playwright test tests/regression --grep-invert @manual`
- 只跑某一支 regression（範例）：
  `./node_modules/.bin/playwright test tests/regression/popup.regression.spec.ts`
- 列出所有測試（不執行）：`npm run test:list`

## Regression 測項對照表

`tests/regression/` 下按模組拆檔，共 12 檔（含 setup + helpers）/ 56 個測試。
所有 spec 共用 `tests/regression/_helpers.ts` 的工具
（`closeAllAutoPopups`、`openAvatarPopup`、`popupByText`、`waitLobbyReady`…）。

| 檔案 | 對應測項範圍 |
|---|---|
| `_helpers.ts` | 共用工具（關彈窗 / 開頭像 / 切 tab / popupByText / waitLobbyReady） |
| `auth.setup.ts` | 一次性登入並保存 storageState（見下節） |
| `popup.regression.spec.ts` | 首儲彈窗、活動彈窗（顯示、左右箭頭、滑動、跳轉、關閉） |
| `avatar.regression.spec.ts` | 頭像、暱稱、VIP、Lv；個人頁 4 tab（我的 / 存摺 / 好友 / 背包）、UID、X/1000 |
| `header-menu.regression.spec.ts` | 右上漢堡：禮包碼、桌面捷徑、音樂 / 音效 / 大獎、公告、信箱、封鎖、客服、條款、登出 |
| `header-nav.regression.spec.ts` | 金幣 / 銀幣切換、頁首背包 X/1000、6 大分類 tab、頁首 icon、搜索 |
| `chat.regression.spec.ts` | 聊天頻顯示、開公頻彈窗、tab 切換、發送文字 |
| `ranking.regression.spec.ts` | 排行榜彈窗、tab 切換 |
| `task.regression.spec.ts` | 任務彈窗、無破圖、領取任務 |
| `mall.regression.spec.ts` | 商城跳轉、無破圖 |
| `gift.regression.spec.ts` | 贈禮彈窗、tab 切換、UID 查詢 |
| `guild.regression.spec.ts` | 公會彈窗、tab 切換 |
| `checklist.regression.spec.ts` | 早期 placeholder（test.skip）保留作為對照 |

### 撰寫慣例

- 因為網站尚無 `data-testid`，目前選擇器以 `getByAltText` / `getByText`
  / 穩定 class（`.page-popup-container`、`.coin-bg`、`.avatar-box`、
  `.swiper-button-prev|next`）為主。前端補上 `data-testid` 後再統一替換。
- 互動才會 render 的內容（漢堡選單項、聊天輸入欄、贈禮 UID input 等）
  採「找觸發元素 → 點擊 → 驗證 popup 含關鍵字」的軟驗證寫法，斷言鬆一點，
  不會因小幅 UI 改動就誤掛。
- 後台 / 金流 / 跳外部連結等項目以 `test.skip(true, '...')` 保留，
  並在測試名稱前加 `@manual` tag，跑 `--grep-invert @manual` 會自動排除。

### 測試帳號需求

regression 全部使用 `loginByReviewMode`（審核模式登入），需要 `.env` 提供：

- `BASE_URL`（例：`https://www-t001.hsswww.com`）
- `E2E_ACCOUNT`、`E2E_PASSWORD`

帳號需具備可進入大廳的權限；若帳號無法登入，setup 步驟就會失敗，
後續所有 regression spec 會被跳過。

### Regression 共用登入 session（避免重複登入被踢）

遊戲後端「重複登入會踢掉前一個 session」，所以 regression **整個 test run 只登入一次**，
後續所有 spec 共用同一份 cookie / localStorage。做法是 Playwright 標準的
**auth setup + storageState** 模式：

- `tests/regression/auth.setup.ts`：透過 `setup-regression` project 一次性登入，
  把 storage state 寫到 `playwright/.auth/user.json`（已加入 `.gitignore`）。
- `playwright.config.js` 新增兩個 project：
  - `setup-regression`：只跑 `auth.setup.ts`
  - `chromium-regression`：跑所有 `regression/*.spec.ts`，
    `dependencies: ['setup-regression']` + `storageState: 'playwright/.auth/user.json'`，
    並設 `fullyParallel: false`
- 全域 `workers: 1`：確保整個 run 同時間只有一個瀏覽器 context 在用 cookie，
  不會觸發後端的多重連線踢線。
- 每支 regression spec 的 `beforeEach` 不再呼叫 `loginByReviewMode`，
  只做 `await page.goto('/')`，cookie 會自動帶上，直接進大廳。

跑法不變，下面這幾個指令會自動先跑 setup、再跑 spec：

```
npm run test:regression
./node_modules/.bin/playwright test tests/regression --grep-invert @manual
./node_modules/.bin/playwright test tests/regression/popup.regression.spec.ts
```

如果想強制重新登入（例如 cookie 過期或換帳號），刪掉
`playwright/.auth/user.json` 即可，下次跑會自動重抓。

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
  - `/smoke`
  - `/features`
  - `/regression`
  - `/all`
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
