# Arca File SDK

文件上传客户端，通过预签名 URL 实现安全的文件传输。支持 MCAP 日志、图片等多种文件类型的上传、确认与读取。

## 安装

```toml
[dependencies]
astra-faber = { version = "0.1", features = ["arca"] }
tokio = { version = "1", features = ["full"] }
```

## 快速上手

```rust
use astra_faber::{FileClient, Uploader};
use std::sync::Arc;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 1. 连接 Arca 文件服务
    let mut file_client = FileClient::connect("http://127.0.0.1:50052").await?;

    // 2. 请求上传 URL
    let url_info = file_client.request_upload_url(
        "robot-001",        // device_id
        "rec-20240101",     // recording_id
        "mcap",             // asset_type
        1024 * 1024,        // estimated_size (bytes)
    ).await?;

    println!("上传地址: {}", url_info.presigned_url);
    println!("对象键: {}", url_info.object_key);

    // 3. 通过预签名 URL 上传文件（HTTP PUT）
    let data = std::fs::read("recording.mcap")?;
    let resp = reqwest::Client::new()
        .put(&url_info.presigned_url)
        .body(data)
        .send()
        .await?;
    let etag = resp.headers()
        .get("etag")
        .unwrap()
        .to_str()?
        .to_string();

    // 4. 确认上传完成
    let result = file_client.confirm_upload(
        "rec-20240101",
        &url_info.object_key,
        &etag,
    ).await?;

    if result.is_sealed() {
        println!("上传已封存");
    }

    Ok(())
}
```

## 核心 API

### FileClient

文件服务的 gRPC 客户端。

```rust
use astra_faber::FileClient;

// 通过地址连接
let mut client = FileClient::connect("http://127.0.0.1:50052").await?;
```

#### 方法一览

| 方法 | 说明 |
|------|------|
| `connect(addr)` | 连接 Arca 文件服务 |
| `request_upload_url(device_id, recording_id, asset_type, size)` | 获取预签名上传 URL |
| `confirm_upload(recording_id, object_key, etag)` | 确认上传完成 |
| `get_read_url(recording_id)` | 获取预签名下载 URL |
| `abort_upload(recording_id, reason)` | 取消上传 |

---

### request_upload_url

请求一个预签名 PUT URL，用于直接上传文件到对象存储。

```rust
let url_info = client.request_upload_url(
    "robot-001",     // device_id: 设备标识
    "rec-001",       // recording_id: 录制 ID
    "mcap",          // asset_type: 文件类型（mcap / image / log）
    10 * 1024 * 1024, // estimated_size: 预估大小（字节）
).await?;
```

返回 `UploadUrlInfo`：

| 字段 | 类型 | 说明 |
|------|------|------|
| `presigned_url` | `String` | 预签名 PUT URL |
| `object_key` | `String` | 对象存储中的键 |
| `expires_at` | `i64` | URL 过期时间戳 |

---

### confirm_upload

上传完成后，调用此方法通知服务端进行封存和元数据关联。

```rust
let result = client.confirm_upload(
    "rec-001",        // recording_id
    &url_info.object_key, // object_key
    &etag,            // etag: 上传返回的 ETag
).await?;

if result.is_sealed() {
    println!("文件已封存: {}", result.message);
}
```

返回 `ConfirmResult`：

| 方法 | 说明 |
|------|------|
| `is_sealed()` | 是否封存成功 |
| `is_failed()` | 是否封存失败 |
| `status` | 状态字符串 |
| `message` | 详细消息 |

---

### get_read_url

获取预签名下载 URL，用于读取已上传的文件。

```rust
let read_info = client.get_read_url("rec-001").await?;
println!("下载地址: {}", read_info.presigned_url);
```

---

### abort_upload

取消正在进行的上传。

```rust
let aborted = client.abort_upload("rec-001", "用户取消").await?;
```

---

## Uploader

封装完整上传流程（请求 URL → HTTP PUT → 确认）的高级组件。

```rust
use astra_faber::{FileClient, Uploader};
use std::sync::Arc;

let file_client = FileClient::connect("http://127.0.0.1:50052").await?;
let file_client = Arc::new(tokio::sync::Mutex::new(file_client));

let uploader = Uploader::new(file_client, "robot-001")
    .with_max_retries(3)
    .with_retry_interval(std::time::Duration::from_secs(2));

// 一步完成上传
let result = uploader.upload(
    "rec-001",          // recording_id
    file_data,          // Vec<u8> 文件内容
    "mcap",             // asset_type
).await?;

println!("上传完成: key={}, sealed={}", result.object_key, result.sealed);
```

### UploadResult

| 字段 | 类型 | 说明 |
|------|------|------|
| `recording_id` | `String` | 录制 ID |
| `object_key` | `String` | 对象存储键 |
| `etag` | `String` | 文件 ETag |
| `sealed` | `bool` | 是否已封存 |

---

## 错误处理

```rust
use astra_faber::Error;

match uploader.upload("rec-001", data, "mcap").await {
    Ok(result) => println!("上传成功: {}", result.object_key),
    Err(Error::Upload(msg)) => eprintln!("上传失败: {}", msg),
    Err(Error::Http(msg)) => eprintln!("HTTP 错误: {}", msg),
    Err(Error::FileClient(msg)) => eprintln!("文件服务错误: {}", msg),
    Err(Error::Timeout) => eprintln!("上传超时"),
    Err(e) => eprintln!("其他错误: {}", e),
}
```
