-- 英作文添削メーカー データベース定義
-- Supabase の SQL Editor に貼り付けて実行する。
-- 何度実行しても壊れないように書いてある。

-- ============================================================
-- 1. 講師プロフィール
--    Supabase Auth のユーザーと1対1。ログインした人の表示名を持つ。
-- ============================================================

create table if not exists public.instructors (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  display_name text not null default '',
  created_at timestamptz not null default now()
);

-- サインアップ時に自動でプロフィールを作る
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.instructors (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 2. 生徒
-- ============================================================

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  honorific text not null default 'くん',
  slug text not null default '',            -- ファイル名に使う英数字
  grade text not null default '英検2級 対策',
  note text not null default '',
  created_by uuid references public.instructors(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists students_created_at_idx on public.students (created_at desc);

-- ============================================================
-- 3. 添削
--    生成の入力・結果・講師が編集したHTML・利用トークンをまとめて持つ。
-- ============================================================

create table if not exists public.corrections (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  instructor_id uuid references public.instructors(id) on delete set null,

  -- 入力
  instructor_name text not null default '',
  grade text not null default '',
  date_label text not null default '',       -- 資料に出す「2026年8月16日」
  target_date date not null default current_date,
  topic text not null default '',
  english_points text not null default '',
  instructor_notes text not null default '',
  image_paths text[] not null default '{}',  -- Storage 上のパス

  -- 結果
  status text not null default 'generating', -- generating / done / error
  error_message text not null default '',
  data jsonb,                                -- 生成された資料（Feedback型）
  edited_html text,                          -- 講師が編集した版。あればこちらを表示する

  -- 実績
  model text not null default '',
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  elapsed_seconds int not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists corrections_student_idx on public.corrections (student_id, created_at desc);
create index if not exists corrections_created_at_idx on public.corrections (created_at desc);

-- updated_at を自動更新
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists students_touch on public.students;
create trigger students_touch before update on public.students
  for each row execute function public.touch_updated_at();

drop trigger if exists corrections_touch on public.corrections;
create trigger corrections_touch before update on public.corrections
  for each row execute function public.touch_updated_at();

-- ============================================================
-- 4. アクセス制御（RLS）
--    方針: ログインした講師は全員、すべての生徒と添削を読み書きできる。
--    小さな教室で指導の質を揃えるのが目的のため、担当で分けない。
--    ログインしていない人は一切見られない。
-- ============================================================

alter table public.instructors enable row level security;
alter table public.students    enable row level security;
alter table public.corrections enable row level security;

drop policy if exists "講師は全プロフィールを閲覧" on public.instructors;
create policy "講師は全プロフィールを閲覧" on public.instructors
  for select to authenticated using (true);

drop policy if exists "自分のプロフィールを更新" on public.instructors;
create policy "自分のプロフィールを更新" on public.instructors
  for update to authenticated using (auth.uid() = id);

drop policy if exists "講師は生徒を自由に操作" on public.students;
create policy "講師は生徒を自由に操作" on public.students
  for all to authenticated using (true) with check (true);

drop policy if exists "講師は添削を自由に操作" on public.corrections;
create policy "講師は添削を自由に操作" on public.corrections
  for all to authenticated using (true) with check (true);

-- ============================================================
-- 5. 答案画像のストレージ
--    非公開バケット。ログインした講師だけが読み書きできる。
-- ============================================================

insert into storage.buckets (id, name, public)
values ('answers', 'answers', false)
on conflict (id) do nothing;

drop policy if exists "講師は答案画像を閲覧" on storage.objects;
create policy "講師は答案画像を閲覧" on storage.objects
  for select to authenticated using (bucket_id = 'answers');

drop policy if exists "講師は答案画像を保存" on storage.objects;
create policy "講師は答案画像を保存" on storage.objects
  for insert to authenticated with check (bucket_id = 'answers');

drop policy if exists "講師は答案画像を削除" on storage.objects;
create policy "講師は答案画像を削除" on storage.objects
  for delete to authenticated using (bucket_id = 'answers');
