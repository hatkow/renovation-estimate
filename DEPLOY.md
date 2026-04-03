# デプロイ手順

このアプリは、`React + Vite` のフロントと `Express` のAPIを1つのNodeプロセスで配信できます。

無料公開を優先する場合は、`GitHub + Vercel + Supabase` の構成がおすすめです。

## 無料構成のおすすめ

- フロント公開: Vercel Hobby
- 問い合わせ保存: Supabase Database
- 画像保存: Supabase Storage
- ソース管理: GitHub

この場合、Node サーバーを常駐させなくても運用できます。

## GitHub + Vercel + Supabase 手順

### 1. Supabase プロジェクト作成

- Supabase で新規プロジェクトを作成
- SQL Editor で [supabase/schema.sql](C:\codex\renovation-estimate\supabase\schema.sql) を実行
- `Project URL`
- `anon public key`
を控える

### 2. GitHub へ push

```bash
git add .
git commit -m "Add Vercel and Supabase deployment support"
git push origin main
```

### 3. Vercel へ接続

- Vercel で GitHub リポジトリを import
- Framework Preset は `Vite`
- Build Command は通常そのまま `npm run build`
- Output Directory は通常そのまま `dist`

### 4. Vercel 環境変数設定

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_BUCKET=estimate-images
```

### 5. 再デプロイ

- 環境変数保存後に再デプロイ
- フォーム送信
- 管理画面一覧
- 画像アップロード
を確認

## 前提

- Node.js 20 以上
- npm
- 本番サーバーで `8787` 番ポート、または任意のNodeポートを利用可能
- 画像保存用に `uploads/`、問い合わせ保存用に `data/` への書き込み権限

## 1. サーバーへ配置

```bash
git clone <repo-url>
cd renovation-estimate
npm install
```

## 2. 本番ビルド

```bash
npm run build
```

## 3. 起動

```bash
PORT=8787 npm run start
```

Windows の場合:

```powershell
$env:PORT=8787
npm run start
```

## 4. PM2で常駐化する場合

```bash
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

## 5. Nginx リバースプロキシ例

```nginx
server {
    listen 80;
    server_name example.com;

    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 6. WordPress へ埋め込む場合

別ドメインまたはサブドメインで起動したURLを、WordPress 側で `iframe` または埋め込みスクリプトとして読み込みます。

例:

```html
<iframe
  src="https://estimate.example.com/"
  width="100%"
  height="1800"
  style="border:0;"
  loading="lazy"
></iframe>
```

## 補足

- `/api/*` は Express API
- `/uploads/*` はアップロード画像
- その他のURLは `dist/index.html` を返すので、直接アクセスでも表示可能
- データは簡易的に `data/submissions.json` へ保存しています。本番ではDB化推奨です
