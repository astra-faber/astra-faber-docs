# vera-web 管理界面

vera-web 是 Vera 平台的 Web 管理界面，提供物模型定义、设备管理、接口类型配置、组件模型管理和数据可视化等功能。

## 技术栈

- **前端框架**: Vue 3.5 + TypeScript
- **UI 组件库**: Arco Design Vue
- **通信协议**: ConnectRPC (gRPC-Web)
- **构建工具**: Vite 6
- **Protobuf**: 使用 Buf 工具链自动生成

## 快速启动

```bash
cd vera-web
npm install
npm run dev
```

启动后访问 `http://localhost:3000`。

::: tip 前置条件
vera-web 需要连接 Vera 服务端。请确保服务端已在 `localhost:50051` 运行：
```bash
cargo run -p vera
```
:::

## 连接配置

### 开发模式

开发模式下，Vite 开发服务器会自动代理 gRPC-Web 请求到后端：

| 前端路径 | 代理目标 |
|----------|----------|
| `/vera.store.v1/*` | `http://localhost:50051` |
| `/vera.things.v1/*` | `http://localhost:50051` |

无需额外配置跨域，前端直接请求即可。

### 生产模式

```bash
npm run build
npm run preview
```

构建产物位于 `dist/` 目录，部署时需确保 gRPC-Web 端点可达。

## 功能页面

### 物模型管理

| 路由 | 功能 |
|------|------|
| `/` | 物模型列表 — 查看所有已创建的物模型 |
| `/models/create` | 创建物模型 — 定义属性、事件、动作和 Slot |
| `/models/:id` | 编辑物模型 — 修改已有物模型定义 |

物模型编辑器支持：
- 定义根属性（名称、标识符、数据类型、访问模式）
- 配置 Slot 插槽（兼容接口、物理约束、默认绑定）
- 管理子模型和嵌套结构

### 设备管理

| 路由 | 功能 |
|------|------|
| `/devices` | 设备列表 — 查看所有注册设备 |
| `/devices/:modelId/:deviceId` | 设备详情 — 查看设备实时状态和属性值 |

设备详情页展示：
- 设备基本信息（model_id、device_id）
- 根属性当前值和上报时间
- Slot 属性状态（包括已绑定组件的属性值）

### 接口类型管理

| 路由 | 功能 |
|------|------|
| `/interfaces` | 接口类型列表 |
| `/interfaces/create` | 创建接口类型 — 定义标准契约 |
| `/interfaces/:id/:version` | 编辑接口类型 |

接口类型（InterfaceType）定义了组件需要实现的标准契约，包括必需属性、可选属性和能力声明。

### 组件模型管理

| 路由 | 功能 |
|------|------|
| `/components` | 组件模型列表 |
| `/components/create` | 创建组件模型 |
| `/components/:key` | 编辑组件模型 |

组件模型（ComponentModel）代表具体的硬件产品（如 Nikon Z8 相机），通过 Port 声明实现了哪些接口类型。

### 数据可视化

| 路由 | 功能 |
|------|------|
| `/visualization/:modelId/:deviceId` | 设备数据可视化 |
| `/visualization` | 可视化选择页 |

---

## 与其他工具的关系

vera-web 和 [vera-cli 命令行工具](/tools/vera-cli) 连接同一个 Vera 服务端（默认 `localhost:50051`），数据完全互通：

- 通过 **vera-cli** 创建的设备、表和数据，可在 vera-web 界面中实时查看
- 通过 **vera-web** 创建的物模型、接口类型和组件模型，设备端 [astra-faber SDK](/sdk/vera/things) 连接后会自动同步

```
┌─────────────┐     gRPC      ┌──────────────┐
│  vera-cli   │──────────────▶│              │
│  命令行工具  │               │  Vera 服务端  │
└─────────────┘               │  :50051      │
                              │              │
┌─────────────┐   gRPC-Web    │              │
│  vera-web   │──────────────▶│              │
│  管理界面    │               │              │
└─────────────┘               │              │
                              │              │
┌─────────────┐   gRPC Stream │              │
│ astra-faber │──────────────▶│              │
│  设备 SDK    │               │              │
└─────────────┘               └──────────────┘
```

## 开发指南

### 重新生成 Protobuf 代码

当 Proto 文件变更后，重新生成 TypeScript 类型：

```bash
npm run generate
```

### 项目结构

```
vera-web/
├── src/
│   ├── api/            # gRPC 客户端和生成代码
│   ├── components/     # 可复用组件（SlotEditor、属性编辑器等）
│   ├── views/          # 页面视图
│   ├── router/         # 路由配置
│   └── App.vue         # 根组件
├── vite.config.ts      # Vite 配置（含 gRPC 代理）
└── package.json
```
