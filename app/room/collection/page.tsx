import Link from "next/link";
import { randomUUID } from "node:crypto";
import { requireRole, client } from "../../../lib/supabase/server";
import { items } from "../../../lib/rules";
import { Scene } from "../../rewards/scene";
import { dress, letter, redeem } from "../../rewards/actions";
export const dynamic = "force-dynamic";
export default async function Collection({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; folder?: string }>;
}) {
  await requireRole("player");
  const db = await client(),
    q = await searchParams;
  const [
    inventory,
    outfits,
    badges,
    unlocks,
    mail,
    attachments,
    claims,
    requests,
    budget,
    wallet,
  ] = await Promise.all([
    db.from("inventory").select("item_id"),
    db.from("outfits").select("item_id"),
    db.from("achievements").select("id,name"),
    db.from("achievement_unlocks").select("achievement_id"),
    db
      .from("mail_messages")
      .select("id,title,body,read_at,starred,trashed_at,sent_at")
      .order("sent_at", { ascending: false }),
    db.from("mail_attachments").select("id,message_id,coins"),
    db.from("mail_claims").select("attachment_id"),
    db
      .from("redemption_requests")
      .select("id,coins,status")
      .order("requested_at", { ascending: false })
      .limit(40),
    db.from("reward_budget").select("*").single(),
    db.from("wallets").select("available,frozen").single(),
  ]);
  if (
    inventory.error ||
    outfits.error ||
    badges.error ||
    unlocks.error ||
    mail.error ||
    attachments.error ||
    claims.error ||
    requests.error ||
    budget.error ||
    wallet.error
  )
    throw Error("无法读取收藏，请检查养成系统迁移");
  const owned = new Set(inventory.data.map((x) => String(x.item_id))),
    worn = new Set(outfits.data.map((x) => String(x.item_id))),
    folder = q.folder ?? "inbox";
  const letters = mail.data.filter((m) =>
    folder === "trash"
      ? m.trashed_at
      : !m.trashed_at && (folder !== "star" || m.starred),
  );
  return (
    <main className="live">
      <header className="top">
        <h1>小张的收藏室</h1>
        <Link href="/room">返回卧室</Link>
      </header>
      {q.message && <p role="status">{q.message}</p>}
      <section className="panel">
        <h2>我的衣柜</h2>
        <Scene owned={owned} worn={worn} />
        {items
          .filter((i) => i.layer && owned.has(i.id))
          .map((i) => (
            <form key={i.id} action={dress}>
              <input type="hidden" name="item" value={i.id} />
              <button name="on" value={worn.has(i.id) ? "no" : "yes"}>
                {worn.has(i.id) ? "脱下" : "穿上"}
                {i.name}
              </button>
            </form>
          ))}
        {!worn.size && <p>当前穿着初始短裤。</p>}
      </section>
      <section className="panel">
        <h2>成就图鉴</h2>
        <div className="tasks">
          {badges.data.map((b) => (
            <div
              key={b.id}
              className={
                "badge " +
                (unlocks.data.some((u) => u.achievement_id === b.id)
                  ? ""
                  : "locked")
              }
            >
              <img
                className="iconart"
                alt=""
                src={b.id === "pride" ? "/art/heart.webp" : "/art/medal.webp"}
              />
              {b.name}
              <small>
                {unlocks.data.some((u) => u.achievement_id === b.id)
                  ? "已点亮"
                  : "待解锁"}
              </small>
            </div>
          ))}
        </div>
      </section>
      <section className="panel">
        <h2>女友来信</h2>
        <nav className="tabs">
          {[
            ["inbox", "收件箱"],
            ["star", "珍藏夹"],
            ["trash", "回收站"],
          ].map(([k, s]) => (
            <Link key={k} href={"?folder=" + k}>
              {s}
            </Link>
          ))}
        </nav>
        {letters.length === 0 && <p>这里暂时没有信件。</p>}
        {letters.map((m) => {
          const a = attachments.data.find((x) => x.message_id === m.id),
            claimed = a && claims.data.some((x) => x.attachment_id === a.id);
          return (
            <article className="mail-card" key={m.id}>
              <h3>
                {m.read_at ? "✉" : "💌"} {m.title}
              </h3>
              <small>
                {new Date(m.sent_at).toLocaleDateString("zh-CN", {
                  timeZone: "America/Toronto",
                })}{" "}
                · {m.read_at ? "已读" : "未读"}
              </small>
              <form action={letter}>
                <input type="hidden" name="id" value={m.id} />
                {m.read_at ? (
                  <p className="letter-body">{m.body}</p>
                ) : (
                  <button name="action" value="read">
                    拆开来信
                  </button>
                )}
                {m.trashed_at ? (
                  <>
                    <button name="action" value="restore">
                      恢复
                    </button>
                    <details>
                      <summary>永久删除…</summary>
                      <button name="action" value="delete">
                        确认永久删除这封信
                      </button>
                    </details>
                  </>
                ) : (
                  <>
                    <button name="action" value={m.starred ? "unstar" : "star"}>
                      {m.starred ? "取消珍藏" : "珍藏"}
                    </button>
                    <button name="action" value="trash">
                      移入回收站
                    </button>
                    {a && m.read_at && (
                      <button disabled={claimed} name="action" value="claim">
                        {claimed ? "已领取" : "领取 " + a.coins + " 金币"}
                      </button>
                    )}
                  </>
                )}
              </form>
            </article>
          );
        })}
      </section>
      <section className="panel">
        <h2>现实兑奖</h2>
        <p>
          可用 {wallet.data.available} 金币 · 已冻结 {wallet.data.frozen} 金币 ·
          本月剩余 CA${200 - budget.data.monthly_coins / 10}
        </p>
        <form action={redeem}>
          <input type="hidden" name="key" value={randomUUID()} />
          <label>
            每 10 金币兑换 CA$1
            <input
              name="coins"
              type="number"
              required
              step="10"
              min="10"
              max={Math.min(2000, wallet.data.available)}
            />
          </label>
          <button disabled={wallet.data.available < 10}>冻结金币并申请</button>
        </form>
        {requests.data.map((r) => (
          <p key={r.id}>
            CA${r.coins / 10} ·{" "}
            {r.status === "paid"
              ? "已兑现"
              : r.status === "rejected"
                ? "已退回"
                : "等待审核"}
          </p>
        ))}
      </section>
    </main>
  );
}
