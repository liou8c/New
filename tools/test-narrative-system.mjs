/*
 * 敘事資料庫的快速自動測試。不需要開啟遊戲即可驗證：
 * 1. CSV 產物可載入；2. 一次性事件會切換旗標；3. 日常事件與效果可運作；
 * 4. 尚未翻譯的英文會安全回退中文。
 */
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";

function scriptFromTwee(source) { return source.replace(/^::[^\n]*\n/, ""); }
const state = {
    language: "zh-TW",
    gameDate: new Date(2026, 4, 24, 8, 0),
    flags: {},
    mood: 70,
    moodMax: 100,
    hpMax: 100,
    inventory: {},
    skillMaxLevel: 10,
    skills: {
        fitness: { level: 1, exp: 0 },
        cooking: { level: 1, exp: 0 }
    },
    npcRelations: { winley: { affection: 0, romance: 0, relationshipStatus: "affection" } }
};
const setup = {
    balance: { skills: { maxLevel: 10, expBase: 100, fitnessHpMaxGain: 6 } },
    gameDatabase: { items: { ramen: {}, tea: {} } },
    itemText: function (id) { return id === "ramen" ? "泡麵" : id === "tea" ? "紅茶" : id; },
    getSkillName: function (id) { return id === "fitness" ? "健身" : id === "cooking" ? "料理" : id; },
    npcText: function (id) { return id === "winley" ? "溫莉" : id; },
    canStartRomance: function (id) { return id === "winley" && state.npcRelations[id].affection >= 80; },
    changeNpcAffection: function (id, amount) { state.npcRelations[id].affection += amount; },
    changeNpcRomance: function (id, amount) { state.npcRelations[id].romance += amount; },
    acceptRomance: function () { return true; },
    declineRomance: function () { return true; },
    breakupWithNpc: function () { return true; }
};
const context = vm.createContext({ setup, State: { variables: state }, random: function () { return 0; }, window: { advanceTime: function (minutes) { state.gameDate.setMinutes(state.gameDate.getMinutes() + minutes); } }, console });
const gameDatabaseSource = await fs.readFile("src/_GameDatabase.twee", "utf8");
assert.match(gameDatabaseSource, /cookie:[\s\S]*stat: "satiety", amount: 20[\s\S]*stat: "mood", amount: 5/, "餅乾應同時恢復飽食度與心情");
const addItemStart = gameDatabaseSource.indexOf("setup.addItemToInventory = function");
const addItemEnd = gameDatabaseSource.indexOf("setup.useItem = function", addItemStart);
assert.ok(addItemStart >= 0 && addItemEnd > addItemStart, "應存在共用的加入背包函式");
await vm.runInContext(gameDatabaseSource.slice(addItemStart, addItemEnd), context);
await vm.runInContext(scriptFromTwee(await fs.readFile("src/_NarrativeDatabase.twee", "utf8")), context);
await vm.runInContext(scriptFromTwee(await fs.readFile("src/_NarrativeEngine.twee", "utf8")), context);

const sourceFiles = await fs.readdir("src", { recursive: true });
const usedTextKeys = [];
for (const sourceFile of sourceFiles.filter(function (name) { return name.endsWith(".twee"); })) {
    const source = await fs.readFile(`src/${sourceFile}`, "utf8");
    for (const match of source.matchAll(/<<storyText\s+"([^"]+)"/g)) { usedTextKeys.push(match[1]); }
}
usedTextKeys.forEach(function (textKey) {
    assert.ok(setup.narrativeDatabase.texts[textKey], `遊戲引用了不存在的 text_key：${textKey}`);
});

const widgetSource = await fs.readFile("src/_widget.twee", "utf8");
const narrativePassagesSource = await fs.readFile("src/NarrativePassages.twee", "utf8");
const passageHeaderSource = await fs.readFile("src/_Passage.twee", "utf8");
const streetSource = await fs.readFile("src/Map01_street.twee", "utf8");
const userStyleSource = await fs.readFile("src/_UserStyle.twee", "utf8");
const builtGameSource = await fs.readFile("build/Untitled-Story.html", "utf8");
assert.doesNotMatch(widgetSource, /new Wikifier\(this\.output/, "storyText 不可從 <<run>> 讀取不存在的 this.output");
assert.doesNotMatch(narrativePassagesSource, /new Wikifier\(this\.output/, "故事事件不可從 <<run>> 讀取不存在的 this.output");
assert.match(widgetSource, /<<print setup\.interpolateNarrativeText/, "storyText 應交由 SugarCube 的 <<print>> 安全輸出");
assert.ok(setup.narrativeDatabase.texts.joel_first_meeting["zh-TW"].includes("你的鑰匙"), "喬爾初見舊文本應保留在資料庫");
assert.match(narrativePassagesSource, /:: 故事事件 \[narrative\]/, "故事事件 passage 應允許顯示 Banner");
assert.match(passageHeaderSource, /_narrativeBannerEvent\.banner/, "PassageHeader 應讀取事件指定的 Banner");
assert.match(builtGameSource, /name="故事事件" tags="narrative"/, "目前可玩的 HTML 應包含可顯示 Banner 的故事事件 passage");
assert.match(builtGameSource, /"banner": "street"/, "目前可玩的 HTML 應包含溫莉事件的 Banner 資料");
assert.match(widgetSource, /setup\.gainSkillExp\(_skillId, _gain\)/, "技能 widget 應共用敘事引擎的升級流程");
assert.match(builtGameSource, /setup\.addItemToInventory = function/, "目前可玩的 HTML 應包含共用背包入口");
assert.match(builtGameSource, /effect\.type === "giveItem"/, "目前可玩的 HTML 應支援劇情給予物品效果");
assert.match(builtGameSource, /name: "餅乾"[\s\S]*飽食度 \+20、心情 \+5/, "目前可玩的 HTML 應包含餅乾的雙重恢復效果");
assert.doesNotMatch(streetSource, /目前沒有可觸發的事件。/, "沒有符合事件時不應顯示出戲的系統提示");
assert.doesNotMatch(builtGameSource, /目前沒有可觸發的事件。/, "目前可玩的 HTML 不應顯示出戲的系統提示");
assert.match(userStyleSource, /\.scene-banner img[\s\S]*margin-bottom: 1em/, "Banner 與正文應只保留一行間距");
assert.match(userStyleSource, /\.button-container[\s\S]*margin-top: 1em/, "正文與按鈕應使用相同的一行間距");

const cookingResult = setup.gainSkillExp("cooking", 120);
assert.equal(cookingResult.level, 2, "料理獲得 120 經驗後應升到 2 級");
assert.equal(state.skills.cooking.exp, 20, "升級後應保留多出的 20 經驗");
setup.applyNarrativeEffects([{ type: "gainSkillExp", skillId: "fitness", amount: 100 }], {});
assert.equal(state.skills.fitness.level, 2, "劇情效果應能提升健身技能");
assert.equal(state.hpMax, 106, "健身升級仍應增加體力上限");
setup.applyNarrativeEffects([{ type: "giveItem", itemId: "ramen", quantity: 2 }], {});
assert.equal(state.inventory.ramen, 2, "劇情選項應能把指定數量的物品加入背包");
assert.equal(setup.addItemToInventory("tea", 1.8).added, 1, "物品數量應取正整數");
assert.equal(setup.addItemToInventory("missing_item", 3).ok, false, "不存在的物品 ID 不應加入背包");
assert.equal(state.inventory.missing_item, undefined, "不存在的物品不可污染背包資料");

const intro = setup.pickNarrativeEvent("winley_park", {});
assert.equal(intro.id, "winley_park_intro", "首次見面應優先於日常事件");
assert.equal(intro.banner, "street", "溫莉公園事件應顯示公園目前共用的街道 Banner");
setup.openNarrativeEvent(intro.id, {});
assert.equal(setup.finishNarrativeChoice(intro.id, "continue"), "公園");
assert.equal(state.flags.winley_park_intro_done, true, "首次見面應寫入完成旗標");
assert.equal(state.npcRelations.winley.affection, 5, "首次見面應增加 5 點好感");

state.flags.winley_park_left_on = null;
const daily = setup.pickNarrativeEvent("winley_park", {});
assert.ok(daily.id.startsWith("winley_park_"), "首次見面後應能挑選日常事件");
if (daily.id === "winley_park_coffee_first") {
    setup.openNarrativeEvent(daily.id, {});
    assert.equal(state.flags.winley_park_coffee_count, 1, "咖啡日常應累加次數");
    assert.equal(state.mood, 75, "咖啡日常應增加心情");
}

state.language = "en";
assert.equal(setup.getNarrativeText("winley_park_intro"), setup.narrativeDatabase.texts.winley_park_intro["zh-TW"], "未翻譯英文應回退中文");
console.log("敘事資料庫測試通過。");
