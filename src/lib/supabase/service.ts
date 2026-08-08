import { createClient } from "@supabase/supabase-js";

/**
 * サービスロール（RLS バイパス）。トークン保存などサーバー専用処理用。
 * ブラウザに絶対に渡さないこと。
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error(
      "SUPABASE_SECRET_KEY または NEXT_PUBLIC_SUPABASE_URL が未設定です。",
    );
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
