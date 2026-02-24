# Twitter MCP

Fork of [Barresider/x-mcp](https://github.com/Barresider/x-mcp)，通过 Playwright 浏览器自动化操作 Twitter/X 的 MCP 服务。

## 改动

基于上游做了以下修改：

- **HTTP 传输**: 新增 StreamableHTTP 端点 `/mcp`，支持 `http`/`sse`/`stdio` 三种模式
- **Cookie 认证**: 新增 `extract-cookies` 命令，从真实 Chrome 提取 Cookie（绕过 Twitter 反自动化检测）
- **Bug 修复**: likePost 选择器、unbookmarkPost 选择器、compose 对话框选择器、screenshot 缺少 await
- **性能优化**: 移除全局 slowMo 1000ms、媒体上传智能等待
- **移除功能**: `replace_comment`（Twitter 不支持编辑评论）

## 安装

```bash
npm install
npx playwright install chromium
```

## 登录

Twitter 会检测 Playwright 自动化登录，所以采用 **从 Chrome 提取 Cookie** 的方式：

```bash
npm run extract-cookies
```

会弹出一个独立的 Chrome 窗口（临时 profile，不影响你的主 Chrome），在里面手动登录目标 Twitter 账号，登录成功后自动保存 Cookie。

如果你的主 Chrome 已经登录了目标账号，也可以用 Python 直接提取（需要 `pycookiecheat`）：

```bash
pip install pycookiecheat
python3 -c "
from pycookiecheat import chrome_cookies
import json, os

cookies = chrome_cookies('https://x.com')
# 注意：这种方式只能获取非 httpOnly 的 cookie 值
# 推荐使用 npm run extract-cookies
"
```

Cookie 保存在 `playwright/.auth/twitter.json`（已 gitignore）。

## 运行

```bash
# HTTP 模式（默认，端口 18071）
npm run mcp

# 指定模式
MCP_TRANSPORT=stdio npm run mcp
MCP_TRANSPORT=sse npm run mcp
```

## MCP 注册

```bash
claude mcp add --transport http twitter-mcp http://localhost:18071/mcp
```

## 可用工具（20 个）

| 类别 | 工具 |
|------|------|
| 发布 | `tweet`, `thread`, `reply_to_post`, `quote_tweet` |
| 互动 | `like_post`, `unlike_post`, `retweet_post`, `unretweet_post`, `bookmark_post`, `unbookmark_post` |
| 评论 | `like_comment_by_id`, `unlike_comment_by_id`, `reply_to_comment_by_id` |
| 爬取 | `scrape_posts`, `scrape_profile`, `scrape_comments`, `scrape_timeline`, `scrape_trending` |
| 搜索 | `search_twitter`, `search_viral` |

## 环境变量

```env
# 服务配置
MCP_PORT=18071              # HTTP 端口
MCP_TRANSPORT=http          # http|sse|stdio

# 自动登录（可选，Twitter 可能拦截）
TWITTER_USERNAME=
TWITTER_PASSWORD=
TWITTER_EMAIL=

# 代理（可选）
PROXY_URL=
PROXY_USERNAME=
PROXY_PASSWORD=

# 调试
SLOW_MO=0                   # 浏览器操作延迟(ms)
NODE_ENV=production         # development 显示浏览器
AUTH_DIR=playwright/.auth   # Cookie 存储目录
```

## 端口

**18071**（固定，已在全局端口分配表中注册）

## License

MIT
