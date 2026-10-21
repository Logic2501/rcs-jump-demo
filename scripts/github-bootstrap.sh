#!/usr/bin/env bash
set -euo pipefail

REPO="${1:-rcs-jump-demo}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ -n "$(git status --porcelain -- .github scripts/github-bootstrap.sh GitHub_Agent配置.md)" ]; then
  echo "GitHub 配置/工作流文件尚未提交，push 时不会包含它们。先提交："
  git status --short -- .github scripts/github-bootstrap.sh GitHub_Agent配置.md
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "缺少 GitHub CLI。先安装：brew install gh"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "GitHub CLI 未登录。先执行："
  echo "  gh auth login --hostname github.com --git-protocol ssh --scopes repo,workflow"
  exit 1
fi

OWNER="$(gh api user --jq .login)"
OWNER_LC="$(printf '%s' "$OWNER" | tr '[:upper:]' '[:lower:]')"
REMOTE="git@github.com:${OWNER}/${REPO}.git"

if git remote get-url origin >/dev/null 2>&1; then
  echo "使用现有 origin: $(git remote get-url origin)"
else
  git remote add origin "$REMOTE"
  echo "已添加 origin: $REMOTE"
fi

if gh repo view "${OWNER}/${REPO}" >/dev/null 2>&1; then
  echo "仓库已存在: ${OWNER}/${REPO}"
else
  gh repo create "${OWNER}/${REPO}" \
    --public \
    --description "three.js + SVG RCS jump demo"
  echo "已创建仓库: ${OWNER}/${REPO}"
fi

git push -u origin main

if gh api "repos/${OWNER}/${REPO}/pages" >/dev/null 2>&1; then
  gh api -X PUT "repos/${OWNER}/${REPO}/pages" -f build_type=workflow >/dev/null
else
  gh api -X POST "repos/${OWNER}/${REPO}/pages" -f build_type=workflow >/dev/null
fi
echo "Pages 已设为 GitHub Actions 构建。"

gh workflow run pages.yml --ref main 2>/dev/null || true
echo "Pages: https://${OWNER_LC}.github.io/${REPO}/"
echo "Actions: https://github.com/${OWNER}/${REPO}/actions"
