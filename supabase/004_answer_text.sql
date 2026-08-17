-- 答案をテキストで提出できるようにする。
-- 画像で送ってくる生徒とテキストで送ってくる生徒がいるため、どちらか一方でもよい。
alter table public.corrections
  add column if not exists answer_text text not null default '';
