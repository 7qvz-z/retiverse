# リテイバース (Retiverse)

いまのあなただけにあったプレイリストを自動生成する Web サービス（MVP）。

## 技術スタック

- Next.js (App Router) + TypeScript + Tailwind CSS
- Supabase Auth（Google OAuth）
- YouTube Data API v3
- 天気: Open-Meteo（Geolocation 連携予定）

## セットアップ

```bash
cp .env.example .env.local
# .env.local に Supabase / YouTube の値を入れる
npm install
npm run dev
```

http://localhost:3000/login を開く。

### Supabase

1. プロジェクト作成
2. Authentication → Providers → Google を有効化
3. Redirect URL に `http://localhost:3000/auth/callback` を追加
4. `supabase/migrations/20260804000000_init.sql` を SQL Editor で実行

## 画面

| パス | 内容 |
|------|------|
| `/login` | Google ログイン |
| `/setup` | 初回設定（実装予定） |
| `/` | ホーム（実装予定） |
| `/generate` | プレイリスト生成（実装予定） |
| `/settings` | 設定（実装予定） |
| `/me` | マイページ（実装予定） |

詳細は `リテイバース_仕様書_v2.md` を参照。
