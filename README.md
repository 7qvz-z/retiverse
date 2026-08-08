# Retiverse（リテイバース）

いまの気分に、ぴったりの宇宙をつくる。YouTube プレイリスト自動生成 Web サービス（MVP）。

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
4. **SQL Editor でマイグレーションを順番に実行**（後述）

### マイグレーション（SQL Editor）

Supabase Dashboard → SQL Editor で、次のファイルを **上から順に** 実行する。

| 順序 | ファイル | 内容 |
|------|----------|------|
| 1 | `supabase/migrations/20260804000000_init.sql` | profiles / 好み / 履歴などの基本テーブル |
| 2 | `supabase/migrations/20260804000001_playlist_analysis.sql` | プレイリスト解析結果の保存カラム |
| 3 | `supabase/migrations/20260805000000_artist_corrections.sql` | アーティスト修正（学習）テーブル |
| 4 | `supabase/migrations/20260805010000_youtube_credentials.sql` | profiles に YouTube 用 Google トークン列 |
| 5 | `supabase/migrations/20260806000000_saved_youtube_playlists.sql` | 他人の PL を URL 登録するカラム |
| 6 | `supabase/migrations/20260806010000_youtube_search_cache.sql` | YouTube 検索結果キャッシュ（TTL 24h） |
| 7 | `supabase/migrations/20260807000000_youtube_api_usage.sql` | YouTube API 利用量（マイページ表示） |
| 8 | `supabase/migrations/20260808000000_terms_accepted.sql` | 利用規約・プライバシー同意（`terms_accepted_at`） |

未適用のまま API を叩くと、該当エンドポイントがマイグレーションファイル名付きのエラーを返します。

- 解析結果カラム不足 → `/api/youtube/analyze`
- `artist_corrections` 不足 → `/api/youtube/analyze`・`/api/artist-corrections`・`/api/artist-aliases`
- YouTube トークン列不足 → 連携は動くが、期限切れ後の自動更新が効かない（SQL 実行＋再連携が必要）
- `saved_youtube_playlists` 不足 → 他人の PL の URL 登録ができない
- `youtube_search_cache` 不足 → 検索は動くがキャッシュされない（枠節約に効かない。SQL 実行で有効化）
- `youtube_api_usage` 不足 → マイページの API 利用量表示が無効（SQL 実行で有効化）
- `terms_accepted_at` 不足 → 同意画面での保存が失敗する（SQL 実行で有効化。未適用時は同意ゲート自体はスキップ）

### YouTube 連携が切れないようにする

ログイン用の Google 認証とは別に、**専用の YouTube OAuth** で API 用トークンを取得します。

1. 上記マイグレーション 4 を SQL Editor で実行
2. `.env.local` に `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` を設定  
   （Supabase Dashboard → Authentication → Providers → Google と同じ値）
3. `SUPABASE_SECRET_KEY` も設定（トークン列の読み書き用）
4. **Google Cloud Console → API とサービス → 認証情報 → OAuth 2.0 クライアント** の「承認済みのリダイレクト URI」に次を追加:
   - `http://127.0.0.1:3000/api/youtube/oauth/callback`
   - `http://localhost:3000/api/youtube/oauth/callback`
   - （本番があれば）`https://あなたのドメイン/api/youtube/oauth/callback`
5. 同じコンソールで **YouTube Data API v3** を有効化
6. OAuth 同意画面の **Data Access（スコープ）** に  
   `https://www.googleapis.com/auth/youtube.force-ssl` を追加
7. アプリの「YouTube連携する」を押して許可する
8. 以降は refresh token から自動で再発行されます

> 以前の「スコープ不足」エラーは、ログイン用トークン（email/profile のみ）を YouTube API に使っていたことが原因です。必ず手順 4〜7 の専用連携をやり直してください。

## 本番公開（Vercel / HTTPS）

Next.js アプリを [Vercel](https://vercel.com) にデプロイすると、無料枠で `https://<名前>.vercel.app` が付きます。

### 1. GitHub に push

Vercel はリポジトリ連携が前提です。デプロイしたいコミットを `origin` に push してください。

### 2. Vercel で Import

1. [vercel.com](https://vercel.com) → Add New → Project → GitHub の `retiverse` を Import
2. Framework Preset: **Next.js**（自動検出）
3. 下の環境変数を入れてから Deploy（またはデプロイ後に設定 → Redeploy）

### 3. 環境変数（Production）

Vercel → Project → Settings → Environment Variables に、ローカルの `.env.local` と同じキーを入れます（値をチャットや README に貼らないこと）。

| 変数 | 注意 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | ローカルと同じで可 |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 同上 |
| `SUPABASE_SECRET_KEY` | サーバー専用。`NEXT_PUBLIC_` を付けない |
| `YOUTUBE_API_KEY` | サーバー専用 |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Supabase の Google プロバイダと同じ |
| `NEXT_PUBLIC_SITE_URL` | **`https://<名前>.vercel.app`**（末尾スラッシュなし） |

`NEXT_PUBLIC_*` はビルド時に埋め込まれるため、変更後は **Redeploy** が必要です。

### 4. Supabase Auth（Redirect）

Dashboard → Authentication → URL Configuration:

- **Site URL**: `https://<名前>.vercel.app`（本番を正にする場合）
- **Redirect URLs** に追加:
  - `https://<名前>.vercel.app/auth/callback`
  - 開発用に `http://127.0.0.1:3000/auth/callback` も残してよい

### 5. Google Cloud（OAuth リダイレクト）

OAuth 2.0 クライアントの「承認済みのリダイレクト URI」に追加:

- `https://<名前>.vercel.app/api/youtube/oauth/callback`
- （既存）`https://<project>.supabase.co/auth/v1/callback` はそのまま

OAuth 同意画面が **Testing** のままなら、本番で使う Google アカウントをテストユーザーに追加するか、公開ステータスを検討してください。

### 6. デプロイ後チェック

- `https://<名前>.vercel.app/login` が開く
- Google ログイン →（未同意なら）`/consent` → `/setup` またはホーム
- YouTube 連携が成功する
- `/privacy` `/terms` が未ログインでも読める
- DB マイグレーション 1〜8（特に `terms_accepted`）が適用済み

独自ドメインは後から Vercel → Domains で追加できます。追加したら `NEXT_PUBLIC_SITE_URL` と上記 Redirect もドメインに合わせて更新してください。

## 画面

| パス | 内容 |
|------|------|
| `/login` | Google ログイン |
| `/setup` | 初回設定（YouTube連携・好み・設定） |
| `/` | ホーム（気分・環境・生成・履歴） |
| `/generate` | プレイリスト生成（プレビュー・YouTube追加） |
| `/settings` | 設定（生成オプション・曲数・プラン） |
| `/settings/tastes` | アーティスト・ジャンル編集 |
| `/settings/playlists` | YouTubeプレイリスト解析 |
| `/me` | マイページ（プロフィール・履歴・お気に入り） |

### 初回設定を使う前に

1. Supabase SQL Editor でマイグレーションを **順序どおり** 実行（上記表）
2. Google Cloud で **YouTube Data API v3** を有効化
3. Google OAuth のリダイレクト URI に  
   `https://<project>.supabase.co/auth/v1/callback` があること

### 天気・季節・時間帯

設定で ON にすると、ホームで自動取得・環境チップへ反映します。

- 天気: ブラウザの位置情報 → Open-Meteo API（APIキー不要）
- 季節: 端末の日付
- 時間帯: 端末の現在時刻
