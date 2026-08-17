-- 英訳課題のフィードバックに対応するための追加。
-- Supabase の SQL Editor に貼り付けて実行する。何度実行しても壊れない。
--
-- kind = 'writing'     … ライティング答案の添削（従来のもの）
-- kind = 'translation' … 毎日の英訳課題のフィードバック（1問ずつ短く）

alter table public.corrections
  add column if not exists kind text not null default 'writing';

alter table public.corrections
  drop constraint if exists corrections_kind_check;

alter table public.corrections
  add constraint corrections_kind_check check (kind in ('writing', 'translation'));

-- 一覧に出す件数は、種類によって数える場所が違う
create or replace function public.sync_correction_flags()
returns trigger language plpgsql as $$
begin
  if new.kind = 'translation' then
    new.fix_count := coalesce(jsonb_array_length(new.data -> 'items'), 0);
  else
    new.fix_count := coalesce(jsonb_array_length(new.data -> 'corrections'), 0);
  end if;
  new.is_edited := new.edited_html is not null;
  return new;
end;
$$;

drop trigger if exists corrections_sync_flags on public.corrections;
create trigger corrections_sync_flags
  before insert or update on public.corrections
  for each row execute function public.sync_correction_flags();

update public.corrections
set fix_count = case
      when kind = 'translation' then coalesce(jsonb_array_length(data -> 'items'), 0)
      else coalesce(jsonb_array_length(data -> 'corrections'), 0)
    end,
    is_edited = edited_html is not null;
