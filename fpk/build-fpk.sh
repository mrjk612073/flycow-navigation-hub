#!/bin/bash
# 在 Linux / 飞牛 NAS 上执行：把 fpk 工程打成 .fpk 安装包
#
# 用法（在 fpk 目录下）：
#   bash build-fpk.sh
#
# 前置条件：
#   1. 已安装 fnpack（飞牛官方打包工具，仅 Linux 可用）
#   2. 应用源码已放在仓库根目录（与 fpk/、deploy/ 同级，能直接看到 package.json）
#      脚本会自动把仓库根的源码同步到 app/docker/src/

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== 1/5 检查 fpk 必需文件 ==="
REQUIRED=(manifest config/privilege config/resource ICON.PNG ICON_256.PNG app cmd wizard)
for f in "${REQUIRED[@]}"; do
    if [ ! -e "$f" ]; then
        echo "缺少必需文件或目录：$f"
        exit 1
    fi
done
echo "必需文件齐全"

echo "=== 2/5 准备应用源码 ==="
if [ -f "app/docker/src/package.json" ]; then
    echo "app/docker/src/ 已有源码，跳过同步"
else
    if [ -f "${REPO_ROOT}/package.json" ]; then
        echo "从仓库根同步源码：${REPO_ROOT} -> app/docker/src/"
        find "${REPO_ROOT}" -maxdepth 1 -mindepth 1 \
            ! -name 'node_modules' ! -name 'dist' ! -name 'data' \
            ! -name 'fpk' ! -name 'deploy' ! -name '.git' ! -name '.gitignore' \
            ! -name 'Dockerfile' ! -name '.dockerignore' \
            ! -name 'README.md' ! -name 'LICENSE' \
            -exec cp -a {} "app/docker/src/" \;
    else
        echo "没有找到源码"
        echo "请把应用源码放到仓库根目录（${REPO_ROOT} 下应当有 package.json），"
        echo "或者手动解压到 app/docker/src/（package.json 必须与 Dockerfile 同级）"
        exit 1
    fi
fi

if [ ! -f "app/docker/src/package.json" ]; then
    echo "app/docker/src/ 下仍没有 package.json，请检查源码目录结构"
    exit 1
fi
echo "源码已就位"

echo "=== 3/5 修正脚本执行权限与换行 ==="
chmod +x cmd/* 2>/dev/null || true
sed -i 's/\r$//' cmd/* 2>/dev/null || true
sed -i 's/\r$//' manifest 2>/dev/null || true
sed -i 's/\r$//' app/docker/docker-compose.yaml 2>/dev/null || true
echo "权限与换行已处理"

echo "=== 4/5 检查 fnpack ==="
if ! command -v fnpack >/dev/null 2>&1; then
    echo "未找到 fnpack 命令"
    echo "请先在飞牛 NAS 上安装 fnpack，参考 developer.fnnas.com/docs/cli/fnpack/"
    exit 1
fi

APPNAME=$(grep -E '^[[:space:]]*appname[[:space:]]*=' manifest | head -n 1 | cut -d '=' -f 2 | xargs)
VERSION=$(grep -E '^[[:space:]]*version[[:space:]]*=' manifest | head -n 1 | cut -d '=' -f 2 | xargs)

echo "=== 5/5 打包 ==="
fnpack build

echo
echo "打包完成，产物：${APPNAME}-${VERSION}.fpk"
ls -lh ./*.fpk 2>/dev/null || true
