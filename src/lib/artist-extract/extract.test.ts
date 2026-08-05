import { describe, expect, it } from "vitest";
import {
  cleanChannelName,
  cleanExtractedName,
  extractArtistsFromVideo,
  findSimilarPairs,
  isBlockedName,
  mergeAliasIntoDictionary,
  normalizeArtistName,
  resolveSlashParts,
  splitArtistCandidates,
  stringSimilarity,
  validateArtistNames,
} from "./index";

describe("extractArtistsFromVideo — 必須ケース", () => {
  it('タイトル「陽キャJKに憧れる陰キャJKの歌/音莉飴」→ ["音莉飴"]', () => {
    const result = extractArtistsFromVideo({
      title: "陽キャJKに憧れる陰キャJKの歌/音莉飴",
    });
    expect(result.artists).toEqual(["音莉飴"]);
    expect(result.confidence).toBe("high");
  });

  it('タイトル「【ORIGINAL SONG MV】「Q」 - Calliope Mori x Gawr Gura x DECO*27」→ 3人', () => {
    const result = extractArtistsFromVideo({
      title:
        "【ORIGINAL SONG MV】「Q」 - Calliope Mori x Gawr Gura x DECO*27",
    });
    expect(result.artists).toEqual(
      ["Calliope Mori", "Gawr Gura", "DECO*27"].sort((a, b) =>
        a.localeCompare(b, "ja"),
      ),
    );
    expect(result.confidence).toBe("high");
  });

  it('チャンネル名「Kizuna AI - A.I.Channel」→ ["Kizuna AI"]', () => {
    const result = extractArtistsFromVideo({
      channelTitle: "Kizuna AI - A.I.Channel",
    });
    expect(result.artists).toEqual(["Kizuna AI"]);
    expect(result.confidence).toBe("high");
  });

  it("ローマ字チャンネル Hatsuboshi Gakuen → 初星学園", () => {
    const result = extractArtistsFromVideo({
      channelTitle: "Hatsuboshi Gakuen - Topic",
    });
    expect(result.artists).toEqual(["初星学園"]);
  });

  it("ローマ字チャンネル Suisei + タイトルの漢字表記 → 星街すいせい", () => {
    const result = extractArtistsFromVideo({
      title: "ロウワー / 星街すいせい(cover)",
      channelTitle: "Suisei Channel",
    });
    expect(result.artists).toContain("星街すいせい");
    expect(result.artists).not.toContain("Suisei");
  });
});

describe("ステップA: チャンネル名クリーニング", () => {
  it("天月-あまつき-YouTube → 天月", () => {
    expect(cleanExtractedName("天月-あまつき-YouTube")).toBe("天月");
  });

  it("【音莉飴】official → 音莉飴", () => {
    expect(cleanExtractedName("【音莉飴】official")).toBe("音莉飴");
  });

  it("末尾 YouTube / Official / 公式チャンネル", () => {
    expect(cleanExtractedName("誰か - YouTube")).toBe("誰か");
    expect(cleanExtractedName("誰か(YouTube)")).toBe("誰か");
    expect(cleanExtractedName("HoneyWorks OFFICIAL")).toBe("HoneyWorks");
    expect(cleanExtractedName("アーティスト公式チャンネル")).toBe(
      "アーティスト",
    );
  });

  it("チャンネル掃除", () => {
    expect(cleanChannelName("Kizuna AI - A.I.Channel")).toBe("Kizuna AI");
  });
});

describe("ステップB: エイリアス正規化", () => {
  it("辞書照合で canonical に置換", () => {
    expect(normalizeArtistName("Hatsuboshi Gakuen")).toBe("初星学園");
    expect(normalizeArtistName("suisei")).toBe("星街すいせい");
  });

  it("手動マージを辞書に反映", () => {
    const next = mergeAliasIntoDictionary(
      { 天月: ["あまつき"] },
      "天月",
      "Amatsuki",
    );
    expect(next["天月"]).toContain("Amatsuki");
    expect(next["天月"]).toContain("あまつき");
  });
});

describe("バリデーション", () => {
  it("feat. は本体があるときだけ分割", () => {
    expect(splitArtistCandidates("音莉飴 feat.弱酸性").artists).toEqual([
      "音莉飴",
      "弱酸性",
    ]);
    expect(splitArtistCandidates("feat.弱酸性").discarded.length).toBe(1);
    expect(splitArtistCandidates("feat.弱酸性").artists).toEqual([]);
  });

  it("不揃い括弧は未分類", () => {
    const r = splitArtistCandidates("Hauken (");
    expect(r.artists).toEqual([]);
    expect(r.unclassified.length).toBeGreaterThan(0);
  });

  it("ブロックリスト除外", () => {
    expect(isBlockedName("HYBE LABELS")).toBe(true);
    expect(isBlockedName("Official")).toBe(true);
    expect(isBlockedName("音莉飴")).toBe(false);
    const v = validateArtistNames(["音莉飴", "HYBE LABELS", "V"]);
    expect(v.confirmed).toEqual(["音莉飴"]);
    expect(v.unclassified.some((u) => u.name === "V")).toBe(true);
  });

  it("類似度で表記ゆれを検出", () => {
    expect(stringSimilarity("Calliope Mori", "Calliope Mri")).toBeGreaterThan(
      0.8,
    );
    const pairs = findSimilarPairs([
      "Calliope Mori",
      "Calliope Mri",
      "YOASOBI",
    ]);
    expect(
      pairs.some(
        (p) =>
          (p.a === "Calliope Mori" && p.b === "Calliope Mri") ||
          (p.a === "Calliope Mri" && p.b === "Calliope Mori"),
      ),
    ).toBe(true);
  });

  it("空白差のみ（Lil Nas X / LilNasX）は同一キー扱いで確定は1件", () => {
    expect(stringSimilarity("Lil Nas X", "LilNasX")).toBe(1);
    const v = validateArtistNames(["Lil Nas X", "LilNasX"]);
    expect(v.confirmed).toHaveLength(1);
  });
});

describe("ユニット: slash / split", () => {
  it("曲名/アーティストは右側", () => {
    expect(
      resolveSlashParts("陽キャJKに憧れる陰キャJKの歌", "音莉飴"),
    ).toEqual(["音莉飴"]);
  });

  it("漢字/ローマ字は漢字側", () => {
    expect(resolveSlashParts("初星学園", "Hatsuboshi Gakuen")).toEqual([
      "初星学園",
    ]);
  });

  it("x コラボ分割", () => {
    expect(
      splitArtistCandidates("Calliope Mori x Gawr Gura x DECO*27").artists,
    ).toEqual(["Calliope Mori", "Gawr Gura", "DECO*27"]);
  });

  it("GILTY×GILTY は分割しない", () => {
    expect(splitArtistCandidates("GILTY×GILTY").artists).toEqual([
      "GILTY×GILTY",
    ]);
  });
});
