# 导航页

桌面级导航起始页，面向 NAS 自托管场景。支持小组件自由拖拽与拉伸、在线壁纸自动轮换、天气显示、
内网/外网地址自动切换、多用户独立布局，数据落地本地，可打包为 Docker 或飞牛 fnOS 的 fpk 应用。

## 功能

- **小组件网格**：时钟、日期、天气、搜索框、每个导航入口都是独立组件，可在 4×4 方格面板里拖选尺寸
  （1×1 / 2×1 / 2×2 / 3×1 …），拖动时其它组件实时平滑补位，布局随账号保存到后端
- **壁纸**：本地图片上传 + 轮播，或接入在线壁纸 API（必应每日一图 / 随机风景 / 随机二次元 / 随机 ACG / 自定义）
- **天气**：内置免费源开箱可用，可切换和风天气、高德、心知等需要 Key 的服务商；支持浏览器精确定位、
  手动搜索城市、IP 粗定位三种方式
- **内外网切换**：每张卡片可分别填内网和外网地址，按当前访问来源自动选择，也可手动强制切换
- **多用户**：注册登录、每人独立卡片与布局、管理员角色、访客只读公共主页
- **三端适配**：桌面 6 列 / 平板 4 列 / 手机 2 列，手机端支持长按拖动与手势
- **容错**：后端异常时页面照常渲染并提示，不白屏；接口未登录态返回 200 + 空数据，不弹技术性报错

## 快速开始

### Docker Compose

把源码放到一个目录，再将 `deploy/` 下的 `Dockerfile`、`docker-compose.yml`、`.dockerignore`
复制到源码根目录（`package.json` 同级），然后：

```bash
mkdir -p data
docker compose up -d --build
```

访问 `http://NAS_IP:3002`。数据保存在 `./data`。

### 飞牛 fnOS fpk

```bash
cd fpk
bash build-fpk.sh      # 需要先安装 fnpack，且已把源码放在仓库根目录
```

产物为 `compass-nav-1.0.0.fpk`，在应用中心手动安装即可。数据保存在 Docker 命名卷 `compass-nav-data`。

详细步骤、端口说明、备份迁移、反向代理与 HTTPS 配置见仓库根目录的部署文档。

## 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `SERVER_PORT` | `3002` | 监听端口 |
| `SERVER_HOST` | `0.0.0.0` | 监听地址 |
| `DATA_DIR` | `/app/data` | 数据目录（数据库与壁纸） |
| `JWT_SECRET` | 内置默认值 | **上线前必须修改** |
| `TZ` | `Asia/Shanghai` | 时区 |

## 目录结构

```
.
├── deploy/        # Docker 部署文件（Dockerfile / compose / dockerignore）
├── fpk/           # 飞牛 fpk 应用工程（manifest / config / cmd / wizard / app）
├── server/        # 后端
├── client/        # 前端
├── package.json
└── LICENSE
```

## 说明

浏览器定位（天气精确位置）仅在 HTTPS 或 localhost 下可用，HTTP 域名访问时会被浏览器拒绝，
此时请用手动搜索城市或 IP 粗定位。

## License

MIT

## 镜像源与国内网络

基础镜像与 npm 源都做成了构建参数，默认值已经适配国内网络：

- `NODE_IMAGE=docker.m.daocloud.io/library/node:22-slim`
- `NPM_REGISTRY=https://registry.npmmirror.com`

海外环境或想换别的源，直接覆盖即可：

```bash
docker build -f deploy/Dockerfile \
  --build-arg NODE_IMAGE=node:22-slim \
  --build-arg NPM_REGISTRY= \
  -t compass-nav:1.0.0 .
```

> 已知问题：飞牛自带的 `docker.fnnas.com` 对 `node:22-slim` 的 HEAD 请求返回**不带认证挑战的 401**，
> buildkit 无法取到 token，报 `unexpected status from HEAD request ... 401 Unauthorized`。
> 因此默认不走该源；如需走飞牛源，请在飞牛 Docker 设置里先配置可用的加速器。

## 构建注意：不要用 `--ignore-scripts`

`npm ci --ignore-scripts` 会让 `@swc/core`、`esbuild` 这类带安装脚本的包跳过脚本执行，
平台二进制（`@swc/core-linux-x64-gnu` 等）装不上，构建时会直接报：

```
Error Failed to load "@swc/cli" and/or "@swc/core" required packages
Failed to load native binding
```

Dockerfile 里已经避开了这个坑：正常执行 `npm ci`，另外单独删除项目自带的
`postinstall`（它调用生成器的 `fullstack-cli`，容器里没有），
并把前后端构建拆成两条 `RUN`，失败时能直接看出是哪一步挂的。
