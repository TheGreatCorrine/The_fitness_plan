import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("migration, two seats, RLS, private evidence and denied financial mutations", async () => {
  const db = new PGlite();
  try {
    const player = "00000000-0000-4000-8000-000000000001",
      admin = "00000000-0000-4000-8000-000000000002",
      outsider = "00000000-0000-4000-8000-000000000003";
    // Supabase supplies these roles, schemas and Storage grants in a hosted project.
    await db.exec(`create role authenticated;create role anon;create schema auth;create schema storage;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,storage to authenticated,anon;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(bucket_id text references storage.buckets,name text);
 alter table storage.objects enable row level security;
 grant select,insert,update,delete on storage.objects to authenticated;
 insert into auth.users values ('${player}'),('${admin}'),('${outsider}');`);
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/202611180001_game.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.query("insert into profiles values ($1,$2),($3,$4)", [
      player,
      "player",
      admin,
      "admin",
    ]);
    await assert.rejects(
      db.query("insert into profiles values ($1,$2)", [outsider, "player"]),
      /unique/,
    );
    const count = async (table: string) =>
      Number(
        (await db.query<{ n: string }>("select count(*) n from " + table))
          .rows[0].n,
      );
    const as = async (id: string) => {
      await db.exec("reset role;set role authenticated");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        id,
      ]);
    };
    const upload = (path: string) =>
      db.query("insert into storage.objects values('checkin-evidence',$1)", [
        path,
      ]);
    assert.equal(
      (
        await db.query<{ public: boolean }>(
          "select public from storage.buckets",
        )
      ).rows[0].public,
      false,
    );
    await as(player);
    assert.equal(await count("profiles"), 1);
    assert.equal(await count("items"), 8);
    await upload(player + "/proof.png");
    await assert.rejects(upload(admin + "/proof.png"), /row-level security/);
    await assert.rejects(
      db.exec("update profiles set role='admin'"),
      /permission denied/,
    );
    for (const table of [
      "wallets",
      "ledger_entries",
      "inventory",
      "checkins",
      "redemption_requests",
      "mail_claims",
      "admin_audit_log",
    ]) {
      await assert.rejects(
        db.exec("delete from " + table),
        /permission denied/,
      );
    }
    await as(outsider);
    for (const t of ["profiles", "tasks", "wallets", "storage.objects"])
      assert.equal(await count(t), 0);
    await assert.rejects(upload(outsider + "/proof.png"), /row-level security/);
    await as(admin);
    assert.equal(await count("profiles"), 2);
    assert.equal(await count("wallets"), 1);
    assert.equal(await count("storage.objects"), 1);
    await assert.rejects(upload(admin + "/fake.png"), /row-level security/);
    await assert.rejects(
      db.exec("update wallets set available=100"),
      /permission denied/,
    );
    await db.exec("reset role;set role anon");
    await assert.rejects(count("tasks"), /permission denied/);
  } finally {
    await db.close();
  }
});
