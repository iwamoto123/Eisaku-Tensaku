import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/**
 * セッションの更新と、未ログイン時のログイン画面への誘導。
 * Server Component は cookie を書けないため、更新はここで行う。
 */
export async function middleware(request: NextRequest) {
  // 接続情報が無いうちはログイン画面だけ表示し、そこに案内を出す
  if (!isSupabaseConfigured()) {
    const path = request.nextUrl.pathname;
    if (path.startsWith("/login") || path.startsWith("/preview")) {
      return NextResponse.next({ request });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const requestPath = request.nextUrl.pathname;
  const isPublic =
    requestPath.startsWith("/login") ||
    requestPath.startsWith("/auth") ||
    requestPath.startsWith("/preview");

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", requestPath);
    return NextResponse.redirect(url);
  }

  if (user && requestPath === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    // 静的ファイルと画像以外のすべて
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|json)$).*)",
  ],
};
