/**
 * 分割ステップ（厳格化）
 * - feat. は「本体 feat. 相手」の完全形のみ
 * - 括弧は対が揃っているときだけ除去
 */

function key(name: string): string {
  return name
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\u3000]/g, "")
    .trim();
}

export type SplitResult = {
  artists: string[];
  /** 括弧破綻など要確認 */
  unclassified: string[];
  /** feat. 欠落などで破棄 */
  discarded: string[];
};

const COLLAB_SPLIT =
  /\s*[×✕✖ｘ]\s*|\s+[xX]\s+|\s*[&＆]\s*|\s*[、,]\s*/;

/** 括弧の開閉が揃っているか */
export function hasBalancedParens(text: string): boolean {
  let round = 0;
  let square = 0;
  let curly = 0;
  for (const ch of text) {
    if (ch === "(" || ch === "（") round += 1;
    if (ch === ")" || ch === "）") round -= 1;
    if (ch === "[") square += 1;
    if (ch === "]") square -= 1;
    if (ch === "{" || ch === "「" || ch === "『") {
      /* ignore jp quotes here */
    }
    if (round < 0 || square < 0 || curly < 0) return false;
  }
  return round === 0 && square === 0 && curly === 0;
}

/** 揃った括弧の中身ごと除去。不揃いなら null */
export function stripBalancedParens(text: string): string | null {
  if (!hasBalancedParens(text)) return null;
  return text
    .replace(/[（(][^）)]*[）)]/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 不揃い括弧断片を前後と結合して修復を試みる
 */
export function tryRepairParenFragments(parts: string[]): {
  repaired: string[];
  unclassified: string[];
} {
  const repaired: string[] = [];
  const unclassified: string[] = [];
  let i = 0;
  while (i < parts.length) {
    const cur = parts[i]?.trim() ?? "";
    if (!cur) {
      i += 1;
      continue;
    }
    if (hasBalancedParens(cur)) {
      repaired.push(cur);
      i += 1;
      continue;
    }

    // 直後と結合
    if (i + 1 < parts.length) {
      const joined = `${cur} ${parts[i + 1]}`.replace(/\s+/g, " ").trim();
      if (hasBalancedParens(joined)) {
        repaired.push(joined);
        i += 2;
        continue;
      }
    }
    // 直前と結合（すでに repaired に入っている場合）
    if (repaired.length > 0) {
      const prev = repaired[repaired.length - 1];
      const joined = `${prev} ${cur}`.replace(/\s+/g, " ").trim();
      if (hasBalancedParens(joined)) {
        repaired[repaired.length - 1] = joined;
        i += 1;
        continue;
      }
    }

    unclassified.push(cur);
    i += 1;
  }
  return { repaired, unclassified };
}

function splitCollabOnly(text: string): string[] {
  if (!COLLAB_SPLIT.test(text)) return [text];
  const parts = text
    .split(COLLAB_SPLIT)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return [text];
  const allSame = parts.every((p) => key(p) === key(parts[0]));
  if (allSame) return [text];
  return parts;
}

/**
 * feat. 分割: 本体名が空なら分割せず feat. 部分ごと破棄
 */
function splitFeatStrict(text: string): SplitResult | null {
  const trimmed = text.trim();

  // 先頭が feat. のみ → 本体欠落 → 破棄
  if (/^(?:feat\.?|ft\.?|featuring)\b/i.test(trimmed)) {
    return { artists: [], unclassified: [], discarded: [trimmed] };
  }

  // 本体 feat.相手 / 本体 feat. 相手（feat.直後の空白は任意）
  const m = trimmed.match(
    /^(.+?)\s+(?:feat\.?|ft\.?|featuring)\s*(.+)$/i,
  );
  if (!m) return null;

  const body = m[1]?.trim() ?? "";
  const guest = m[2]?.trim() ?? "";
  if (!body || !guest) {
    return { artists: [], unclassified: [], discarded: [trimmed] };
  }

  return {
    artists: [...splitCollabOnly(body), ...splitCollabOnly(guest)],
    unclassified: [],
    discarded: [],
  };
}

export function splitArtistCandidates(raw: string): SplitResult {
  const text = raw.normalize("NFKC").trim();
  if (!text) return { artists: [], unclassified: [], discarded: [] };

  // 括弧不揃い → 修復 or 未分類
  if (!hasBalancedParens(text)) {
    // コラボ区切りで一度割ってから修復
    const rough = COLLAB_SPLIT.test(text)
      ? text.split(COLLAB_SPLIT).map((p) => p.trim()).filter(Boolean)
      : [text];
    const { repaired, unclassified } = tryRepairParenFragments(rough);
    const artists: string[] = [];
    const moreUnclassified = [...unclassified];
    for (const part of repaired) {
      const stripped = stripBalancedParens(part);
      if (stripped === null) {
        moreUnclassified.push(part);
        continue;
      }
      if (stripped) artists.push(stripped);
    }
    return { artists, unclassified: moreUnclassified, discarded: [] };
  }

  // feat. 厳格分割
  const feat = splitFeatStrict(text);
  if (feat) {
    const artists: string[] = [];
    const unclassified: string[] = [...feat.unclassified];
    for (const a of feat.artists) {
      if (!hasBalancedParens(a)) {
        unclassified.push(a);
        continue;
      }
      const stripped = stripBalancedParens(a);
      if (stripped) artists.push(stripped);
    }
    return {
      artists,
      unclassified,
      discarded: feat.discarded,
    };
  }

  // 通常コラボ分割
  const parts = splitCollabOnly(text);
  const artists: string[] = [];
  const unclassified: string[] = [];
  for (const part of parts) {
    if (!hasBalancedParens(part)) {
      unclassified.push(part);
      continue;
    }
    const stripped = stripBalancedParens(part);
    if (stripped) artists.push(stripped);
  }
  return { artists, unclassified, discarded: [] };
}
