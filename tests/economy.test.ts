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
    for (const file of [
      "202611180001_game",
      "202611180002_economy",
      "202611180003_rewards",
    ])
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
    await role("authenticated", admin);
    await db.query(
      "select save_mail_template($1,'daily','加油','每天一封',0,true)",
      [randomUUID()],
    );
    await db.query(
      "select save_mail_template($1,'warm','暖和了','给小张',3,true)",
      [randomUUID()],
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
    assert.equal(
      (await db.query("select id from mail_messages")).rows.length,
      2,
    );
    assert.equal(
      (await db.query("select achievement_id from achievement_unlocks")).rows
        .length,
      4,
    );
    const gift = randomUUID();
    await db.query("select write_letter($1,'测试','保留原文',2400)", [gift]);
    await assert.rejects(
      db.query("update mail_messages set body='changed'"),
      /permission denied/,
    );
    await role("authenticated");
    await db.query("select wear_item('pants_warm',false)");
    assert.equal((await db.query("select * from outfits")).rows.length, 0);
    const m = (
      await db.query<{ id: string }>(
        "select id from mail_messages where title='测试'",
      )
    ).rows[0].id;
    for (const action of [
      "read",
      "claim",
      "star",
      "trash",
      "restore",
      "claim",
      "trash",
      "delete",
    ])
      await db.query("select manage_letter($1,$2)", [m, action]);
    assert.equal(await balance(), 2414);
    assert.equal(
      (await db.query("select id from mail_messages where id=$1", [m])).rows
        .length,
      0,
    );
    const firstPay = randomUUID(),
      secondPay = randomUUID();
    for (const [k, n] of [
      [firstPay, 2000],
      [firstPay, 2000],
      [secondPay, 400],
    ])
      await db.query("select request_redemption($1,$2)", [k, n]);
    assert.equal(await balance(), 14);
    await assert.rejects(
      db.query("select settle_redemption($1,true)", [firstPay]),
      /仅管理员/,
    );
    await role("authenticated", admin);
    await db.query("select settle_redemption($1,true)", [firstPay]);
    await db.query("select settle_redemption($1,true)", [firstPay]);
    await assert.rejects(
      db.query("select settle_redemption($1,true)", [secondPay]),
      /本月实付额度不足/,
    );
    await db.query("select settle_redemption($1,false)", [secondPay]);
    assert.equal(await balance(), 414);
    assert.equal(
      Number(
        (
          await db.query<{ monthly_coins: number }>(
            "select * from reward_budget",
          )
        ).rows[0].monthly_coins,
      ),
      2000,
    );
  } finally {
    await db.close();
  }
});
