# GitHub Agent 操作准备

> 目标：让 agent 能完成建仓、推送、Pages、Actions、Issue/PR 等操作，同时不把 token 写进仓库。
> 当前状态：已安装并登录 `gh`；仓库 `Logic2501/rcs-jump-demo` 已创建；`main` 已推送；Pages 已通过 GitHub Actions 部署成功。
> 站点：https://logic2501.github.io/rcs-jump-demo/

## 1. 当前状态

| 项 | 状态 | 说明 |
|----|------|------|
| GitHub SSH | ✅ | `ssh -T git@github.com` 返回 `Hi Logic2501!` |
| 本地 git 提交 | ✅ | `main` 已推送到远端 |
| git remote | ✅ | `origin` 指向 `Logic2501/rcs-jump-demo` |
| GitHub CLI (`gh`) | ✅ | 2.93.0，已安装 |
| gh 登录 | ✅ | 账号 `Logic2501`，SSH 协议，scopes: repo/workflow |
| GitHub 仓库 | ✅ | https://github.com/Logic2501/rcs-jump-demo |
| GitHub Pages | ✅ | https://logic2501.github.io/rcs-jump-demo/ |

## 2. 已完成的一次性步骤（记录）

```bash
brew install gh
gh auth login --hostname github.com --git-protocol ssh --scopes repo,workflow
bash scripts/github-bootstrap.sh
```

登录选择：

- 账号：`Logic2501`
- 协议：SSH
- 浏览器登录或粘贴一次性验证码

完成后验证：

```bash
gh auth status
gh api user --jq .login
```

## 3. 自动建仓与 Pages

登录后执行：

```bash
bash scripts/github-bootstrap.sh
```

脚本会：

1. 检测/添加 `origin`；
2. 创建 public 仓库 `rcs-jump-demo`（已存在则跳过）；
3. 推送 `main`；
4. 把 Pages 的构建源设为 GitHub Actions；
5. 触发 `pages.yml`；
6. 输出 Pages 与 Actions 地址。

预期站点：

`https://logic2501.github.io/rcs-jump-demo/`

## 4. 已准备的工作流

| 文件 | 作用 |
|------|------|
| `.github/workflows/pages.yml` | push 到 `main` 后构建并部署 Pages |
| `.github/workflows/test.yml` | push / PR 时运行 `npm test` |

`pages.yml` 使用官方 `configure-pages`、`upload-pages-artifact`、`deploy-pages`，并尝试自动启用 Pages（`enablement: true`）。若仓库策略阻止自动启用，手动在 Settings → Pages → Source 选择 **GitHub Actions** 即可。

## 5. 登录后 agent 可做的事

```bash
gh repo view
gh repo edit --description "..."
gh issue list
gh issue create
gh pr list
gh pr create
gh run list
gh run view <id> --log
gh release create v1.0.0 ...
```

## 6. 无浏览器/无交互的替代方案

如果 agent 需要在无人值守环境操作，使用 **fine-grained PAT**，不要把 token 写进仓库：

- Contents: Read and write
- Pages: Read and write
- Workflows: Read and write
- Metadata: Read

通过 shell 环境或系统钥匙串注入：

```bash
export GH_TOKEN="github_pat_xxx"
gh auth status
```

`GH_TOKEN` 只放在本机环境；不要提交 `.env`、shell history 或项目文件。

## 7. 可选增强

| 工具 | 用途 | 安装 |
|------|------|------|
| `actionlint` | 本地校验 workflow YAML | `brew install actionlint` |
| `act` | 本地跑 GitHub Actions（需 Docker） | `brew install act` |
| `git-lfs` | 大文件（当前不需要） | `brew install git-lfs` |

## 8. 安全与执行约束

- 私钥 `~/.ssh/id_ed25519` 不复制、不提交。
- token 不写入 `opencode.json`、`AGENTS.md`、仓库文件。
- Pages 只发布静态文件；当前站点不需要服务端密钥。
- 网络/建仓/改 Pages 属于需要用户明确同意的操作；本文件只做准备工作，不自动执行登录或建仓。
