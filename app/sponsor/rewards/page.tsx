import Link from "next/link";
import { randomUUID } from "node:crypto";
import { requireRole, client } from "../../../lib/supabase/server";
import {
  pride,
  send,
  settle,
  template,
  removeTemplate,
} from "../../rewards/actions";
export const dynamic = "force-dynamic";
export default async function Rewards({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  await requireRole("admin");
  const db = await client(),
    { message } = await searchParams;
  const [badges, templates, history, requests, budget, wallet] =
    await Promise.all([
      db.from("achievements").select("id,name"),
      db.from("mail_templates").select("*").order("id"),
      db
        .from("mail_messages")
        .select("id,title,body,sent_at")
        .order("sent_at", { ascending: false })
        .limit(50),
      db
        .from("redemption_requests")
        .select("id,coins,status")
        .eq("status", "requested")
        .order("requested_at"),
      db.from("reward_budget").select("*").single(),
      db.from("wallets").select("available,frozen").maybeSingle(),
    ]);
  if (
    badges.error ||
    templates.error ||
    history.error ||
    requests.error ||
    budget.error ||
    wallet.error
  )
    throw Error("无法读取运营记录");
  return (
    <main className="live">
      <header className="top">
        <h1>女友的书桌</h1>
        <Link href="/sponsor">返回审核室</Link>
      </header>
      {message && <p role="status">{message}</p>}
      <section className="panel">
        <h2>给小张写信</h2>
        <form action={send}>
          <input type="hidden" name="id" value={randomUUID()} />
          <label>
            标题
            <input required maxLength={120} name="title" />
          </label>
          <label>
            正文
            <textarea required maxLength={10000} name="body" />
          </label>
          <label>
            金币附件
            <input type="number" min="0" name="gift" defaultValue="0" />
          </label>
          <button>立即寄出</button>
        </form>
      </section>
      <section className="panel">
        <h2>自动来信模板</h2>
        {[
          ...templates.data,
          {
            id: randomUUID(),
            title: "",
            body: "",
            kind: "daily",
            achievement_id: null,
            enabled: false,
            attachment_coins: 0,
          },
        ].map((t) => (
          <details key={t.id}>
            <summary>
              {t.title || "新建模板"}{" "}
              {t.title && (t.enabled ? "· 已启用" : "· 已停用")}
            </summary>
            <form action={template}>
              <input type="hidden" name="id" value={t.id} />
              <label>
                触发条件
                <select name="event" defaultValue={t.achievement_id ?? "daily"}>
                  <option value="daily">当日打卡获批 · 每天最多一封</option>
                  {badges.data.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <input
                name="title"
                aria-label="模板标题"
                required
                maxLength={120}
                defaultValue={t.title}
              />
              <textarea
                name="body"
                required
                aria-label="模板正文"
                maxLength={10000}
                defaultValue={t.body}
              />
              <label>
                金币附件
                <input
                  type="number"
                  min="0"
                  name="gift"
                  defaultValue={t.attachment_coins}
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  name="enabled"
                  defaultChecked={t.enabled}
                />
                启用
              </label>
              <button>保存模板</button>
            </form>
            {t.title && (
              <details>
                <summary>删除模板…</summary>
                <form action={removeTemplate}>
                  <input type="hidden" name="id" value={t.id} />
                  <button>确认删除模板</button>
                </form>
              </details>
            )}
          </details>
        ))}
        <form action={pride}>
          <button>授予「女友的骄傲」</button>
        </form>
      </section>
      <section className="panel">
        <h2>兑奖与预算</h2>
        <p>
          本月已付 CA${budget.data.monthly_coins / 10} / 200 · 累计已付 CA$
          {budget.data.lifetime_coins / 10}
        </p>
        <p>
          可用 {wallet.data?.available ?? 0} 金币 · 冻结{" "}
          {wallet.data?.frozen ?? 0} 金币
        </p>
        {requests.data.length === 0 && <p>暂时没有待兑奖申请。</p>}
        {requests.data.map((r) => (
          <form key={r.id} action={settle}>
            <strong>CA${r.coins / 10}</strong>
            <input name="id" type="hidden" value={r.id} />
            <button
              name="action"
              value="paid"
              disabled={Number(budget.data.monthly_coins) + r.coins > 2000}
            >
              已实际支付，确认兑现
            </button>
            <button name="action" value="reject">
              拒绝并解冻
            </button>
          </form>
        ))}
      </section>
      <section className="panel">
        <h2>已寄出的信</h2>
        {history.data.map((m) => (
          <details key={m.id}>
            <summary>{m.title}</summary>
            <p className="letter-body">{m.body}</p>
          </details>
        ))}
      </section>
    </main>
  );
}
