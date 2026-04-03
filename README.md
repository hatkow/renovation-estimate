# Renovation Estimate

WordPressと連携しやすい、リフォーム見積もりフォームのプロトタイプです。  
現在は以下を実装しています。

- カテゴリ別の概算シミュレーション
- 画像アップロード付き問い合わせフォーム
- 見積もり後のCTAポップアップ
- 問い合わせ一覧を確認できる簡易管理画面
- Supabase または Express API による永続化

## 起動方法

依存関係のインストール:

```bash
npm install
```

フロントエンドとAPIサーバーを同時起動:

```bash
npm run dev
```

フロントエンドのみ起動:

```bash
npm run dev:client
```

APIサーバーのみ起動:

```bash
npm run dev:server
```

本番ビルド:

```bash
npm run build
```

本番起動:

```bash
npm run start
```

## API

- `GET /api/health`
- `GET /api/submissions`
- `POST /api/submissions`

`POST /api/submissions` は `multipart/form-data` を受け取り、`payload` にJSON文字列、`images` に画像ファイルを送れます。

## Supabase / Vercel 対応

無料公開向けに、Supabase が設定されていれば次の優先順で動作します。

1. Supabase
2. Express API
3. ローカル保存

環境変数:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_SUPABASE_BUCKET=estimate-images
```

雛形は [.env.example](C:\codex\renovation-estimate\.env.example) にあります。

Supabase のテーブル・Storage・Policy 作成SQLは [supabase/schema.sql](C:\codex\renovation-estimate\supabase\schema.sql) を使ってください。設定保存テーブルも含むため、更新後は再実行して問題ありません。

保存先:

- 問い合わせデータ: [data/submissions.json](C:\codex\renovation-estimate\data\submissions.json)
- 画像アップロード先: [uploads](C:\codex\renovation-estimate\uploads)

## WordPress連携メモ

想定している連携方法は次の順です。

1. まずは別アプリとしてこのフォームを運用
2. WordPress側には `iframe` または `script` で埋め込む
3. サイトごとにAPIキーやテーマ設定を持たせる
4. 将来的にSaaS化し、テナント単位で管理する

埋め込み用の軽量表示モード:

```text
https://renovation-estimate.vercel.app/?embed=1
```

`?embed=1` を付けると、ヘッダーや管理サイドバーを省いた軽量表示になります。

広告やSNSの分析をしたい場合は、URL に UTM を付けて流入元を保存できます。

```text
https://renovation-estimate.vercel.app/?utm_source=google&utm_medium=cpc&utm_campaign=kitchen_lp
```

保存される主な項目:

- `lead_source`
- `utm_source`
- `utm_medium`
- `utm_campaign`
- `landing_page`
- `referrer_host`

## デプロイ

本番サーバーへの配置手順は [DEPLOY.md](C:\codex\renovation-estimate\DEPLOY.md) にまとめています。

## 主なファイル

- フロント: [src/App.tsx](C:\codex\renovation-estimate\src\App.tsx)
- スタイル: [src/App.css](C:\codex\renovation-estimate\src\App.css)
- APIサーバー: [server/index.mjs](C:\codex\renovation-estimate\server\index.mjs)
- Vite設定: [vite.config.ts](C:\codex\renovation-estimate\vite.config.ts)
