# 浏览器录制与回放

录制浏览器操作并支持回放，用于自动化测试和操作复现。

## 录制控制 (browser_recording)

### 开始录制

```bash
curl -X POST -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "login-flow", "description": "用户登录流程"}' \
  "http://127.0.0.1:18791/recording/start?profile=default"
```

**参数**:
- `name`: 录制会话名称
- `description`: 录制描述
- `profile`: 使用的浏览器实例

### 停止录制

```bash
curl -X POST -H "Authorization: Bearer <token>" \
  "http://127.0.0.1:18791/recording/stop?profile=default"
```

### 查看录制状态

```bash
curl -H "Authorization: Bearer <token>" \
  "http://127.0.0.1:18791/recording/status?profile=default"
```

返回:
```json
{
  "isRecording": true,
  "name": "login-flow",
  "actionCount": 5,
  "duration": 12345
}
```

### 加载录制文件

```bash
curl -X POST -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"filePath": "./recordings/login-flow.json"}' \
  "http://127.0.0.1:18791/recording/load?profile=default"
```

### 导出录制

```bash
curl -X POST -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"format": "llm"}' \
  "http://127.0.0.1:18791/recording/export?profile=default"
```

**导出格式**:
- `json`: 原始 JSON 格式
- `llm`: LLM 优化格式（推荐）
- `markdown`: Markdown 文档格式

## 回放控制 (browser_replay)

### 播放录制

```bash
curl -X POST -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"speedMultiplier": 1, "showCursor": true}' \
  "http://127.0.0.1:18791/replay/play?profile=default"
```

**参数**:
- `speedMultiplier`: 回放速度倍数（默认 1）
- `showCursor`: 显示可视化光标（默认 true）
- `useOriginalTiming`: 使用录制时的实际时间间隔（默认 true）
- `delay`: 固定延迟时间（毫秒）

### 暂停回放

```bash
curl -X POST -H "Authorization: Bearer <token>" \
  "http://127.0.0.1:18791/replay/pause?profile=default"
```

### 恢复回放

```bash
curl -X POST -H "Authorization: Bearer <token>" \
  "http://127.0.0.1:18791/replay/resume?profile=default"
```

### 停止回放

```bash
curl -X POST -H "Authorization: Bearer <token>" \
  "http://127.0.0.1:18791/replay/stop?profile=default"
```

### 单步执行

```bash
curl -X POST -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"index": 0}' \
  "http://127.0.0.1:18791/replay/step?profile=default"
```

**参数**:
- `index`: 操作索引（从 0 开始）

### 从指定位置播放

```bash
curl -X POST -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"startIndex": 2, "count": 5}' \
  "http://127.0.0.1:18791/replay/playFrom?profile=default"
```

**参数**:
- `startIndex`: 开始索引（从 0 开始）
- `count`: 回放操作数量（不指定则回放到末尾）

### 获取指定操作

```bash
curl -H "Authorization: Bearer <token>" \
  "http://127.0.0.1:18791/replay/getAction?index=0&profile=default"
```

返回:
```json
{
  "index": 0,
  "action": {
    "type": "navigate",
    "url": "https://example.com",
    "timestamp": 1234567890
  }
}
```

### 执行单个操作

用于手动验证修改后的动作：

```bash
curl -X POST -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"actionJson": "{\"type\":\"click\",\"ref\":\"e1\"}"}' \
  "http://127.0.0.1:18791/replay/execute?profile=default"
```

### 查看回放状态

```bash
curl -H "Authorization: Bearer <token>" \
  "http://127.0.0.1:18791/replay/status?profile=default"
```

返回:
```json
{
  "isPlaying": true,
  "currentIndex": 3,
  "totalActions": 10,
  "name": "login-flow"
}
```

## 使用示例

### 录制登录流程

```
Step 1: 开始录制
→ POST /recording/start {"name": "login", "description": "登录流程"}

Step 2: 执行操作
→ navigate({"url": "https://example.com/login"})
→ snapshot({"format": "ai"})
→ type({"ref": "e1", "text": "user@example.com"})
→ type({"ref": "e2", "text": "password"})
→ click({"ref": "e3"})

Step 3: 停止录制
→ POST /recording/stop

Step 4: 导出录制
→ POST /recording/export {"format": "llm"}
```

### 回放录制

```
Step 1: 加载录制文件
→ POST /recording/load {"filePath": "./recordings/login.json"}

Step 2: 查看状态
→ GET /replay/status

Step 3: 播放
→ POST /replay/play {"speedMultiplier": 1}

Step 4: 等待完成
→ GET /replay/status (检查 isPlaying)
```

### 调试回放

```
Step 1: 加载录制
→ POST /recording/load {"filePath": "./recordings/login.json"}

Step 2: 单步执行
→ POST /replay/step {"index": 0}  # 第一步
→ POST /replay/step {"index": 1}  # 第二步

Step 3: 从指定位置继续
→ POST /replay/playFrom {"startIndex": 2}
```

## 录制文件格式

### JSON 格式

```json
{
  "name": "login-flow",
  "description": "用户登录流程",
  "actions": [
    {
      "type": "navigate",
      "url": "https://example.com/login",
      "timestamp": 1234567890
    },
    {
      "type": "type",
      "ref": "e1",
      "text": "user@example.com",
      "timestamp": 1234567900
    }
  ]
}
```

### LLM 优化格式

```
Recording: login-flow
Description: 用户登录流程
Total Actions: 5

[0] navigate → https://example.com/login
[1] type → e1: "user@example.com"
[2] type → e2: "password"
[3] click → e3
[4] wait → selector: "#dashboard"
```

## 注意事项

1. **录制时机**: 在开始操作前启动录制，操作完成后停止
2. **Ref 失效**: 回放时如果页面结构变化，ref 可能失效
3. **时间间隔**: 使用 `useOriginalTiming` 保持原始操作节奏
4. **调试模式**: 使用单步执行调试问题操作
