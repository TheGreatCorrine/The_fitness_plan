import { redirect } from "next/navigation";
import { profile } from "../lib/supabase/server";
export const dynamic = "force-dynamic";
export default async function Home() {
  const p = await profile();
  redirect(p ? (p.role === "admin" ? "/sponsor" : "/room") : "/login");
}
