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

---

## 实战示例：机械臂 + 摄像头 Slot

以下是一个完整的端到端示例，演示如何：

1. 使用管理端 gRPC 创建 InterfaceType、ComponentModel 和 ThingModel（含 Slot）
2. 注册设备并绑定 Slot 组件
3. 使用 astra-faber SDK 上报根属性和 Slot 属性
4. 通过 gRPC 查询验证设备状态

也可以使用 [vera-web 管理界面](/tools/vera-web) 可视化完成步骤 1-2 的配置。

### 场景描述

- **物模型**：机械臂（`robot_arm`），包含根属性 `joint_angle`、`control_mode`
- **Slot**：腕部相机插槽（`camera_slot`），兼容 `camera_port@>=1.0` 接口
- **组件**：Nikon Z8 相机，实现 `camera_port@1.0` 接口，扩展 `iso` 属性

### 依赖配置

```toml
[dependencies]
astra-faber = { version = "0.1", features = ["vera"] }
vera-api = "0.1"        # gRPC 管理端 API
vera-client = "0.1"     # 类型辅助函数
tonic = "0.14"
tokio = { version = "1", features = ["full"] }
chrono = "0.4"
tracing = "0.1"
tracing-subscriber = "0.3"
```

### Step 1: 创建接口类型（InterfaceType）

InterfaceType 定义了组件的标准契约。这里定义一个相机接口，包含分辨率、帧率等必需属性。

```rust
use vera_api::things::*;
use vera_client::{int32_type, float32_type};

fn build_camera_interface_type() -> InterfaceTypeDef {
    InterfaceTypeDef {
        interface_type_id: "camera_port".to_string(),
        version: "1.0".to_string(),
        category: "sensor".to_string(),
        required_properties: vec![
            PropertyDef {
                name: "分辨率宽度".into(),
                identifier: "resolution_width".into(),
                data_type: Some(int32_type()),
                access_mode: AccessMode::ReadOnly as i32,
                description: Some("图像宽度（像素）".into()),
                unit: Some("px".into()),
                ..Default::default()
            },
            PropertyDef {
                name: "分辨率高度".into(),
                identifier: "resolution_height".into(),
                data_type: Some(int32_type()),
                access_mode: AccessMode::ReadOnly as i32,
                description: Some("图像高度（像素）".into()),
                unit: Some("px".into()),
                ..Default::default()
            },
            PropertyDef {
                name: "帧率".into(),
                identifier: "fps".into(),
                data_type: Some(float32_type()),
                access_mode: AccessMode::ReadOnly as i32,
                description: Some("每秒帧数".into()),
                unit: Some("fps".into()),
                ..Default::default()
            },
        ],
        optional_properties: vec![],
        capabilities: vec!["capture".into(), "stream".into()],
        description: Some("相机接口标准契约".into()),
        ..Default::default()
    }
}
```

### Step 2: 创建组件模型（ComponentModel）

ComponentModel 代表具体的硬件产品，通过 Port 声明实现了哪些接口。

```rust
fn build_nikon_z8_component() -> ComponentModelDef {
    ComponentModelDef {
        vendor: "nikon".into(),
        model_id: "z8".into(),
        model_name: "Nikon Z8".into(),
        version: "1.0".into(),
        ports: vec![PortDef {
            port_id: "camera".into(),
            implements: "camera_port@1.0".into(),
            // 扩展属性：Nikon 特有的 ISO 设置
            extended_properties: vec![PropertyDef {
                name: "ISO 感光度".into(),
                identifier: "iso".into(),
                data_type: Some(int32_type()),
                access_mode: AccessMode::ReadWrite as i32,
                description: Some("ISO 值".into()),
                ..Default::default()
            }],
        }],
        physical_specs: Some(PhysicalSpecs {
            weight_kg: Some(0.91),
            mounting_pattern: Some("1/4-20 tripod".into()),
        }),
        description: Some("Nikon Z8 全画幅无反相机".into()),
    }
}
```

### Step 3: 创建物模型（ThingModel）+ Slot

物模型定义了机械臂的根属性和 Slot 插槽。`default_bindings` 指定出厂预装的组件。

```rust
use vera_client::{float64_type, string_type};

fn build_robot_arm_model() -> ThingModelDef {
    ThingModelDef {
        model_id: "e2e_robot_arm".into(),
        model_name: "E2E 测试机械臂".into(),
        version: 1,
        properties: vec![
            PropertyDef {
                name: "关节角度".into(),
                identifier: "joint_angle".into(),
                data_type: Some(float64_type()),
                access_mode: AccessMode::ReadOnly as i32,
                description: Some("当前关节角度（度）".into()),
                unit: Some("deg".into()),
                ..Default::default()
            },
            PropertyDef {
                name: "控制模式".into(),
                identifier: "control_mode".into(),
                data_type: Some(string_type()),
                access_mode: AccessMode::ReadWrite as i32,
                description: Some("控制模式：position / velocity / torque".into()),
                ..Default::default()
            },
        ],
        // 定义相机 Slot
        slots: vec![SlotDef {
            slot_id: "camera_slot".into(),
            name: "腕部相机".into(),
            required: false,
            compatible_interfaces: vec!["camera_port@>=1.0".into()],
            constraints: Some(SlotConstraints {
                max_payload_kg: Some(2.0),
                mounting_pattern: Some("1/4-20 tripod".into()),
            }),
            description: Some("安装在机械臂腕部的相机插槽".into()),
        }],
        // 默认绑定：出厂预装 Nikon Z8
        default_bindings: vec![SlotBinding {
            slot_id: "camera_slot".into(),
            component_model_id: "nikon_z8@1.0".into(),
            port_id: "camera".into(),
            component_instance_id: Some("nikon-z8-sn-001".into()),
            bound_at: 0,
        }],
        ..Default::default()
    }
}
```

### Step 4: 管理端注册 — 通过 gRPC 调用

```rust
use tonic::transport::Channel;
use vera_api::things::{
    things_service_client::ThingsServiceClient,
    interface_type_service_client::InterfaceTypeServiceClient,
    component_model_service_client::ComponentModelServiceClient,
    CreateInterfaceTypeReq, CreateComponentModelReq,
    CreateThingModelReq, RegisterDeviceReq, BindSlotReq,
};

const SERVER_ADDR: &str = "http://127.0.0.1:50051";

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let channel = Channel::from_static(SERVER_ADDR).connect().await?;

    // 创建 InterfaceType
    let mut iface_client = InterfaceTypeServiceClient::new(channel.clone());
    iface_client.create_interface_type(CreateInterfaceTypeReq {
        interface_type: Some(build_camera_interface_type()),
    }).await?;

    // 创建 ComponentModel
    let mut comp_client = ComponentModelServiceClient::new(channel.clone());
    comp_client.create_component_model(CreateComponentModelReq {
        component_model: Some(build_nikon_z8_component()),
    }).await?;

    // 创建 ThingModel
    let mut things_client = ThingsServiceClient::new(channel.clone());
    things_client.create_thing_model(CreateThingModelReq {
        model: Some(build_robot_arm_model()),
    }).await?;

    // 注册设备
    things_client.register_device(RegisterDeviceReq {
        model_id: "e2e_robot_arm".into(),
        device_id: "arm-001".into(),
        device_name: Some("机械臂 #001".into()),
    }).await?;

    // 绑定 Slot
    things_client.bind_slot(BindSlotReq {
        model_id: "e2e_robot_arm".into(),
        device_id: "arm-001".into(),
        binding: Some(SlotBinding {
            slot_id: "camera_slot".into(),
            component_model_id: "nikon_z8@1.0".into(),
            port_id: "camera".into(),
            component_instance_id: Some("nikon-z8-sn-001".into()),
            bound_at: chrono::Utc::now().timestamp_millis(),
        }),
    }).await?;

    println!("管理端配置完成！");
    Ok(())
}
```

::: tip
上述管理端操作也可以通过 [vera-web](/tools/vera-web) 界面完成，无需编写代码。
:::

### Step 5: 设备端 — SDK 上报属性

设备端使用 `astra-faber` SDK 连接服务器，上报根属性和 Slot 属性。

```rust
use astra_faber::{ThingsClient, vera::ThingsConfig};
use std::time::Duration;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 配置 SDK
    let config = ThingsConfig::builder()
        .server_addr("http://127.0.0.1:50051")
        .model_id("e2e_robot_arm")
        .device_id("arm-001")
        .auto_fetch_schema(true)
        .build()?;

    // 创建客户端并连接
    let client = ThingsClient::new(config).await?;
    client.connect().await?;

    // 等待 Schema 同步
    tokio::time::sleep(Duration::from_millis(500)).await;
    println!("Schema 版本: {}", client.schema_version());

    // 上报根属性
    client.report("joint_angle", 45.0f64).await?;
    client.report("control_mode", "position").await?;

    // 上报 Slot 属性（接口标准属性）
    client.report_slot("camera_slot", "resolution_width", 8256i32).await?;
    client.report_slot("camera_slot", "resolution_height", 5504i32).await?;
    client.report_slot("camera_slot", "fps", 30.0f32).await?;

    // 上报 Slot 扩展属性（Nikon 特有）
    client.report_slot("camera_slot", "iso", 800i32).await?;

    println!("属性上报完成！");
    client.disconnect().await;
    Ok(())
}
```

### Step 6: 查询验证 — GetDeviceState

通过 gRPC 查询设备状态，验证上报数据。

```rust
use vera_api::things::{
    things_service_client::ThingsServiceClient,
    GetDeviceStateReq,
};

let mut things_client = ThingsServiceClient::new(channel);
let state = things_client.get_device_state(GetDeviceStateReq {
    model_id: "e2e_robot_arm".into(),
    device_id: "arm-001".into(),
}).await?.into_inner();

// 根属性
for prop in &state.root_properties {
    println!("{}: {:?}", prop.identifier, prop.reported);
}
// 输出:
//   joint_angle: Some(Value { f64_value: 45.0 })
//   control_mode: Some(Value { string_value: "position" })

// Slot 属性
for slot in &state.slot_states {
    println!("Slot: {}", slot.slot_id);
    for prop in &slot.properties {
        println!("  {}: {:?}", prop.identifier, prop.reported);
    }
}
// 输出:
//   Slot: camera_slot
//     resolution_width: Some(Value { i32_value: 8256 })
//     resolution_height: Some(Value { i32_value: 5504 })
//     fps: Some(Value { f32_value: 30.0 })
//     iso: Some(Value { i32_value: 800 })
```

::: info 完整代码
完整的 E2E 测试代码位于仓库 `tests/e2e/tests/e2e_slot_test.rs`，可直接运行：
```bash
# 先启动 Vera 服务端
cargo run -p vera

# 运行 E2E 测试
cargo test -p e2e-tests --test e2e_slot_test -- --ignored --nocapture
```
:::
