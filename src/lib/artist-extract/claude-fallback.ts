/**
 * Claude API フォールバック（低自信度時）
 * 現状はスタブ。API キー設定後に実装する。
 */
export type ClaudeFallbackInput = {
  title?: string;
  channelTitle?: string;
  description?: string;
};

export async function extractArtistsWithClaude(
  _input: ClaudeFallbackInput,
): Promise<string[] | null> {
  // TODO: Anthropic API でタイトル・チャンネルからアーティスト判定
  return null;
}
