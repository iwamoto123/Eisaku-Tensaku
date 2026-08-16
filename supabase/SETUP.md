# Supabase のセットアップ手順

公開版で使うログイン・データベース・画像保管を用意します。所要15分ほどです。
無料枠（500MBのDB、1GBのストレージ）で足ります。

## 1. プロジェクトを作る

1. https://supabase.com にアクセスして GitHub アカウントでサインイン
2. **New project** を押す
3. 入力する内容
   - Name: `eisaku-tensaku`
   - Database Password: 自動生成のものを使い、パスワード管理ソフトに保存する
   - Region: **Northeast Asia (Tokyo)** を選ぶ（日本から使うため）
4. 作成に2分ほどかかります

## 2. テーブルを作る

1. 左メニューの **SQL Editor** を開く
2. **New query** を押す
3. このフォルダの `schema.sql` の中身を全部コピーして貼り付ける
4. **Run** を押す

「Success. No rows returned」と出れば完了です。
左メニューの **Table Editor** に `instructors` `students` `corrections` の3つが見えます。

## 3. ログインの設定

1. 左メニューの **Authentication** → **Providers** を開く
2. **Email** を開き、次のとおりにする
   - Enable Email provider: **オン**
   - Confirm email: **オフ**（マジックリンクで本人確認するため不要）
3. **Save** を押す

次に、勝手に登録されないよう入口を閉じます。

4. **Authentication** → **Sign In / Providers** の下のほう、または **Settings** にある
   **Allow new users to sign up**（新規登録の許可）を **オフ** にする

これで、あらかじめ登録した講師だけがログインできます。

## 4. 講師を登録する

1. 左メニューの **Authentication** → **Users** を開く
2. **Add user** → **Create new user** を押す
3. 講師のメールアドレスを入れる。パスワードは適当で構いません（使いません）
4. **Auto Confirm User** に**チェックを入れる**
5. 講師の人数分くり返す

登録した人は、アプリのログイン画面にメールアドレスを入れるとリンクが届き、それを押すだけでログインできます。パスワードは不要です。

## 5. アプリに接続情報を書く

1. 左メニューの **Project Settings**（歯車）→ **API** を開く
2. 次の2つをコピーする
   - **Project URL**
   - **anon public** キー
3. `.env.local` に追記する

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhb...
```

`anon` キーは公開されても問題ないキーです。ブラウザ側で使います。
データの保護は、手順2で入れたRLS（ログインした人だけ読み書きできる規則）が担っています。

もう1つ、**service_role** キーは絶対に `.env.local` 以外に書かないでください。
このキーはRLSを無視できるため、漏れると全データが読まれます。今の構成では使いません。

## 6. 動作確認

```bash
npm run dev
```

http://localhost:3210 を開くとログイン画面が出ます。
手順4で登録したメールアドレスを入れ、届いたリンクを押してログインできれば完了です。

## Vercel にデプロイするとき

Vercel のプロジェクト設定 → Environment Variables に、`.env.local` と同じ内容を入れます。

| 変数 | 値 |
|---|---|
| `ANTHROPIC_API_KEY` | Anthropic のAPIキー |
| `ANTHROPIC_MODEL` | `claude-opus-5` |
| `ANTHROPIC_EFFORT` | `high` |
| `ANTHROPIC_MAX_TOKENS` | `64000` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase の Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase の anon キー |

あわせて Supabase の **Authentication** → **URL Configuration** で、
**Site URL** に本番のURL（`https://xxx.vercel.app`）を入れてください。
ログインのリンクがそこへ戻るようになります。ローカルで使い続ける場合は
**Redirect URLs** に `http://localhost:3210/**` も足しておきます。
