"use client";
import { useState } from "react";
import { items, tasks, bases, details, reward } from "../lib/rules";
const player = [
  "游戏主页",
  "每日任务",
  "金币商店",
  "小张衣柜",
  "小张房间",
  "成就图鉴",
  "游戏邮箱",
  "现实兑奖",
];
const admin = [
  "管理概览",
  "打卡审核",
  "任务规则",
  "商品管理",
  "兑奖审核",
  "邮件运营",
  "流水与预算",
  "玩家预览",
];
const symbols = ["⌂", "☑", "♧", "♙", "▧", "✧", "✉", "♢"];
const badges = [
  "初次出发",
  "坚持一周",
  "自律达人",
  "健康饮食家",
  "终于有裤子穿了",
  "小张的第一件装备",
  "女友的骄傲",
];
type Check = {
  task: number;
  amount: number;
  photo: string;
  note: string;
  status: string;
  weekly: number;
};
type Mail = {
  title: string;
  body: string;
  gift: number;
  claimed: boolean;
  read: boolean;
  star: boolean;
  trash: boolean;
  id: number;
};
const letter = (title: string, body: string, gift = 0): Mail => ({
  title,
  body,
  gift,
  claimed: false,
  read: false,
  star: false,
  trash: false,
  id: 0,
});
export default function Game() {
  const [a, A] = useState(false),
    [page, P] = useState(0),
    [coins, C] = useState(0),
    [owned, O] = useState<string[]>([]),
    [wear, W] = useState<string[]>([]),
    [msg, M] = useState(""),
    [checks, K] = useState<Check[]>([]),
    [rules, R] = useState([...bases]),
    [prices, V] = useState(items.map((i) => i.price)),
    [mail, L] = useState<Mail[]>([
      letter(
        "没有特别的理由",
        "今天只是想来你的小房间看看。窗边晒得到太阳，等你回来，一起吃晚饭呀。♡",
      ),
      {
        ...letter(
          "开张的小小礼物",
          "模拟试玩金，拿去挑一件喜欢的装备吧。",
          160,
        ),
        id: 1,
      },
    ]),
    [folder, F] = useState("收件箱"),
    [opened, E] = useState(-1),
    [red, D] = useState<{ amount: number; status: string }[]>([]),
    [ledger, G] = useState<string[]>([]),
    [template, T] = useState(""),
    [daily, Y] = useState(false),
    [talk, Q] = useState(0);
  const preview = a && page === 7,
    home = (!a && page === 0) || preview,
    cold = !owned.includes("pants_warm"),
    paid = red
      .filter((r) => r.status === "已兑现")
      .reduce((n, r) => n + r.amount, 0);
  const change = (n: number, s: string) => {
    C((v) => v + n);
    G((v) => [s + "　" + (n > 0 ? "+" : "") + n, ...v]);
  };
  const go = (i: number) => {
    P(i);
    M("");
    E(-1);
  };
  const send = (m: Mail) =>
    L((v) => [{ ...m, id: Math.max(0, ...v.map((x) => x.id)) + 1 }, ...v]);
  const patch = (id: number, p: Partial<Mail>) =>
    L((v) => v.map((x) => (x.id === id ? { ...x, ...p } : x)));
  function buy(i: number) {
    const it = items[i];
    if (
      owned.includes(it.id) ||
      coins < prices[i] ||
      (i === 5 && !owned.includes("dumbbell_basic"))
    )
      return;
    O([...owned, it.id]);
    change(-prices[i], it.name);
    if (it.layer) W([...wear, it.id]);
    M(i === 0 ? "✧ 终于有裤子穿了！寒冷永久解除。" : "已收藏 · " + it.name);
  }
  function review(i: number, approve: boolean) {
    const c = checks[i];
    if (c.status !== "待审核") return;
    K(
      checks.map((x, j) =>
        j === i ? { ...x, status: approve ? "已通过" : "已驳回" } : x,
      ),
    );
    if (approve) {
      const weekly =
        c.task === 0 &&
        checks.filter((x) => x.task === 0 && x.status === "已通过").length ===
          2;
      change(
        c.amount + (weekly ? c.weekly : 0),
        tasks[c.task] + (weekly ? " + 周满勤" : ""),
      );
      if (template && !daily) {
        send(letter("今天的小张好棒！", template));
        Y(true);
      }
    }
  }
  const art = (id: string) => (
    <img className="iconart" alt="" src={"/art/" + id + ".webp"} />
  );
  const scene = (
    <div className="scene">
      <span className="roomlabel">⌂　小张的卧室</span>
      <span className={"temp " + (!cold ? "warm" : "")}>
        {cold ? "❄ 寒冷 · 收益 −20%" : "☀ 温暖"}
      </span>
      <div className="bubble">
        {["今天也要一起加油呀 ♡", "你回来啦！", "窗外好像下雪了。"][talk]}
      </div>
      <button
        className={"character " + (cold ? "shiver" : "")}
        aria-label="和小张说话"
        disabled={preview}
        onClick={() => Q((talk + 1) % 3)}
      >
        <img src="/art/base.png" alt="黑发短裤小张" />
        {items
          .filter((it) => wear.includes(it.id) && it.layer)
          .map((it) => (
            <img key={it.id} alt={it.name} src={"/art/" + it.layer + ".png"} />
          ))}
      </button>
      <div className="props">
        {items
          .filter((it) => owned.includes(it.id) && !it.layer)
          .map((it) => (
            <span key={it.id}>{art(it.id)}</span>
          ))}
      </div>
      <div className="caption">
        小张 <small>· {cold ? "等一条暖和的长裤" : "暖洋洋的午后"}</small>
      </div>
    </div>
  );
  const cards = (limited = false) => (
    <div className="products">
      {items.slice(0, limited ? 3 : 8).map((it, i) => (
        <article key={it.id}>
          {art(it.id)}
          <div>
            <strong>{it.name}</strong>
            <small>{it.effect}</small>
          </div>
          <button
            disabled={
              preview ||
              owned.includes(it.id) ||
              coins < prices[i] ||
              (i === 5 && !owned.includes("dumbbell_basic"))
            }
            onClick={() => buy(i)}
          >
            {owned.includes(it.id) ? "已拥有" : "🪙 " + prices[i]}
          </button>
        </article>
      ))}
    </div>
  );
  const today = (
    <div className="tasks">
      {tasks.slice(0, 3).map((t, i) => (
        <button key={t} disabled={preview} onClick={() => go(1)}>
          {art(["dumbbell_basic", "tableware", "running_shoes"][i])}
          <strong>{t}</strong>
          <small>{details[i]}</small>
          <b>+{reward(i, owned, rules[i])} 金币</b>
        </button>
      ))}
    </div>
  );
  const titles = (en: string, zh: string) => (
    <header className="section">
      <small>{en}</small>
      <h2>{zh}</h2>
    </header>
  );
  return (
    <main>
      <header className="top">
        <div className="brand">
          <img src="/art/base.png" alt="" />
          <div>
            <small>PROJECT XIAOZHANG</small>
            <h1>小张养成计划</h1>
          </div>
        </div>
        <div className="wallet">
          🪙 <b>{coins}</b> 金币
        </div>
        <button
          className="switch"
          onClick={() => {
            A(!a);
            go(0);
          }}
        >
          {a ? "返回玩家" : "女友管理"} ⇄
        </button>
      </header>
      <div className="layout">
        <aside>
          <small>{a ? "SPONSOR DESK" : "MY LITTLE WORLD"}</small>
          <nav>
            {(a ? admin : player).map((s, i) => (
              <button
                key={s}
                aria-current={page === i ? "page" : undefined}
                onClick={() => go(i)}
              >
                <i>{symbols[i]}</i>
                {s}
                {!a && i === 6 && mail.some((m) => !m.read && !m.trash) && (
                  <em>●</em>
                )}
              </button>
            ))}
          </nav>
          <footer>✿　S1 · 白手起家</footer>
        </aside>
        <section className="content">
          <div className="heading">
            <div>
              <small>
                {home
                  ? "WINTER ROOM　/　第一赛季"
                  : a
                    ? "SPONSOR DESK"
                    : "GROWTH JOURNAL"}
              </small>
              <h2>
                {home
                  ? preview
                    ? "玩家只读预览"
                    : "小张的冬日手记"
                  : (a ? admin : player)[page]}
              </h2>
            </div>
            <span className="demo">模拟试玩</span>
          </div>
          {msg && (
            <div role="status" className="notice">
              {msg}
              <button onClick={() => M("")}>×</button>
            </div>
          )}
          {home ? (
            <>
              <div className="homegrid">
                <div className="frame">{scene}</div>
                <section className="panel shelf">
                  {titles("EQUIPMENT", "装备小铺")}
                  {cards(true)}
                  <button disabled={preview} onClick={() => go(2)}>
                    逛逛商店 →
                  </button>
                </section>
              </div>
              <section className="panel">
                {titles("DAILY QUESTS", "今日任务")}
                {today}
              </section>
            </>
          ) : null}
          {!a && page === 1 && (
            <section className="panel">
              {tasks.map((t, i) => (
                <div className="row" key={t}>
                  <strong>
                    {t}　+{reward(i, owned, rules[i])}
                  </strong>
                  <small>{details[i]}</small>
                  {i < 3 && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget),
                          file = f.get("photo") as File;
                        if (
                          checks.filter(
                            (c) => c.task === i && c.status !== "已驳回",
                          ).length >= (i === 0 ? 3 : 1)
                        ) {
                          M("本模拟周期已达到提交上限");
                          return;
                        }
                        K([
                          ...checks,
                          {
                            task: i,
                            amount: reward(i, owned, rules[i]),
                            weekly: reward(3, owned, rules[3]),
                            photo: URL.createObjectURL(file),
                            note: String(f.get("note")),
                            status: "待审核",
                          },
                        ]);
                        e.currentTarget.reset();
                        M("已送到女友的审核桌");
                      }}
                    >
                      <input
                        type="file"
                        accept="image/*"
                        required
                        name="photo"
                        aria-label={t + "照片"}
                      />
                      <input name="note" placeholder="写句备注（可选）" />
                      <button>提交打卡</button>
                    </form>
                  )}
                </div>
              ))}
              {checks.map((c, i) => (
                <p key={i}>
                  {tasks[c.task]} · {c.status}
                </p>
              ))}
            </section>
          )}
          {!a && page === 2 && (
            <section className="panel">
              <p>终身限购一件 · 永久持有 · 不可退款</p>
              {cards()}
              <p>试玩提示：邮箱里的开张礼物附有 160 模拟金币。</p>
            </section>
          )}
          {!a && (page === 3 || page === 4) && (
            <section className="panel">
              {scene}
              {page === 3 ? (
                <>
                  <h3>我的衣柜</h3>
                  {!owned.some(
                    (id) => items.find((it) => it.id === id)?.layer,
                  ) && <p>衣柜里只有初始短裤，去商店挑一件吧。</p>}
                  {items
                    .filter((it) => it.layer && owned.includes(it.id))
                    .map((it) => (
                      <button
                        key={it.id}
                        onClick={() =>
                          W(
                            wear.includes(it.id)
                              ? wear.filter((k) => k !== it.id)
                              : [...wear, it.id],
                          )
                        }
                      >
                        {wear.includes(it.id) ? "脱下" : "穿上"}
                        {it.name}
                      </button>
                    ))}
                </>
              ) : (
                <p>
                  已收藏{" "}
                  {
                    owned.filter(
                      (id) => !items.find((it) => it.id === id)?.layer,
                    ).length
                  }{" "}
                  件房间陈设
                </p>
              )}
            </section>
          )}
          {!a && page === 5 && (
            <section className="panel tasks">
              {badges.map((b, i) => {
                const gyms = checks.filter(
                  (c) => c.task === 0 && c.status === "已通过",
                ).length;
                const on = [
                  gyms > 0,
                  gyms >= 3,
                  gyms >= 15,
                  checks.filter((c) => c.task === 1 && c.status === "已通过")
                    .length >= 20,
                  !cold,
                  items.slice(0, 6).some((it) => owned.includes(it.id)),
                  false,
                ][i];
                return (
                  <div key={b} className={on ? "badge" : "badge locked"}>
                    {art(i === 6 ? "heart" : "medal")}
                    <strong>{b}</strong>
                    <small>{on ? "已点亮" : "尚未解锁"}</small>
                  </div>
                );
              })}
            </section>
          )}
          {!a && page === 6 && (
            <section className="panel">
              <div className="tabs">
                {["收件箱", "珍藏夹", "回收站"].map((s) => (
                  <button
                    aria-pressed={s === folder}
                    key={s}
                    onClick={() => {
                      F(s);
                      E(-1);
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
              {mail
                .filter((m) =>
                  folder === "回收站"
                    ? m.trash
                    : !m.trash && (folder !== "珍藏夹" || m.star),
                )
                .map((m) => (
                  <article className="row" key={m.id}>
                    <button
                      onClick={() => {
                        E(opened === m.id ? -1 : m.id);
                        patch(m.id, { read: true });
                      }}
                    >
                      {m.read ? "✉" : "💌"}　{m.title}
                    </button>
                    {opened === m.id && (
                      <>
                        <p>{m.body}</p>
                        <small>来自女友 ♡</small>
                        {m.gift > 0 && (
                          <button
                            disabled={m.claimed || m.trash}
                            onClick={() => {
                              patch(m.id, { claimed: true });
                              change(m.gift, "邮件附件");
                            }}
                          >
                            {m.claimed ? "已领取" : "领取 " + m.gift + " 金币"}
                          </button>
                        )}
                        <button onClick={() => patch(m.id, { star: !m.star })}>
                          {m.star ? "取消珍藏" : "珍藏"}
                        </button>
                        <button
                          onClick={() => patch(m.id, { trash: !m.trash })}
                        >
                          {m.trash ? "恢复" : "移至回收站"}
                        </button>
                        {m.trash && (
                          <button
                            onClick={() => {
                              if (confirm("永久删除这封信？"))
                                L(mail.filter((x) => x.id !== m.id));
                            }}
                          >
                            永久删除
                          </button>
                        )}
                      </>
                    )}
                  </article>
                ))}
            </section>
          )}
          {!a && page === 7 && (
            <section className="panel">
              <h3>10 金币 = CA$1</h3>
              <p>
                本模拟月剩余额度 CA${200 - paid / 10} · 可用 {coins} 金币
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const n = Number(new FormData(e.currentTarget).get("amount"));
                  if (n <= 0 || n % 10 || n > coins) return;
                  D([...red, { amount: n, status: "已冻结" }]);
                  change(-n, "兑奖冻结");
                }}
              >
                <input
                  name="amount"
                  type="number"
                  min="10"
                  step="10"
                  max={coins}
                  required
                  placeholder="金币数量"
                />
                <button>申请兑奖</button>
              </form>
              {red.map((r, i) => (
                <p key={i}>
                  CA${r.amount / 10} · {r.status}
                </p>
              ))}
            </section>
          )}
          {a && !preview && (
            <section className="panel">
              {page === 0 && (
                <>
                  <h3>今天的审核桌</h3>
                  <p>
                    待审核打卡{" "}
                    {checks.filter((c) => c.status === "待审核").length}{" "}
                    件　·　待兑奖{" "}
                    {red.filter((r) => r.status === "已冻结").length} 件
                  </p>
                  <button onClick={() => go(1)}>查看打卡</button>
                </>
              )}
              {page === 1 &&
                (checks.length ? (
                  checks.map((c, i) => (
                    <article className="row" key={i}>
                      <img width="120" alt="模拟打卡凭证" src={c.photo} />
                      <p>
                        {tasks[c.task]} · {c.amount} 金币 · {c.status}
                      </p>
                      <p>{c.note}</p>
                      {c.status === "待审核" && (
                        <>
                          <button onClick={() => review(i, true)}>通过</button>
                          <button onClick={() => review(i, false)}>驳回</button>
                        </>
                      )}
                    </article>
                  ))
                ) : (
                  <p>审核桌上还没有打卡。</p>
                ))}
              {(page === 2 || page === 3) &&
                (page === 2 ? tasks : items.map((it) => it.name)).map(
                  (name, i) => (
                    <form
                      className="row"
                      key={name}
                      onSubmit={(e) => {
                        e.preventDefault();
                        const n = Number(
                          new FormData(e.currentTarget).get("n"),
                        );
                        if (page === 2)
                          R(rules.map((x, j) => (j === i ? n : x)));
                        else V(prices.map((x, j) => (j === i ? n : x)));
                        M("已更新后续模拟" + (page === 2 ? "任务" : "购买"));
                      }}
                    >
                      <label>
                        {name}　
                        <input
                          required
                          name="n"
                          type="number"
                          min="1"
                          defaultValue={(page === 2 ? rules : prices)[i]}
                        />
                      </label>
                      <button>保存</button>
                    </form>
                  ),
                )}
              {page === 4 &&
                (red.length ? (
                  red.map((r, i) => (
                    <div className="row" key={i}>
                      CA${r.amount / 10} · {r.status}{" "}
                      {r.status === "已冻结" &&
                        [true, false].map((ok) => (
                          <button
                            key={String(ok)}
                            disabled={ok && paid + r.amount > 2000}
                            onClick={() => {
                              D(
                                red.map((x, j) =>
                                  i === j
                                    ? { ...x, status: ok ? "已兑现" : "已拒绝" }
                                    : x,
                                ),
                              );
                              if (!ok) change(r.amount, "解除冻结");
                              else
                                G(["确认实付 CA$" + r.amount / 10, ...ledger]);
                            }}
                          >
                            {ok ? "确认实付" : "拒绝并解冻"}
                          </button>
                        ))}
                    </div>
                  ))
                ) : (
                  <p>还没有兑奖申请。</p>
                ))}
              {page === 5 && (
                <>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      send(
                        letter(
                          String(f.get("title")),
                          String(f.get("body")),
                          Number(f.get("gift")),
                        ),
                      );
                      e.currentTarget.reset();
                      M("信已送达小张的邮箱");
                    }}
                  >
                    <input name="title" required placeholder="信件标题" />
                    <textarea required name="body" placeholder="亲爱的小张，" />
                    <input
                      name="gift"
                      type="number"
                      min="0"
                      defaultValue="0"
                      aria-label="金币附件"
                    />
                    <button>立即发送</button>
                  </form>
                  <h3>每日鼓励模板</h3>
                  <textarea
                    aria-label="每日鼓励信"
                    value={template}
                    onChange={(e) => T(e.target.value)}
                    placeholder="留空停用。当天首次获批时投递。"
                  />
                </>
              )}
              {page === 6 && (
                <>
                  <h3>本月已兑现 CA${paid / 10}</h3>
                  <p>
                    可用 {coins} 金币 · 已冻结{" "}
                    {red
                      .filter((r) => r.status === "已冻结")
                      .reduce((n, r) => n + r.amount, 0)}{" "}
                    金币
                  </p>
                  {ledger.map((s, i) => (
                    <p key={i}>{s}</p>
                  ))}
                </>
              )}
            </section>
          )}
          <div className="foot">
            ♡　两个人的养成日记　·　模拟数据仅在本次页面内有效
          </div>
        </section>
      </div>
    </main>
  );
}
