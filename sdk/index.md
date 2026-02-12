# astra-faber SDK

面向边缘设备的统一 Rust SDK，集成 **Vera 物模型同步** 与 **Arca 文件管理** 两大模块。一个 crate 覆盖设备孪生、属性上报、日志录制与文件上传全场景。

## 安装

在 `Cargo.toml` 中添加依赖：

```toml
[dependencies]
astra-faber = { version = "0.1", features = ["vera", "arca"] }
tokio = { version = "1", features = ["full"] }
```

### Feature 选择

| Feature | 说明 | 默认 |
|---------|------|------|
| `vera` | 物模型同步：ThingsClient、属性上报、离线队列、Schema 校验 | 启用 |
| `arca` | 文件服务：FileClient、MCAP 录制、文件上传 | 启用 |

按需选择：

```toml
# 仅物模型（不需要文件服务）
astra-faber = { version = "0.1", features = ["vera"] }

# 仅文件服务（不需要物模型）
astra-faber = { version = "0.1", features = ["arca"] }
```

## 模块一览

### Vera 模块

| 组件 | 说明 | 文档 |
|------|------|------|
| **Client** | 数据读写客户端，Schema 定义、表/设备操作、流式查询 | [Vera Client](/sdk/vera/client) |
| **Things** | 设备孪生客户端，属性同步、离线队列、冲突解决 | [Vera Things](/sdk/vera/things) |

### Arca 模块

| 组件 | 说明 | 文档 |
|------|------|------|
| **File** | 文件上传客户端，预签名 URL、上传确认 | [Arca File](/sdk/arca/file) |
| **Recorder** | MCAP 日志录制，自动轮转、自动上传 | [Arca Recorder](/sdk/arca/recorder) |

## 快速上手

### 设备属性上报（Vera）

```rust
use astra_faber::{ThingsClient, ThingsConfig};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let config = ThingsConfig::builder()
        .server_addr("http://127.0.0.1:50051")
        .model_id("temperature_sensor")
        .device_id("sensor-001")
        .build()?;

    let client = ThingsClient::new(config).await?;
    client.connect().await?;

    client.report("temperature", 23.5f64).await?;
    client.report("humidity", 65.0f64).await?;

    client.disconnect().await;
    Ok(())
}
```

### 录制并上传 MCAP（Arca）

```rust
use astra_faber::{FileClient, McapRecorder, Uploader, DeviceClock, RotatePolicy};
use std::sync::Arc;
use std::time::Duration;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 连接 Arca 文件服务
    let file_client = FileClient::connect("http://127.0.0.1:50052").await?;
    let file_client = Arc::new(tokio::sync::Mutex::new(file_client));

    // 创建时钟和录制器
    let clock = Arc::new(DeviceClock::standalone());
    let policy = RotatePolicy::new(Duration::from_secs(300), 256 * 1024 * 1024);
    let mut recorder = McapRecorder::new(clock, policy, "robot-001");

    // 开始录制
    let recording_id = recorder.start()?;

    // 写入数据
    recorder.write_message(0, b"sensor data...")?;

    // 结束并上传
    let (data, id) = recorder.finalize()?;
    let uploader = Uploader::new(file_client, "robot-001");
    uploader.upload(&id, data, "mcap").await?;

    Ok(())
}
```

## 公共类型

### HlcTimestamp

混合逻辑时钟时间戳，用于分布式环境下的因果排序。

```rust
use astra_faber::HlcTimestamp;

let ts = HlcTimestamp::now();
println!("物理时间: {}ms, 逻辑序号: {}", ts.physical_time(), ts.logical());
```

### Error

统一错误类型，覆盖连接、配置、gRPC、校验等场景。

```rust
use astra_faber::Error;

match result {
    Err(Error::NotConnected) => println!("未连接"),
    Err(Error::Timeout) => println!("超时"),
    Err(Error::QueueFull) => println!("离线队列已满"),
    Err(e) => println!("错误: {}", e),
    Ok(_) => {}
}
```
