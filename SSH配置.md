# SSH 配置（GitHub over 443）

> 实测环境：macOS Apple Silicon，2026-10-21。
> 适用场景：网络屏蔽 22 端口，但允许 443；GitHub SSH 走 `ssh.github.com:443`。

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

> 本机当前项目尚未配置 `git remote`；需要推送时再添加。

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

若 443 也需要代理，可在 `Host github.com` 段增加 `ProxyCommand`（按实际代理软件调整），不要全局改 `http.proxy` 影响其他仓库。

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
