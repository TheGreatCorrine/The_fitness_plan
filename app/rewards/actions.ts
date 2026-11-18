"use server";
import { redirect } from "next/navigation";
import { requireRole, client } from "../../lib/supabase/server";
async function run(
  role: "admin" | "player",
  name: string,
  args: Record<string, unknown>,
  success: string,
) {
  await requireRole(role);
  const db = await client();
  const { error } = await db.rpc(name, args);
  const path = role === "admin" ? "/sponsor/rewards" : "/room/collection";
  const message = error
    ? error.code === "P0001"
      ? error.message
      : "操作未确认，请刷新后检查记录。"
    : success;
  redirect(path + "?message=" + encodeURIComponent(message));
}
const val = (f: FormData, k: string) => String(f.get(k) ?? "");
export async function dress(f: FormData) {
  await run(
    "player",
    "wear_item",
    { p_item: val(f, "item"), p_on: val(f, "on") === "yes" },
    "穿搭已保存",
  );
}
export async function letter(f: FormData) {
  await run(
    "player",
    "manage_letter",
    { p_id: val(f, "id"), p_action: val(f, "action") },
    "信件已处理",
  );
}
export async function redeem(f: FormData) {
  await run(
    "player",
    "request_redemption",
    { p_key: val(f, "key"), p_coins: val(f, "coins") },
    "申请已提交，金币已冻结",
  );
}
export async function settle(f: FormData) {
  await run(
    "admin",
    "settle_redemption",
    { p_id: val(f, "id"), p_paid: val(f, "action") === "paid" },
    "兑奖审核已记录",
  );
}
export async function send(f: FormData) {
  await run(
    "admin",
    "write_letter",
    {
      p_key: val(f, "id"),
      p_title: val(f, "title"),
      p_body: val(f, "body"),
      p_gift: Number(val(f, "gift")),
    },
    "信已送达",
  );
}
export async function template(f: FormData) {
  await run(
    "admin",
    "save_mail_template",
    {
      p_id: val(f, "id"),
      p_event: val(f, "event"),
      p_title: val(f, "title"),
      p_body: val(f, "body"),
      p_gift: Number(val(f, "gift")),
      p_enabled: f.has("enabled"),
    },
    "模板已保存",
  );
}
export async function pride() {
  await run("admin", "award_pride", {}, "已授予「女友的骄傲」");
}

export async function removeTemplate(f: FormData) {
  await run(
    "admin",
    "remove_mail_template",
    { p_id: val(f, "id") },
    "模板已删除，已发信件保留",
  );
}
