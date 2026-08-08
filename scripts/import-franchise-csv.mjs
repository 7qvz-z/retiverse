/**
 * ラブライブ / アイマス CSV → group-members / unit-members / alias-dictionary にマージ
 *
 * CSV 列: シリーズ,ユニット,日本語名,英語名
 *
 * Usage:
 *   node scripts/import-franchise-csv.mjs "path1.csv" "path2.csv" ...
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DICT_PATH = path.join(
  ROOT,
  "src/lib/artist-extract/alias-dictionary.json",
);
const GROUP_PATH = path.join(
  ROOT,
  "src/lib/artist-extract/group-members.json",
);
const UNIT_PATH = path.join(ROOT, "src/lib/artist-extract/unit-members.json");

/** シリーズ名 → 既存グループ正式名（重複を避ける） */
const SERIES_GROUP_CANONICAL = {
  学園アイドルマスター: "初星学園",
};

/** グループ追加エイリアス */
const EXTRA_GROUP_ALIASES = {
  初星学園: ["学園アイドルマスター", "学マス", "Gakuen Idolmaster", "Gakumas"],
  "ラブライブ！": ["ラブライブ", "Love Live", "LoveLive", "μ'sシリーズ"],
  "ラブライブ！サンシャイン!!": [
    "ラブライブサンシャイン",
    "Love Live Sunshine",
    "Aqoursシリーズ",
  ],
  "ラブライブ！虹ヶ咲学園スクールアイドル同好会": [
    "虹ヶ咲",
    "ニジガク",
    "Nijigasaki",
    "Love Live Nijigasaki",
  ],
  "ラブライブ！スーパースター!!": [
    "ラブライブスーパースター",
    "Love Live Superstar",
    "Liella",
  ],
  "ラブライブ！蓮ノ空女学院スクールアイドルクラブ": [
    "蓮ノ空",
    "Hasunosora",
    "Love Live Hasunosora",
  ],
  "イキヅライブ！ LOVELIVE! BLUEBIRD": [
    "イキヅライブ",
    "いきづらい部",
    "Ikizulive",
    "LOVELIVE BLUEBIRD",
    "Love Live Bluebird",
  ],
  アイドルマスター: [
    "アイマス",
    "THE IDOLM@STER",
    "Idolmaster",
    "765PRO",
    "765プロ",
  ],
  "アイドルマスター シンデレラガールズ": [
    "デレマス",
    "シンデレラガールズ",
    "Cinderella Girls",
    "IMAS CG",
  ],
  "アイドルマスター ミリオンライブ！": [
    "ミリマス",
    "ミリオンライブ",
    "Million Live",
  ],
  "アイドルマスター SideM": ["SideM", "サイマス", "Idolmaster SideM"],
  "アイドルマスター シャイニーカラーズ": [
    "シャニマス",
    "シャイニーカラーズ",
    "Shiny Colors",
    "ShinyColors",
  ],
};

function dictKey(name) {
  return name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\u3000・･._\-–—'!！]/g, "")
    .replace(/[\u2019'`]/g, "")
    .trim();
}

function pushAlias(list, alias, canonical) {
  const ak = dictKey(alias);
  const ck = dictKey(canonical);
  if (!ak || ak === ck) return false;
  if (list.some((a) => dictKey(a) === ak)) return false;
  list.push(alias);
  return true;
}

function parseCsv(text) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .trim()
    .split(/\r?\n/);
  const rows = [];
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue;
    // カンマ区切り（英語名にカンマは無い想定）
    const cols = line.split(",");
    const series = (cols[0] ?? "").trim();
    const unit = (cols[1] ?? "").trim();
    const ja = (cols[2] ?? "").trim();
    const en = (cols.slice(3).join(",") ?? "").trim();
    if (!series || !ja) continue;
    rows.push({ series, unit, ja, en });
  }
  return rows;
}

function categoryForSeries(series) {
  if (series.includes("ラブライブ") || series.includes("イキヅライブ")) {
    return "lovelive";
  }
  if (series.includes("アイドルマスター") || series.includes("アイマス")) {
    return "idolmaster";
  }
  return "franchise";
}

function resolveGroupName(series, unit) {
  if (SERIES_GROUP_CANONICAL[series]) return SERIES_GROUP_CANONICAL[series];
  if (unit === "初星学園") return "初星学園";
  return series;
}

const csvPaths = process.argv.slice(2);
if (csvPaths.length === 0) {
  console.error("Usage: node scripts/import-franchise-csv.mjs <csv>...");
  process.exit(1);
}

/** @type {Record<string, string[]>} */
const dict = JSON.parse(readFileSync(DICT_PATH, "utf8"));
/** @type {Record<string, { category: string, members: string[] }>} */
const groups = JSON.parse(readFileSync(GROUP_PATH, "utf8"));
/** @type {Record<string, { group?: string, members: string[] }>} */
const units = JSON.parse(readFileSync(UNIT_PATH, "utf8"));

let addedAliases = 0;
let memberAdds = 0;
let unitAdds = 0;

for (const csvPath of csvPaths) {
  const rows = parseCsv(readFileSync(csvPath, "utf8"));
  console.log(`Reading ${csvPath}: ${rows.length} rows`);

  for (const { series, unit, ja, en } of rows) {
    const groupName = resolveGroupName(series, unit);

    // --- aliases: member ---
    if (!dict[ja]) dict[ja] = [];
    if (en && pushAlias(dict[ja], en, ja)) addedAliases += 1;

    // --- group members ---
    if (!groups[groupName]) {
      groups[groupName] = {
        category: categoryForSeries(series),
        members: [],
      };
    }
    const gMembers = groups[groupName].members;
    if (!gMembers.some((m) => dictKey(m) === dictKey(ja))) {
      gMembers.push(ja);
      memberAdds += 1;
    }

    // --- unit members（シリーズ名＝ユニット名はグループ扱いのみ） ---
    if (
      unit &&
      dictKey(unit) !== dictKey(series) &&
      dictKey(unit) !== dictKey(groupName)
    ) {
      if (!units[unit]) {
        units[unit] = { group: groupName, members: [] };
        unitAdds += 1;
      } else if (!units[unit].group) {
        units[unit].group = groupName;
      }
      const uMembers = units[unit].members;
      if (!uMembers.some((m) => dictKey(m) === dictKey(ja))) {
        uMembers.push(ja);
      }
      if (!dict[unit]) dict[unit] = [];
    }

    // --- aliases: series / group ---
    if (!dict[groupName]) dict[groupName] = [];
    if (series !== groupName) {
      if (pushAlias(dict[groupName], series, groupName)) addedAliases += 1;
    }
  }
}

for (const [group, aliases] of Object.entries(EXTRA_GROUP_ALIASES)) {
  if (!dict[group]) dict[group] = [];
  for (const a of aliases) {
    if (pushAlias(dict[group], a, group)) addedAliases += 1;
  }
}

// ユニット名がグループ正式名のほぼ別名のときだけ削除
// （例: 虹ヶ咲学園… ⊂ ラブライブ！虹ヶ咲…）
// μ's / Aqours / 765PRO など固有ユニット名は残す（検出時にメンバー展開するため）
let removedFullUnits = 0;
for (const [unitName, entry] of Object.entries(units)) {
  const groupName = entry.group;
  if (!groupName || !groups[groupName]) continue;
  const u = dictKey(unitName);
  const g = dictKey(groupName);
  const nameIsGroupAlias =
    u === g || (u.length >= 4 && g.includes(u)) || (g.length >= 4 && u.includes(g));
  if (!nameIsGroupAlias) continue;
  if (!dict[groupName]) dict[groupName] = [];
  if (pushAlias(dict[groupName], unitName, groupName)) addedAliases += 1;
  delete units[unitName];
  removedFullUnits += 1;
}

/** @type {Record<string, string[]>} */
const sortedDict = {};
for (const key of Object.keys(dict).sort((a, b) => a.localeCompare(b, "ja"))) {
  sortedDict[key] = [...dict[key]].sort((a, b) => a.localeCompare(b, "ja"));
}

/** @type {typeof groups} */
const sortedGroups = {};
for (const key of Object.keys(groups).sort((a, b) =>
  a.localeCompare(b, "ja"),
)) {
  sortedGroups[key] = {
    category: groups[key].category,
    members: [...groups[key].members],
  };
}

/** @type {typeof units} */
const sortedUnits = {};
for (const key of Object.keys(units).sort((a, b) => a.localeCompare(b, "ja"))) {
  sortedUnits[key] = {
    ...(units[key].group ? { group: units[key].group } : {}),
    members: [...units[key].members],
  };
}

writeFileSync(DICT_PATH, `${JSON.stringify(sortedDict, null, 2)}\n`, "utf8");
writeFileSync(GROUP_PATH, `${JSON.stringify(sortedGroups, null, 2)}\n`, "utf8");
writeFileSync(UNIT_PATH, `${JSON.stringify(sortedUnits, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      addedAliases,
      memberAdds,
      unitEntriesAdded: unitAdds,
      removedFullGroupUnits: removedFullUnits,
      groups: Object.fromEntries(
        Object.entries(sortedGroups).map(([k, v]) => [k, v.members.length]),
      ),
      units: Object.fromEntries(
        Object.entries(sortedUnits).map(([k, v]) => [
          k,
          { group: v.group ?? null, n: v.members.length },
        ]),
      ),
      sample: {
        "μ's": sortedUnits["μ's"],
        "高坂穂乃果": sortedDict["高坂穂乃果"],
        天海春香: sortedDict["天海春香"],
        初星学園: {
          members: sortedGroups["初星学園"]?.members.length,
          aliases: sortedDict["初星学園"]?.slice(0, 8),
        },
      },
    },
    null,
    2,
  ),
);
