import { client } from "../../lib/supabase/server";
const labels: Record<string, string> = {
  checkin: "打卡通过",
  weekly: "每周三练",
  purchase: "购买装备",
  mail: "邮件附件",
  freeze: "申请兑奖",
  paid: "已兑现",
  rejected: "兑奖退回",
};
export async function Ledger() {
  const db = await client();
  const { data, error } = await db
    .from("ledger_entries")
    .select("id,kind,available_delta,frozen_delta,created_at")
    .order("id", { ascending: false })
    .limit(30);
  if (error) throw new Error("无法读取金币流水");
  return (
    <section className="panel">
      <h2>最近金币流水</h2>
      {data.length ? (
        data.map((row) => (
          <p key={row.id}>
            {new Date(row.created_at).toLocaleDateString("zh-CN", {
              timeZone: "America/Toronto",
            })}
            　{labels[row.kind] ?? row.kind}　
            <strong>
              {row.available_delta > 0 ? "+" : ""}
              {row.available_delta}
              {row.frozen_delta !== 0 &&
                "（冻结变动 " + row.frozen_delta + "）"}
            </strong>
          </p>
        ))
      ) : (
        <p>第一枚金币会记在这里。</p>
      )}
    </section>
  );
}
