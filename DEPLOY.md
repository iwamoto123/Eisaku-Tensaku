# 公開の手順（Vercel）

GitHubのリポジトリをVercelにつなぐと、以降は `git push` するたびに自動で本番へ反映されます。
所要20分ほどです。

## 0. 先に Vercel を Pro にする

このアプリは1回の生成に4分ほどかかります。無料のHobbyプランは実行時間の上限が300秒で、
余裕がありません。**先に Pro（月$20）にアップグレードしてください。**

Proにする前にデプロイすると、`maxDuration = 800` の指定が上限を超えるため
ビルドが失敗します。

## 1. リポジトリをつなぐ

1. https://vercel.com にGitHubアカウントでログイン
2. **Add New → Project**
3. `iwamoto123/Eisaku-Tensaku` を **Import**
4. 設定はすべて初期値のままで構いません（Next.jsとして自動認識されます）
5. **まだ Deploy を押さず**、先に次の環境変数を入れます

## 2. 環境変数を入れる

**Environment Variables** に次の6つを追加します。値は手元の `.env.local` と同じです。

| 名前 | 値 |
|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-...` |
| `ANTHROPIC_MODEL` | `claude-opus-5` |
| `ANTHROPIC_EFFORT` | `high` |
| `ANTHROPIC_MAX_TOKENS` | `64000` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://slbwsigcpiclwqlcmovp.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_...` |

環境（Production / Preview / Development）はすべてにチェックを入れておきます。

入れ終わったら **Deploy** を押します。2〜3分で完了します。

## 3. Supabase に本番のURLを教える

デプロイが終わると `https://eisaku-tensaku-xxxx.vercel.app` のようなURLが出ます。
このURLを Supabase 側に登録しないと、**ログインができません。**

1. Supabase の **Authentication** → **URL Configuration**
2. **Site URL** を本番のURLに変える
3. **Redirect URLs** に次の2つが入っている状態にする
   - `https://<本番のURL>/**`
   - `http://localhost:3210/**`（手元でも開発を続けるため）

## 4. 動作を確認する

本番のURLを開いて、次を順に試します。

1. ログインできるか
2. 生徒を1人登録できるか
3. 添削を1件作れるか（4分ほどかかります）
4. PDFが書き出せるか

## 5. 講師に配る

Supabase の **Authentication → Users → Add user** で講師を追加します。
**Auto Confirm User に必ずチェックを入れてください。**

追加した瞬間からログインできるようになります。デプロイのやり直しは不要です。

パスワードを本人に伝えるか、メールのリンクを使ってもらいます。
ただし標準のメール送信は**1時間に2通まで**なので、講師が増えるなら
独自のSMTP（Resend など）の設定が必要です。
**Project Settings → Authentication → SMTP Settings** から設定します。

## 以降の更新

```bash
cd writing-tensaku
git add -A
git commit -m "何を変えたか"
git push
```

push すると Vercel が自動でビルドして本番に反映します。1〜2分です。

## 独自ドメインを使う場合

Vercel のプロジェクト設定 → **Domains** から追加できます（無料）。
`tensaku.shiratanionline.jp` のような形にできます。
設定したら、手順3のURLもそちらに変えてください。

## 本番での費用の記録について

手元で動かしているときは、利用トークン数が `../api-cost-notifier/data/` に記録されます。
**本番（Vercel）ではこの記録は残りません。** サーバーにファイルを書けないためです。

ただし1件ごとのトークン数は `corrections` テーブルに保存しているので、
そちらから集計できます。月次レポートをSupabase参照に切り替えるのは今後の課題です。
