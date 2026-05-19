# Coding Worker

> 想睡觉的时候模型自己实现需求么？coding worker 让你的服务器晚上玩命干活，派任务就行！

基于 [Hatchet](https://hatchet.run/) 任务队列和 [Claude Code](https://docs.anthropic.com/en/docs/claude-code)（通过 `@anthropic-ai/claude-agent-sdk`）的分布式编码任务 Worker，支持 [oh-my-claudecode](https://github.com/anthropics/claude-code) 插件。

它作为 Worker 连接到 Hatchet 实例，从队列中接收编码任务，驱动 Claude Code 执行——自动进行 git worktree 隔离、分支管理和结果流式推送。

> **强烈建议：** 在运行 Worker 的机器上全局安装 [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode) 插件，然后使用 `coding-worker coding` 模式，最大化利用 autopilot 和 ralplan 全自动"蹬"起来！

## 功能特性

- **分布式任务队列** — 基于 Hatchet 构建，任务提交到队列后自动分发给可用 Worker
- **两种工作流类型**
  - `simple` — 直接通过 Claude Code 执行任务描述
  - `coding` — 支持 `autopilot`（自主执行）和 `ralplan`（先规划后执行）模式，依赖 oh-my-claudecode
- **Git Worktree 隔离** — 每个任务在独立的 git worktree 和新分支上执行；变更自动提交，worktree 清理后分支保留供审查
- **实时日志** — Claude Code 的每一步（思考、工具调用、工具结果）都通过 Hatchet 日志流式推送
- **灵活配置** — 支持配置文件（`.coding-worker.yaml`）、环境变量和命令行参数

## 前置要求

- Node.js >= 18.0.0
- 运行中的 [Hatchet](https://docs.hatchet.run/) 实例及 API Token
- 已安装并认证的 [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code)（`claude` 在 PATH 中）

## 安装

```bash
git clone <repo-url> coding-worker
cd coding-worker
npm install
npm run build

# 注册全局命令（之后可以在任意目录运行 `coding-worker`）
npm link
```

## 环境变量设置

启动 Worker 前需要设置以下环境变量：

```bash
# Hatchet 连接
export HATCHET_CLIENT_TOKEN="your-hatchet-token"

# Anthropic API（或兼容端点）
export ANTHROPIC_AUTH_TOKEN=your-token-api-key
export ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic

# 模型配置（所有层级使用相同模型，或按层级分别配置）
export ANTHROPIC_MODEL=deepseek-v4-flash
export ANTHROPIC_DEFAULT_HAIKU_MODEL=deepseek-v4-flash
export ANTHROPIC_DEFAULT_OPUS_MODEL=deepseek-v4-flash
export ANTHROPIC_DEFAULT_SONNET_MODEL=deepseek-v4-flash
```

> **提示：** 将这些写入 `~/.bashrc`、`~/.zshrc` 或 PM2 ecosystem 配置文件，以便跨会话持久化。

## 配置

所有配置均可通过环境变量（推荐）或命令行参数完成。`.coding-worker.yaml` 配置文件也可作为备选方案——见下方说明。

### 环境变量

**必填：**

| 变量 | 说明 |
|---|---|
| `HATCHET_CLIENT_TOKEN` | Hatchet API Token（JWT） |

**可选（省略时从 JWT 中自动提取）：**

| 变量 | 说明 |
|---|---|
| `HATCHET_CLIENT_HOST_PORT` | gRPC 地址 |
| `HATCHET_CLIENT_API_URL` | REST API 地址 |
| `HATCHET_CLIENT_TENANT_ID` | 租户 ID |
| `HATCHET_CLIENT_TLS_STRATEGY` | `tls`、`mtls` 或 `none`（默认: `none`） |

**Worker 设置：**

| 变量 | 说明 |
|---|---|
| `CODING_WORKER_NAME` | Worker 名称（省略时自动生成） |
| `CODING_WORKER_WORKFLOW_SUFFIX` | 工作流名称后缀 |
| `CODING_WORKER_SLOTS` | 最大并发任务数（默认: 2） |
| `CODING_WORKER_WORK_DIR` | Claude Code 工作目录（默认: 当前目录） |

**优先级：** 命令行参数 > 环境变量 > 配置文件 > JWT 默认值。

### 配置文件（`.coding-worker.yaml`）— 可选

```yaml
hatchet:
  token: <your-hatchet-jwt-token>
  host_port: <grpc-address>        # 可选，JWT 中自动提取
  api_url: <rest-api-address>      # 可选，JWT 中自动提取
  tenant_id: <tenant-id>           # 可选，JWT 中自动提取
  tls_strategy: none               # tls | mtls | none

worker:
  name: my-coding-worker           # 可选，默认从主机名+目录名自动生成
  workflow_suffix: my-project      # 可选，工作流名称变为 coding-workflow-{suffix}
  slots: 2                         # 最大并发任务数（默认: 2）
  work_dir: /path/to/project       # Claude Code 工作目录（默认: 当前目录）
```

## 使用方式

### 启动 Worker

**Simple 工作流**（直接执行）：

```bash
npm start
# 或
coding-worker start --token <your-token>
```

**Coding 工作流**（autopilot/ralplan 模式）：

```bash
npm run start -- coding --token <your-token>
# 或
coding-worker coding --token <your-token>
```

### CLI 命令一览

| 命令 | 说明 |
|---|---|
| `coding-worker start` | 启动 Worker（simple 工作流） |
| `coding-worker coding` | 启动 Worker（coding 工作流，支持 autopilot/ralplan） |
| `coding-worker workflows` | 列出已注册的工作流 |
| `coding-worker trigger [description]` | 触发一个编码任务 |

### 触发任务

```bash
# 直接指定工作流名称和描述
coding-worker trigger coding-workflow-my-project "修复登录按钮样式"

# Autopilot 模式（coding 工作流）
coding-worker trigger coding-workflow-my-project "autopilot 重构认证模块"

# Ralplan 模式 — 先规划再执行（coding 工作流）
coding-worker trigger coding-workflow-my-project "ralplan 添加用户资料页面，支持头像上传"

# 使用 -d 标志指定描述
coding-worker trigger coding-workflow-my-project -d "添加单元测试"

# 省略工作流名称 — 交互式选择可用工作流
coding-worker trigger "修复 README 中的拼写错误"

# 触发后不等待（不流式输出日志）
coding-worker trigger coding-workflow-my-project "修复拼写错误" --no-wait

# 指定工作目录
coding-worker trigger coding-workflow-my-project "添加单元测试" --work-dir /path/to/project
```

> **工作流解析规则：** 如果第一个位置参数匹配已注册的工作流名称，则作为工作流名称，第二个参数作为描述；如果不匹配任何工作流，则视为描述，并提示选择工作流。

### 启动参数（`start` 和 `coding` 命令）

```
--token <token>            Hatchet API Token（JWT）
--host-port <host:port>    gRPC 地址
--api-url <url>            REST API 地址
--tenant-id <id>           租户 ID
--tls-strategy <strategy>  TLS 策略: tls, mtls, none（默认: none）
--name <name>              覆盖自动生成的 Worker 名称
--workflow-suffix <suffix> 工作流名称后缀
--slots <n>                最大并发任务数
--work-dir <path>          Claude Code 工作目录
--omc-dir <path>           oh-my-claudecode 插件目录
--config <path>            配置文件路径（默认: .coding-worker.yaml）
```

## 使用 PM2 守护进程管理

使用 [PM2](https://pm2.keymetrics.io/) 将 Worker 作为常驻守护进程运行。

### 安装 PM2

```bash
npm install -g pm2
```

### 启动 Worker

由于 `coding-worker` 是通过 npm 安装的全局命令，PM2 可以直接使用它启动：

```bash
# Simple 工作流
pm2 start coding-worker --name coding-worker -- start

# Coding 工作流（带参数）
pm2 start coding-worker --name coding-worker -- coding \
  --token <your-token> \
  --work-dir /path/to/project \
  --slots 3
```

> **注意：** 如果提示找不到 `coding-worker`，在项目目录下执行 `npm link` 注册全局 bin，或改用完整路径 `node dist/bin/coding-worker.js`。

### 使用 Ecosystem 配置文件

创建 `ecosystem.config.js`：

```js
module.exports = {
  apps: [
    {
      name: 'coding-worker',
      script: 'coding-worker',   // npm bin 命令
      args: 'start',
      env: {
        HATCHET_CLIENT_TOKEN: '<your-hatchet-jwt-token>',
        CODING_WORKER_WORK_DIR: '/path/to/project',
        CODING_WORKER_SLOTS: 3,
      },
      max_restarts: 10,
      restart_delay: 5000,
      watch: false,
      autorestart: true,
    },
  ],
};
```

然后通过配置文件启动：

```bash
pm2 start ecosystem.config.js
```

### 常用 PM2 命令

```bash
pm2 list                    # 查看所有进程
pm2 logs coding-worker      # 查看日志流
pm2 restart coding-worker   # 重启 Worker
pm2 stop coding-worker      # 停止 Worker
pm2 delete coding-worker    # 从 PM2 中删除
pm2 monit                   # 实时监控面板
```

### 开机自启动

`pm2 startup` 会在系统层面注册一个自启动服务（macOS 为 LaunchDaemon，Linux 为 systemd）。机器重启后，PM2 会自动启动并恢复所有通过 `pm2 save` 保存的进程。

```bash
pm2 startup                 # 输出一条 sudo 命令，执行它来注册系统服务
pm2 save                    # 保存当前进程列表（重启后自动恢复）
```

## 工作原理

1. **Worker 连接** — 连接到 Hatchet 实例并注册工作流
2. **接收任务** — 任务推送到队列后，Worker 自动拉取
3. **Prepare** — 在独立分支上创建 git worktree（非 git 仓库则跳过）
4. **Execute** — Claude Code 在 worktree 目录中执行任务
   - `simple` 模式：直接传入 prompt
   - `autopilot` 模式：prompt 前缀加 `/autopilot`
   - `ralplan` 模式：先执行 `/ralplan` 规划，再执行 `/team ralph` 实现
5. **Commit** — 变更自动提交到分支，worktree 被移除，分支保留

## 许可证

MIT
