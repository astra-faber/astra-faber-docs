# Arca Recorder SDK

MCAP 日志录制组件，支持自动轮转策略和自动上传。适用于机器人传感器数据、ROS 消息等场景的持续录制。

## 安装

```toml
[dependencies]
astra-faber = { version = "0.1", features = ["arca"] }
tokio = { version = "1", features = ["full"] }
```

## 快速上手

```rust
use astra_faber::{FileClient, McapRecorder, Uploader, DeviceClock, RotatePolicy};
use std::sync::Arc;
use std::time::Duration;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 1. 准备依赖
    let clock = Arc::new(DeviceClock::standalone());
    let policy = RotatePolicy::new(
        Duration::from_secs(300),    // 每 5 分钟轮转
        256 * 1024 * 1024,           // 或达到 256MB 时轮转
    );

    // 2. 创建录制器
    let mut recorder = McapRecorder::new(clock, policy, "robot-001");

    // 3. 开始录制
    let recording_id = recorder.start()?;
    println!("录制开始: {}", recording_id);

    // 4. 写入数据
    for i in 0..1000 {
        let data = format!("sensor_reading_{}", i);
        // 返回 Some 表示触发了轮转，需要上传旧文件
        if let Some((mcap_bytes, old_id)) = recorder.write_message(0, data.as_bytes())? {
            println!("轮转: {} ({} bytes)", old_id, mcap_bytes.len());
            // 上传旧文件...
        }
    }

    // 5. 结束录制
    let (final_data, final_id) = recorder.finalize()?;
    println!("录制结束: {} ({} bytes)", final_id, final_data.len());

    Ok(())
}
```

## 核心 API

### DeviceClock

设备时钟，为 MCAP 录制提供纳秒级时间戳。

```rust
use astra_faber::DeviceClock;

// 独立时钟（不与 ThingsClient 共享）
let clock = DeviceClock::standalone();

// 共享 ThingsClient 的 HLC 时钟（推荐，保证时序一致）
let clock = DeviceClock::new(things_client.hlc().clone());

// 获取时间
let ns = clock.now_ns();   // 纳秒（MCAP 时间戳）
let ms = clock.now_ms();   // 毫秒
```

---

### RotatePolicy

轮转策略，定义何时将当前录制文件切分为新文件。

```rust
use astra_faber::RotatePolicy;
use std::time::Duration;

// 自定义策略
let policy = RotatePolicy::new(
    Duration::from_secs(300),     // 最长录制时间：5 分钟
    256 * 1024 * 1024,            // 最大文件大小：256 MB
);

// 默认策略（5 分钟 / 256 MB）
let policy = RotatePolicy::default();

// 检查是否需要轮转
let should_rotate = policy.should_rotate(
    Duration::from_secs(120),   // 当前录制时长
    100 * 1024 * 1024,          // 当前文件大小
);
```

**默认值**：

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `max_duration` | 5 分钟 | 单个文件最长录制时间 |
| `max_size_bytes` | 256 MB | 单个文件最大大小 |

---

### McapRecorder

MCAP 格式的日志录制器。

```rust
use astra_faber::{McapRecorder, DeviceClock, RotatePolicy};
use std::sync::Arc;

let clock = Arc::new(DeviceClock::standalone());

// 完整配置
let mut recorder = McapRecorder::new(
    clock.clone(),
    RotatePolicy::default(),
    "robot-001",              // recording_id 前缀
);

// 使用默认配置的快捷方式
let mut recorder = McapRecorder::with_defaults(clock, "robot-001");
```

#### 方法一览

| 方法 | 说明 |
|------|------|
| `start()` | 开始录制，返回 `recording_id` |
| `write_message(channel_id, data)` | 写入一条消息 |
| `finalize()` | 结束录制，返回 `(mcap_bytes, recording_id)` |
| `is_recording()` | 是否正在录制 |
| `message_count()` | 已写入的消息数 |
| `current_size()` | 当前文件大小（字节） |

---

### start

开始一个新的录制会话。

```rust
let recording_id = recorder.start()?;
// recording_id 格式："{prefix}-{timestamp}"
// 例如："robot-001-1700000000000"
```

---

### write_message

写入一条消息到当前 MCAP 文件。

```rust
let rotate_result = recorder.write_message(
    0,                     // channel_id
    b"sensor data bytes",  // data
)?;

match rotate_result {
    Some((old_data, old_id)) => {
        // 触发轮转：旧文件已完成，需要上传
        println!("文件轮转: {} ({} bytes)", old_id, old_data.len());
        // upload old_data...
    }
    None => {
        // 正常写入，无需轮转
    }
}
```

**轮转机制**：当写入后文件大小或录制时间超过 `RotatePolicy` 设定的阈值，自动触发轮转：
1. 当前 MCAP 文件被 finalize 并返回
2. 自动创建新的 MCAP 文件继续录制
3. 返回 `Some((旧文件数据, 旧录制ID))`

---

### finalize

手动结束当前录制。

```rust
let (mcap_bytes, recording_id) = recorder.finalize()?;
println!("录制结束: {} ({} 条消息, {} bytes)",
    recording_id,
    recorder.message_count(),
    mcap_bytes.len(),
);
```

---

## 完整示例：录制 + 自动上传

```rust
use astra_faber::{
    FileClient, McapRecorder, Uploader, DeviceClock, RotatePolicy,
    ThingsClient, ThingsConfig,
};
use std::sync::Arc;
use std::time::Duration;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // --- 连接 Vera（可选，用于共享时钟） ---
    let things_config = ThingsConfig::builder()
        .server_addr("http://127.0.0.1:50051")
        .model_id("robot_arm")
        .device_id("franka-001")
        .build()?;
    let things_client = ThingsClient::new(things_config).await?;
    things_client.connect().await?;

    // --- 连接 Arca ---
    let file_client = FileClient::connect("http://127.0.0.1:50052").await?;
    let file_client = Arc::new(tokio::sync::Mutex::new(file_client));

    // --- 共享时钟（Vera + Arca 时序一致） ---
    let clock = Arc::new(DeviceClock::new(things_client.hlc().clone()));

    // --- 创建录制器和上传器 ---
    let mut recorder = McapRecorder::new(
        clock,
        RotatePolicy::new(Duration::from_secs(60), 64 * 1024 * 1024),
        "franka-001",
    );
    let uploader = Uploader::new(file_client, "franka-001")
        .with_max_retries(3);

    // --- 录制循环 ---
    recorder.start()?;

    loop {
        let sensor_data = read_sensor();  // 你的传感器读取逻辑

        // 同时上报属性和录制
        things_client.report("position_x", sensor_data.x).await?;
        things_client.report("position_y", sensor_data.y).await?;

        // 写入 MCAP，处理轮转
        if let Some((data, id)) = recorder.write_message(0, &sensor_data.raw)? {
            // 轮转时自动上传旧文件
            let result = uploader.upload(&id, data, "mcap").await?;
            println!("已上传: {} (sealed={})", result.object_key, result.sealed);
        }

        tokio::time::sleep(Duration::from_millis(10)).await;
    }
}
```

---

## 错误处理

```rust
use astra_faber::Error;

match recorder.write_message(0, data) {
    Ok(Some((bytes, id))) => { /* 处理轮转 */ }
    Ok(None) => { /* 正常写入 */ }
    Err(Error::McapRecord(msg)) => eprintln!("录制错误: {}", msg),
    Err(e) => eprintln!("其他错误: {}", e),
}

match recorder.start() {
    Ok(id) => println!("录制开始: {}", id),
    Err(Error::McapRecord(msg)) => eprintln!("启动录制失败: {}", msg),
    Err(e) => eprintln!("错误: {}", e),
}
```
