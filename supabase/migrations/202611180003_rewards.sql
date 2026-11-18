begin;
create function game_private.deliver(p uuid,k text,t text,b text,g int) returns void language plpgsql set search_path='' as $$
declare m uuid;
begin
 if p is null or nullif(trim(t),'') is null or nullif(trim(b),'') is null or length(t)>120 or length(b)>10000 or g is null or g<0 then raise exception '信件内容无效'; end if;
 insert into public.mail_messages(player_id,delivery_key,title,body) values(p,k,t,b) on conflict(delivery_key) do nothing returning id into m;
 if m is not null and g>0 then insert into public.mail_attachments(message_id,coins) values(m,g); end if;
end $$;
create function public.write_letter(p_key uuid,p_title text,p_body text,p_gift int) returns void language plpgsql security definer set search_path='' as $$
declare p uuid;
begin
 if game_private.my_role() is distinct from 'admin' or p_key is null then raise exception '仅管理员可以发信'; end if;
 select player_id into strict p from public.wallets;
 perform game_private.deliver(p,'manual/'||p_key,p_title,p_body,p_gift);
end $$;
create function public.save_mail_template(p_id uuid,p_event text,p_title text,p_body text,p_gift int,p_enabled boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if game_private.my_role() is distinct from 'admin' then raise exception '仅管理员可以管理模板'; end if;
 if nullif(trim(p_title),'') is null or nullif(trim(p_body),'') is null or length(p_title)>120 or length(p_body)>10000 then raise exception '模板内容无效'; end if;
 insert into public.mail_templates(id,kind,title,body,attachment_coins,achievement_id,enabled)
 values(p_id,case when p_event='daily' then 'daily' else 'achievement' end,p_title,p_body,p_gift,nullif(p_event,'daily'),p_enabled)
 on conflict(id) do update set kind=excluded.kind,title=excluded.title,body=excluded.body,attachment_coins=excluded.attachment_coins,achievement_id=excluded.achievement_id,enabled=excluded.enabled;
end $$;
create function public.manage_letter(p_id uuid,p_action text) returns void language plpgsql security definer set search_path='' as $$
declare m public.mail_messages; a public.mail_attachments; l bigint;
begin
 if game_private.my_role() is distinct from 'player' then raise exception '仅收件人可以操作'; end if;
 perform 1 from public.wallets where player_id=auth.uid() for update;
 select * into strict m from public.mail_messages where id=p_id and player_id=auth.uid() and deleted_at is null for update;
 case p_action
 when 'read' then update public.mail_messages set read_at=coalesce(read_at,now()) where id=p_id;
 when 'star','unstar' then update public.mail_messages set starred=(p_action='star') where id=p_id;
 when 'trash' then update public.mail_messages set trashed_at=coalesce(trashed_at,now()) where id=p_id;
 when 'restore' then update public.mail_messages set trashed_at=null where id=p_id;
 when 'delete' then
 if m.trashed_at is null then raise exception '请先移入回收站'; end if;
 update public.mail_messages set deleted_at=now() where id=p_id;
 when 'claim' then
 if m.trashed_at is not null then raise exception '请先恢复来信'; end if;
 select * into strict a from public.mail_attachments where message_id=p_id;
 if exists(select 1 from public.mail_claims where attachment_id=a.id) then return; end if;
 insert into public.ledger_entries(player_id,event_key,kind,available_delta,frozen_delta) values(m.player_id,'attachment/'||a.id,'mail',a.coins,0) returning id into l;
 insert into public.mail_claims(attachment_id,ledger_id) values(a.id,l);
 update public.wallets set available=available+a.coins where player_id=m.player_id;
 else raise exception '未知操作'; end case;
end $$;
create function game_private.send_template(p uuid,event text,k text) returns void language plpgsql set search_path='' as $$
declare t public.mail_templates;
begin
 select * into t from public.mail_templates where enabled and (kind='daily' and event='daily' or kind='achievement' and achievement_id=event) order by random() limit 1;
 if found then perform game_private.deliver(p,k,t.title,t.body,t.attachment_coins); end if;
end $$;
create function game_private.badge_mail() returns trigger language plpgsql security definer set search_path='' as $$
begin perform game_private.send_template(new.player_id,new.achievement_id,'badge/'||new.player_id||'/'||new.achievement_id);return new;end $$;
create trigger badge_letter after insert on public.achievement_unlocks for each row execute function game_private.badge_mail();

create function game_private.sync_badges(p uuid) returns void language sql set search_path='' as $$
 with activity as (select v.task_id,c.activity_date from public.checkins c join public.task_rule_versions v on v.id=c.rule_id where c.player_id=p and c.status='approved'),
 earned as (
 select 'first_gym' id where exists(select 1 from activity where task_id='gym')
 union all select 'weekly_gym' where exists(select 1 from activity where task_id='gym' group by date_trunc('week',activity_date::timestamp) having count(*)>=3)
 union all select 'gym_15' where (select count(*) from activity where task_id='gym')>=15
 union all select 'dinner_20' where (select count(distinct activity_date) from activity where task_id='dinner')>=20
 union all select 'warm' where exists(select 1 from public.inventory where player_id=p and item_id='pants_warm')
 union all select 'first_gear' where exists(select 1 from public.inventory where player_id=p and effect_snapshot<>'{}'::jsonb))
 insert into public.achievement_unlocks(player_id,achievement_id) select p,id from earned on conflict do nothing
$$;
create function game_private.after_growth() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform game_private.sync_badges(new.player_id);
 if tg_table_name='checkins' then
 perform game_private.send_template(new.player_id,'daily','daily/'||new.player_id||'/'||(now() at time zone 'America/Toronto')::date);
 elsif new.item_id in ('pants_warm','running_shoes','hoodie','glasses_gold') then
 insert into public.outfits values(new.player_id,new.item_id,new.item_id) on conflict do nothing;
 end if;
 return new;
end $$;
create trigger gear_growth after insert on public.inventory for each row execute function game_private.after_growth();
create trigger checkin_growth after update of status on public.checkins for each row when(new.status='approved' and old.status<>'approved') execute function game_private.after_growth();
select game_private.sync_badges(player_id) from public.wallets;
insert into public.outfits select player_id,item_id,item_id from public.inventory where item_id in ('pants_warm','running_shoes','hoodie','glasses_gold') on conflict do nothing;
create function public.wear_item(p_item text,p_on boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if game_private.my_role() is distinct from 'player' or p_item not in ('pants_warm','running_shoes','hoodie','glasses_gold') then raise exception '无法穿戴'; end if;
 if p_on then insert into public.outfits values(auth.uid(),p_item,p_item) on conflict do nothing;
 else delete from public.outfits where player_id=auth.uid() and item_id=p_item; end if;
end $$;
create function public.award_pride() returns void language plpgsql security definer set search_path='' as $$
begin
 if game_private.my_role() is distinct from 'admin' then raise exception '仅管理员可以授章'; end if;
 insert into public.achievement_unlocks select player_id,'pride',now() from public.wallets on conflict do nothing;
end $$;

create function public.request_redemption(p_key uuid,p_coins bigint) returns void language plpgsql security definer set search_path='' as $$
declare p uuid:=auth.uid(); bal bigint;
begin
 if game_private.my_role() is distinct from 'player' then raise exception '仅玩家可以申请'; end if;
 select available into strict bal from public.wallets where player_id=p for update;
 if exists(select 1 from public.redemption_requests where id=p_key and player_id=p) then return; end if;
 if p_coins is null or p_coins<=0 or p_coins%10<>0 or p_coins>2000 or p_coins>bal then raise exception '请检查申请金额、余额和单月上限'; end if;
 insert into public.redemption_requests(id,player_id,coins,status) values(p_key,p,p_coins,'requested');
 update public.wallets set available=available-p_coins,frozen=frozen+p_coins where player_id=p;
 insert into public.ledger_entries(player_id,event_key,kind,available_delta,frozen_delta) values(p,'freeze/'||p_key,'freeze',-p_coins,p_coins);
end $$;
create function public.settle_redemption(p_id uuid,p_paid boolean) returns void language plpgsql security definer set search_path='' as $$
declare r public.redemption_requests; target text; spent bigint; local_month timestamp;
begin
 if game_private.my_role() is distinct from 'admin' or p_paid is null then raise exception '仅管理员可以审核兑奖'; end if;
 select * into strict r from public.redemption_requests where id=p_id;
 perform 1 from public.wallets where player_id=r.player_id for update;
 select * into strict r from public.redemption_requests where id=p_id for update;
 target:=case when p_paid then 'paid' else 'rejected' end;
 if r.status=target then return; end if;
 if r.status not in ('requested','approved') then raise exception '该申请已处理'; end if;
 if p_paid then
 local_month:=date_trunc('month',statement_timestamp() at time zone 'America/Toronto');
 select coalesce(sum(coins),0) into spent from public.redemption_requests where player_id=r.player_id and status='paid'
 and date_trunc('month',paid_at at time zone 'America/Toronto')=local_month;
 if spent+r.coins>2000 then raise exception '本月实付额度不足'; end if;
 end if;
 update public.redemption_requests set status=target,paid_at=case when p_paid then statement_timestamp() end where id=r.id;
 update public.wallets set frozen=frozen-r.coins,available=available+case when p_paid then 0 else r.coins end where player_id=r.player_id;
 insert into public.ledger_entries(player_id,event_key,kind,available_delta,frozen_delta) values(r.player_id,'settle/'||r.id,target,case when p_paid then 0 else r.coins end,-r.coins);
 insert into public.admin_audit_log(actor,action,details) values(auth.uid(),target,jsonb_build_object('redemption',r.id,'coins',r.coins));
end $$;
create function public.remove_mail_template(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if game_private.my_role() is distinct from 'admin' then raise exception '仅管理员可以管理模板'; end if;
 delete from public.mail_templates where id=p_id;
end $$;
create view public.reward_budget with (security_invoker=true) as
select coalesce(sum(coins) filter(where date_trunc('month',paid_at at time zone 'America/Toronto')=date_trunc('month',now() at time zone 'America/Toronto')),0) monthly_coins,
coalesce(sum(coins),0) lifetime_coins from public.redemption_requests where status='paid';
grant select on public.reward_budget to authenticated;
revoke all on function game_private.deliver(uuid,text,text,text,int),game_private.send_template(uuid,text,text),game_private.badge_mail(),game_private.sync_badges(uuid),game_private.after_growth() from public,anon,authenticated;
do $$
declare f regprocedure;
begin
 foreach f in array array['public.remove_mail_template(uuid)'::regprocedure,'public.write_letter(uuid,text,text,int)'::regprocedure,'public.save_mail_template(uuid,text,text,text,int,boolean)'::regprocedure,'public.manage_letter(uuid,text)'::regprocedure,'public.wear_item(text,boolean)'::regprocedure,'public.award_pride()'::regprocedure,'public.request_redemption(uuid,bigint)'::regprocedure,'public.settle_redemption(uuid,boolean)'::regprocedure] loop
 execute format('revoke all on function %s from public,anon',f);
 execute format('grant execute on function %s to authenticated',f);
 end loop;
end $$;
commit;
