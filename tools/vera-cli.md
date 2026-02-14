# vera-cli 命令行工具

`vera-cli` 是 Vera 平台的命令行客户端，用于管理设备、表、数据插入和查询操作。适合快速调试、数据导入和自动化脚本使用。

## 安装

从源码编译：

```bash
cargo install --path binaries/clients/vera-client
```

编译完成后，`vera-cli` 将安装到 `~/.cargo/bin/` 目录下。

## 连接配置

默认连接 `http://127.0.0.1:50051`，可通过以下方式修改：

```bash
# 命令行参数
vera-cli -e http://192.168.1.100:50051 ping

# 环境变量
export VERA_ENDPOINT=http://192.168.1.100:50051
vera-cli ping
```

### 全局选项

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `-e, --endpoint <URL>` | 服务端地址 | `http://127.0.0.1:50051` |
| `-o, --output <格式>` | 输出格式：`table` 或 `json` | `table` |

## 命令一览

### ping — 测试连接

```bash
vera-cli ping
```

验证服务端是否正常运行。

---

### device create — 创建设备

创建设备超级表，定义 Tag（设备标识）和 Property（时序属性）。

```bash
vera-cli device create \
    --name robot \
    --tag device_id:string \
    --tag location:string \
    --property temperature:float64 \
    --property is_online:bool \
    --primary-key device_id
```

| 参数 | 说明 | 必填 |
|------|------|------|
| `-n, --name` | 设备名称（超级表名） | 是 |
| `-t, --tag <name:type>` | Tag 列定义，可多次指定 | 是 |
| `-p, --property <name:type>` | 属性列定义，可多次指定 | 是 |
| `-k, --primary-key <field>` | 主键字段（必须是 Tag） | 否 |

---

### table create — 创建表

创建普通数据表。

```bash
vera-cli table create \
    --name users \
    --field id:int32 \
    --field name:string \
    --field age:int32
```

| 参数 | 说明 | 必填 |
|------|------|------|
| `-n, --name` | 表名 | 是 |
| `-f, --field <name:type>` | 字段定义，可多次指定 | 是 |

---

### table list — 列出元数据

列出服务端的元数据信息。默认只列出超级表（设备定义），使用 `--all` 列出所有类别。

```bash
# 默认只列超级表
vera-cli table list

# 列出所有类别
vera-cli table list --all

# 按类别选择
vera-cli table list --supertables --tables
vera-cli table list --thing-models --interface-types --component-models

# JSON 格式输出
vera-cli -o json table list --all
```

| 参数 | 说明 | 默认 |
|------|------|------|
| `--all` | 列出所有类别 | 否 |
| `--supertables` | 列出超级表（设备定义） | 无 flag 时默认列出 |
| `--tables` | 列出普通表 | 否 |
| `--thing-models` (别名 `--tm`) | 列出物模型 | 否 |
| `--interface-types` (别名 `--it`) | 列出接口类型 | 否 |
| `--component-models` (别名 `--cm`) | 列出组件模型 | 否 |

#### 支持的类别

| 类别 | 说明 |
|------|------|
| **超级表** | 设备定义，包括名称、主键、Tag 列、Property 列、子表数量 |
| **普通表** | 通过 `table create` 创建的数据表 |
| **物模型** | ThingModel 定义，包含属性、Slot、Port 信息 |
| **接口类型** | InterfaceType 定义，描述组件兼容接口 |
| **组件模型** | ComponentModel 定义，描述可插拔硬件组件 |

#### 输出示例

表格格式：

```
超级表 (3):
┌───────────────────────────┬────┬───────────┬───────────┬──────────────────────┬────────┐
│ 名称                       │ ID │ 主键       │ Tag 列    │ Property 列           │ 子表数  │
├───────────────────────────┼────┼───────────┼───────────┼──────────────────────┼────────┤
│ twin_robot                 │ 1  │ device_id │ device_id │ temperature, force   │ 5      │
│ twin_robot_slot_gripper    │ 2  │ device_id │ device_id │ grip_force           │ 3      │
│ sensor                     │ 3  │ device_id │ device_id │ temp, humidity       │ 100    │
└───────────────────────────┴────┴───────────┴───────────┴──────────────────────┴────────┘
```

JSON 格式：

```json
{
  "type": "supertables",
  "total": 3,
  "items": [
    {
      "name": "twin_robot",
      "stable_id": 1,
      "primary_key": "device_id",
      "tag_columns": ["device_id"],
      "property_columns": ["temperature", "force"],
      "subtable_count": 5,
      "created_at": 1700000000000
    }
  ]
}
```

---

### insert device — 插入设备数据

向设备超级表中插入一行数据。

```bash
vera-cli insert device \
    --name robot \
    --tags device_001,warehouse_a \
    --values 25.5,true
```

| 参数 | 说明 | 必填 |
|------|------|------|
| `-n, --name` | 设备名称 | 是 |
| `-t, --tags <值1,值2,...>` | Tag 值，逗号分隔 | 是 |
| `-V, --values <值1,值2,...>` | 属性值，逗号分隔 | 是 |

---

### insert json — JSON 批量导入

从 JSON 文件或标准输入批量导入数据。

```bash
# 从文件导入
vera-cli insert json --file data.json

# 从标准输入导入
cat data.json | vera-cli insert json
```

JSON 格式：

```json
{
  "device_name": "robot",
  "rows": [
    {
      "tags": ["device_001", "warehouse_a"],
      "values": [25.5, 60.0, true]
    },
    {
      "tags": ["device_002", "warehouse_b"],
      "values": [24.1, 58.3, false]
    }
  ]
}
```

---

### query latest — 查询最新值

查询单个设备的最新数据。

```bash
vera-cli query latest --device robot --id device_001

# JSON 格式输出
vera-cli -o json query latest --device robot --id device_001
```

| 参数 | 说明 | 必填 |
|------|------|------|
| `-d, --device` | 设备名称 | 是 |
| `-i, --id` | 设备 ID | 是 |

---

### query range — 时间范围查询

按时间范围查询设备历史数据。

```bash
vera-cli query range \
    --device robot \
    --id device_001 \
    --start 1700000000000000000 \
    --end 1800000000000000000 \
    --limit 100
```

| 参数 | 说明 | 必填 |
|------|------|------|
| `-d, --device` | 设备名称 | 是 |
| `-i, --id` | 设备 ID | 是 |
| `-s, --start` | 起始时间（纳秒时间戳） | 否 |
| `-E, --end` | 结束时间（纳秒时间戳） | 否 |
| `-l, --limit` | 最大行数（0 表示不限） | 否 |

---

### query batch — 批量查询最新值

同时查询多个设备的最新数据。

```bash
vera-cli query batch \
    --device robot \
    --ids device_001,device_002,device_003
```

| 参数 | 说明 | 必填 |
|------|------|------|
| `-d, --device` | 设备名称 | 是 |
| `--ids <id1,id2,...>` | 设备 ID 列表，逗号分隔 | 是 |

---

## 支持的数据类型

| 类型名 | 说明 |
|--------|------|
| `string` | UTF-8 字符串 |
| `int32` | 32 位有符号整数 |
| `int64` | 64 位有符号整数 |
| `float32` | 32 位浮点数 |
| `float64` | 64 位浮点数 |
| `bool` | 布尔值 |
| `binary` | 二进制数据 |
| `timestamp` | 纳秒时间戳 |
| `date` | 日期 |

## 使用示例

### 完整工作流

```bash
# 1. 测试连接
vera-cli ping

# 2. 创建温度传感器设备
vera-cli device create \
    --name temperature_sensor \
    --tag device_id:string \
    --tag location:string \
    --property temperature:float64 \
    --property humidity:float64 \
    --primary-key device_id

# 3. 查看已创建的超级表
vera-cli table list

# 4. 插入数据
vera-cli insert device \
    --name temperature_sensor \
    --tags sensor-001,room-a \
    --values 23.5,65.0

vera-cli insert device \
    --name temperature_sensor \
    --tags sensor-002,room-b \
    --values 24.1,58.3

# 5. 查询最新值
vera-cli query latest --device temperature_sensor --id sensor-001

# 6. 批量查询
vera-cli query batch --device temperature_sensor --ids sensor-001,sensor-002

# 7. 查看所有元数据
vera-cli table list --all
```

### 配合 vera-web 使用

`vera-cli` 和 [vera-web 管理界面](/tools/vera-web) 连接同一个 Vera 服务端。通过 CLI 创建的设备和数据，可以在 vera-web 界面中实时查看和管理。

```bash
# CLI 创建设备并插入数据
vera-cli device create --name robot --tag device_id:string --property temp:float64 --primary-key device_id
vera-cli insert device --name robot --tags arm-001 --values 25.5

# 打开 vera-web 查看
# http://localhost:3000
```
