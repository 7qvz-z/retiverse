import { describe, expect, it } from "vitest";
import {
  mergeMineAndSavedPlaylists,
  normalizeSavedPlaylists,
  parseYouTubePlaylistId,
} from "@/lib/youtube/playlists";

describe("parseYouTubePlaylistId", () => {
  it("parses playlist URL", () => {
    expect(
      parseYouTubePlaylistId(
        "https://www.youtube.com/playlist?list=PLrAXtmRdnEQy6nuLMHjMZOz59Oq8HK9qX",
      ),
    ).toBe("PLrAXtmRdnEQy6nuLMHjMZOz59Oq8HK9qX");
  });

  it("parses watch URL with list", () => {
    expect(
      parseYouTubePlaylistId(
        "https://www.youtube.com/watch?v=abc&list=PLabcdefghijklmnopqrstuv",
      ),
    ).toBe("PLabcdefghijklmnopqrstuv");
  });

  it("accepts bare id", () => {
    expect(parseYouTubePlaylistId("PLabcdefghijklmnopqrstuv")).toBe(
      "PLabcdefghijklmnopqrstuv",
    );
  });

  it("rejects empty", () => {
    expect(parseYouTubePlaylistId("")).toBeNull();
    expect(parseYouTubePlaylistId("not-a-url")).toBeNull();
  });
});

describe("normalizeSavedPlaylists / merge", () => {
  it("normalizes and tags saved", () => {
    const saved = normalizeSavedPlaylists([
      {
        id: "PLsaved1xxxxx",
        title: "Saved",
        itemCount: 3,
        thumbnailUrl: null,
      },
    ]);
    expect(saved[0]?.source).toBe("saved");
  });

  it("prefers mine on id collision", () => {
    const merged = mergeMineAndSavedPlaylists(
      [
        {
          id: "PLsame",
          title: "Mine",
          itemCount: 1,
          thumbnailUrl: null,
          source: "mine",
        },
      ],
      [
        {
          id: "PLsame",
          title: "Saved copy",
          itemCount: 9,
          thumbnailUrl: null,
          source: "saved",
        },
        {
          id: "PLother",
          title: "Other",
          itemCount: 2,
          thumbnailUrl: null,
          source: "saved",
        },
      ],
    );
    expect(merged.map((p) => `${p.id}:${p.source}:${p.title}`)).toEqual([
      "PLsame:mine:Mine",
      "PLother:saved:Other",
    ]);
  });
});
