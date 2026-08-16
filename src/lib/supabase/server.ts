import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * サーバー側（Server Component / Route Handler）から使う Supabase クライアント。
 * ログイン中のユーザーとして動くので、RLSがそのまま効く。
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Component からは cookie を書けない。
            // セッションの更新は middleware が担当するので、ここは無視してよい。
          }
        },
      },
    },
  );
}

/**
 * 表示のためだけにログイン中のユーザーを取り出す。
 *
 * getUser() は毎回Supabaseへ問い合わせるため1回あたり90msほどかかる。
 * ログインしているかどうかは middleware がすでに検証済みで、
 * データの読み書きの可否はDB側のRLSが判断するため、
 * 画面に名前を出すだけならcookieから読んで十分。
 */
export async function getViewer() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return { supabase, user: session?.user ?? null };
}
