import { items } from "../../lib/rules";
export function Scene({
  owned,
  worn,
}: {
  owned: Set<string>;
  worn: Set<string>;
}) {
  const warm = owned.has("pants_warm");
  return (
    <div className="scene">
      <span className="temp">{warm ? "☀ 温暖" : "❄ 寒冷 · 收益 −20%"}</span>
      <div className={"character " + (warm ? "" : "shiver")}>
        <img src="/art/base.png" alt="小张" />
        {items
          .filter((i) => i.layer && worn.has(i.id))
          .map((i) => (
            <img src={"/art/" + i.layer + ".png"} alt={i.name} key={i.id} />
          ))}
      </div>
      <div className="props">
        {items
          .filter((i) => !i.layer && owned.has(i.id))
          .map((i) => (
            <img
              className="iconart"
              key={i.id}
              alt={i.name}
              src={"/art/" + i.id + ".webp"}
            />
          ))}
      </div>
    </div>
  );
}
