import { describe, expect, it } from "vitest";
import { preferTopicThenMv } from "@/lib/playlist/filters";
import {
  buildSearchQueries,
  type GenerateInput,
} from "@/lib/playlist/generate";
import { DEFAULT_PREFERENCES } from "@/lib/types";
import type { TrackCandidate } from "@/lib/playlist/terms";

function baseInput(over: Partial<GenerateInput> = {}): GenerateInput {
  return {
    artists: ["米津玄師", "YOASOBI"],
    genres: ["J-POP"],
    moods: ["energetic"],
    environments: ["night"],
    noteKeywords: [],
    preferences: { ...DEFAULT_PREFERENCES, mixNewTracks: false },
    excludeVideoIds: [],
    accessToken: null,
    apiKey: null,
    ...over,
  };
}

describe("buildSearchQueries", () => {
  it("returns topic and mv lists separately", () => {
    const plan = buildSearchQueries(baseInput());
    expect(plan.topicQueries.length).toBeGreaterThan(0);
    expect(plan.mvQueries.length).toBeGreaterThan(0);
    expect(plan.topicQueries.every((q) => /Topic/i.test(q))).toBe(true);
    expect(
      plan.mvQueries.every((q) => /Official Music Video/i.test(q)),
    ).toBe(true);
    expect(plan.mvQueries.some((q) => /公式 MV/.test(q))).toBe(false);
  });

  it("caps topic queries to save quota", () => {
    const plan = buildSearchQueries(
      baseInput({
        artists: ["A", "B", "C", "D", "E", "F", "G", "H"],
        genres: ["J-POP", "ロック", "アニソン", "ボカロ"],
        moods: ["energetic", "hype", "relax", "drive"],
        environments: ["night", "morning", "rainy"],
        noteKeywords: ["夏", "雨"],
        preferences: { ...DEFAULT_PREFERENCES, mixNewTracks: true },
      }),
    );
    expect(plan.topicQueries.length).toBeLessThanOrEqual(8);
    expect(plan.mvQueries.length).toBeLessThanOrEqual(6);
  });

  it("uses one Topic query per artist without mood Topic by default", () => {
    const plan = buildSearchQueries(
      baseInput({ artists: ["米津玄師"], environments: [] }),
    );
    const artistTopics = plan.topicQueries.filter((q) =>
      q.startsWith("米津玄師"),
    );
    expect(artistTopics).toEqual(["米津玄師 Topic"]);
  });
});

describe("preferTopicThenMv", () => {
  it("orders Topic before MV", () => {
    const tracks: TrackCandidate[] = [
      {
        videoId: "mv1",
        title: "Song Official Music Video",
        channelTitle: "Artist Official",
        thumbnailUrl: "",
        query: "q",
      },
      {
        videoId: "tp1",
        title: "Song",
        channelTitle: "Artist - Topic",
        thumbnailUrl: "",
        query: "q",
      },
    ];
    const identity = <T>(items: T[]) => items;
    const selected = preferTopicThenMv(tracks, 2, identity, false);
    expect(selected.map((t) => t.videoId)).toEqual(["tp1", "mv1"]);
  });
});
