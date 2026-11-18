"use server";
import { redirect } from "next/navigation";
import { configured, client, profile } from "../../lib/supabase/server";
export async function signIn(form: FormData) {
  if (!configured()) redirect("/login?error=config");
  const db = await client();
  const { error } = await db.auth.signInWithPassword({
    email: String(form.get("email") ?? "").trim(),
    password: String(form.get("password") ?? ""),
  });
  if (error) redirect("/login?error=login");
  const p = await profile();
  if (!p) {
    await db.auth.signOut({ scope: "local" });
    redirect("/login?error=login");
  }
  redirect(p.role === "admin" ? "/sponsor" : "/room");
}
export async function signOut() {
  const db = await client();
  const { error } = await db.auth.signOut({ scope: "local" });
  if (error) throw new Error("退出失败，请重试");
  redirect("/login");
}
