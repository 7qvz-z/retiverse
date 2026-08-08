/**
 * グループ／ユニット／ソロの優先解決
 *
 * 1動画あたりの優先順位（「グループ検出＝メンバー全員確定」はしない）:
 * 1. ソロ … タイトルからメンバー個人が分かる → その人だけ（＋グループ名は残してよい）
 * 2. ユニット … ユニット名が分かる → そのユニットのメンバーだけ
 * 3. グループのみ … 個人もユニットも無い → グループ正式名のみ
 * 4. 該当なし … 通常のルール抽出に任せる
 */

import groupMembersJson from "./group-members.json";
import unitMembersJson from "./unit-members.json";
import {
  ALIAS_DICTIONARY,
  dictKey,
  type AliasDictionary,
} from "./normalize";

export type GroupEntry = {
  category: string;
  members: string[];
};

export type UnitEntry = {
  group?: string;
  members: string[];
};

export type GroupMembersDictionary = Record<string, GroupEntry>;
export type UnitMembersDictionary = Record<string, UnitEntry>;

export const GROUP_MEMBERS: GroupMembersDictionary =
  groupMembersJson as GroupMembersDictionary;

export const UNIT_MEMBERS: UnitMembersDictionary =
  unitMembersJson as UnitMembersDictionary;

export type FranchiseKind = "solo" | "unit" | "group" | "none";

export type FranchiseResolution = {
  kind: FranchiseKind;
  /** この動画で採用するアーティスト（確定候補） */
  artists: string[];
  group: string | null;
  unit: string | null;
};

type Mention = {
  display: string;
  needles: string[];
};

function uniqueByKey(names: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    const t = name.trim();
    if (!t) continue;
    const k = dictKey(t);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

function needlesForName(
  canonical: string,
  dictionary: AliasDictionary,
): string[] {
  const needles = new Set<string>();
  const add = (s: string) => {
    const t = s.normalize("NFKC").trim();
    if (t.length >= 2) needles.add(t);
  };
  add(canonical);
  for (const a of dictionary[canonical] ?? []) add(a);
  return [...needles].sort((a, b) => b.length - a.length);
}

function textMentions(haystack: string, needles: string[]): boolean {
  if (!haystack || needles.length === 0) return false;
  const norm = haystack.normalize("NFKC");
  const lower = norm.toLowerCase();
  for (const needle of needles) {
    if (needle.length < 2) continue;
    if (norm.includes(needle)) return true;
    if (lower.includes(needle.toLowerCase())) return true;
  }
  return false;
}

function findMentioned(haystack: string, mentions: Mention[]): string[] {
  const hit: string[] = [];
  const seen = new Set<string>();
  const sorted = [...mentions].sort(
    (a, b) =>
      Math.max(...b.needles.map((n) => n.length), 0) -
      Math.max(...a.needles.map((n) => n.length), 0),
  );
  for (const m of sorted) {
    if (!textMentions(haystack, m.needles)) continue;
    const k = dictKey(m.display);
    if (seen.has(k)) continue;
    seen.add(k);
    hit.push(m.display);
  }
  return hit;
}

const GROUP_BY_KEY = (() => {
  const map = new Map<string, { group: string; entry: GroupEntry }>();
  for (const [group, entry] of Object.entries(GROUP_MEMBERS)) {
    map.set(dictKey(group), { group, entry });
  }
  return map;
})();

/** グループ正式名のメンバー一覧 */
export function getGroupMembers(name: string): string[] {
  const hit = GROUP_BY_KEY.get(dictKey(name));
  return hit ? [...hit.entry.members] : [];
}

export function isKnownGroupName(name: string): string | null {
  const direct = GROUP_BY_KEY.get(dictKey(name));
  return direct ? direct.group : null;
}

function detectGroupsInText(
  title: string,
  channelTitle: string,
  dictionary: AliasDictionary,
): string[] {
  const found: string[] = [];
  const haystacks = [channelTitle, title].filter(Boolean);

  for (const group of Object.keys(GROUP_MEMBERS)) {
    const needles = needlesForName(group, dictionary);
    if (haystacks.some((h) => textMentions(h, needles))) {
      found.push(group);
    }
  }
  return uniqueByKey(found);
}

/**
 * タイトル・チャンネルからソロ／ユニット／グループを優先解決する。
 * kind === "none" のときは通常パイプラインを使う。
 */
export function resolveFranchiseArtists(
  title: string,
  channelTitle: string,
  dictionary: AliasDictionary = ALIAS_DICTIONARY,
): FranchiseResolution {
  const groups = detectGroupsInText(title, channelTitle, dictionary);
  if (groups.length === 0) {
    return { kind: "none", artists: [], group: null, unit: null };
  }

  const primaryGroup = groups[0];
  const memberPool = new Set<string>();
  for (const g of groups) {
    for (const m of getGroupMembers(g)) memberPool.add(m);
  }

  // 1. ソロ: タイトルにメンバー個人
  const memberMentions: Mention[] = [...memberPool].map((m) => ({
    display: m,
    needles: needlesForName(m, dictionary),
  }));
  const solos = findMentioned(title, memberMentions);
  if (solos.length > 0) {
    return {
      kind: "solo",
      artists: uniqueByKey([...solos, primaryGroup]),
      group: primaryGroup,
      unit: null,
    };
  }

  // 2. ユニット: タイトルにユニット名 → そのメンバーだけ（グループ全員は出さない）
  const unitMentions: Mention[] = [];
  for (const [unitName, entry] of Object.entries(UNIT_MEMBERS)) {
    if (
      entry.group &&
      !groups.some((g) => dictKey(g) === dictKey(entry.group ?? ""))
    ) {
      continue;
    }
    unitMentions.push({
      display: unitName,
      needles: needlesForName(unitName, dictionary),
    });
  }
  const units = findMentioned(title, unitMentions);
  if (units.length > 0) {
    const unitArtists: string[] = [];
    for (const u of units) {
      const entry = UNIT_MEMBERS[u];
      if (!entry) continue;
      unitArtists.push(...entry.members);
    }
    return {
      kind: "unit",
      artists: uniqueByKey(unitArtists),
      group: primaryGroup,
      unit: units[0] ?? null,
    };
  }

  // 3. グループのみ（全員展開しない）
  return {
    kind: "group",
    artists: [primaryGroup],
    group: primaryGroup,
    unit: null,
  };
}

/**
 * @deprecated 全員展開は廃止。互換のため入力をそのまま一意化するだけ。
 */
export function expandGroupMembers(names: string[]): string[] {
  return uniqueByKey(names);
}
