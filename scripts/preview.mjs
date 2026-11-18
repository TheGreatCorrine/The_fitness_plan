import { build } from "esbuild";
import { readFile, writeFile, readdir } from "node:fs/promises";
const art = {};
for (const name of await readdir("public/art")) {
  const data = await readFile("public/art/" + name);
  art["/art/" + name] =
    "data:image/" +
    (name.endsWith("png") ? "png" : "webp") +
    ";base64," +
    data.toString("base64");
}
const result = await build({
  stdin: {
    contents:
      "import React from 'react'; import {createRoot} from 'react-dom/client'; import Game from './app/page'; createRoot(document.querySelector('main')).render(React.createElement(Game));",
    resolveDir: process.cwd(),
  },
  bundle: true,
  write: false,
  minify: true,
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [
    {
      name: "embedded-art",
      setup(b) {
        b.onLoad({ filter: /app\/page\.tsx$/ }, async (args) => {
          const source = await readFile(args.path, "utf8");
          return {
            loader: "tsx",
            resolveDir: process.cwd() + "/app",
            contents:
              source
                .replace(/src=\{([^}]+)\}/g, "src={artFiles[$1] ?? $1}")
                .replace(/src="(\/art\/[^"]+)"/g, 'src={artFiles["$1"]}') +
              "\nconst artFiles:Record<string,string>=" +
              JSON.stringify(art),
          };
        });
      },
    },
  ],
});
const dir = ".next/static/css/";
let css = await readFile(
  dir + (await readdir(dir)).find((x) => x.endsWith(".css")),
  "utf8",
);
css = css.replaceAll("/art/bedroom.webp", art["/art/bedroom.webp"]);
await writeFile(
  "play.html",
  '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>小张养成计划</title><style>' +
    css +
    '</style><body><main style="display:contents"></main><script>' +
    result.outputFiles[0].text.replaceAll("</script", "<\\/script") +
    "</script></body></html>",
);
