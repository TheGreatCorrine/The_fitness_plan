import { requireRole, client } from "../../lib/supabase/server";
import { signOut } from "../login/actions";
export const dynamic = "force-dynamic";
export default async function Sponsor() {
  await requireRole("admin");
  const db = await client();
  const { data, error } = await db
    .from("wallets")
    .select("available,frozen")
    .maybeSingle();
  if (error) throw new Error("读取玩家账户失败");
  return (
    <main className="entry">
      <section className="panel">
        <small>S1 · 白手起家</small>
        <h1>女友管理室</h1>
        {data ? (
          <p>
            小张的可用金币 {data.available} · 冻结金币 {data.frozen}
          </p>
        ) : (
          <p>等待绑定小张的玩家账号。</p>
        )}
        <form action={signOut}>
          <button>退出登录</button>
        </form>
      </section>
    </main>
  );
}
