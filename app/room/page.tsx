import { randomUUID } from "node:crypto";
import { requireRole, client } from "../../lib/supabase/server";
import { signOut } from "../login/actions";
import { items } from "../../lib/rules";
import { purchase, submit } from "../economy/actions";
import { Ledger } from "../economy/history";
export const dynamic = "force-dynamic";
const states: Record<string, string> = {
  submitted: "待审核",
  approved: "已通过",
  rejected: "已驳回",
};
export default async function Room({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const p = await requireRole("player"),
    db = await client();
  const [wallet, inventory, catalog, history] = await Promise.all([
    db
      .from("wallets")
      .select("available,frozen")
      .eq("player_id", p.id)
      .single(),
    db.from("inventory").select("item_id"),
    db.from("items").select("id,name,price,requires_item"),
    db
      .from("checkins")
      .select(
        "id,activity_date,status,reward_snapshot,review_note,task_rule_versions!inner(tasks!inner(name))",
      )
      .order("submitted_at", { ascending: false })
      .limit(30),
  ]);
  if (wallet.error || inventory.error || catalog.error || history.error)
    throw new Error("暂时无法读取游戏记录");
  const owned = new Set(inventory.data.map((x) => x.item_id)),
    warm = owned.has("pants_warm"),
    today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Toronto",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  const { message } = await searchParams;
  return (
    <main className="live">
      <header className="top">
        <h1>小张的卧室</h1>
        <div className="wallet">🪙 {wallet.data.available}</div>
        <form action={signOut}>
          <button>退出登录</button>
        </form>
      </header>
      {message && <p role="status">{message}</p>}
      <div className="homegrid">
        <section className="frame">
          <div className="scene">
            <span className="temp">
              {warm ? "☀ 温暖" : "❄ 寒冷 · 收益 −20%"}
            </span>
            <div className={"character " + (warm ? "" : "shiver")}>
              <img src="/art/base.png" alt="小张" />
              {items
                .filter((x) => x.layer && owned.has(x.id))
                .map((x) => (
                  <img
                    key={x.id}
                    src={"/art/" + x.layer + ".png"}
                    alt={x.name}
                  />
                ))}
            </div>
          </div>
        </section>
        <section className="panel">
          <h2>今日打卡</h2>
          <form action={submit}>
            <input type="hidden" name="attempt" value={randomUUID()} />
            <label>
              任务
              <select name="task">
                <option value="gym">健身 ≥30 分钟</option>
                <option value="dinner">健康晚餐</option>
                <option value="steps">步数 ≥8,000</option>
              </select>
            </label>
            <label>
              活动日期（多伦多）
              <input
                required
                type="date"
                name="date"
                defaultValue={today}
                max={today}
              />
            </label>
            <label>
              照片 · JPG / PNG / WebP · ≤3 MiB
              <input
                required
                type="file"
                name="photo"
                accept="image/jpeg,image/png,image/webp"
              />
            </label>
            <label>
              备注
              <input name="note" maxLength={600} />
            </label>
            <button>提交给女友审核</button>
          </form>
        </section>
      </div>
      <section className="panel">
        <h2>装备小铺</h2>
        <p>每件限购一次，永久保留。装备购买后不可退款。</p>
        <div className="products">
          {items.map((info) => {
            const item = catalog.data.find((it) => it.id === info.id);
            if (!item) return null;
            const missing =
              item.requires_item && !owned.has(item.requires_item);
            return (
              <article key={item.id}>
                <img
                  className="iconart"
                  src={"/art/" + item.id + ".webp"}
                  alt=""
                />
                <div>
                  <strong>{item.name}</strong>
                  <small>
                    {info.effect} · {item.price} 金币
                  </small>
                </div>
                <form action={purchase}>
                  <input type="hidden" name="item" value={item.id} />
                  <button
                    disabled={
                      owned.has(item.id) ||
                      missing ||
                      wallet.data.available < item.price
                    }
                  >
                    {owned.has(item.id)
                      ? "已拥有"
                      : missing
                        ? "需基础哑铃"
                        : wallet.data.available < item.price
                          ? "余额不足"
                          : "购买"}
                  </button>
                </form>
              </article>
            );
          })}
        </div>
      </section>
      <section className="panel">
        <h2>最近打卡</h2>
        {history.data.length ? (
          history.data.map((c) => (
            <p key={c.id}>
              {c.activity_date}　
              {
                (c.task_rule_versions as unknown as { tasks: { name: string } })
                  .tasks.name
              }
              　{states[c.status]} · {c.reward_snapshot.coins} 金币
              {c.review_note && " · " + c.review_note}
            </p>
          ))
        ) : (
          <p>还没有打卡记录。</p>
        )}
      </section>
      <Ledger />
    </main>
  );
}
