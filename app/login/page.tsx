import Link from "next/link";
import { configured } from "../../lib/supabase/server";
import { signIn } from "./actions";
export const dynamic = "force-dynamic";
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const ready = configured();
  const { error } = await searchParams;
  return (
    <main className="entry">
      <section className="panel">
        <img className="portrait" src="/art/base.png" alt="小张" />
        <small>S1 · 白手起家</small>
        <h1>小张养成计划</h1>
        {ready ? (
          <form action={signIn}>
            <label>
              邮箱
              <input
                required
                type="email"
                name="email"
                autoComplete="username"
              />
            </label>
            <label>
              密码
              <input
                required
                type="password"
                name="password"
                autoComplete="current-password"
              />
            </label>
            <button>进入小屋</button>
          </form>
        ) : (
          <p>正式小屋正在布置中，可以先进入模拟试玩。</p>
        )}
        {error === "login" && (
          <p role="alert">
            登录失败，请检查账号与密码，或确认账号已分配游戏角色。
          </p>
        )}
        <Link href="/demo">进入模拟试玩 →</Link>
      </section>
    </main>
  );
}
