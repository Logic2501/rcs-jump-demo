import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

const root = process.cwd();

const modules = [
  { id: "app:three-core", file: "vendor/three.core.js" },
  { id: "app:three", file: "vendor/three.module.js" },
  { id: "app:spec", file: "src/spec.js" },
  { id: "app:sim", file: "src/sim.js" },
  { id: "app:hud", file: "src/hud.js" },
  { id: "app:scene", file: "src/scene.js" },
  { id: "app:main", file: "src/main.js" },
];

const pathToId = new Map(
  modules.map((m) => [resolve(root, m.file), m.id]),
);

function rewriteImports(file, source) {
  return source.replace(
    /(from\s*|import\s*)(["'])([^"']+)\2/g,
    (match, prefix, quote, spec) => {
      if (!spec.startsWith(".")) return match;
      const target = resolve(dirname(resolve(root, file)), spec);
      const id = pathToId.get(target);
      if (!id) {
        throw new Error(`Unmapped import: ${spec} (${file}) -> ${target}`);
      }
      return `${prefix}${quote}${id}${quote}`;
    },
  );
}

const imports = {};
for (const mod of modules) {
  const source = readFileSync(resolve(root, mod.file), "utf8");
  const rewritten = rewriteImports(mod.file, source);
  imports[mod.id] =
    "data:text/javascript;base64," +
    Buffer.from(rewritten, "utf8").toString("base64");
}

const css = readFileSync(resolve(root, "src/style.css"), "utf8");
let html = readFileSync(resolve(root, "index.html"), "utf8");

const cssTag = '<link rel="stylesheet" href="./src/style.css" />';
if (!html.includes(cssTag)) throw new Error("stylesheet tag not found");
html = html.replace(cssTag, `<style>\n${css}\n</style>`);

if (!/<script type="importmap">[\s\S]*?<\/script>/.test(html)) {
  throw new Error("import map not found");
}
html = html.replace(
  /<script type="importmap">[\s\S]*?<\/script>/,
  `<script type="importmap">${JSON.stringify({ imports })}</script>`,
);

const mainTag = '<script type="module" src="./src/main.js"></script>';
if (!html.includes(mainTag)) throw new Error("main module tag not found");
html = html.replace(
  mainTag,
  '<script type="module">import "app:main";</script>',
);

const downloadHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>RCS-07 · 单文件下载</title>
<style>
  :root { color-scheme: dark; }
  body {
    margin: 0;
    min-height: 100vh;
    display: grid;
    place-items: center;
    background: radial-gradient(circle at 50% 35%, #172a3a, #05080d 65%);
    color: #dcebf6;
    font-family: "SF Mono", Menlo, Consolas, monospace;
  }
  main {
    width: min(520px, calc(100vw - 48px));
    padding: 32px;
    border: 1px solid #2d4b60;
    background: rgba(4, 10, 16, 0.82);
    box-shadow: 0 0 40px rgba(60, 160, 220, 0.12);
  }
  h1 { margin: 0 0 10px; font-size: 20px; letter-spacing: 0.12em; }
  p { color: #8fa9bb; line-height: 1.7; font-size: 13px; }
  a {
    display: inline-block;
    margin-top: 18px;
    padding: 12px 18px;
    border: 1px solid #6ee7ff;
    color: #aef4ff;
    text-decoration: none;
    letter-spacing: 0.08em;
  }
  a:hover { background: rgba(110, 231, 255, 0.12); }
  .sub { margin-top: 14px; font-size: 12px; }
  .sub a { margin: 0; padding: 0; border: 0; color: #ffb454; }
</style>
</head>
<body>
<main>
  <h1>RCS-07 · SINGLE FILE</h1>
  <p>单文件 HTML，包含 three.js、SVG HUD 与全部样式；可直接离线打开。</p>
  <a href="./rcs-jump-demo.html" download="rcs-jump-demo.html">DOWNLOAD · rcs-jump-demo.html</a>
  <p class="sub"><a href="./rcs-jump-demo.html">或在线预览</a></p>
</main>
</body>
</html>
`;

mkdirSync(resolve(root, "dist"), { recursive: true });
writeFileSync(resolve(root, "dist/rcs-jump-demo.html"), html);
writeFileSync(resolve(root, "dist/download.html"), downloadHtml);

console.log(`dist/rcs-jump-demo.html ${(html.length / 1024 / 1024).toFixed(2)} MB`);
console.log("dist/download.html");
