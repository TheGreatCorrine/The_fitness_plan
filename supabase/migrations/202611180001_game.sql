begin;
create schema if not exists game_private;
revoke all on schema game_private from public;
grant usage on schema game_private to authenticated;
create table public.profiles(
 id uuid primary key references auth.users(id) on delete restrict,
 role text not null unique check(role in ('admin','player'))
);
create function game_private.my_role() returns text language sql stable security definer set search_path='' as $$
 select role from public.profiles where id=(select auth.uid())
$$;
revoke all on function game_private.my_role() from public;
grant execute on function game_private.my_role() to authenticated;
create table public.wallets(
 player_id uuid primary key references public.profiles, available bigint not null default 0 check(available>=0), frozen bigint not null default 0 check(frozen>=0)
);
create function game_private.open_wallet() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.role='player' then insert into public.wallets(player_id) values(new.id); end if;
 return new;
end $$;
revoke all on function game_private.open_wallet() from public;
create trigger open_player_wallet after insert on public.profiles for each row execute function game_private.open_wallet();
create table public.tasks(id text primary key, name text not null);
create table public.task_rule_versions(
 id bigint generated always as identity primary key,task_id text not null references public.tasks,version int not null check(version>0),
 base_coins int not null check(base_coins>=0),period text not null check(period in ('day','week')),period_limit int not null check(period_limit>0),
 unique(task_id,version)
);
create table public.checkins(
 id uuid primary key default gen_random_uuid(),player_id uuid not null references public.wallets,
 rule_id bigint not null references public.task_rule_versions,activity_date date not null,photo_path text not null unique,
 evidence_sha256 text not null, note text not null default '',reward_snapshot jsonb not null,
 status text not null default 'submitted' check(status in ('submitted','approved','rejected')),submitted_at timestamptz not null default now(),
 reviewed_by uuid references public.profiles,reviewed_at timestamptz
);
create unique index checkins_active_evidence on public.checkins(player_id,evidence_sha256) where status<>'rejected';
create table public.items(id text primary key,name text not null,price int not null check(price>=0),effect jsonb not null,requires_item text references public.items);
create table public.inventory(
 player_id uuid not null references public.wallets,item_id text not null references public.items,price_paid int not null check(price_paid>=0),
 effect_snapshot jsonb not null,purchased_at timestamptz not null default now(),primary key(player_id,item_id)
);
create table public.outfits(player_id uuid not null,slot text not null,item_id text not null,primary key(player_id,slot),
 foreign key(player_id,item_id) references public.inventory);
create table public.achievements(id text primary key,name text not null);
create table public.achievement_unlocks(player_id uuid not null references public.wallets,achievement_id text not null references public.achievements,unlocked_at timestamptz not null default now(),primary key(player_id,achievement_id));
create table public.redemption_requests(id uuid primary key default gen_random_uuid(),player_id uuid not null references public.wallets,
 coins bigint not null check(coins>0 and coins%10=0),status text not null check(status in ('requested','approved','paid','rejected','cancelled')),
 requested_at timestamptz not null default now(),paid_at timestamptz,check((status='paid')=(paid_at is not null)));
create table public.ledger_entries(id bigint generated always as identity primary key,player_id uuid not null references public.wallets,
 event_key text not null unique,kind text not null,available_delta bigint not null,frozen_delta bigint not null,created_at timestamptz not null default now(),check(available_delta<>0 or frozen_delta<>0));
create table public.mail_templates(id uuid primary key default gen_random_uuid(),kind text not null check(kind in ('daily','achievement')),
 title text not null,body text not null,attachment_coins int not null default 0 check(attachment_coins>=0),achievement_id text references public.achievements,enabled boolean not null default false);
create table public.mail_messages(id uuid primary key default gen_random_uuid(),player_id uuid not null references public.wallets,
 title text not null,body text not null,delivery_key text unique,sent_at timestamptz not null default now(),read_at timestamptz,starred boolean not null default false,trashed_at timestamptz,deleted_at timestamptz);
create table public.mail_attachments(id uuid primary key default gen_random_uuid(),message_id uuid not null unique references public.mail_messages,coins int not null check(coins>0));
create table public.mail_claims(attachment_id uuid primary key references public.mail_attachments,ledger_id bigint not null unique references public.ledger_entries,claimed_at timestamptz not null default now());
create table public.admin_audit_log(id bigint generated always as identity primary key,actor uuid not null references public.profiles,action text not null,details jsonb not null,created_at timestamptz not null default now());
-- Phase 2 grants read-only access. Later mutation functions must grant EXECUTE individually.
do $$
declare t text; predicate text;
begin
 foreach t in array array['profiles','wallets','tasks','task_rule_versions','checkins','items','inventory','outfits','achievements','achievement_unlocks','redemption_requests','ledger_entries','mail_templates','mail_messages','mail_attachments','mail_claims','admin_audit_log']
 loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public, anon, authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 predicate:=case
 when t='profiles' then 'id=(select auth.uid()) or (select game_private.my_role())=''admin'''
 when t in ('mail_templates','admin_audit_log') then '(select game_private.my_role())=''admin'''
 when t in ('tasks','task_rule_versions','items','achievements') then '(select game_private.my_role()) is not null'
 when t='mail_attachments' then 'exists(select 1 from public.mail_messages m where m.id=message_id)'
 when t='mail_claims' then 'exists(select 1 from public.mail_attachments a where a.id=attachment_id)'
 when t='mail_messages' then '(select game_private.my_role())=''admin'' or (player_id=(select auth.uid()) and deleted_at is null)'
 else 'player_id=(select auth.uid()) or (select game_private.my_role())=''admin''' end;
 execute format('create policy game_read on public.%I for select to authenticated using (%s)',t,predicate);
 end loop;
end $$;
insert into public.tasks values ('gym','健身房运动'),('dinner','健康晚餐'),('steps','每日八千步'),('weekly','本周健身三次');
insert into public.task_rule_versions(task_id,version,base_coins,period,period_limit) values ('gym',1,50,'week',3),('dinner',1,10,'day',1),('steps',1,10,'day',1),('weekly',1,30,'week',1);
insert into public.items values ('pants_warm','运动长裤',120,'{"warm":true}',null),('dumbbell_basic','基础哑铃',120,'{"gym":20}',null),('tableware','精致餐具',40,'{"dinner":20}',null),('running_shoes','轻盈跑鞋',60,'{"steps":20}',null),('sports_bottle','运动水壶',100,'{"gym":10}',null),('dumbbell_advanced','高级哑铃',300,'{"gym":20}','dumbbell_basic'),('hoodie','可爱卫衣',80,'{}',null),('glasses_gold','金丝眼镜',50,'{}',null);
insert into public.achievements values ('first_gym','初次出发'),('weekly_gym','坚持一周'),('gym_15','自律达人'),('dinner_20','健康饮食家'),('warm','终于有裤子穿了'),('first_gear','小张的第一件装备'),('pride','女友的骄傲');
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values ('checkin-evidence','checkin-evidence',false,8388608,array['image/jpeg','image/png','image/webp']);
create policy evidence_upload on storage.objects for insert to authenticated with check(
 bucket_id='checkin-evidence' and (select game_private.my_role())='player' and split_part(name,'/',1)=(select auth.uid())::text
);
create policy evidence_read on storage.objects for select to authenticated using(
 bucket_id='checkin-evidence' and ((select game_private.my_role())='admin' or ((select game_private.my_role())='player' and split_part(name,'/',1)=(select auth.uid())::text))
);
commit;
