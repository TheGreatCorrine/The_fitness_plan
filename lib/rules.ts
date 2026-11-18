export const tasks = ["健身房运动", "健康晚餐", "每日八千步", "本周健身三次"];
export const bases = [50, 10, 10, 30];
export const details = [
  "运动满 30 分钟 · 每周 3 次",
  "拍下今天的晚餐 · 每日 1 次",
  "记录 8,000 步 · 每日 1 次",
  "三次健身审核通过后自动结算",
];
export const items = [
  {
    id: "pants_warm",
    name: "运动长裤",
    price: 120,
    effect: "永久解除寒冷",
    layer: "trousers",
  },
  {
    id: "tableware",
    name: "精致餐具",
    price: 40,
    effect: "晚餐收益 +20%",
    layer: "",
  },
  {
    id: "running_shoes",
    name: "轻盈跑鞋",
    price: 60,
    effect: "步数收益 +20%",
    layer: "trainers",
  },
  {
    id: "dumbbell_basic",
    name: "基础哑铃",
    price: 120,
    effect: "健身收益 +20%",
    layer: "",
  },
  {
    id: "sports_bottle",
    name: "运动水壶",
    price: 100,
    effect: "健身收益 +10%",
    layer: "",
  },
  {
    id: "dumbbell_advanced",
    name: "高级哑铃",
    price: 300,
    effect: "健身再 +20% · 需基础哑铃",
    layer: "",
  },
  {
    id: "hoodie",
    name: "可爱卫衣",
    price: 80,
    effect: "衣柜外观",
    layer: "sweater",
  },
  {
    id: "glasses_gold",
    name: "金丝眼镜",
    price: 50,
    effect: "衣柜外观",
    layer: "spectacles",
  },
];
export function reward(task: number, owned: string[], base = bases[task]) {
  const has = (id: string) => Number(owned.includes(id));
  const bonus = [
    20 * has("dumbbell_basic") +
      10 * has("sports_bottle") +
      20 * has("dumbbell_advanced"),
    20 * has("tableware"),
    20 * has("running_shoes"),
    0,
  ][task];
  return Math.round(
    (base * (100 + bonus) * (has("pants_warm") ? 100 : 80)) / 10000,
  );
}
