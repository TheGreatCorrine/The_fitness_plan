import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const configured = () =>
  Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
export async function client() {
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll(values) {
          try {
            for (const { name, value, options } of values)
              jar.set(name, value, options);
          } catch {
            /* Read-only Server Components delegate refresh to proxy. */
          }
        },
      },
    },
  );
}
export async function profile() {
  if (!configured()) return null;
  const db = await client();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return null;
  const { data, error } = await db
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw new Error("暂时无法读取游戏账号");
  return data?.role === "admin" || data?.role === "player"
    ? { id: user.id, role: data.role as "admin" | "player" }
    : null;
}
export async function requireRole(role: "admin" | "player") {
  const p = await profile();
  if (!p) redirect("/login");
  if (p.role !== role) redirect(p.role === "admin" ? "/sponsor" : "/room");
  return p;
}
