# 劇情資料來源

主要編輯方式已改為 `story-editor` 裡的「枝語 Story Studio」。它會用中文表單建立條件與效果，不需要手寫 JSON，並可直接匯出遊戲使用的 `_NarrativeDatabase.twee`。

本資料夾的三份 CSV 與 Google Sheet 同名工作表仍使用完全相同的欄位，保留作為翻譯協作、批次檢視與相容格式。若使用舊流程，請下載三張工作表為 CSV 並覆蓋本資料夾的檔案，然後在專案根目錄執行：

```powershell
node tools/sync-narrative-database.mjs database/story
```

成功後會更新 `src/_NarrativeDatabase.twee`。這個產物已被遊戲讀取，請不要手動編輯它。

## 表格的分工

- `Story Text`：只放實際顯示的文字；`zh_TW` 與 `en` 是相同 `text_key` 的翻譯。英文留空時，遊戲會暫時顯示中文，避免漏翻時出現空白。
- `Story Events`：決定什麼情境可出現什麼文字。`banner` 決定對話上方圖片；`conditions_json` 填觸發條件，`on_enter_effects_json` 填進入事件立即發生的效果。
- `Choices`：一個選項集合可被多個事件共用；每個選項可有自己的條件、效果與下一個 passage。

## 使用 GUI 的最小新增範例

想新增「溫莉好感 50 後的日常」：

1. 在「文本與翻譯」新增 `winley_park_affection_50` 和中文內容；英文暫時可留空。
2. 在「劇情事件」新增事件，場景 ID 填 `winley_park`，Banner 選「街道／公園共用」，使用文本選剛才的 Key，選項組選 `winley_park_daily_choices`。
3. 在「觸發條件」按新增，選「NPC 好感至少」，NPC ID 填 `winley`，數值填 `50`。
4. 到「檢查與匯出」下載引擎檔、覆蓋 `src/_NarrativeDatabase.twee`，再重新編譯遊戲。

目前可用條件：`flagIs`、`flagNotSet`、`flagAtLeast`、`flagAtMost`、`flagDateIsNotToday`、`npcAffectionAtLeast`、`stateEquals`、`stateAtLeast`。可用效果：`setFlag`、`setFlagToday`、`incrementFlag`、`changeNpcAffection`、`changeNpcRomance`、`changeStat`、`gainSkillExp`、`giveItem`、`advanceTime`、`acceptRomance`、`declineRomance`、`breakup`。GUI 已經知道每一種格式需要哪些欄位；JSON 只會在匯出 CSV 時自動產生。

技能經驗請選 GUI 的「增加技能經驗」，不要選 `$skillMaxLevel`。放在事件的「進場效果」會在事件開始時發放；放在選項的「選擇後效果」則會在玩家按下該按鈕後發放。技能欄位會列出 Notion 登記的現有技能。

NPC 給玩家物品時，在按鈕的「選擇後效果」選「獲得物品」，填入已存在的物品 ID 與數量。例如 `ramen`、`2` 會在玩家按下按鈕後加入 2 個泡麵。
