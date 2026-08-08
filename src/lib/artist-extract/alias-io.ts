/**
 * alias-dictionary.json は初期共有辞書（読み取り専用）。
 * ユーザー修正・統合は `artist_corrections`（Supabase）に保存し、
 * 解析時に `buildOverrides` でパイプラインへ反映する。
 *
 * 本番（Vercel 等）のファイルシステムは読み取り専用のため、
 * ここに fs.writeFile を置かないこと。
 */

export { ALIAS_DICTIONARY } from "./normalize";
export type { AliasDictionary } from "./normalize";
