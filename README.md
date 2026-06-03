# 史迹 · 中国历史人物关系图谱

中国历史人物与事件关系可视化产品。以朝代为单元，将历史人物、事件、关系以交互图谱形式呈现，支持聚焦探索、时间轴联动、全局搜索与深链定位。

---

## 技术栈

| 层 | 技术 |
|---|---|
| 框架 | Next.js 14 (App Router) + React 18 + TypeScript |
| 图谱渲染 | 纯 SVG + React（自研层级轨道布局） |
| 样式 | Tailwind CSS |
| API | Next.js Route Handlers |
| 数据库 | PostgreSQL 16 |
| 部署 | Docker Compose（Next.js 镜像 + PostgreSQL） |

---

## 快速启动

### 生产模式（Docker 一键）

需要本机安装 Docker。

```bash
docker compose up --build
```

首次启动约 3–5 分钟，包含镜像构建、数据库初始化、种子数据导入。完成后访问 `http://localhost:3000`。

```bash
# 后台运行
docker compose up --build -d

# 查看日志
docker compose logs -f app
docker compose logs -f db

# 停止（保留数据）
docker compose down

# 停止并清空数据（下次重新初始化）
docker compose down -v
```

### 开发模式（热更新，推荐）

Docker 只跑数据库，Next.js 本地运行，改代码浏览器实时刷新。

```bash
# 1. 启动数据库
docker compose up -d db

# 2. 创建本地环境变量（只需一次）
echo "DATABASE_URL=postgresql://history:history@localhost:5432/history" > .env.local

# 3. 安装依赖（只需一次）
npm install

# 4. 启动开发服务器
npm run dev
```

访问 `http://localhost:3000`。

---

## 功能

### 首页
- 全局搜索框（人物 / 事件 / 朝代，实时搜索 + 键盘导航）
- 朝代卡片入口
- 推荐故事入口（如「从曹操开始」「赤壁之战」）

### 朝代图谱页 `/dynasty/:slug`
- **关系图谱**：层级轨道布局（帝王/霸主 → 文臣武将 → 武将/其他 → 历史事件），SVG 渲染，发光节点，贝塞尔曲线边，拖拽平移，滚轮缩放
- **节点交互**：点击聚焦，高亮直接关系，非相关节点淡出
- **详情面板**：右侧滑出，展示人物/事件完整介绍、关联人物、相关事件，可逐级跳转
- **底部时间轴**：朝代关键事件按年份排列，点击联动图谱聚焦
- **深链**：`?focus=person:cao-cao` 直接进入指定节点视角
- **ESC** 退出聚焦，恢复全景

### API

| 路由 | 说明 |
|---|---|
| `GET /api/dynasties` | 朝代列表 + 推荐入口 |
| `GET /api/graph/:dynastySlug` | 朝代图谱投影（节点 + 边 + 时间轴） |
| `GET /api/entities/:type/:slug` | 人物 / 事件详情 |
| `GET /api/search?q=` | 全局搜索 |

---

## 项目结构

```
.
├── Dockerfile                       # 多阶段构建，standalone 输出
├── docker-compose.yml               # app + db 编排
├── next.config.js
├── tailwind.config.ts
└── src
    ├── app
    │   ├── api                      # 后端 API（Route Handlers）
    │   │   ├── dynasties/route.ts
    │   │   ├── graph/[dynastySlug]/route.ts
    │   │   ├── entities/[entityType]/[entitySlug]/route.ts
    │   │   └── search/route.ts
    │   ├── dynasty/[dynastySlug]
    │   │   ├── page.tsx             # 朝代图谱页（Server Component）
    │   │   └── components           # 页面专属组件
    │   │       ├── DynastyGraphPage.tsx  # 页面容器，状态编排
    │   │       ├── GraphCanvas.tsx       # SVG 图谱渲染 + 交互
    │   │       ├── DetailPanel.tsx       # 右侧详情面板
    │   │       └── Timeline.tsx          # 底部时间轴
    │   ├── page.tsx                 # 首页
    │   ├── layout.tsx
    │   └── globals.css
    ├── components
    │   └── SearchBox.tsx            # 跨页面共享搜索框
    ├── hooks
    │   └── useDynastyFocus.ts       # 节点聚焦状态、URL 同步、键盘、popstate
    ├── services
    │   ├── entityService.ts         # fetchEntityDetail()
    │   └── searchService.ts         # searchEntities()（含 AbortController）
    ├── utils
    │   ├── format.ts                # formatYear()
    │   └── graphLayout.ts           # computeLayout / edgePath / 角色颜色常量
    ├── lib                          # 后端专用
    │   ├── db.ts                    # PostgreSQL 连接池（懒加载）
    │   ├── db-init.ts               # 建表 + 种子数据 + 投影构建（幂等）
    │   ├── queries.ts               # 业务查询函数
    │   └── types.ts                 # 全局类型定义
    └── instrumentation.ts           # 应用启动钩子，触发数据库初始化
```

### 前端分层说明

| 层 | 路径 | 职责 |
|---|---|---|
| 页面 | `app/*/page.tsx` | 服务端数据加载，组件编排 |
| 页面组件 | `app/.../components/` | 当前页面专属 UI 与交互逻辑 |
| 共享组件 | `components/` | 跨页面复用的纯 UI 组件 |
| Hooks | `hooks/` | 可复用状态逻辑与副作用封装 |
| Services | `services/` | API 请求封装，统一管理 fetch 与错误 |
| Utils | `utils/` | 无副作用纯函数（格式化、布局计算等） |
| 后端 | `lib/` | 数据库连接、查询、类型定义 |

---

## 数据模型

采用「规范化主表 + 只读投影表」双层模型：

**主表**（写入）
- `dynasties` — 朝代
- `persons` — 人物（含 importance_score、primary_role、x/y 种子坐标）
- `events` — 历史事件
- `relations` — 人物/事件关系（blood / political / conflict / participation / subordinate）
- `entity_aliases` — 别名（用于搜索）
- `timeline_entries` — 时间轴条目

**投影表**（只读，应用启动时构建）
- `dynasty_graph_projections` — 图谱 JSON（节点 + 边）
- `entity_detail_projections` — 详情 JSON（关联人物、相关事件）
- `search_documents` — 搜索文档（全文搜索）

投影由 `src/lib/db-init.ts` 在应用启动时幂等构建，前端 API 只读投影，不直接访问主表。

---

## 当前数据范围

| 朝代 | 人物 | 事件 |
|---|---|---|
| 三国时期 (184–280) | 15 人（曹操、刘备、孙权、诸葛亮、司马懿、关羽、张飞、赵云、周瑜、陆逊等） | 5 件（赤壁之战、三顾茅庐、官渡之战、夷陵之战、北伐中原） |
| 秦朝 (前221–前206) | 7 人（秦始皇、李斯、蒙恬、赵高、扶苏、胡亥、项羽） | 4 件（统一六国、修筑长城、焚书坑儒、沙丘之变） |

### 新增朝代/人物/事件

编辑 `src/lib/db-init.ts`，在对应数组追加种子条目。修改后清空数据卷重启：

```bash
docker compose down -v && docker compose up --build
```

开发模式下重启 `npm run dev` 即可（instrumentation 自动重新初始化）。

---

## 环境变量

| 变量 | 必需 | 默认 | 说明 |
|---|---|---|---|
| `DATABASE_URL` | ✅ | — | PostgreSQL 连接串 |
| `NODE_ENV` | | `development` | `production` 时 Next.js 以生产模式运行 |
| `PORT` | | `3000` | 监听端口 |

Docker Compose 已自动注入 `DATABASE_URL`，本地开发通过 `.env.local` 提供。

---

## 常见问题

**首页朝代区域显示「数据初始化中」**
首次启动等 PostgreSQL 健康检查通过后，instrumentation 执行种子导入，通常 10–30 秒。刷新即可。查看进度：`docker compose logs -f app`，出现 `[db] initialized` 表示完成。

**想清空数据重新导入**
`docker compose down -v && docker compose up --build`

**本地 `npm run dev` 报 `DATABASE_URL is required`**
根目录创建 `.env.local`，写入 `DATABASE_URL=postgresql://history:history@localhost:5432/history`。

**浏览器兼容性**
图谱使用 SVG + CSS filter，支持所有现代浏览器（Chrome / Edge / Safari / Firefox 最新版）。移动端暂未适配。

---

## 后续计划

- 补全更多朝代数据（汉、唐、宋、明、清等）
- 跨朝代关系视图（同一人物跨朝代连接）
- 地图维度联动
- 人物对比模式
- 移动端适配
