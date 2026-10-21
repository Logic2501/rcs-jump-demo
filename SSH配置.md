# SSH 配置（GitHub over 443）

> 实测环境：macOS Apple Silicon，2026-10-21。
> 适用场景：网络屏蔽 22 端口，但允许 443；GitHub SSH 走 `ssh.github.com:443`。

## 0. 当前状态（2026-10-21）

| 项 | 状态 |
|----|------|
| `ssh -T git@github.com` | ✅ `Hi Logic2501!` |
| `gh auth status` | ✅ `Logic2501`，SSH 协议，scopes: `gist, read:org, repo, workflow` |
| 仓库 | https://github.com/Logic2501/rcs-jump-demo |
| 推送 | ✅ `main -> origin/main` |
| Pages | ✅ https://logic2501.github.io/rcs-jump-demo/ |

## 1. 配置文件

路径：`~/.ssh/config`

```sshconfig
Host github.com
  HostName ssh.github.com
  Port 443
  User git
  IdentityFile ~/.ssh/id_ed25519
  IdentitiesOnly yes
```

说明：

| 项 | 作用 |
|----|------|
| `Host github.com` | 让 `git@github.com:...` 自动匹配本段配置 |
| `HostName ssh.github.com` | 实际连接 GitHub 的 443 入口 |
| `Port 443` | 绕过 22 端口封锁 |
| `User git` | GitHub SSH 固定用户名 |
| `IdentityFile` | 指定私钥，避免用错 key |
| `IdentitiesOnly yes` | 只使用指定 key，避免 agent 里其他 key 干扰 |

## 2. 密钥

| 项 | 值 |
|----|-----|
| 类型 | ED25519 |
| 私钥 | `~/.ssh/id_ed25519`（**绝不外传、绝不提交**） |
| 公钥 | `~/.ssh/id_ed25519.pub` |
| 公钥指纹 | `SHA256:8KqNwJoKHXpMhtQ3agJcbuFsA1W2fqUKe45bD+iY8XA` |
| GitHub 账号 | `Logic2501` |

查看指纹：

```bash
ssh-keygen -lf ~/.ssh/id_ed25519.pub
```

期望输出（末尾注释可能不同）：

```text
256 SHA256:8KqNwJoKHXpMhtQ3agJcbuFsA1W2fqUKe45bD+iY8XA qianfeng@local (ED25519)
```

## 3. 权限

macOS 对 `~/.ssh` 权限敏感，过宽会导致 SSH 忽略密钥：

```bash
chmod 700 ~/.ssh
chmod 600 ~/.ssh/config
chmod 600 ~/.ssh/id_ed25519
chmod 600 ~/.ssh/known_hosts
chmod 644 ~/.ssh/id_ed25519.pub
```

检查：

```bash
ls -la ~/.ssh
```

## 4. 连通性验证

```bash
ssh -T git@github.com
```

期望输出：

```text
Hi Logic2501! You've successfully authenticated, but GitHub does not provide shell access.
```

看到 `Hi <用户名>!` 即表示 SSH 认证成功；“does not provide shell access” 是正常提示。

首次连接会写入 `known_hosts`，可用以下方式非交互接受：

```bash
ssh -T -o StrictHostKeyChecking=accept-new git@github.com
```

## 5. Git 仓库使用

确认远端：

```bash
git remote -v
```

添加 GitHub 远端（示例）：

```bash
git remote add origin git@github.com:Logic2501/<repo>.git
git push -u origin main
```

> 当前项目已配置 `origin` 为 `git@github.com:Logic2501/rcs-jump-demo.git`，并已成功推送 `main`。

### 5.1 提交身份

本机未设置全局 `git user.name` / `user.email`；本次提交使用一次性参数：

```bash
git -c user.name=Logic2501 \
    -c user.email=Logic2501@users.noreply.github.com \
    commit -m "message"
```

需要固定身份时，只在项目内设置（不要改全局）：

```bash
git config user.name Logic2501
git config user.email Logic2501@users.noreply.github.com
```

### 5.2 SSH 与 gh 的分工

| 能力 | SSH | `gh` / GitHub API |
|------|-----|-------------------|
| `git push/pull` | ✅ | ✅（内部仍可走 SSH） |
| 创建仓库 | ❌ | ✅ `gh repo create` |
| Pages / Actions | ❌ | ✅ |
| Issue / PR / Release | ❌ | ✅ |

> SSH 只是传输认证，不能替代浏览器登录；`gh auth login` 获取的是 API token。

## 6. 常见问题

### 6.1 `Permission denied (publickey)`

1. 确认公钥已添加到 GitHub：Settings → SSH and GPG keys。
2. 确认 `~/.ssh/config` 的 `IdentityFile` 指向正确私钥。
3. 用详细日志定位：
   ```bash
   ssh -vT git@github.com
   ```
4. 检查 agent：
   ```bash
   ssh-add -l
   ```

### 6.2 `Connection timed out` / 22 端口不可达

说明没有走 443。检查 `~/.ssh/config` 是否包含 `HostName ssh.github.com` 与 `Port 443`，并用 `ssh -vT git@github.com` 确认实际连接地址。

### 6.3 `Host key verification failed`

删除旧记录后重试：

```bash
ssh-keygen -R "[ssh.github.com]:443"
ssh -T -o StrictHostKeyChecking=accept-new git@github.com
```

### 6.4 代理环境

- GitHub SSH 走 `ssh.github.com:443`，当前无需 HTTP 代理。
- `github.com` 直连实测超时；`gh auth login` 建议带 Clash 代理：
  ```bash
  HTTPS_PROXY=http://127.0.0.1:7890 HTTP_PROXY=http://127.0.0.1:7890 \
    gh auth login --hostname github.com --git-protocol ssh --scopes repo,workflow
  ```
- `api.github.com` 直连可用（约 0.8s），走代理约 0.4s。
- 若 443 也需要代理，可在 `Host github.com` 段增加 `ProxyCommand`（按实际代理软件调整），不要全局改 `http.proxy` 影响其他仓库。

## 7. 安全约束

- 只备份/传输 `id_ed25519.pub`，**不要**复制 `id_ed25519`。
- 不要把 `~/.ssh` 放进任何项目目录或提交到 Git。
- 项目 `.gitignore` 建议包含：
  ```gitignore
  .env
  *.pem
  id_ed25519
  id_ed25519.pub
  ```
- 换机时重新生成密钥并在 GitHub 添加新公钥，不要复用私钥。
- `gh` token 保存在系统 keyring；不要把 `gh auth token` 输出贴到聊天、日志或仓库。
- 无人值守用 fine-grained PAT 时，至少需要 Contents / Pages / Workflows 读写；token 只注入本机环境。
