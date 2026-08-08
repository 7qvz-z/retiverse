import { describe, expect, it } from "vitest";
import {
  buildYouTubeSearchCacheKey,
  parseCachedTrackCandidates,
} from "@/lib/youtube/search-cache";

describe("buildYouTubeSearchCacheKey", () => {
  it("normalizes case, width, and whitespace", () => {
    const a = buildYouTubeSearchCacheKey("  米津玄師   Topic  ");
    const b = buildYouTubeSearchCacheKey("米津玄師 Topic");
    const c = buildYouTubeSearchCacheKey("ＭＶ");
    const d = buildYouTubeSearchCacheKey("mv");
    expect(a).toBe(b);
    expect(c).toBe(d);
  });
});

describe("parseCachedTrackCandidates", () => {
  it("accepts valid TrackCandidate arrays", () => {
    const parsed = parseCachedTrackCandidates([
      {
        videoId: "abc",
        title: "Song",
        channelTitle: "Artist - Topic",
        thumbnailUrl: "https://example.com/t.jpg",
        query: "Artist Topic",
      },
    ]);
    expect(parsed).toHaveLength(1);
    expect(parsed?.[0]?.videoId).toBe("abc");
  });

  it("rejects malformed payloads", () => {
    expect(parseCachedTrackCandidates([{ videoId: 1 }])).toBeNull();
    expect(parseCachedTrackCandidates("nope")).toBeNull();
  });
});
