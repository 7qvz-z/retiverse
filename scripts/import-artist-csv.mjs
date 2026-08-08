/**
 * ワンショット: 歌い手/VTuber/アーティスト CSV → alias-dictionary.json マージ
 *
 * 衝突時の方針:
 * - 同じ正式名（dictKey一致）→ 別名を追加
 * - 新正式名が既存の別名と一致 → 日本語名を正式名に昇格し、旧正式名を別名へ
 * - 新英語名が既存の正式名と一致 → 日本語名を優先して統合（旧正式名を別名へ）
 * - ローマ字列は取り込まない
 *
 * Usage:
 *   node scripts/import-artist-csv.mjs [csvPath]
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

/** @param {string} name */
function dictKey(name) {
  return name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\u3000・･._\-–—']/g, "")
    .replace(/[’'`]/g, "")
    .trim();
}

/**
 * 簡易 CSV（カンマ区切り・ダブルクォート対応）
 * @param {string} text
 * @returns {string[][]}
 */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    const next = src[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (ch === "\n" || (ch === "\r" && next === "\n")) {
      row.push(cell);
      cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
      if (ch === "\r") i += 1;
      continue;
    }
    if (ch === "\r") {
      row.push(cell);
      cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
      continue;
    }
    cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

/**
 * @typedef {Record<string, string[]>} AliasDictionary
 */

/**
 * @param {AliasDictionary} dict
 * @param {string} name
 * @returns {string | null} existing canonical key
 */
function findCanonicalByKey(dict, name) {
  const k = dictKey(name);
  if (!k) return null;
  for (const canonical of Object.keys(dict)) {
    if (dictKey(canonical) === k) return canonical;
  }
  return null;
}

/**
 * @param {AliasDictionary} dict
 * @param {string} name
 * @returns {{ canonical: string } | null}
 */
function findAsAlias(dict, name) {
  const k = dictKey(name);
  if (!k) return null;
  for (const [canonical, aliases] of Object.entries(dict)) {
    if (aliases.some((a) => dictKey(a) === k)) {
      return { canonical };
    }
  }
  return null;
}

/**
 * @param {string[]} list
 * @param {string} alias
 * @param {string} canonical
 */
function pushAlias(list, alias, canonical) {
  const ak = dictKey(alias);
  const ck = dictKey(canonical);
  if (!ak || ak === ck) return false;
  if (list.some((a) => dictKey(a) === ak)) return false;
  list.push(alias);
  return true;
}

/**
 * 旧エントリを新正式名へ吸収（日本語優先）
 * @param {AliasDictionary} dict
 * @param {string} japaneseCanonical
 * @param {string} oldCanonical
 */
function absorbCanonical(dict, japaneseCanonical, oldCanonical) {
  if (dictKey(japaneseCanonical) === dictKey(oldCanonical)) {
    return;
  }
  const absorbed = [...(dict[oldCanonical] ?? [])];
  delete dict[oldCanonical];

  // 他キーから japanese / old を別名として持つ参照を掃除
  for (const [key, aliases] of Object.entries(dict)) {
    dict[key] = aliases.filter(
      (a) =>
        dictKey(a) !== dictKey(japaneseCanonical) &&
        dictKey(a) !== dictKey(oldCanonical),
    );
  }

  const list = dict[japaneseCanonical] ?? [];
  pushAlias(list, oldCanonical, japaneseCanonical);
  for (const a of absorbed) {
    pushAlias(list, a, japaneseCanonical);
  }
  dict[japaneseCanonical] = list;
}

function main() {
  const csvPath =
    process.argv[2] ??
    path.join(
      process.env.USERPROFILE ?? "",
      "Downloads",
      "ai_studio_code.csv",
    );

  const csvText = readFileSync(csvPath, "utf8");
  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    throw new Error("CSV にデータ行がありません");
  }

  const header = rows[0].map((h) => h.trim());
  const iJa = header.indexOf("日本語名");
  const iEn = header.indexOf("英語名");
  if (iJa < 0 || iEn < 0) {
    throw new Error("ヘッダーに 日本語名 / 英語名 が必要です");
  }

  /** @type {AliasDictionary} */
  const dict = JSON.parse(readFileSync(DICT_PATH, "utf8"));
  const beforeCanonicals = new Set(Object.keys(dict));
  let beforeAliasCount = 0;
  for (const list of Object.values(dict)) beforeAliasCount += list.length;

  let addedCanonicals = 0;
  let addedAliases = 0;
  let skippedSameName = 0;
  const notes = [];

  for (const cols of rows.slice(1)) {
    const japanese = (cols[iJa] ?? "").trim();
    const english = (cols[iEn] ?? "").trim();
    if (!japanese) continue;

    // --- 正式名の解決（日本語優先） ---
    let canonicalKey = findCanonicalByKey(dict, japanese);

    if (!canonicalKey) {
      const asAlias = findAsAlias(dict, japanese);
      if (asAlias) {
        // 新正式名が既存の別名 → 日本語名を正式名に昇格
        notes.push(
          `別名→正式名昇格: 「${japanese}」was alias of「${asAlias.canonical}」`,
        );
        absorbCanonical(dict, japanese, asAlias.canonical);
        canonicalKey = japanese;
        if (!beforeCanonicals.has(japanese)) addedCanonicals += 1;
      }
    }

    if (!canonicalKey && english) {
      const enAsCanonical = findCanonicalByKey(dict, english);
      if (enAsCanonical && dictKey(enAsCanonical) !== dictKey(japanese)) {
        // 英語名が既存正式名 → 日本語を優先して統合
        notes.push(
          `英語正式名→日本語へ統合: 「${enAsCanonical}」→「${japanese}」`,
        );
        absorbCanonical(dict, japanese, enAsCanonical);
        canonicalKey = japanese;
        if (!beforeCanonicals.has(japanese)) addedCanonicals += 1;
      } else {
        const enAsAlias = findAsAlias(dict, english);
        if (
          enAsAlias &&
          dictKey(enAsAlias.canonical) !== dictKey(japanese)
        ) {
          // 英語名が別正式名の別名 → そのエントリ全体を日本語正式名へ寄せる
          notes.push(
            `英語別名の親を日本語へ統合: 「${enAsAlias.canonical}」(alias ${english})→「${japanese}」`,
          );
          absorbCanonical(dict, japanese, enAsAlias.canonical);
          canonicalKey = japanese;
          if (!beforeCanonicals.has(japanese)) addedCanonicals += 1;
        }
      }
    }

    if (!canonicalKey) {
      dict[japanese] = [];
      canonicalKey = japanese;
      addedCanonicals += 1;
    }

    // キー表記が微妙に違う場合は既存キーを維持（同じ dictKey）
    const canonical = canonicalKey;

    if (english) {
      if (dictKey(english) === dictKey(canonical)) {
        skippedSameName += 1;
      } else {
        const list = dict[canonical] ?? [];
        const before = list.length;
        if (pushAlias(list, english, canonical)) {
          addedAliases += 1;
        }
        dict[canonical] = list;
        void before;
      }
    }
  }

  // キーを localeCompare("ja") でソート、別名も同様
  /** @type {AliasDictionary} */
  const sorted = {};
  for (const key of Object.keys(dict).sort((a, b) => a.localeCompare(b, "ja"))) {
    sorted[key] = [...dict[key]].sort((a, b) => a.localeCompare(b, "ja"));
  }

  writeFileSync(DICT_PATH, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");

  let afterAliasCount = 0;
  for (const list of Object.values(sorted)) afterAliasCount += list.length;

  console.log(
    JSON.stringify(
      {
        csvPath,
        csvRows: rows.length - 1,
        addedCanonicals,
        addedAliases,
        skippedSameNameAsCanonical: skippedSameName,
        canonicalTotal: Object.keys(sorted).length,
        aliasTotal: afterAliasCount,
        aliasDelta: afterAliasCount - beforeAliasCount,
        collisionNotes: notes,
      },
      null,
      2,
    ),
  );
}

main();
