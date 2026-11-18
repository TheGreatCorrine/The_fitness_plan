import Link from "next/link";
import { requireRole, client } from "../../lib/supabase/server";
import { signOut } from "../login/actions";
import { review } from "../economy/actions";
import { Ledger } from "../economy/history";
export const dynamic = "force-dynamic";
export default async function Sponsor({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  await requireRole("admin");
  const db = await client();
  const [wallet, pending] = await Promise.all([
    db.from("wallets").select("available,frozen").maybeSingle(),
    db
      .from("checkins")
      .select(
        "id,activity_date,photo_path,note,reward_snapshot,task_rule_versions!inner(tasks!inner(name))",
      )
      .eq("status", "submitted")
      .order("submitted_at")
      .limit(30),
  ]);
  if (wallet.error || pending.error) throw new Error("暂时无法读取审核记录");
  const paths = pending.data.map((c) => c.photo_path);
  const signed = paths.length
    ? await db.storage.from("checkin-evidence").createSignedUrls(paths, 300)
    : null;
  const { message } = await searchParams;
  return (
    <main className="live">
      <header className="top">
        <h1>女友管理室</h1>
        <form action={signOut}>
          <button>退出登录</button>
        </form>
        <Link href="/sponsor/rewards">写信与兑奖</Link>
      </header>
      {message && <p role="status">{message}</p>}
      <section className="panel">
        <h2>小张的钱包</h2>
        {wallet.data ? (
          <p>
            可用 {wallet.data.available} 金币 · 已冻结 {wallet.data.frozen} 金币
          </p>
        ) : (
          <p>等待绑定玩家账号。</p>
        )}
      </section>
      <section className="panel">
        <h2>待审核打卡</h2>
        {pending.data.length ? (
          pending.data.map((c) => {
            const url = signed?.data?.find(
              (row) => row.path === c.photo_path,
            )?.signedUrl;
            return (
              <article className="row" key={c.id}>
                <strong>
                  {
                    (
                      c.task_rule_versions as unknown as {
                        tasks: { name: string };
                      }
                    ).tasks.name
                  }{" "}
                  · {c.activity_date}
                </strong>
                <p>
                  提交时奖励 {c.reward_snapshot.coins} 金币　{c.note}
                </p>
                {url ? (
                  <a href={url} target="_blank" rel="noreferrer">
                    <img width="160" src={url} alt="查看原始打卡照片" />
                  </a>
                ) : (
                  <p>照片暂时不可用，请刷新重试。</p>
                )}
                <form action={review}>
                  <input name="id" value={c.id} type="hidden" />
                  <input
                    name="note"
                    maxLength={600}
                    aria-label="审核留言"
                    placeholder="给小张的留言"
                  />
                  <button disabled={!url} name="decision" value="approve">
                    通过并发币
                  </button>
                  <button name="decision" value="reject">
                    驳回
                  </button>
                </form>
              </article>
            );
          })
        ) : (
          <p>目前没有待审核打卡。</p>
        )}
      </section>
      <Ledger />
    </main>
  );
}
