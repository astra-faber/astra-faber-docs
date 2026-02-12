# Vera Things SDK

设备孪生客户端，运行在边缘设备上，为每个设备维护本地属性缓存、离线队列和 Schema 校验，通过 gRPC 双向流与云端实时同步。

## 安装

```toml
[dependencies]
astra-faber = { version = "0.1", features = ["vera"] }
tokio = { version = "1", features = ["full"] }
```

## 快速上手

```rust
use astra_faber::{ThingsClient, ThingsConfig};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 1. 配置
    let config = ThingsConfig::builder()
        .server_addr("http://127.0.0.1:50051")
        .model_id("temperature_sensor")
        .device_id("sensor-001")
        .device_name("温度传感器 #1")
        .build()?;

    // 2. 创建客户端并连接
    let client = ThingsClient::new(config).await?;
    client.connect().await?;

    // 3. 上报属性
    client.report("temperature", 23.5f64).await?;
    client.report("humidity", 65.0f64).await?;

    // 4. 读取期望值
    if let Some(desired) = client.get_desired("temperature") {
        println!("期望温度: {}", desired.to_string_repr());
    }

    Ok(())
}
```

## 核心 API

### ThingsConfig / ThingsConfigBuilder

使用 Builder 模式配置 SDK。

```rust
use astra_faber::{ThingsConfig, PersistenceConfig};

let config = ThingsConfig::builder()
    .server_addr("http://127.0.0.1:50051")
    .model_id("robot_arm")
    .device_id("franka-001")
    .device_name("Franka Emika Panda")
    // 心跳与重连
    .heartbeat_interval_secs(30)
    .reconnect_interval_secs(5)
    .max_reconnect_attempts(10)
    // 离线队列
    .max_offline_queue_size(10000)
    // 批量上报
    .batch_report_threshold(50)
    .batch_report_interval_ms(100)
    // 持久化
    .file_persistence("./things_data")
    // 校验
    .validate_before_report(true)
    .auto_fetch_schema(true)
    .build()?;
```

**配置项一览**：

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `server_addr` | 必填 | 服务端地址 |
| `model_id` | 必填 | 物模型 ID |
| `device_id` | 必填 | 设备唯一标识 |
| `device_name` | `""` | 设备显示名称 |
| `heartbeat_interval_secs` | `30` | 心跳间隔（秒） |
| `reconnect_interval_secs` | `5` | 重连间隔（秒） |
| `max_reconnect_attempts` | `0`（无限） | 最大重连次数 |
| `max_offline_queue_size` | `10000` | 离线队列容量 |
| `batch_report_threshold` | `50` | 批量上报阈值 |
| `batch_report_interval_ms` | `100` | 批量上报间隔（毫秒） |
| `validate_before_report` | `false` | 上报前是否校验 |
| `auto_fetch_schema` | `true` | 连接时自动拉取 Schema |

---

### ThingsClient

SDK 的核心客户端，封装连接管理、属性操作、Slot 操作和 Schema 管理。

#### 连接管理

```rust
let client = ThingsClient::new(config).await?;

// 连接 / 断开
client.connect().await?;
client.disconnect().await;

// 状态检查
client.is_connected();     // TCP 连接是否建立
client.is_online();         // 双向流是否活跃
client.connection_state();  // ConnectionState 枚举
```

**ConnectionState** 状态流转：

| 状态 | 说明 |
|------|------|
| `Disconnected` | 未连接 |
| `Connecting` | 连接中 |
| `Connected` | TCP 已建立 |
| `Syncing` | 同步初始状态 |
| `Online` | 双向流活跃 |
| `Reconnecting` | 重连中 |

#### 属性上报

```rust
// 单个上报
client.report("temperature", 23.5f64).await?;
client.report("status", "running").await?;
client.report("enabled", true).await?;

// 批量上报
client.report_batch(vec![
    ("temperature", PropertyValue::Float64(23.5)),
    ("humidity", PropertyValue::Float64(65.0)),
    ("pressure", PropertyValue::Float64(1013.25)),
]).await?;
```

#### 属性读取

```rust
// 读取已上报值
let temp = client.get_reported("temperature");

// 读取期望值（云端下发）
let desired = client.get_desired("temperature");

// 读取完整状态（包含版本、同步状态）
let state = client.get_state("temperature");
if let Some(s) = state {
    println!("已上报: {:?}", s.reported);
    println!("期望值: {:?}", s.desired);
    println!("同步状态: {:?}", s.sync_status);
}

// 获取所有属性状态
let all_states = client.get_all_states();

// 获取待同步 / 冲突的属性
let pending = client.get_pending_properties();
let conflicts = client.get_conflict_properties();
```

#### Slot 操作

Slot 是物模型的组件化扩展，一个设备可以挂载多个子组件（如机械臂的关节）。

```rust
// Slot 属性上报
client.report_slot("joint_1", "angle", 45.0f64).await?;
client.report_slot("joint_1", "torque", 12.5f64).await?;

// Slot 批量上报
client.report_slot_batch("joint_1", vec![
    ("angle", PropertyValue::Float64(45.0)),
    ("velocity", PropertyValue::Float64(1.2)),
    ("torque", PropertyValue::Float64(12.5)),
]).await?;

// 读取 Slot 数据
let angle = client.get_slot_reported("joint_1", "angle");
let desired = client.get_slot_desired("joint_1", "angle");

// 枚举所有 Slot
let slot_ids = client.get_slot_ids();   // Vec<String>
let slots = client.get_slots();          // Vec<LocalSlotDef>
let slot = client.get_slot("joint_1");   // Option<LocalSlotDef>
```

#### Schema 管理

```rust
// 获取物模型定义
let model = client.schema();           // Option<ThingModelDef>
let version = client.schema_version(); // u64
let loaded = client.is_schema_loaded();

// 查询属性定义
let prop_def = client.get_property_def("temperature");
let all_paths = client.get_property_paths(); // Vec<String>

// 强制刷新 Schema
client.refresh_schema().await?;
```

---

### PropertyValue

属性值类型枚举。

```rust
use astra_faber::PropertyValue;

let values = vec![
    PropertyValue::Null,
    PropertyValue::Bool(true),
    PropertyValue::Int32(42),
    PropertyValue::Int64(1_000_000),
    PropertyValue::Float32(3.14),
    PropertyValue::Float64(2.71828),
    PropertyValue::String("hello".into()),
    PropertyValue::Binary(vec![0x01, 0x02]),
];

// 类型转换
let v = PropertyValue::Float64(23.5);
assert_eq!(v.as_f64(), Some(23.5));
assert_eq!(v.is_null(), false);
assert_eq!(v.to_string_repr(), "23.5");
```

**自动类型转换**：`report` 方法接受 `impl Into<PropertyValue>`，以下类型可直接传入：

| Rust 类型 | PropertyValue |
|-----------|---------------|
| `bool` | `Bool` |
| `i32` | `Int32` |
| `i64` | `Int64` |
| `f32` | `Float32` |
| `f64` | `Float64` |
| `&str` / `String` | `String` |
| `Vec<u8>` | `Binary` |

---

## 高级功能

### Schema 校验

在上报前自动校验值的类型和权限。

```rust
// 启用校验
client.set_validate_before_report(true);

// 手动校验
match client.validate("temperature", &PropertyValue::Float64(23.5)) {
    Ok(()) => println!("校验通过"),
    Err(ValidationError::TypeMismatch { property, expected, actual }) => {
        eprintln!("{}: 期望 {}, 实际 {}", property, expected, actual);
    }
    Err(ValidationError::ReadOnly(prop)) => {
        eprintln!("{} 是只读属性", prop);
    }
    Err(ValidationError::PropertyNotFound(prop)) => {
        eprintln!("属性 {} 不存在", prop);
    }
    _ => {}
}

// 批量校验
let results = client.validate_batch(&[
    ("temperature", PropertyValue::Float64(23.5)),
    ("status", PropertyValue::String("active".into())),
]);
```

---

### 冲突解决

当云端期望值与本地上报值产生冲突时，通过冲突解决策略处理。

```rust
use astra_faber::{
    ConflictResolver, ConflictType, ConflictResolution,
    DefaultConflictResolver, LastWriteWinsResolver,
    DesiredFirstResolver, CallbackResolver,
};

// 内置策略
let config = ThingsConfig::builder()
    .conflict_resolver(Arc::new(DefaultConflictResolver))  // HLC 最后写入者胜出
    // .conflict_resolver(Arc::new(DesiredFirstResolver))  // 期望值优先
    .build()?;

// 自定义回调
let config = ThingsConfig::builder()
    .conflict_resolver(Arc::new(CallbackResolver::new(|conflict| {
        match conflict {
            ConflictType::DesiredVsLocalPending { property_path, .. } => {
                println!("属性 {} 冲突", property_path);
                ConflictResolution::AcceptDesired
            }
            ConflictType::DesiredVsReported { .. } => {
                ConflictResolution::Defer // 延迟处理
            }
        }
    })))
    .build()?;
```

**冲突解决选项**：

| 策略 | 说明 |
|------|------|
| `AcceptDesired` | 接受云端期望值 |
| `AcceptLocal` | 保留本地值 |
| `Custom(value)` | 使用自定义值 |
| `Defer` | 延迟处理，不立即解决 |

---

### 离线队列

断网时自动将上报数据暂存到队列，恢复连接后自动重发。

```rust
// 查询队列状态
let queue_len = client.offline_queue_len().await;
let has_pending = client.has_pending_data().await;

println!("离线队列中有 {} 条待发送数据", queue_len);
```

配合持久化使用，可保证数据不丢失：

```rust
let config = ThingsConfig::builder()
    .max_offline_queue_size(50000)
    .file_persistence("./things_data")  // 队列持久化到文件
    .build()?;
```

---

### 持久化

支持将本地缓存和离线队列持久化，设备重启后自动恢复。

```rust
// 内存持久化（默认，重启丢失）
let config = ThingsConfig::builder()
    .persistence(PersistenceConfig::None)
    .build()?;

// 文件持久化（推荐生产使用）
let config = ThingsConfig::builder()
    .file_persistence("./things_data")
    .build()?;
```

也可实现自定义持久化：

```rust
use astra_faber::{Persistence, OfflineQueue, LocalCache};

struct MyPersistence;

impl Persistence for MyPersistence {
    fn save_queue(&self, queue: &OfflineQueue) -> Result<()> { /* ... */ }
    fn load_queue(&self) -> Result<OfflineQueue> { /* ... */ }
    fn save_cache(&self, cache: &LocalCache) -> Result<()> { /* ... */ }
    fn load_cache(&self) -> Result<LocalCache> { /* ... */ }
    fn clear(&self) -> Result<()> { /* ... */ }
}
```

---

### HLC 混合逻辑时钟

SDK 内置 HLC 实现，用于分布式环境下的因果排序和版本管理。

```rust
// 获取当前 HLC 时间戳
let ts = client.now();
println!("物理时间: {}ms", ts.physical_time());
println!("逻辑序号: {}", ts.logical());
println!("编码值: {}", ts.as_u64());

// 读取当前值（不递增）
let current = client.current_hlc();

// 从编码值恢复
let restored = HlcTimestamp::from_u64(ts.as_u64());
assert_eq!(ts, restored);

// 零值判断
let zero = HlcTimestamp::zero();
assert!(zero.is_zero());
```

HLC 特性：

- **物理时间 + 逻辑计数器**，兼顾时间精度和因果顺序
- 自动与服务端 HLC 同步，接收服务端时间戳时校准本地时钟
- 单调递增，即使本地时钟回拨也能保证顺序
- 编码为 `u64`：高 48 位为毫秒时间戳，低 16 位为逻辑计数器
