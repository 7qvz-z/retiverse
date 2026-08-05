import { describe, expect, it } from "vitest";
import {
  cleanChannelName,
  extractArtistsFromVideo,
  resolveSlashParts,
  splitArtistCandidates,
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
    expect(result.artists).toEqual([
      "Calliope Mori",
      "Gawr Gura",
      "DECO*27",
    ]);
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

describe("ユニット: slash / split / channel", () => {
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
      splitArtistCandidates("Calliope Mori x Gawr Gura x DECO*27"),
    ).toEqual(["Calliope Mori", "Gawr Gura", "DECO*27"]);
  });

  it("GILTY×GILTY は分割しない", () => {
    expect(splitArtistCandidates("GILTY×GILTY")).toEqual(["GILTY×GILTY"]);
  });

  it("チャンネル掃除", () => {
    expect(cleanChannelName("Kizuna AI - A.I.Channel")).toBe("Kizuna AI");
    expect(cleanChannelName("【音莉飴】official")).toBe("音莉飴");
    expect(cleanChannelName("HoneyWorks OFFICIAL")).toBe("HoneyWorks");
  });
});
