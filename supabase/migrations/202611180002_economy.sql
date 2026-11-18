begin;
drop policy evidence_upload on storage.objects;
alter table public.checkins add column submission_key uuid unique, add column review_note text not null default '';

-- Every economic operation locks the same wallet first. Submit and review therefore
-- observe a consistent inventory, even while purchases or other approvals run.
create function game_private.task_reward(base int, bonus int, warm boolean)
returns integer language sql immutable strict set search_path='' as $$
 select round(base::numeric*(100+bonus)/100 * case when warm then 1 else 0.8 end)::int
$$;

-- Called only after the Next.js server has authenticated the player and hashed the
-- immutable object bytes. The service role never takes a player ID from the form.
create function public.submit_checkin(p_player uuid,p_key uuid,p_task text,p_date date,p_path text,p_hash text,p_note text)
returns text language plpgsql security definer set search_path='' as $$
declare
 today date := (now() at time zone 'America/Toronto')::date;
 rule public.task_rule_versions;
 weekly public.task_rule_versions;
 previous public.checkins;
 period_start date;
 span int;
 counted int;
 bonus int;
 warm boolean;

begin
 perform 1 from public.wallets where player_id=p_player for update;
 if not found then raise exception '玩家账号不存在'; end if;
 select * into previous from public.checkins where submission_key=p_key;
 if found then
  if previous.player_id=p_player then return previous.photo_path; end if;
  raise exception '凭证无效';
 end if;
 if p_key is null or p_date is null or p_date>today or p_task not in ('gym','dinner','steps') or p_task is null
 or split_part(p_path,'/',1)<>p_player::text or p_hash !~ '^[a-f0-9]{64}$' or length(p_note)>600
 then raise exception '任务、日期或凭证无效'; end if;
 if not exists(select 1 from storage.objects where bucket_id='checkin-evidence' and name=p_path)
 then raise exception '找不到已上传的照片'; end if;
 if exists(select 1 from public.checkins where player_id=p_player and evidence_sha256=p_hash and status<>'rejected')
 then raise exception '这张照片已用于打卡'; end if;
 select * into strict rule from public.task_rule_versions where task_id=p_task order by version desc limit 1;
 select * into strict weekly from public.task_rule_versions where task_id='weekly' order by version desc limit 1;
 period_start:= case when rule.period='week' then date_trunc('week',p_date::timestamp)::date else p_date end;
 span:=case when rule.period='week' then 7 else 1 end;
 select count(*) into counted from public.checkins c join public.task_rule_versions v on v.id=c.rule_id
 where c.player_id=p_player and v.task_id=p_task and c.status<>'rejected' and c.activity_date>=period_start and c.activity_date<period_start+span;
 if counted>=rule.period_limit then raise exception '本周期提交次数已满'; end if;
 select coalesce(sum((effect_snapshot->>p_task)::int),0),coalesce(bool_or(item_id='pants_warm'),false)
 into bonus,warm from public.inventory where player_id=p_player;
 insert into public.checkins(submission_key,player_id,rule_id,activity_date,photo_path,evidence_sha256,note,reward_snapshot)
 values(p_key,p_player,rule.id,p_date,p_path,p_hash,coalesce(p_note,''),jsonb_build_object('base',rule.base_coins,'bonus',bonus,'warm',warm,
 'coins',game_private.task_reward(rule.base_coins,bonus,warm),'weekly_rule',weekly.id,'weekly_coins',game_private.task_reward(weekly.base_coins,0,warm)));
 return p_path;
end $$;

create function public.review_checkin(p_id uuid,p_approve boolean,p_note text default '')
returns void language plpgsql security definer set search_path='' as $$
declare c public.checkins; task text; week_start date; n int; amount int; target text; weekly_amount int;
begin
 if game_private.my_role() is distinct from 'admin' then raise exception '仅管理员可以审核'; end if;
 if p_approve is null or length(p_note)>600 then raise exception '审核内容无效'; end if;
 select * into strict c from public.checkins where id=p_id;
 perform 1 from public.wallets where player_id=c.player_id for update;
 select * into strict c from public.checkins where id=p_id for update;
 target:=case when p_approve then 'approved' else 'rejected' end;
 if c.status=target then return; end if;
 if c.status<>'submitted' then raise exception '该打卡已经审核'; end if;
 update public.checkins set status=target,reviewed_at=now(),reviewed_by=auth.uid(),review_note=coalesce(p_note,'') where id=c.id;
 insert into public.admin_audit_log(actor,action,details) values(auth.uid(),target,jsonb_build_object('checkin',p_id));
 if not p_approve then return; end if;
 amount:=(c.reward_snapshot->>'coins')::int;
 if amount>0 then
 insert into public.ledger_entries(player_id,event_key,kind,available_delta,frozen_delta) values(c.player_id,'checkin/'||c.id,'checkin',amount,0);
 end if;
 select task_id into task from public.task_rule_versions where id=c.rule_id;
 if task='gym' then
 week_start:=date_trunc('week',c.activity_date::timestamp)::date;
 select count(*) into n from public.checkins a join public.task_rule_versions r on r.id=a.rule_id
 where a.player_id=c.player_id and r.task_id='gym' and a.status='approved' and a.activity_date>=week_start and a.activity_date<week_start+7;
 weekly_amount:=(c.reward_snapshot->>'weekly_coins')::int;
 if n=3 and weekly_amount>0 then
 insert into public.ledger_entries(player_id,event_key,kind,available_delta,frozen_delta)
 values(c.player_id,'weekly/'||c.player_id||'/'||week_start,'weekly',weekly_amount,0) on conflict(event_key) do nothing;
 if found then amount:=amount+weekly_amount; end if;
 end if;
 end if;
 update public.wallets set available=available+amount where player_id=c.player_id;
end $$;

create function public.purchase_item(p_item text) returns void language plpgsql security definer set search_path='' as $$
declare player uuid:=auth.uid(); balance bigint; item public.items;
begin
 if game_private.my_role() is distinct from 'player' then raise exception '仅玩家可以购买'; end if;
 select available into strict balance from public.wallets where player_id=player for update;
 if exists(select 1 from public.inventory where player_id=player and item_id=p_item) then return; end if;
 select * into strict item from public.items where id=p_item for share;
 if item.requires_item is not null and not exists(select 1 from public.inventory where player_id=player and item_id=item.requires_item)
 then raise exception '需要先购买基础装备'; end if;
 if balance<item.price then raise exception '可用金币不足'; end if;
 insert into public.inventory(player_id,item_id,price_paid,effect_snapshot) values(player,item.id,item.price,item.effect);
 if item.price>0 then
 insert into public.ledger_entries(player_id,event_key,kind,available_delta,frozen_delta) values(player,'purchase/'||player||'/'||item.id,'purchase',-item.price,0);
 update public.wallets set available=available-item.price where player_id=player;
 end if;
end $$;
revoke all on function game_private.task_reward(int,int,boolean), public.submit_checkin(uuid,uuid,text,date,text,text,text), public.purchase_item(text),public.review_checkin(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.submit_checkin(uuid,uuid,text,date,text,text,text) to service_role;
grant execute on function public.purchase_item(text), public.review_checkin(uuid,boolean,text) to authenticated;
commit;
