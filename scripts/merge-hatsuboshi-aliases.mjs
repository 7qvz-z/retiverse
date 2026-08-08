/**
 * 初星学園アイドル CSV → alias-dictionary.json に英語名+ローマ字をマージ
 * Usage: node scripts/merge-hatsuboshi-aliases.mjs [csvPath]
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

function dictKey(name) {
  return name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\u3000・･._\-–—']/g, "")
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

const csvPath =
  process.argv[2] ??
  path.join(
    process.env.USERPROFILE ?? "",
    "Downloads",
    "ai_studio_code (1).csv",
  );

const lines = readFileSync(csvPath, "utf8")
  .replace(/^\uFEFF/, "")
  .trim()
  .split(/\r?\n/)
  .slice(1);

/** @type {Record<string, string[]>} */
const dict = JSON.parse(readFileSync(DICT_PATH, "utf8"));
let added = 0;

for (const line of lines) {
  const cols = line.split(",");
  const ja = (cols[1] ?? "").trim();
  const english = (cols[2] ?? "").trim();
  const romaji = (cols[3] ?? "").trim();
  if (!ja) continue;
  if (!dict[ja]) dict[ja] = [];
  const list = dict[ja];
  for (const a of [english, romaji]) {
    if (a && pushAlias(list, a, ja)) added += 1;
  }
  dict[ja] = list;
}

/** @type {Record<string, string[]>} */
const sorted = {};
for (const key of Object.keys(dict).sort((a, b) => a.localeCompare(b, "ja"))) {
  sorted[key] = [...dict[key]].sort((a, b) => a.localeCompare(b, "ja"));
}

writeFileSync(DICT_PATH, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
console.log(
  JSON.stringify(
    {
      addedAliases: added,
      花海咲季: sorted["花海咲季"],
      葛城リーリヤ: sorted["葛城リーリヤ"],
      十王星南: sorted["十王星南"],
    },
    null,
    2,
  ),
);
