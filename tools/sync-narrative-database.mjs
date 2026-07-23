/**
 * 將 Google Sheet 匯出的三個 CSV 轉成 SugarCube 可讀的資料庫。
 *
 * 使用方式：
 *   node tools/sync-narrative-database.mjs database/story
 *
 * Google Sheet 請分別下載「Story Events」「Story Text」「Choices」三個工作表為 CSV，
 * 放進 database/story。這個工具會驗證 ID、JSON 欄位與引用關係，成功後才覆寫
 * src/_NarrativeDatabase.twee，因此表格中少打一個逗號不會直接讓遊戲壞掉。
 */
import fs from "node:fs/promises";
import path from "node:path";

const inputDir = path.resolve(process.argv[2] || "database/story");
const outputFile = path.resolve("src/_NarrativeDatabase.twee");

function parseCsv(source) {
    const rows = [];
    let row = [];
    let value = "";
    let quoted = false;

    for (let index = 0; index < source.length; index += 1) {
        const character = source[index];
        const next = source[index + 1];
        if (quoted && character === '"' && next === '"') {
            value += '"';
            index += 1;
        } else if (character === '"') {
            quoted = !quoted;
        } else if (!quoted && character === ",") {
            row.push(value);
            value = "";
        } else if (!quoted && (character === "\n" || character === "\r")) {
            if (character === "\r" && next === "\n") { index += 1; }
            row.push(value);
            if (row.some(function (cell) { return cell !== ""; })) { rows.push(row); }
            row = [];
            value = "";
        } else {
            value += character;
        }
    }
    row.push(value);
    if (row.some(function (cell) { return cell !== ""; })) { rows.push(row); }
    if (!rows.length) { return []; }
    const headers = rows.shift().map(function (header) { return header.trim(); });
    return rows.map(function (cells, rowIndex) {
        const record = {};
        headers.forEach(function (header, columnIndex) { record[header] = (cells[columnIndex] || "").trim(); });
        record.__row = rowIndex + 2;
        return record;
    });
}

async function readTable(filename) {
    return parseCsv(await fs.readFile(path.join(inputDir, filename), "utf8"));
}

function parseJson(value, file, row, column, errors, fallback) {
    if (!value) { return fallback; }
    try { return JSON.parse(value); }
    catch (error) {
        errors.push(`${file} 第 ${row} 列的 ${column} 不是合法 JSON：${error.message}`);
        return fallback;
    }
}

function required(record, column, file, errors) {
    if (!record[column]) {
        errors.push(`${file} 第 ${record.__row} 列缺少 ${column}`);
        return false;
    }
    return true;
}

const errors = [];
const [eventRows, textRows, choiceRows] = await Promise.all([
    readTable("Story Events.csv"),
    readTable("Story Text.csv"),
    readTable("Choices.csv")
]);

const texts = {};
for (const row of textRows) {
    if (!required(row, "text_key", "Story Text.csv", errors)) { continue; }
    if (texts[row.text_key]) { errors.push(`Story Text.csv 的 text_key 重複：${row.text_key}`); }
    texts[row.text_key] = {
        "zh-TW": row.zh_TW || "",
        en: row.en || "",
        notes: row.notes || ""
    };
}

const choices = {};
for (const row of choiceRows) {
    if (!required(row, "choice_set_id", "Choices.csv", errors) || !required(row, "choice_id", "Choices.csv", errors)) { continue; }
    const choice = {
        id: row.choice_id,
        sort: Number(row.sort || 0),
        label: { "zh-TW": row.label_zh_TW || "", en: row.label_en || "" },
        conditions: parseJson(row.conditions_json, "Choices.csv", row.__row, "conditions_json", errors, []),
        effects: parseJson(row.effects_json, "Choices.csv", row.__row, "effects_json", errors, []),
        targetPassage: row.target_passage || "",
        notes: row.notes || ""
    };
    choices[row.choice_set_id] ||= [];
    if (choices[row.choice_set_id].some(function (item) { return item.id === choice.id; })) {
        errors.push(`Choices.csv 的選項 ID 重複：${row.choice_set_id}/${choice.id}`);
    }
    choices[row.choice_set_id].push(choice);
}
Object.values(choices).forEach(function (choiceSet) { choiceSet.sort(function (a, b) { return a.sort - b.sort; }); });

const events = {};
for (const row of eventRows) {
    if (!required(row, "event_id", "Story Events.csv", errors) || !required(row, "scene_id", "Story Events.csv", errors)) { continue; }
    if (!required(row, "text_key", "Story Events.csv", errors)) { continue; }
    if (events[row.event_id]) { errors.push(`Story Events.csv 的 event_id 重複：${row.event_id}`); }
    if (!texts[row.text_key]) { errors.push(`Story Events.csv 第 ${row.__row} 列引用了不存在的 text_key：${row.text_key}`); }
    if (row.choice_set_id && !choices[row.choice_set_id]) { errors.push(`Story Events.csv 第 ${row.__row} 列引用了不存在的 choice_set_id：${row.choice_set_id}`); }
    events[row.event_id] = {
        id: row.event_id,
        sceneId: row.scene_id,
        banner: row.banner || "",
        priority: Number(row.priority || 0),
        mode: row.mode || "repeatable",
        conditions: parseJson(row.conditions_json, "Story Events.csv", row.__row, "conditions_json", errors, []),
        onEnter: parseJson(row.on_enter_effects_json, "Story Events.csv", row.__row, "on_enter_effects_json", errors, []),
        textKey: row.text_key,
        choiceSetId: row.choice_set_id || "",
        notes: row.notes || ""
    };
}

if (errors.length) {
    console.error("資料庫未更新，請修正下列問題：\n- " + errors.join("\n- "));
    process.exit(1);
}

const database = { version: 1, defaultLanguage: "zh-TW", texts, choices, events };
const generated = `:: NarrativeDatabase [script]\n/*\n * 此檔案由 tools/sync-narrative-database.mjs 自動產生。\n * 請在 Google Sheet／database/story 的 CSV 修改文本，再執行同步工具；不要直接編輯這個檔案。\n */\nsetup.narrativeDatabase = ${JSON.stringify(database, null, 4)};\n`;
await fs.writeFile(outputFile, generated, "utf8");
console.log(`已寫入 ${outputFile}（${Object.keys(events).length} 個事件、${Object.keys(texts).length} 段文本、${Object.keys(choices).length} 組選項）。`);
