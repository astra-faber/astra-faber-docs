# Client SDK

AstraFaber Client 是官方 Rust 客户端库，提供类型安全的 API 用于连接服务器、创建表/设备、写入和查询数据。支持 gRPC Streaming 高吞吐批量操作。

## 安装

在 `Cargo.toml` 中添加依赖：

```toml
[dependencies]
astra-faber-client = { path = "../crates/astra-faber-client" }
tokio = { version = "1", features = ["full"] }
```

## 快速上手

```rust
use astra_faber_client::{Client, SchemaBuilder, Table, int32_type, string_type};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 1. 连接服务器
    let mut client = Client::connect("http://127.0.0.1:50051").await?;

    // 2. 创建表
    let schema = SchemaBuilder::new()
        .add_field("id", int32_type(), None)
        .add_field("name", string_type(), None)
        .add_field("age", int32_type(), None)
        .build();
    client.create_table("users", schema.fields).await?;

    // 3. 插入数据
    let schema = SchemaBuilder::new()
        .add_field("id", int32_type(), None)
        .add_field("name", string_type(), None)
        .add_field("age", int32_type(), None)
        .build();

    let table = Table::new("users")
        .with_schema(schema)
        .add_row(astra_faber_client::row![1i32, "Alice", 30i32])?
        .add_row(astra_faber_client::row![2i32, "Bob", 25i32])?
        .build()?;

    client.insert_table(table).await?;
    Ok(())
}
```

## 核心 API

### Client

连接服务器并执行所有数据操作的入口。

```rust
use astra_faber_client::Client;

let mut client = Client::connect("http://127.0.0.1:50051").await?;
```

#### 表操作

| 方法 | 说明 |
|------|------|
| `create_table(name, fields)` | 创建表 |
| `insert_table(table)` | 插入表数据 |
| `inserter()` | 获取批量插入器 |

#### 设备操作（超级表）

| 方法 | 说明 |
|------|------|
| `create_device(device)` | 创建设备（超级表） |
| `insert_device(data)` | 插入设备数据 |
| `insert_device_stream()` | 创建流式插入通道 |
| `insert_device_stream_batches(batches)` | 流式批量插入 |

#### 查询操作

| 方法 | 说明 |
|------|------|
| `query_device_latest(name, id)` | 查询设备最新值 |
| `query_device_range(name, id, start, end, limit)` | 时间范围查询 |
| `batch_query_latest(name, ids)` | 批量查询最新值 |
| `stream_query_latest_batch(name, ids)` | 流式批量查询 |

---

### SchemaBuilder

构建表或设备的 Schema 定义。

```rust
use astra_faber_client::{SchemaBuilder, int32_type, string_type, timestamp_type};

let schema = SchemaBuilder::new()
    .add_field("id", int32_type(), None)
    .add_field("name", string_type(), None)
    .add_field("ts", timestamp_type(), None)
    .add_metadata("engine", "astra-faber")
    .build();
```

---

### Table / TableBuilder

构建表数据并插入。

```rust
use astra_faber_client::{Table, SchemaBuilder, int32_type, string_type};

let schema = SchemaBuilder::new()
    .add_field("id", int32_type(), None)
    .add_field("name", string_type(), None)
    .build();

let table = Table::new("users")
    .with_schema(schema)
    .add_row(astra_faber_client::row![1i32, "Alice"])?
    .add_row(astra_faber_client::row![2i32, "Bob"])?
    .build()?;
```

`row!` 宏支持自动推断类型，也可以使用 `RowBuilder`：

```rust
use astra_faber_client::RowBuilder;

let row = RowBuilder::new()
    .add_value(Value::I32(1))
    .add_value(Value::String("Alice".into()))
    .build();
```

---

### Device / DeviceBuilder

创建设备（超级表），其中 Tag 字段用于标识子表。

```rust
use astra_faber_client::{Device, int32_type, float64_type, string_type};

let device = Device::builder("temperature_sensor")
    .add_tag("device_id", string_type())
    .add_tag("location", string_type())
    .add_property("temperature", float64_type())
    .add_property("humidity", float64_type())
    .build()?;

client.create_device(device).await?;
```

---

### DeviceData / DeviceDataBuilder

构建设备数据并插入。

```rust
use astra_faber_client::{DeviceData, Value};

let data = DeviceData::builder("temperature_sensor")
    .add_row(
        vec![Value::String("sensor-001".into()), Value::String("room-a".into())],
        vec![Value::F64(23.5), Value::F64(65.0)],
    )?
    .add_row(
        vec![Value::String("sensor-002".into()), Value::String("room-b".into())],
        vec![Value::F64(24.1), Value::F64(58.3)],
    )?
    .build()?;

client.insert_device(data).await?;
```

---

### Value

值类型枚举，支持所有 AstraFaber 数据类型。

```rust
use astra_faber_client::Value;

let values = vec![
    Value::I32(42),
    Value::I64(1_000_000),
    Value::F32(3.14),
    Value::F64(2.71828),
    Value::Bool(true),
    Value::String("hello".into()),
    Value::Binary(vec![0x01, 0x02, 0x03]),
    Value::TimestampNanosecond(1_700_000_000_000_000_000),
];
```

**Struct 值**：

```rust
use astra_faber_client::{Value, struct_value};

let point = struct_value! {
    "x" => Value::F64(1.0),
    "y" => Value::F64(2.0),
    "z" => Value::F64(3.0),
};
```

---

## 流式操作

### Streaming 插入

使用 gRPC 客户端流实现高吞吐写入：

```rust
// 方式一：通过 channel 发送
let (tx, handle) = client.insert_device_stream().await?;

for batch in data_batches {
    tx.send(batch).await?;
}
drop(tx); // 关闭发送端
let response = handle.await??;
println!("插入 {} 行", response.total_rows);
```

```rust
// 方式二：一次性批量发送
let batches: Vec<DeviceData> = prepare_data();
let response = client.insert_device_stream_batches(batches).await?;
```

### Streaming 查询

```rust
// 批量流式查询最新值
let responses = client.stream_query_latest_batch(
    "temperature_sensor",
    vec!["sensor-001", "sensor-002", "sensor-003"],
).await?;

for resp in responses {
    println!("{}: {:?}", resp.device_id, resp.columns);
}
```

---

## 类型辅助函数

| 函数 | 对应类型 |
|------|----------|
| `int32_type()` | Int32 |
| `int64_type()` | Int64 |
| `float32_type()` | Float32 |
| `float64_type()` | Float64 |
| `string_type()` | UTF-8 字符串 |
| `bool_type()` | Boolean |
| `binary_type()` | Binary |
| `timestamp_type()` | Timestamp (纳秒) |
| `date_type()` | Date32 |
| `enum8_type(names)` | Enum8 枚举 |
| `enum16_type(names)` | Enum16 枚举 |
| `tuple_type(names, types)` | Tuple 元组 |

### 枚举类型示例

```rust
use astra_faber_client::{enum8_type, enum8_type_with_values};

// 自动编号
let status = enum8_type(vec!["active", "inactive", "deleted"]);

// 手动指定值
let priority = enum8_type_with_values(vec![
    ("low", 1),
    ("medium", 5),
    ("high", 10),
]);
```

---

## HLC 时间戳

混合逻辑时钟（Hybrid Logical Clock）用于分布式环境下的因果排序。

```rust
use astra_faber_client::{HlcTimestamp, ClientHlcManager};

// 客户端 HLC 管理器（按子表独立管理）
let hlc_manager = ClientHlcManager::new();

// 获取当前 HLC
let ts = hlc_manager.now("temperature_sensor", "sensor-001");
println!("物理时间: {}ms, 逻辑序号: {}", ts.physical_time(), ts.logical());

// 接收服务端 HLC 并同步
hlc_manager.receive("temperature_sensor", "sensor-001", server_hlc);

// 带 HLC 的数据插入
let data = DeviceData::builder("temperature_sensor")
    .add_row_with_hlc(
        tag_values,
        property_values,
        hlc_manager.now("temperature_sensor", "sensor-001").as_u64(),
    )?
    .build()?;
```

---

## 错误处理

```rust
use astra_faber_client::Error;

match client.create_table("users", fields).await {
    Ok(()) => println!("创建成功"),
    Err(Error::InvalidArgument(msg)) => eprintln!("参数错误: {}", msg),
    Err(Error::ConnectionError(msg)) => eprintln!("连接失败: {}", msg),
    Err(Error::GrpcError(status)) => eprintln!("gRPC 错误: {}", status),
    Err(Error::BuildError(msg)) => eprintln!("构建错误: {}", msg),
}
```
