import Link from "next/link";

type Failure = { code: string } | null;
export function RewardsLoadError({
  admin,
  errors,
}: {
  admin: boolean;
  errors: Record<string, Failure>;
}) {
  const failed = Object.entries(errors).filter(([, error]) => error);
  const details = failed
    .map(([query, error]) => query + " (" + (error?.code || "NETWORK") + ")")
    .join(", ");
  console.error("Rewards page read failed", details);
  const missingBudget = ["PGRST205", "42P01"].includes(
    errors.reward_budget?.code ?? "",
  );
  return (
    <main className="entry">
      <section className="panel">
        <h1>{admin ? "女友的书桌" : "小张的收藏室"}</h1>
        <p role="alert">
          {missingBudget
            ? "数据库接口还找不到兑奖预算视图。"
            : "暂时无法读取游戏记录。"}
        </p>
        {admin && missingBudget && (
          <p>
            请在 Supabase SQL Editor 检查第三份迁移 202611180003_rewards.sql
            是否已成功执行。
          </p>
        )}
        <small>查询详情：{details}</small>
        <Link href={admin ? "/sponsor" : "/room"}>
          返回{admin ? "审核室" : "卧室"}
        </Link>
      </section>
    </main>
  );
}
