---
layout: home
hero:
  name: AstraFaber
  text: IoT & Robotics Platform
  tagline: 面向物联网与机器人的统一平台。设备建模、数据管理、文件服务与数字孪生，一站式解决方案。
  image:
    src: /logo.svg
    alt: AstraFaber
  actions:
    - theme: brand
      text: 快速开始
      link: /sdk/
    - theme: alt
      text: Vera SDK
      link: /sdk/vera/things
    - theme: alt
      text: Arca SDK
      link: /sdk/arca/file

features:
  - icon: "\uD83C\uDFD7\uFE0F"
    title: 设备建模
    details: 灵活的物模型定义，支持属性、事件、动作、子模型和组件化 Slot 扩展，轻松描述复杂设备。
  - icon: "\uD83D\uDD17"
    title: 设备孪生
    details: 为每个设备维护云端数字镜像，期望/实际属性双向同步，冲突自动解决。
  - icon: "\uD83D\uDCC1"
    title: 文件管理
    details: MCAP 日志录制与上传，预签名 URL 安全传输，自动轮转策略，适配机器人与 IoT 场景。
  - icon: "\uD83D\uDD04"
    title: 离线优先
    details: SDK 内置离线队列与本地缓存，断网自动暂存，恢复连接后自动同步，数据零丢失。
  - icon: "\u26A1"
    title: 高性能
    details: 百万级设备接入，毫秒级属性同步，gRPC 双向流通信，175 万行/秒写入吞吐。
  - icon: "\uD83D\uDEE1\uFE0F"
    title: 类型安全
    details: Rust 编写，编译期类型检查。Schema 校验保障数据质量，丰富类型系统覆盖各类场景。
---

<div class="products-section">

<h2 class="section-title">产品矩阵</h2>
<p class="section-desc">四大产品协同，覆盖设备管理、文件存储、数字孪生与仿真全链路</p>

<div class="products-grid">
  <a class="product-card" href="/sdk/vera/things">
    <div class="product-icon">🏛️</div>
    <div class="product-info">
      <h3>Vera</h3>
      <span class="product-badge active">物模型平台</span>
      <p>设备建模与管理，物模型定义，属性双向同步，支持海量设备接入与毫秒级响应。</p>
    </div>
  </a>
  <a class="product-card" href="/sdk/arca/file">
    <div class="product-icon">📦</div>
    <div class="product-info">
      <h3>Arca</h3>
      <span class="product-badge active">文件服务</span>
      <p>文件上传与管理，MCAP 日志录制，预签名安全传输，自动轮转与断点续传。</p>
    </div>
  </a>
  <div class="product-card coming-soon">
    <div class="product-icon">👁️</div>
    <div class="product-info">
      <h3>Anima</h3>
      <span class="product-badge soon">即将推出</span>
      <p>数字孪生引擎，3D 实时可视化，场景记录与回放，支持浏览器端运行。</p>
    </div>
  </div>
  <div class="product-card coming-soon">
    <div class="product-icon">🌌</div>
    <div class="product-info">
      <h3>Cosmo</h3>
      <span class="product-badge soon">即将推出</span>
      <p>仿真平台，物理模拟与场景测试，与 Anima 深度集成，加速开发验证流程。</p>
    </div>
  </div>
</div>

</div>

<div class="performance-section">

<h2 class="section-title">核心性能指标</h2>
<p class="section-desc">实测数据 · Intel i7 / 32GB RAM / SSD</p>

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

**安装 SDK**

```toml
[dependencies]
astra-faber = { version = "0.1", features = ["vera", "arca"] }
tokio = { version = "1", features = ["full"] }
```

**上报设备属性**

```rust
use astra_faber::{ThingsClient, ThingsConfig, PropertyValue};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let config = ThingsConfig::builder()
        .server_addr("http://127.0.0.1:50051")
        .model_id("temperature_sensor")
        .device_id("sensor-001")
        .build()?;

    let client = ThingsClient::new(config).await?;
    client.connect().await?;

    // 上报属性
    client.report("temperature", 23.5f64).await?;
    client.report("humidity", 65.0f64).await?;

    // 读取云端期望值
    if let Some(desired) = client.get_desired("temperature") {
        println!("期望温度: {}", desired.to_string_repr());
    }

    Ok(())
}
```

</div>
