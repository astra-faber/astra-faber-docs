---
layout: home
hero:
  name: AstraFaber
  text: 高性能实时数据库
  tagline: 基于 Apache Arrow 构建，面向 IoT 与边缘计算的列式存储引擎。gRPC Streaming 通信，设备孪生，毫秒级响应。
  image:
    src: /logo.svg
    alt: AstraFaber
  actions:
    - theme: brand
      text: 快速开始
      link: /sdk/client
    - theme: alt
      text: Twin SDK
      link: /sdk/twin

features:
  - icon: "\u26A1"
    title: 极致写入性能
    details: 子表级无锁并发写入，双 MemTable + WAL 批量刷盘，gRPC Streaming 实现 175 万行/秒吞吐。
  - icon: "\uD83D\uDD17"
    title: 设备孪生
    details: 完整的物模型定义、期望/实际属性同步、离线队列、冲突解决，为每个设备维护云端数字镜像。
  - icon: "\uD83D\uDCE1"
    title: gRPC Streaming
    details: 原生支持客户端流、服务端流和双向流，批量插入与查询性能提升数倍，延迟低至 48μs。
  - icon: "\uD83D\uDEE1\uFE0F"
    title: 类型安全
    details: Rust 编写，编译期类型检查。支持 Enum8/16、Struct、Geometry 等丰富类型系统，零拷贝序列化。
  - icon: "\uD83D\uDD04"
    title: 离线同步
    details: SDK 内置离线队列与本地缓存，断网自动暂存，恢复连接后自动同步，HLC 混合逻辑时钟保证时序。
  - icon: "\uD83D\uDD0D"
    title: DataFusion 集成
    details: 内置 Apache DataFusion 查询引擎，支持 SQL 查询、自定义表达式和查询优化。
---

<div class="performance-section">

<h2 style="font-size:1.6rem;font-weight:700;text-align:center;margin-bottom:0.5rem;background:linear-gradient(135deg,#7c3aed,#2563eb);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">核心性能指标</h2>
<p style="text-align:center;color:var(--vp-c-text-3);margin-bottom:1.5rem;font-size:0.95rem;">实测数据 · Intel i7 / 32GB RAM / SSD</p>

<div class="performance-grid">
  <div class="perf-card">
    <div class="number">175万</div>
    <div class="label">行/秒 写入</div>
    <div class="sub">gRPC Streaming · 100 设备</div>
  </div>
  <div class="perf-card">
    <div class="number">207万</div>
    <div class="label">QPS 查询</div>
    <div class="sub">Streaming · 100 连接 · 48μs 延迟</div>
  </div>
  <div class="perf-card">
    <div class="number">73.5万</div>
    <div class="label">行/秒 大规模写入</div>
    <div class="sub">gRPC Streaming · 10 万设备</div>
  </div>
</div>

</div>

<div class="quickstart-section">

## 快速开始

**1. 启动服务器**

```bash
cargo run --release
# AstraFaber Server listening on 127.0.0.1:50051
```

**2. 连接并写入数据**

```rust
use astra_faber_client::{Client, SchemaBuilder, Table, int32_type, string_type};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 连接服务器
    let mut client = Client::connect("http://127.0.0.1:50051").await?;

    // 定义 Schema
    let schema = SchemaBuilder::new()
        .add_field("id", int32_type(), None)
        .add_field("name", string_type(), None)
        .build();

    // 创建表
    client.create_table("users", schema.fields).await?;

    // 插入数据
    let table = Table::new("users")
        .with_schema(schema)
        .add_row(astra_faber_client::row![1i32, "Alice"])?
        .add_row(astra_faber_client::row![2i32, "Bob"])?
        .build()?;

    client.insert_table(table).await?;
    Ok(())
}
```

</div>
