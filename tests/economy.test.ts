import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { randomUUID, createHash } from "node:crypto";
test("trusted submission, weekly bonus, permanent inventory and retry-safe settlement", async () => {
  const db = new PGlite(),
    player = randomUUID(),
    admin = randomUUID();
  try {
    const setup = await readFile(
      new URL("./fixtures/platform.sql", import.meta.url),
      "utf8",
    );
    await db.exec(setup);
    for (const file of ["202611180001_game", "202611180002_economy"])
      await db.exec(
        await readFile(
          new URL("../supabase/migrations/" + file + ".sql", import.meta.url),
          "utf8",
        ),
      );
    await db.query("insert into auth.users values($1),($2)", [player, admin]);
    await db.query("insert into profiles values($1,'player'),($2,'admin')", [
      player,
      admin,
    ]);
    const role = async (r: string, id = player) => {
      await db.exec("reset role;set role " + r);
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        id,
      ]);
    };
    const submit = async (
      task: string,
      tag: string,
      day = "2026-01-05",
      key = randomUUID(),
    ) => {
      await role("service_role");
      const path = player + "/" + randomUUID();
      await db.query(
        "insert into storage.objects values('checkin-evidence',$1)",
        [path],
      );
      const hash = createHash("sha256").update(tag).digest("hex");
      const { rows } = await db.query<{ path: string }>(
        "select submit_checkin($1,$2,$3,$4,$5,$6,$7) path",
        [player, key, task, day, path, hash, ""],
      );
      await role("authenticated");
      return (
        await db.query<{ id: string }>(
          "select id from checkins where photo_path=$1",
          [rows[0].path],
        )
      ).rows[0].id;
    };
    const review = async (id: string, ok = true) => {
      await role("authenticated", admin);
      await db.query("select review_checkin($1,$2) ", [id, ok]);
    };
    const buy = async (id: string) => {
      await role("authenticated");
      await db.query("select purchase_item($1)", [id]);
    };
    const balance = async () =>
      Number(
        (await db.query<{ available: number }>("select available from wallets"))
          .rows[0].available,
      );
    const key = randomUUID(),
      first = await submit("gym", "a", undefined, key);
    assert.equal(await submit("gym", "a", undefined, key), first);
    await assert.rejects(
      db.query("select review_checkin($1,true)", [first]),
      /仅管理员/,
    );
    await assert.rejects(
      db.query("select submit_checkin($1,$2,$3,$4,$5,$6,$7)", [
        player,
        key,
        "gym",
        "2026-01-05",
        "fake",
        "hash",
        "",
      ]),
      /permission denied/,
    );
    await assert.rejects(submit("dinner", "a"), /照片已用于/);
    const second = await submit("gym", "b"),
      third = await submit("gym", "c");
    await assert.rejects(submit("gym", "d"), /次数已满/);
    const dinner = await submit("dinner", "meal");
    await assert.rejects(submit("dinner", "other"), /次数已满/);
    await review(first);
    await review(first);
    await review(second);
    await review(third);
    assert.equal(await balance(), 144);
    await assert.rejects(buy("dumbbell_advanced"), /先购买/);
    await buy("pants_warm");
    await buy("pants_warm");
    assert.equal(await balance(), 24);
    await review(dinner);
    assert.equal(await balance(), 32); // 8 from submission time, even after pants.
    const steps = await submit("steps", "steps");
    await review(steps, false);
    await assert.rejects(review(steps), /已经审核/);
    await review(await submit("steps", "steps"));
    assert.equal(await balance(), 42);
    await buy("tableware");
    assert.equal(await balance(), 2);
    await assert.rejects(buy("sports_bottle"), /不足/);
    await review(await submit("dinner", "next", "2026-01-06"));
    assert.equal(await balance(), 14);
    const { rows } = await db.query<{ n: number }>(
      "select sum(available_delta) n from ledger_entries",
    );
    assert.equal(Number(rows[0].n), 14);
    await assert.rejects(db.query("select purchase_item('hoodie')"), /仅玩家/);
  } finally {
    await db.close();
  }
});
