import { describe, expect, it } from "vitest";
import { DECORATIVE } from "./chars";
import {
  aggregateValidatedArtists,
  cleanChannelName,
  cleanExtractedName,
  detectAnomalies,
  extractArtistsFromVideo,
  findSimilarPairs,
  getGroupMembers,
  isBlockedName,
  looksLikeSongTitle,
  mergeAliasIntoDictionary,
  normalizeArtistName,
  resolveFranchiseArtists,
  resolveSlashParts,
  splitArtistCandidates,
  stringSimilarity,
  validateArtistNames,
} from "./index";
import { buildOverrides, EMPTY_OVERRIDES } from "./overrides";
import { dictKey as nameKey } from "./normalize";

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
    // 辞書取り込み後は日本語正式名へ正規化
    expect(result.artists).toEqual(
      ["森カリオペ", "がうる・ぐら", "DECO*27"].sort((a, b) =>
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

  it("ローマ字チャンネル Hatsuboshi Gakuen → 初星学園のみ（全員展開しない）", () => {
    const result = extractArtistsFromVideo({
      channelTitle: "Hatsuboshi Gakuen - Topic",
    });
    expect(result.artists).toEqual(["初星学園"]);
    expect(result.artists).not.toContain("花海咲季");
    expect(result.confidence).toBe("high");
  });

  it("初星学園チャンネル + タイトルにソロ名 → その人＋学園", () => {
    const result = extractArtistsFromVideo({
      title: "Fighting My Heart / 花海咲季",
      channelTitle: "Hatsuboshi Gakuen - Topic",
    });
    expect(result.artists).toContain("花海咲季");
    expect(result.artists).toContain("初星学園");
    expect(result.artists).not.toContain("月村手毬");
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

  it("絵文字を除去して確定名にする", () => {
    expect(cleanExtractedName("音莉飴🍬")).toBe("音莉飴");
    expect(cleanExtractedName("✨YOASOBI✨")).toBe("YOASOBI");
    expect(cleanExtractedName("🍬🍬")).toBe("");
  });

  it("短い曲名を曲名判定する", () => {
    expect(looksLikeSongTitle("アイドル")).toBe(true);
    expect(looksLikeSongTitle("怪獣の花唄")).toBe(true);
    expect(looksLikeSongTitle("音莉飴")).toBe(false);
  });

  it("with / vs で分割", () => {
    expect(
      splitArtistCandidates("Calliope Mori with Gawr Gura").artists,
    ).toEqual(["Calliope Mori", "Gawr Gura"]);
    expect(splitArtistCandidates("A vs B").artists).toEqual(["A", "B"]);
  });

  it("低自信度の単独候補は要確認寄り（曲名誤認経路）", () => {
    const result = extractArtistsFromVideo({
      title: "Something - ShortSong",
    });
    expect(result.artists).not.toContain("ShortSong");
  });

  it("DECORATIVE.test は連続呼び出しで結果が変わらない", () => {
    const sample = "★A";
    const first = DECORATIVE.test(sample);
    const second = DECORATIVE.test(sample);
    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(first).toBe(second);

    const anomalies1 = detectAnomalies("★☆");
    const anomalies2 = detectAnomalies("★☆");
    expect(anomalies1).toEqual(anomalies2);
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

describe("グループ／ソロ／ユニット優先", () => {
  it("グループのみ → 正式名だけ（全員展開しない）", () => {
    const hit = resolveFranchiseArtists("", "Hatsuboshi Gakuen - Topic");
    expect(hit.kind).toBe("group");
    expect(hit.artists).toEqual(["初星学園"]);
    expect(getGroupMembers("初星学園")).toHaveLength(13);
  });

  it("ソロ（タイトルに個人名）→ その人＋グループ", () => {
    const hit = resolveFranchiseArtists(
      "花海咲季「Fighting My Heart」",
      "Hatsuboshi Gakuen - Topic",
    );
    expect(hit.kind).toBe("solo");
    expect(hit.artists).toContain("花海咲季");
    expect(hit.artists).toContain("初星学園");
    expect(hit.artists).not.toContain("藤田ことね");
  });

  it("aggregate: グループチャンネルのみではメンバーを確定にしない", () => {
    const result = aggregateValidatedArtists([
      { title: "任意の曲", channelTitle: "Hatsuboshi Gakuen - Topic" },
    ]);
    expect(result.confirmed).toEqual(["初星学園"]);
  });

  it("aggregate: ソロ曲ではそのメンバーが確定に入る", () => {
    const result = aggregateValidatedArtists([
      {
        title: "Snow Halation / 月村手毬",
        channelTitle: "Hatsuboshi Gakuen - Topic",
      },
    ]);
    expect(result.confirmed).toContain("月村手毬");
    expect(result.confirmed).toContain("初星学園");
    expect(result.confirmed).not.toContain("花海咲季");
  });
});

describe("Phase 3: ユーザー overrides", () => {
  it("buildOverrides: rename / reject / confirm / split", () => {
    const o = buildOverrides([
      {
        kind: "rename",
        rawName: "Amatsuki",
        canonicalName: "天月",
        splitInto: null,
      },
      {
        kind: "reject",
        rawName: "Noise",
        canonicalName: null,
        splitInto: null,
      },
      {
        kind: "confirm",
        rawName: "弱酸性",
        canonicalName: "弱酸性",
        splitInto: null,
      },
      {
        kind: "split",
        rawName: "A・B・C",
        canonicalName: null,
        splitInto: ["Alice", "Bob"],
      },
    ]);
    expect(o.aliases["天月"]).toContain("Amatsuki");
    expect(o.rejected.has(nameKey("Noise"))).toBe(true);
    expect(o.confirmed.has(nameKey("弱酸性"))).toBe(true);
    expect(o.splits.get(nameKey("A・B・C"))).toEqual(["Alice", "Bob"]);
  });

  it("rename エイリアスが解析に反映される", () => {
    const overrides = buildOverrides([
      {
        kind: "alias",
        rawName: "WrongSpelling",
        canonicalName: "Calliope Mori",
        splitInto: null,
      },
    ]);
    const result = extractArtistsFromVideo({
      channelTitle: "WrongSpelling - Topic",
      overrides,
    });
    expect(result.artists).toContain("Calliope Mori");
    expect(result.artists).not.toContain("WrongSpelling");
  });

  it("reject した名前は確定から除外", () => {
    const overrides = buildOverrides([
      {
        kind: "reject",
        rawName: "音莉飴",
        canonicalName: null,
        splitInto: null,
      },
    ]);
    const result = extractArtistsFromVideo({
      title: "陽キャJKに憧れる陰キャJKの歌/音莉飴",
      overrides,
    });
    expect(result.artists).not.toContain("音莉飴");
  });

  it("split が抽出時に適用される", () => {
    const overrides = buildOverrides([
      {
        kind: "split",
        rawName: "Duo Unit",
        canonicalName: null,
        splitInto: ["Alpha", "Beta"],
      },
    ]);
    const result = aggregateValidatedArtists(
      [{ title: "Song / Duo Unit", channelTitle: "" }],
      undefined,
      overrides,
    );
    expect(result.confirmed).toEqual(
      expect.arrayContaining(["Alpha", "Beta"]),
    );
    expect(result.confirmed).not.toContain("Duo Unit");
  });

  it("confirm は出現1回でも採用する", () => {
    const overrides = buildOverrides([
      {
        kind: "confirm",
        rawName: "RareArtistXYZ",
        canonicalName: "RareArtistXYZ",
        splitInto: null,
      },
    ]);
    const without = aggregateValidatedArtists([
      { title: "Track / RareArtistXYZ", channelTitle: "" },
    ]);
    const withConfirm = aggregateValidatedArtists(
      [{ title: "Track / RareArtistXYZ", channelTitle: "" }],
      undefined,
      overrides,
    );
    expect(withConfirm.confirmed).toContain("RareArtistXYZ");
    void without;
  });

  it("修正データが空でも aggregate は動く（新規ユーザー相当）", () => {
    const result = aggregateValidatedArtists(
      [
        {
          title: "陽キャJKに憧れる陰キャJKの歌/音莉飴",
          channelTitle: "音莉飴 - Topic",
        },
      ],
      undefined,
      EMPTY_OVERRIDES,
    );
    expect(result.confirmed).toContain("音莉飴");
    expect(result.evidence.length).toBeGreaterThan(0);
  });
});
