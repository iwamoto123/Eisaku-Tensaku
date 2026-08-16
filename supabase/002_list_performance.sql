-- 一覧の表示を速くするための追加。
-- Supabase の SQL Editor に貼り付けて実行する。何度実行しても壊れない。
--
-- 背景: 一覧で「直すところ○件」「編集済み」を出すために、
-- 添削データ（1件あたり約50KB）と編集後HTMLを毎回読み込んでいた。
-- 5件並べるだけで500KB超になり、画面の切り替えが目に見えて遅かった。
-- 必要なのは件数と編集の有無だけなので、それを列として持たせる。

alter table public.corrections
  add column if not exists fix_count int not null default 0;

alter table public.corrections
  add column if not exists is_edited boolean not null default false;

-- 保存のたびに自動で埋める
create or replace function public.sync_correction_flags()
returns trigger language plpgsql as $$
begin
  new.fix_count := coalesce(jsonb_array_length(new.data -> 'corrections'), 0);
  new.is_edited := new.edited_html is not null;
  return new;
end;
$$;

drop trigger if exists corrections_sync_flags on public.corrections;
create trigger corrections_sync_flags
  before insert or update on public.corrections
  for each row execute function public.sync_correction_flags();

-- すでにある行を埋め直す
update public.corrections
set fix_count = coalesce(jsonb_array_length(data -> 'corrections'), 0),
    is_edited = edited_html is not null;
