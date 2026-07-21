# Twine / SugarCube：NPC 行程與事件規格書

> **這份文件的用途**：把一段新劇情先用一致的格式寫清楚，再交給 AI 產生 `.twee` 程式碼。
> 
> **適用範圍**：本遊戲目前的 Twine + SugarCube 專案。故事段落仍以各自的 `.twee` passage 撰寫；不要一開始把劇情搬進複雜的資料庫。

---

## 0. 最重要的原則

1. **一個事件，拆成數個小 passage。** 不要把所有溫莉劇情塞在「公園」或「溫莉對話」裡。
2. **入口只負責選事件，事件 passage 只負責演出內容。** 這樣日後加劇情時，只需新增 passage，再在入口加一條規則。
3. **遊戲進度使用 `$` 變數。** 例如 `$flags`、`$npcRelations`、`$reputation`；它們會進入存檔。
4. **名稱可改，ID 不要改。** 發行遊戲後，事件 ID、NPC ID、旗標名稱不要任意改名，避免舊存檔失效。
5. **一次性事件播完就設旗標。** 否則玩家回到地點時可能反覆看到同一段主劇情。

---

## 1. 本專案已經有的資料與寫法

### 時間

遊戲時間是 `$gameDate`，它是一個日期物件。常用判斷如下：

```twine
/% 現在是 08:00 到 08:59 %/
<<if $gameDate.getHours() gte 8 and $gameDate.getHours() lt 9>>
    這段時間會顯示。
<</if>>
```

**注意**：上述寫法只看「小時」。若日後需要精確到 08:30，請先請 AI 改用「當日已過分鐘數」的判斷；目前的一般行程不需要這麼複雜。

### NPC 好感

NPC ID 是英文小寫，例如溫莉是 `winley`。好感放在：

```twine
$npcRelations["winley"].affection
```

範例：

```twine
<<if $npcRelations["winley"].affection gte 30>>
    溫莉對你的態度明顯柔和許多。
<</if>>

/% 好感 + 2；若要避免超過 100，請交給 AI 依遊戲上限處理 %/
<<set $npcRelations["winley"].affection += 2>>
```

### 聲望

玩家聲望使用 `$reputation`：

```twine
<<if $reputation gte 50>>
    她似乎已經聽過你的名字。
<</if>>
```

### 劇情旗標

劇情是否發生過統一存放在 `$flags`：

```twine
/% 尚未看過事件 %/
<<if not $flags["winley_park_intro_done"]>>
    ...
<</if>>

/% 事件結束時，標記已看過 %/
<<set $flags["winley_park_intro_done"] to true>>
```

### 角色台詞外觀

溫莉台詞請維持目前專案的寫法：

```twine
@@.npc-winley;「這是溫莉說的話。」@@
```

---

## 2. 建議的檔案與 passage 結構

每位重要 NPC 建立一個獨立檔案。例如：

```text
src/
  NPC_Winley.twee             ← 溫莉的「事件入口」與所有溫莉事件
  Map01_street.twee           ← 公園、街道等地點入口；只放很短的呼叫
  _GameDatabase.twee          ← NPC 固定資料（名稱、顏色、標籤），不放長劇情
```

溫莉檔案內的 passage 命名：

```text
NPC_Winley_公園入口
NPC_Winley_公園_初次見面
NPC_Winley_公園_低好感
NPC_Winley_公園_秘密
NPC_Winley_公園_日常
```

規則：

- `NPC_角色ID_地點_事件名稱`：一律照此命名，方便搜尋。
- 事件名稱使用可讀的中文；角色 ID 使用固定英文 ID。
- 事件入口可重複使用；事件內容不要互相直接複製貼上。
- 目前建議先讓「一個 NPC 在一個地點」有一個入口。日後溫莉可在咖啡廳與公園都有獨立入口。

---

## 3. 事件挑選的優先順序

當玩家點擊「和溫莉聊天」，可能同時符合數段劇情。因此入口必須按照**最重要 → 最普通**的順序判斷：

1. 一次性的主線／任務事件
2. 有時間限制的特殊事件
3. 好感、聲望或物品條件造成的分歧事件
4. 低好感的拒絕／冷淡反應
5. 可重複出現的日常對話（最後保底）

範例入口：

```twine
:: NPC_Winley_公園入口
<<if not $flags["winley_park_intro_done"]>>
    <<goto "NPC_Winley_公園_初次見面">>
<<elseif $flags["winley_park_intro_done"] and $npcRelations["winley"].affection gte 30 and $reputation gte 50 and not $flags["winley_park_secret_done"]>>
    <<goto "NPC_Winley_公園_秘密">>
<<elseif $npcRelations["winley"].affection lt 20>>
    <<goto "NPC_Winley_公園_低好感">>
<<else>>
    <<goto "NPC_Winley_公園_日常">>
<</if>>
```

這段順序刻意讓「秘密」在「低好感」之前被檢查，但秘密本身要求好感至少 30，所以不會真的衝突。新增事件時，先想清楚它要排在哪一層。

---

## 4. 公園的 NPC 出現方式

「公園」passage 只處理：此刻誰在這裡、玩家能否和他互動。它不應寫完整劇情。

```twine
:: 公園 [park]
有很多人在這。

<<if $gameDate.getHours() gte 8 and $gameDate.getHours() lt 9>>
    溫莉正坐在長椅上。
    <<link "和溫莉聊天">><<goto "NPC_Winley_公園入口">><</link>>
<</if>>

@@.button-container;
<<go "🏘️離開" "街道">>
<<go "🏠回家" "YourHome" 8>>
@@
```

這代表溫莉每天 `08:00–08:59` 出現在公園。玩家從街道走到公園會花時間，因此到達時才檢查時間；這正符合「太晚到就遇不到」的需求。

如果日後有星期限制：

```twine
/% 只在平日早上出現：getDay() 的 0 是星期日，6 是星期六 %/
<<if $gameDate.getDay() gte 1 and $gameDate.getDay() lte 5 and $gameDate.getHours() gte 8 and $gameDate.getHours() lt 9>>
```

---

## 5. 一個完整事件的模板

以下是「初次見面」的一次性事件模板。請複製後替換 `事件ID`、文字與效果。

```twine
:: NPC_Winley_公園_初次見面
<<if $flags["winley_park_intro_done"]>>
    /% 防呆：若事件已播過，直接回到入口重新選擇。 %/
    <<goto "NPC_Winley_公園入口">>
<</if>>

你走近長椅旁。溫莉抬起頭，朝你微微一笑。

@@.npc-winley;「早安。你也是來散步的嗎？」@@

@@.button-container;
<<link "和她聊幾句">>
    <<set $flags["winley_park_intro_done"] to true>>
    <<set $npcRelations["winley"].affection += 2>>
    <<goto "公園">>
<</link>>
<<link "先離開">><<goto "公園">><</link>>
@@
```

### 一次性事件的檢查清單

- [ ] 入口條件有 `not $flags["..."]`
- [ ] 事件結尾有 `<<set $flags["..."] to true>>`
- [ ] 若玩家中途返回或重新整理，不會重複拿到獎勵
- [ ] 所有選項都能回到合理的 passage
- [ ] 若事件需要時間流逝，明確使用現有的 `<<go ... 時間>>` 或 `<<passTime 分鐘>>`

---

## 6. 寫事件前，先填這張「事件卡」

每一個新增事件都先填以下內容。即使只是交給 AI，也請盡量填完整；空白處讓 AI 先問你，不要自行亂補設定。

```md
## 事件卡

- 事件 ID：winley_park_secret
- 顯示名稱：溫莉的秘密
- NPC ID：winley
- 地點：公園
- 可出現時間：每天 08:00–08:59
- 星期限制：無／平日／指定星期幾
- 一次性：是
- 優先層級：主線／特殊／條件分歧／低好感／日常

### 必須符合的條件（全部都要符合）
- 已完成事件：winley_park_intro
- 好感：至少 30
- 聲望：至少 50
- 任務或旗標：無
- 持有物品：無

### 不可符合的條件
- 此事件已完成
- （其他互斥事件或狀態）

### 劇情概要
- 玩家在公園遇到溫莉。
- 溫莉因為相信玩家，說出她來公園的原因。

### 玩家選項與結果
1. 認真傾聽：好感 +3，設定事件完成。
2. 開玩笑帶過：好感 +0，設定事件完成。
3. 打斷她：好感 -2，設定事件完成。

### 事件結束後
- 要設定的旗標：winley_park_secret_done = true
- 要改變的數值：好感依選項變化
- 要花的時間：10 分鐘／不花時間
- 回到哪裡：公園
```

---

## 7. 旗標與 ID 的命名規則

一律使用英文小寫與底線，不使用空白、中文或隨意縮寫。

| 類型 | 格式 | 範例 |
|---|---|---|
| NPC ID | `角色` | `winley` |
| 事件 ID | `角色_地點_事件` | `winley_park_secret` |
| 完成旗標 | `事件ID_done` | `winley_park_secret_done` |
| 任務階段旗標 | `任務ID_stage` | `cafe_job_stage` |
| 當天是否已發生 | `事件ID_today` | `winley_park_chat_today` |

### 什麼時候用哪一種？

- **只發生一次的劇情**：`..._done = true`
- **任務有多個步驟**：`..._stage = 0 / 1 / 2`，不要建立一堆 `questA_part1_done`、`questA_part2_done`
- **每天可發生一次的事件**：需要額外設計「換日重置」。目前專案尚未有統一的每日重置系統，新增前先和 AI 討論，不要假設 `_today` 會自動歸零。
- **一般日常聊天**：通常不需要旗標。

---

## 8. 對 AI 的固定要求（可直接複製）

建立事件前，將「事件卡」貼給 AI，再加上這段：

```md
這是 Twine SugarCube 專案，請依以下規則產生或修改 `.twee` 程式碼：

1. 不要改變既有的 NPC ID、事件 ID、旗標名稱或資料庫結構。
2. 遊戲時間使用 `$gameDate`；判斷整點時段請用 `$gameDate.getHours()`。
3. NPC 好感使用 `$npcRelations["NPC_ID"].affection`，聲望使用 `$reputation`，劇情旗標使用 `$flags["flag_id"]`。
4. 將「事件入口」與「事件內容」分成不同 passage；不要把長劇情塞進地點 passage。
5. 同時符合多個事件時，依優先層級由高到低檢查，最後必須有可重複的日常對話作為保底。
6. 一次性事件必須同時有「尚未完成」判斷與「結尾設為完成」的旗標。
7. 使用既有的角色台詞格式：`@@.npc-NPC_ID;台詞@@`。
8. 不要自行新增不在事件卡中的規則、數值或世界觀；資訊不足時先列出問題。
9. 回覆時先說明要新增／修改哪些 passage，再提供完整可貼上的 `.twee` 程式碼，並說明要放在哪個檔案。
```

---

## 9. 新增內容時的工作流程

1. 填事件卡。
2. 決定它屬於「一次性」、「條件分歧」或「日常」哪一類。
3. 決定它在入口中的優先位置。
4. 請 AI 依固定要求產生程式碼。
5. 在遊戲測試至少四種情況：
   - 條件不符合時，不應看見事件。
   - 條件符合時，應正確出現。
   - 看完後，一次性事件不應重播。
   - 同時符合多個事件時，應播放優先度較高者。
6. 測試通過後，再寫下一個事件。

**一次只增加一個小事件**，會比一次請 AI 寫十段劇情更容易找到錯誤。

---

## 10. 目前專案的第一個建議目標

先只完成以下最小版本，不要一次做完所有系統：

1. 每天 08:00–08:59，溫莉出現在公園。
2. 玩家能點擊和她聊天。
3. 有一段一次性的「初次見面」對話，結束後設旗標。
4. 初次見面後，顯示可重複的日常對話。
5. 再新增一段「初次見面後、好感至少 30、聲望至少 50」才會出現的秘密劇情。

完成這五步後，整套行程、前置劇情、好感門檻、聲望分歧和日後擴充的骨架就都具備了。
