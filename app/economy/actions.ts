"use server";
import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { client, requireRole } from "../../lib/supabase/server";

function finish(path: string, message: string): never {
  redirect(path + "?message=" + encodeURIComponent(message));
}
const messages = [
  "本周期提交次数已满",
  "这张照片已用于打卡",
  "该打卡已经审核",
  "需要先购买基础装备",
  "可用金币不足",
  "任务、日期或凭证无效",
];
function explain(error: { message: string }) {
  return messages.includes(error.message)
    ? error.message
    : "操作未确认，请刷新查看记录后重试。";
}
function imageType(bytes: Buffer) {
  if (bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")))
    return ["png", "image/png"];
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
    return ["jpg", "image/jpeg"];
  if (
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  )
    return ["webp", "image/webp"];
  return null;
}
export async function submit(form: FormData) {
  const player = await requireRole("player");
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) finish("/room", "照片打卡尚未配置，请联系管理员。");
  const task = String(form.get("task")),
    date = String(form.get("date")),
    note = String(form.get("note") ?? "").trim(),
    attempt = String(form.get("attempt"));
  if (
    !["gym", "dinner", "steps"].includes(task) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    note.length > 600 ||
    !/^[a-f\d-]{36}$/.test(attempt)
  )
    finish("/room", "任务、日期或凭证无效");
  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0 || file.size > 3 * 1024 * 1024)
    finish("/room", "请选择 3 MiB 以内的照片。");
  const bytes = Buffer.from(await file.arrayBuffer()),
    type = imageType(bytes);
  if (!type) finish("/room", "支持 JPG、PNG 或 WebP 照片。");
  const hash = createHash("sha256").update(bytes).digest("hex");
  const path = player.id + "/" + randomUUID() + "." + type[0];
  const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const bucket = service.storage.from("checkin-evidence");
  const { error: uploadError } = await bucket.upload(path, bytes, {
    contentType: type[1],
    upsert: false,
  });
  if (uploadError) finish("/room", "照片上传失败，请稍后重试。");
  const { data: linkedPath, error } = await service.rpc("submit_checkin", {
    p_player: player.id,
    p_key: attempt,
    p_task: task,
    p_date: date,
    p_path: path,
    p_hash: hash,
    p_note: note,
  });
  if (error) {
    // A known transaction rejection cannot have linked a newly created object.
    // Preserve files for ambiguous network failures and idempotent retries.
    if (
      error.code === "P0001" ||
      error.code.startsWith("22") ||
      error.code.startsWith("23")
    )
      await bucket.remove([path]);
    finish("/room", explain(error));
  }
  if (linkedPath !== path) await bucket.remove([path]);
  finish("/room", "已提交，等待女友审核。");
}
export async function purchase(form: FormData) {
  await requireRole("player");
  const db = await client();
  const { error } = await db.rpc("purchase_item", {
    p_item: String(form.get("item")),
  });
  finish("/room", error ? explain(error) : "装备已收入永久库存。");
}
export async function review(form: FormData) {
  await requireRole("admin");
  const db = await client();
  const decision = form.get("decision");
  if (decision !== "approve" && decision !== "reject")
    finish("/sponsor", "请选择审核结果。");
  const { error } = await db.rpc("review_checkin", {
    p_id: String(form.get("id")),
    p_approve: decision === "approve",
    p_note: String(form.get("note") ?? ""),
  });
  finish("/sponsor", error ? explain(error) : "审核已保存。");
}
