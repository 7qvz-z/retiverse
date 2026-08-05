import { dictKey } from "@/lib/artist-extract/normalize";
import type { ValidationResult } from "@/lib/artist-extract/validate";

export type ArtistCorrectionKind =
  | "alias"
  | "reject"
  | "rename"
  | "confirm"
  | "split";

export type ArtistCorrection = {
  id?: string;
  kind: ArtistCorrectionKind;
  raw_name: string;
  canonical_name?: string | null;
  split_into?: string[] | null;
  source_title?: string | null;
  source_channel?: string | null;
};

/**
 * ユーザー修正を解析結果に適用（学習反映）
 */
export function applyArtistCorrections(
  result: ValidationResult,
  corrections: ArtistCorrection[],
): ValidationResult {
  if (corrections.length === 0) return result;

  let confirmed = [...result.confirmed];
  let unclassified = [...result.unclassified];

  const removeName = (name: string) => {
    const k = dictKey(name);
    confirmed = confirmed.filter((n) => dictKey(n) !== k);
    unclassified = unclassified.filter((u) => dictKey(u.name) !== k);
  };

  const addConfirmed = (name: string) => {
    const t = name.trim();
    if (!t) return;
    if (!confirmed.some((n) => dictKey(n) === dictKey(t))) {
      confirmed.push(t);
    }
  };

  // 新しい順に適用したい場合は呼び出し側で sort 済み想定。ここでは順次適用。
  for (const c of corrections) {
    const raw = c.raw_name?.trim();
    if (!raw) continue;

    switch (c.kind) {
      case "reject": {
        removeName(raw);
        break;
      }
      case "rename":
      case "alias": {
        const canonical = c.canonical_name?.trim();
        if (!canonical) break;
        removeName(raw);
        addConfirmed(canonical);
        break;
      }
      case "confirm": {
        removeName(raw);
        addConfirmed(c.canonical_name?.trim() || raw);
        break;
      }
      case "split": {
        const parts = (c.split_into ?? [])
          .map((s) => s.trim())
          .filter(Boolean);
        removeName(raw);
        for (const p of parts) addConfirmed(p);
        break;
      }
      default:
        break;
    }
  }

  return {
    confirmed: confirmed.sort((a, b) => a.localeCompare(b, "ja")),
    unclassified: unclassified.sort((a, b) =>
      a.name.localeCompare(b.name, "ja"),
    ),
    similarPairs: result.similarPairs.filter(
      (p) =>
        confirmed.includes(p.a) &&
        confirmed.includes(p.b),
    ),
  };
}
