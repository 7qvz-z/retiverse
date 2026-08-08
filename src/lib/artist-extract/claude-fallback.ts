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
  input: ClaudeFallbackInput,
): Promise<string[] | null> {
  void input;
  // TODO: Anthropic API でタイトル・チャンネルからアーティスト判定
  return null;
}
