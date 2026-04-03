# GitHub + Vercel + Supabase セットアップ

## 1. GitHub にアップロード

このPCで Git が使える環境なら、プロジェクト直下で次を実行します。

```bash
git init
git add .
git commit -m "Initial renovation estimate app"
git branch -M main
git remote add origin <GitHubのリポジトリURL>
git push -u origin main
```

もしこのPCで `git` コマンドが使えない場合は、GitHub Desktop でも問題ありません。

## 2. Supabase 準備

1. Supabaseで新規プロジェクトを作成
2. SQL Editor で [supabase/schema.sql](C:\codex\renovation-estimate\supabase\schema.sql) を実行
3. `Project URL` と `anon key` を控える

## 3. Vercel に接続

1. Vercel にログイン
2. `Add New Project`
3. GitHub リポジトリを選択
4. Framework は `Vite`
5. Build は `npm run build`
6. Output Directory は `dist`

## 4. Vercel の環境変数

次を登録します。

```bash
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_SUPABASE_BUCKET=estimate-images
```

## 5. デプロイ後に確認すること

- 見積もり画面が表示される
- 設備選択で金額が変わる
- フォーム送信できる
- 管理画面に送信データが出る
- 画像アップロードした場合、Supabase Storage に保存される
