# Node 调用规范

## 工具路径（macOS Apple Silicon）

```
node:   /opt/homebrew/bin/node
npm:    /opt/homebrew/bin/npm
npx:    /opt/homebrew/bin/npx
mmdc:   /opt/homebrew/bin/mmdc
```

> 以上路径在 macOS (Apple Silicon) 下通过 `brew install node` 和 `npm install -g @mermaid-js/mermaid-cli` 安装后的默认位置。
>
> **关键**：`/opt/homebrew/bin/` **不在系统默认 PATH 中**，直接调用 `node`、`mmdc` 会报 `node: No such file or directory`。必须使用绝对路径或显式设置 PATH。

## PATH 设置

### 方式一：单次命令（推荐）

```bash
export PATH="/opt/homebrew/bin:$PATH"
```

### 方式二：绝对路径调用

```bash
/opt/homebrew/bin/node script.js
/opt/homebrew/bin/mmdc -i input.mmd -o output.png
```

### 方式三：写入 shell 配置（持久化）

```bash
echo 'export PATH="/opt/homebrew/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

## 验证安装

```bash
# 验证 node
/opt/homebrew/bin/node --version

# 验证 mmdc
/opt/homebrew/bin/mmdc --version

# 验证 npm
/opt/homebrew/bin/npm --version
```

## 静态服务器（本地 Web / ES Module）

```bash
/opt/homebrew/bin/python3 -m http.server 8123 \
  --bind 127.0.0.1 \
  --directory /path/to/web-project
```

- 浏览器直接打开 `file://` 会因 CORS / MIME 拒绝加载 ES Module；必须走 HTTP。
- 默认只监听回环。需要局域网或 tailnet 访问时，用 Tailscale Serve 反代（见 `本机运行环境检查.md` §6.3），不要直接 `--bind 0.0.0.0`。
- 验证：`curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8123/` 应返回 `200`。

## 无头 Chrome 截图

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new \
  --hide-scrollbars \
  --window-size=1600,900 \
  --virtual-time-budget=2400 \
  --screenshot=/tmp/shot.png \
  "http://127.0.0.1:8123/?t=1.2"
```

| 参数 | 作用 |
|------|------|
| `--headless=new` | 新版无头模式，WebGL 支持更完整 |
| `--hide-scrollbars` | 避免截图边缘出现滚动条 |
| `--window-size=W,H` | 视口尺寸，需与页面设计比例一致 |
| `--virtual-time-budget=ms` | 等待加载/动画推进；太小会截到空白或 loader |
| `--user-data-dir=/tmp/xxx` | 隔离配置，避免并发实例抢锁 |
| `--screenshot=path` | 输出 PNG |

> 注意：路径含空格，必须整体加引号；`--virtual-time-budget` 不是真实等待，复杂 WebGL 首帧建议 ≥2000 ms。

## CDP 自动化（Node 内置 WebSocket）

Node ≥ 22 自带全局 `WebSocket` 与 `fetch`，可直接驱动 Chrome DevTools Protocol，无需 `ws` / `puppeteer` / `playwright`。

```js
// scripts/shot.mjs（骨架）
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9224;
const chrome = spawn(CHROME, [
  "--headless=new",
  `--remote-debugging-port=${PORT}`,
  "--user-data-dir=/tmp/chrome-cdp",
  "--window-size=1600,900",
  "about:blank",
], { stdio: "ignore" });

// 1. 等 /json/version 就绪
// 2. PUT /json/new?<url> 建标签页，取 webSocketDebuggerUrl
// 3. Runtime.enable / Page.enable
// 4. Runtime.evaluate({ expression, returnByValue: true })
// 5. Page.captureScreenshot({ format: "png" }) → base64 落盘
// 6. chrome.kill("SIGKILL")
```

要点：

- 用 `PUT` 而不是 `GET` 调 `/json/new`。
- `Runtime.evaluate` 用 `returnByValue: true` 取结构化结果；不要返回循环引用对象。
- 截图前等待页面稳定（固定 sleep 或监听 `Page.loadEventFired`）。
- 每个实例用独立 `--user-data-dir` 和端口；结束务必 `SIGKILL` 清理。
- 本项目的现成实现：`scripts/shot.mjs`、`scripts/inspect.mjs`。

## 脚本化原则（不要把 shell 当垃圾桶）

- 可复用、多行、带分支的逻辑写进 `scripts/*.mjs`，用编辑工具维护；不要用 heredoc 往 shell 里灌代码。
- 避免超长拼接命令；一个命令只做一件事，必要时分步执行。
- 长任务放后台并重定向日志，不要阻塞会话。
- 改完 JS 先做语法检查：`node --check src/foo.js`（只查语法，不解析 import）。
- 测试脚本优先用项目已有入口（如 `npm test`），不要临时猜命令。

## Mermaid 渲染（mmdc）

### 基本用法

```bash
# 必须先设置 PATH
export PATH="/opt/homebrew/bin:$PATH"

# PNG 输出（兼容模式，推荐用于 DOCX）
/opt/homebrew/bin/mmdc \
  -i images/fig01.mmd \
  -o images/fig01.png \
  -w 1200 \
  -b white \
  -t neutral

# SVG 输出（矢量模式）
/opt/homebrew/bin/mmdc \
  -i images/fig01.mmd \
  -o images/fig01.svg \
  -t neutral
```

### 批量渲染脚本

```bash
export PATH="/opt/homebrew/bin:$PATH"
for f in images/*.mmd; do
  base=$(basename "$f" .mmd)
  /opt/homebrew/bin/mmdc \
    -i "$f" \
    -o "images/${base}.png" \
    -w 1200 \
    -b white \
    -t neutral
  echo "Rendered: ${base}.png"
done
```

### 参数说明

| 参数 | 说明 | 推荐值 |
|------|------|--------|
| `-i` | 输入 .mmd 文件路径 | — |
| `-o` | 输出图片路径 | — |
| `-w` | 图片宽度（像素） | 1200（PNG） |
| `-b` | 背景色 | `white`（避免透明背景） |
| `-t` | 主题 | `neutral`（中性主题） |
| `-H` | 图片高度（像素） | 可选，不指定则自动 |

## 常见问题

### 1. `node: No such file or directory`

**原因**：`/opt/homebrew/bin/` 不在 PATH 中。

**解决**：
```bash
export PATH="/opt/homebrew/bin:$PATH"
```

### 2. `mmdc: command not found`

**原因**：mmdc 未安装，或 PATH 未设置。

**解决**：
```bash
# 安装 mmdc
/opt/homebrew/bin/npm install -g @mermaid-js/mermaid-cli

# 或设置 PATH 后重试
export PATH="/opt/homebrew/bin:$PATH"
```

### 3. Puppeteer/Chromium 相关错误

**原因**：mmdc 依赖 Puppeteer 下载 Chromium，首次运行可能下载失败。

**解决**：
```bash
# 设置 Puppeteer 跳过下载（使用系统 Chrome）
export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
# 或指定 Chrome 路径
export PUPPETEER_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
```

### 4. 渲染出的 PNG 字体/排版与 VS Code 预览不一致

**原因**：mmdc 使用内置 Chromium 渲染，字体和 CSS 与 VS Code 不同。

**解决**：
- 这是 mmdc 渲染引擎的固有限制，不影响 DOCX 输出效果
- 如需精确控制样式，可考虑在 VS Code 中截图替代
- 字体差异不影响文档内容的可读性和专业性

### 5. 无头截图空白 / 一直停在 loader

**原因**：`--virtual-time-budget` 太短、静态服务器未启动、或页面在 `?t=` 截图模式下没有隐藏 loader。

**解决**：
```bash
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8123/
# 200 后再加大等待
--virtual-time-budget=3000
```

### 6. CDP 连接被拒绝 / 端口占用

**原因**：上一次 Chrome 未退出，或 `--user-data-dir` 锁未释放。

**解决**：
```bash
pkill -f "remote-debugging-port"
rm -rf /tmp/chrome-cdp
```
换一个 `PORT` 与 `--user-data-dir` 重试。

### 7. `Failed to load module script` / MIME type 错误

**原因**：用 `file://` 打开了含 ES Module 的页面。

**解决**：改用 `python3 -m http.server` 起 HTTP 服务，不要双击 HTML。

### 8. WebGL 场景整体全黑，只有 HTML/SVG 可见

**原因**：灯光参数出现 `NaN`（例如除以 `undefined`），一个 NaN 强度会污染整组光照 uniform，导致所有 PBR 材质变黑。

**解决**：用 CDP `Runtime.evaluate` 检查每个 `light.intensity` 是否 `Number.isFinite`，先修数据，再调曝光/补光。

## 完整工作流示例

```bash
# 1. 设置 PATH
export PATH="/opt/homebrew/bin:$PATH"

# 2. 验证工具
/opt/homebrew/bin/node --version
/opt/homebrew/bin/mmdc --version

# 3. 渲染所有 Mermaid 图
cd /path/to/project
for f in images/*.mmd; do
  base=$(basename "$f" .mmd)
  /opt/homebrew/bin/mmdc \
    -i "$f" \
    -o "images/${base}.png" \
    -w 1200 \
    -b white \
    -t neutral
done

# 4. 验证渲染结果
ls -la images/*.png

# 5. 替换 Mermaid 代码块为图片引用（生成 rendered.md）
python3 scripts/render_md.py

# 6. 确认无残留 Mermaid 代码块
grep -c '```mermaid' output/xxx_rendered.md  # 应输出 0

# 7. Pandoc 转换
/opt/homebrew/bin/pandoc output/xxx_rendered.md \
  -o output/xxx.docx \
  --from markdown \
  --to docx \
  --resource-path=.
```
