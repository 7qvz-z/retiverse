import {
  dictKey,
  mergeAliasIntoDictionary,
  type AliasDictionary,
} from "./normalize";

export type ArtistCorrection = {
  kind: "alias" | "reject" | "rename" | "confirm" | "split";
  rawName: string;
  canonicalName: string | null;
  splitInto: string[] | null;
};

export type ArtistOverrides = {
  /** rename / alias から構築（既存辞書より優先） */
  aliases: AliasDictionary;
  /** dictKey 済み */
  rejected: Set<string>;
  /** dictKey 済み。採用基準をバイパス */
  confirmed: Set<string>;
  /** dictKey → 分割後の名前 */
  splits: Map<string, string[]>;
};

export const EMPTY_OVERRIDES: ArtistOverrides = {
  aliases: {},
  rejected: new Set(),
  confirmed: new Set(),
  splits: new Map(),
};

/** DB 行（snake_case）→ パイプライン用 */
export function correctionFromDbRow(row: {
  kind: string;
  raw_name: string;
  canonical_name?: string | null;
  split_into?: string[] | null;
}): ArtistCorrection {
  return {
    kind: row.kind as ArtistCorrection["kind"],
    rawName: row.raw_name,
    canonicalName: row.canonical_name ?? null,
    splitInto: row.split_into ?? null,
  };
}

/**
 * ユーザー修正行からオーバーライドを構築。
 * 同一 raw への後勝ち（配列順で上書き）。
 */
export function buildOverrides(rows: ArtistCorrection[]): ArtistOverrides {
  const aliases: AliasDictionary = {};
  const rejected = new Set<string>();
  const confirmed = new Set<string>();
  const splits = new Map<string, string[]>();

  for (const row of rows) {
    const raw = row.rawName?.trim();
    if (!raw) continue;
    const rawKey = dictKey(raw);

    switch (row.kind) {
      case "alias":
      case "rename": {
        const canonical = row.canonicalName?.trim();
        if (!canonical) break;
        rejected.delete(rawKey);
        splits.delete(rawKey);
        const list = aliases[canonical] ?? [];
        if (
          dictKey(raw) !== dictKey(canonical) &&
          !list.some((a) => dictKey(a) === rawKey)
        ) {
          list.push(raw);
        }
        aliases[canonical] = list;
        break;
      }
      case "reject": {
        rejected.add(rawKey);
        confirmed.delete(rawKey);
        splits.delete(rawKey);
        break;
      }
      case "confirm": {
        const name = (row.canonicalName?.trim() || raw).trim();
        const nameKey = dictKey(name);
        confirmed.add(nameKey);
        rejected.delete(nameKey);
        rejected.delete(rawKey);
        break;
      }
      case "split": {
        const parts = (row.splitInto ?? [])
          .map((s) => s.trim())
          .filter(Boolean);
        if (parts.length < 2) break;
        splits.set(rawKey, parts);
        rejected.delete(rawKey);
        for (const p of parts) {
          confirmed.add(dictKey(p));
        }
        break;
      }
      default:
        break;
    }
  }

  return { aliases, rejected, confirmed, splits };
}

/** ファイル辞書の上にユーザー alias を重ねる（ユーザー優先） */
export function mergeDictionaryWithOverrides(
  base: AliasDictionary,
  overrides: ArtistOverrides,
): AliasDictionary {
  let next: AliasDictionary = { ...base };
  for (const [canonical, aliasList] of Object.entries(overrides.aliases)) {
    if (!next[canonical]) {
      next[canonical] = [];
    }
    for (const alias of aliasList) {
      next = mergeAliasIntoDictionary(next, canonical, alias);
    }
  }
  return next;
}

/** ユーザー指定の分割があれば展開 */
export function expandUserSplits(
  name: string,
  splits: Map<string, string[]>,
): string[] {
  const parts = splits.get(dictKey(name));
  if (parts && parts.length >= 2) return [...parts];
  return [name];
}

export function isRejectedName(
  name: string,
  rejected: Set<string>,
): boolean {
  return rejected.has(dictKey(name));
}

export function isUserConfirmedName(
  name: string,
  confirmed: Set<string>,
): boolean {
  return confirmed.has(dictKey(name));
}
