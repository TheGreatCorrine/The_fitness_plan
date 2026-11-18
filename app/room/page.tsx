import { requireRole, client } from "../../lib/supabase/server";
import { signOut } from "../login/actions";
export const dynamic = "force-dynamic";
export default async function Room() {
  const p = await requireRole("player");
  const db = await client();
  const { data, error } = await db
    .from("wallets")
    .select("available,frozen")
    .eq("player_id", p.id)
    .single();
  if (error) throw new Error("读取金币账户失败");
  return (
    <main className="entry">
      <section className="panel">
        <small>S1 · 白手起家</small>
        <h1>小张的卧室</h1>
        <div className="scene">
          <div className="character">
            <img src="/art/base.png" alt="小张" />
          </div>
        </div>
        <p>
          可用金币 {data.available} · 冻结金币 {data.frozen}
        </p>
        <form action={signOut}>
          <button>退出登录</button>
        </form>
      </section>
    </main>
  );
}
