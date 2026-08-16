import AppHeader from "@/components/AppHeader";
import ProfileForm from "@/components/ProfileForm";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("instructors")
    .select("display_name")
    .eq("id", user?.id ?? "")
    .maybeSingle();

  return (
    <>
      <AppHeader email={user?.email ?? ""} breadcrumb={[{ label: "設定" }]} />
      <main className="page narrow">
        <div className="page-head">
          <h1>設定</h1>
          <p className="lead-text">この画面の内容は、あなたのアカウントにだけ反映されます。</p>
        </div>

        <ProfileForm
          email={user?.email ?? ""}
          displayName={profile?.display_name ?? ""}
        />

        <div className="panel-box">
          <h2>講師を増やすには</h2>
          <p className="lead-text">
            Supabase の管理画面から追加します。
            <br />
            <strong>Authentication → Users → Add user</strong> でメールアドレスを登録し、
            <strong>Auto Confirm User</strong> にチェックを入れてください。
          </p>
          <p className="lead-text" style={{ marginTop: 12 }}>
            追加した瞬間からログインできます。登録した講師は、すべての生徒と添削を見られます。
          </p>
        </div>
      </main>
    </>
  );
}
