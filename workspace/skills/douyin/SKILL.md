---
name: "douyin"
description: "Operates Douyin (抖音) platform features including search, messaging, homepage navigation, video comments extraction, and interactive elements. Invoke when user needs to interact with Douyin website or perform actions like searching videos, checking messages, browsing content, or extracting comments."
---

# Douyin (抖音) 操作技能

本技能指导 Agent 如何操作抖音网站，包括视频评论提取和交互元素操作。

**依赖**: 本技能依赖 [browser skill](../browser/SKILL.md) 提供的浏览器自动化能力。

## 主要功能

### 1. 搜索功能
- **URL**: `https://www.douyin.com/user/self/search/<关键词>?aid=<随机UUID>&type=<搜索类型>`
- 用于搜索视频、用户、话题等内容
- **重要**: `aid` 参数是必须的，需要随机生成 UUID 格式以避免封号
- UUID 格式示例: `130e9837-c18b-496c-a2fa-c53a7579eb9a`

**搜索类型参数 (type)**：
- `general` - 综合搜索，结果包含播主和视频
- `video` - 视频搜索，结果为相关视频
- `user` - 用户搜索，结果为抖音用户
- `live` - 直播搜索，结果为直播

### 2. 私信功能
- **URL**: `douyin.com/chat?isPopup=1`
- 查看和回复私信

### 3. 主页浏览
- **URL**: `https://www.douyin.com/`
- 浏览推荐内容、热门视频

### 4. 我的关注
- **URL**: `https://www.douyin.com/follow`
- 查看已关注用户的视频动态

### 5. 视频评论提取
- **API**: `GET http://127.0.0.1:18791/snapshot?format=platform`
- 自动提取当前视频页面的评论、视频详情和交互元素
- **前置条件**: 必须在抖音视频详情页 (`/video/<video_id>`)

---

## 平台快照数据格式

当使用 `format=platform` 获取抖音页面快照时，返回数据结构如下：

### 用户主页 (`/user/<sec_uid>`)

**支持分页**: 用户主页视频列表支持分页返回，默认每页12条（抖音一行6个，正好两行）。

```json
{
  "platform": "douyin",
  "pageType": "user",
  "pagination": {
    "pageNum": 1,
    "pageSize": 12,
    "totalLoaded": 57,
    "returned": 12,
    "hasMore": true
  },
  "elements": [
    {
      "ref": "r1",
      "type": "video",
      "videoId": "7160164132585573639",
      "title": "视频标题...",
      "likeCount": "2373",
      "selector": "a[href=\"/video/7160164132585573639\""
    }
  ],
  "user": {
    "nickname": "用户名",
    "avatar": "头像URL",
    "followingCount": "100",
    "followerCount": "1万",
    "likeCount": "10万",
    "worksCount": 1281,
    "homepageUrl": "https://www.douyin.com/user/xxx"
  },
  "pageText": "..."
}
```

**分页字段说明**:
- `pagination.pageNum`: 当前页码（默认1）
- `pagination.pageSize`: 每页数量（默认12）
- `pagination.totalLoaded`: 页面上已加载的视频总数
- `pagination.returned`: 本次返回的视频数量
- `pagination.hasMore`: 是否还有更多视频

**用户字段说明**:
- `user.worksCount`: 该用户的总作品数量（从页面统计信息获取）

### 视频详情页 (`/video/<video_id>`)

```json
{
  "platform": "douyin",
  "pageType": "video",
  "videos": [],
  "video": {
    "videoId": "7618838251784260906",
    "url": "https://www.douyin.com/video/7618838251784260906",
    "title": "视频标题...",
    "hashtags": ["#AI", "#人工智能"],
    "author": "分享与思考",
    "authorId": "",
    "likeCount": "7104",
    "commentCount": "1.6万",
    "collectCount": "622",
    "shareCount": "800",
    "publishTime": "2026-03-19 13:43"
  },
  "comments": [
    {
      "index": 0,
      "author": "阿朗",
      "content": "评论内容...",
      "likeCount": "44",
      "time": "5天前",
      "location": "越南"
    }
  ],
  "elements": [
    {
      "ref": "comment-input",
      "type": "input",
      "selector": "textarea[placeholder*=\"评论\"]",
      "description": "评论输入框"
    },
    {
      "ref": "comment-submit",
      "type": "button",
      "selector": "button",
      "description": "发送评论按钮"
    }
  ],
  "pageText": "..."
}
```

**字段说明**:
- `video`: 视频详情（标题、作者、点赞数、评论数等）
- `comments`: 评论列表（最多20条），包含作者、内容、点赞数、时间、地点
- `elements`: 可交互元素（评论输入框、发送按钮、点赞按钮等）
- `user`: 用户信息（仅在用户主页返回）
- `pagination`: 分页信息（仅在用户主页返回）
- `pageText`: 页面文本内容（前50000字符）

**注意**: 分页功能目前仅在用户主页 (`/user/<sec_uid>`) 支持，视频详情页 (`/video/<video_id>`) 不支持分页。

---

## 使用方式

### 获取视频评论和详情

**HTTP API 调用**:
```bash
# 确保当前页面是抖音视频详情页
curl -H "Authorization: Bearer cradle-browser-test-token" \
  "http://127.0.0.1:18791/snapshot?format=platform&platform=douyin"
```

**使用步骤**:
1. 导航到抖音视频详情页 (`/video/<video_id>`)
2. 等待页面完全加载（评论区域可见）
3. 调用 API 获取评论数据
4. 解析返回的 JSON 数据

**MCP Browser 工具调用**:
```
action: snapshot
format: platform
platform: douyin
```

---

## 交互元素操作

### 评论相关元素

| 元素 | ref | 类型 | 用途 |
|------|-----|------|------|
| 评论输入框 | `comment-input` | input | 输入评论内容 |
| 发送按钮 | `comment-submit` | button | 提交评论 |
| 点赞按钮 | `video-like` | button | 给视频点赞 |
| 评论项 | `comment-0`, `comment-1`... | button | 点击评论进行回复 |

### 操作示例

**输入评论**:
```
action: click
ref: comment-input
```

```
action: type
ref: comment-input
text: 这是一条评论
```

**发送评论**:
```
action: click
ref: comment-submit
```

**给视频点赞**:
```
action: click
ref: video-like
```

---

## Playwright 元素选择器

### 用户主页 - 视频列表

**页面URL**: `/user/<sec_uid>`

| 元素 | Playwright 选择器 | 说明 |
|------|------------------|------|
| 视频卡片列表 | `li:has(a[href^="/video/"])` | 包含视频链接的列表项 |
| 用户作品链接 | `a[href^="/video/"]:not([href*="source="])` | 排除页脚推荐视频 |
| 视频ID | `a[href^="/video/"]` → 提取href中的数字 | 从链接中提取 |
| 视频标题 | `a[href^="/video/"]` → textContent | 链接文本包含标题和点赞数 |
| 点赞数 | `a[href^="/video/"]` → textContent → 正则提取 | 格式如 "14.2万" |

**重要**: 页面底部可能包含推荐视频（带 `source=Baiduspider` 参数），需要排除：
- 用户作品: `/video/7620434506289351979` (相对路径，无source参数)
- 推荐视频: `https://www.douyin.com/video/xxx?source=Baiduspider` (完整URL，有source参数)

---

### 视频详情页

**页面URL**: `/video/<video_id>`

| 元素 | Playwright 选择器 | 说明 |
|------|------------------|------|
| 视频标题 | `text=/展开.+/` 或页面文本匹配 | 展开后的完整标题 |
| 发布时间 | `text=/发布时间[：:]\s*\d{4}/` | 格式: "发布时间：2024-02-08 11:00" |
| 作者昵称 | `text=/认证徽章/` 的前一个元素 | 认证徽章前的文本 |
| 粉丝数 | `text=/粉丝\d+/` | 格式: "粉丝142.6万" |
| 统计数据 | 页面文本中连续的数字+万 | 点赞、播放、评论 |
| 评论输入框 | `textarea[placeholder*="评论"], [contenteditable="true"]` | 评论输入区域 |
| 发送按钮 | `button:has-text("发送")` | 发送评论按钮 |

---

## 数据提取方法

### 方法1: 获取用户主页视频列表

**适用页面**: 用户主页 (`/user/<sec_uid>`)

**Playwright 操作**:
```javascript
// 1. 等待页面加载
await page.waitForSelector('a[href^="/video/"]', { timeout: 10000 });

// 2. 获取用户作品链接（排除页脚推荐视频）
const videoLinks = await page.locator('a[href^="/video/"]:not([href*="source="])').all();

// 3. 遍历提取数据
const videos = [];
for (const link of videoLinks) {
  const href = await link.getAttribute('href');
  const text = await link.textContent();
  const videoId = href?.match(/\/video\/(\d+)/)?.[1];
  
  // 从文本中提取点赞数
  const likeMatch = text?.match(/(置顶)?(\d+\.?\d*万)/);
  
  videos.push({
    videoId,
    url: `https://www.douyin.com${href}`,
    title: text?.replace(/(置顶)?\d+\.?\d*万/, '').trim(),
    likeCount: likeMatch?.[2] || likeMatch?.[1]
  });
}
```

**返回数据**:
```json
[
  {
    "videoId": "7332906152117767451",
    "url": "https://www.douyin.com/video/7332906152117767451",
    "title": "新年的挣点小钱的思路和方法",
    "likeCount": "14.2万"
  }
]
```

---

### 方法2: 获取视频详情和评论（API方式）

**适用页面**: 视频详情页 (`/video/<video_id>`)

**HTTP API 调用**:
```bash
# 调用 snapshot API
curl -H "Authorization: Bearer cradle-browser-test-token" \
  "http://127.0.0.1:18791/snapshot?format=platform&platform=douyin"
```

**返回数据**:
```json
{
  "video": {
    "videoId": "7618838251784260906",
    "title": "人民网给AI征集中文好名...",
    "author": "分享与思考",
    "likeCount": "7104",
    "commentCount": "1.6万",
    "publishTime": "2026-03-19 13:43"
  },
  "comments": [
    {
      "index": 0,
      "author": "阿朗",
      "content": "当年广州塔十万块钱征名...",
      "likeCount": "44",
      "time": "5天前",
      "location": "越南"
    }
  ],
  "elements": [...]
}
```

---

### 方法3: 滚动加载更多视频

**适用页面**: 用户主页 (`/user/<sec_uid>`)

**重要**: 抖音使用自定义滚动容器 `route-scroll-container`，而非标准 `window.scroll`。

**Playwright 操作**:
```javascript
// 滚动到底部加载更多
async function loadMoreVideos(page, targetCount = 100) {
  let lastCount = 0;
  let noChangeCount = 0;
  
  while (true) {
    const currentCount = await page.locator('a[href^="/video/"]:not([href*="source="])').count();
    
    if (currentCount >= targetCount) break;
    if (currentCount === lastCount) {
      noChangeCount++;
      if (noChangeCount >= 3) break;
    } else {
      noChangeCount = 0;
    }
    
    lastCount = currentCount;
    
    // 滚动自定义容器到底部
    await page.evaluate(() => {
      const container = document.querySelector('.route-scroll-container, [class*="route-scroll"]');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    });
    
    await page.waitForTimeout(1000);
  }
  
  return await page.locator('a[href^="/video/"]:not([href*="source="])').count();
}
```

---

### 方法4: 点击视频进入详情

**适用页面**: 用户主页 (`/user/<sec_uid>`)

**Playwright 操作**:
```javascript
// 点击第N个视频
async function openVideoDetail(page, index) {
  const videoLink = page.locator('a[href^="/video/"]:not([href*="source="])').nth(index);
  
  // 获取视频ID
  const href = await videoLink.getAttribute('href');
  const videoId = href?.match(/\/video\/(\d+)/)?.[1];
  
  // 点击打开
  await videoLink.click();
  
  // 等待导航完成
  await page.waitForURL(/\/video\//);
  
  return { videoId, url: page.url() };
}
```

---

## 常见操作流程

### 流程1: 获取用户所有视频

1. 导航到用户主页
2. 等待 `a[href^="/video/"]` 出现
3. 滚动加载更多（可选）
4. 使用 `page.locator('a[href^="/video/"]:not([href*="source="])').all()` 获取所有链接
5. 遍历提取 videoId、title、likeCount

### 流程2: 获取视频详情和评论（推荐）

1. 导航到视频详情页 (`/video/<video_id>`)
2. 等待页面完全加载（评论区域可见）
3. 调用 API: `GET /snapshot?format=platform&platform=douyin`
4. 解析返回的 JSON 数据获取视频详情和评论

### 流程3: 自动回复评论

1. 导航到视频详情页
2. 调用 API 获取评论列表
3. 分析评论内容，确定回复目标
4. 使用 MCP 工具操作页面元素：
   - 点击评论项 (`comment-0`, `comment-1` 等)
   - 或点击评论输入框 (`comment-input`)
   - 输入回复内容
   - 点击发送按钮 (`comment-submit`)

### 流程4: 批量获取视频评论

1. 获取用户主页视频列表
2. 遍历视频列表
3. 对每个视频：
   - 点击视频进入详情页
   - 调用 API 获取评论
   - 保存评论数据
   - 返回列表页

---

## 注意事项

1. **API 调用前置条件**: 调用 `/snapshot?format=platform` 前必须确保当前页面是抖音视频详情页
2. **评论数量限制**: API 最多返回 20 条评论，如需更多需要滚动页面加载
3. **选择器稳定性**: 使用 `a[href*="/video/"]` 比 class 选择器更稳定
4. **懒加载**: 用户主页需要滚动才能加载更多视频
5. **反爬机制**: 频繁请求可能触发验证码，建议添加延迟
6. **数据格式**: 点赞数等是格式化字符串（"14.2万"），需要时转换为数字
7. **页面变化**: 抖音可能更新页面结构，选择器需要定期验证
