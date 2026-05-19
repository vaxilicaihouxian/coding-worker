# Coding Worker

> Want the model to implement your requirements while you sleep? Coding Worker makes your server work its tail off at night — just dispatch tasks and let it rip!

A distributed coding task worker powered by [Hatchet](https://hatchet.run/) and [Claude Code](https://docs.anthropic.com/en/docs/claude-code) (via `@anthropic-ai/claude-agent-sdk`), with [oh-my-claudecode](https://github.com/anthropics/claude-code) plugin support.

It connects to a Hatchet instance as a worker, receives coding tasks from the queue, and drives Claude Code to execute them — with automatic git worktree isolation, branch management, and result streaming.

> **Strongly recommended:** Install the [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode) plugin globally on the machine running the worker, then use `coding-worker coding` mode to fully unleash autopilot and ralplan for hands-free, full-auto execution!

## Features

- **Distributed Task Queue** — Built on Hatchet; tasks are submitted to a queue and distributed to available workers
- **Two Workflow Types**
  - `simple` — Executes the task description directly through Claude Code
  - `coding` — Supports `autopilot` (autonomous execution) and `ralplan` (plan-then-execute) modes via oh-my-claudecode
- **Git Worktree Isolation** — Each task runs in an isolated git worktree on a new branch; changes are auto-committed and the worktree is cleaned up while the branch is preserved for review
- **Real-time Logging** — Every Claude Code step (thinking, tool calls, tool results) is streamed back through Hatchet logs
- **Flexible Configuration** — Supports config file (`.coding-worker.yaml`), environment variables, and CLI flags

## Prerequisites

- Node.js >= 18.0.0
- A running [Hatchet](https://docs.hatchet.run/) instance with an API token
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed and authenticated (`claude` in PATH)

## Installation

```bash
git clone <repo-url> coding-worker
cd coding-worker
npm install
npm run build

# Register the global bin command (so you can run `coding-worker` anywhere)
npm link
```

## Environment Setup

Before starting the worker, set the required environment variables:

```bash
# Hatchet connection
export HATCHET_CLIENT_TOKEN="your-hatchet-token"

# Anthropic API (or compatible endpoint)
export ANTHROPIC_AUTH_TOKEN=your-token-api-key
export ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic

# Model configuration (use the same model for all tiers, or customize per tier)
export ANTHROPIC_MODEL=deepseek-v4-flash
export ANTHROPIC_DEFAULT_HAIKU_MODEL=deepseek-v4-flash
export ANTHROPIC_DEFAULT_OPUS_MODEL=deepseek-v4-flash
export ANTHROPIC_DEFAULT_SONNET_MODEL=deepseek-v4-flash
```

> **Tip:** Add these to your `~/.bashrc`, `~/.zshrc`, or the PM2 ecosystem file to persist them across sessions.

## Configuration

All configuration can be done via environment variables (recommended) or CLI flags. A `.coding-worker.yaml` config file is also supported as an alternative — see below.

### Environment Variables

**Required:**

| Variable | Description |
|---|---|
| `HATCHET_CLIENT_TOKEN` | Hatchet API token (JWT) |

**Optional (auto-extracted from JWT if omitted):**

| Variable | Description |
|---|---|
| `HATCHET_CLIENT_HOST_PORT` | gRPC address |
| `HATCHET_CLIENT_API_URL` | REST API address |
| `HATCHET_CLIENT_TENANT_ID` | Tenant ID |
| `HATCHET_CLIENT_TLS_STRATEGY` | `tls`, `mtls`, or `none` (default: `none`) |

**Worker settings:**

| Variable | Description |
|---|---|
| `CODING_WORKER_NAME` | Worker name (auto-generated if omitted) |
| `CODING_WORKER_WORKFLOW_SUFFIX` | Workflow name suffix |
| `CODING_WORKER_SLOTS` | Max concurrent tasks (default: 2) |
| `CODING_WORKER_WORK_DIR` | Claude Code working directory (default: cwd) |

**Priority:** CLI flags > environment variables > config file > JWT defaults.

### Config File (`.coding-worker.yaml`) — Optional

```yaml
hatchet:
  token: <your-hatchet-jwt-token>
  host_port: <grpc-address>        # optional, auto-extracted from JWT
  api_url: <rest-api-address>      # optional, auto-extracted from JWT
  tenant_id: <tenant-id>           # optional, auto-extracted from JWT
  tls_strategy: none               # tls | mtls | none

worker:
  name: my-coding-worker           # optional, auto-generated from hostname+dirname
  workflow_suffix: my-project      # optional, workflow name becomes coding-workflow-{suffix}
  slots: 2                         # max concurrent tasks (default: 2)
  work_dir: /path/to/project       # Claude Code working directory (default: cwd)
```

## Usage

### Start a Worker

**Simple workflow** (direct execution):

```bash
npm start
# or
coding-worker start --token <your-token>
```

**Coding workflow** (autopilot/ralplan modes):

```bash
npm run start -- coding --token <your-token>
# or
coding-worker coding --token <your-token>
```

### Available CLI Commands

| Command | Description |
|---|---|
| `coding-worker start` | Start worker with simple workflow |
| `coding-worker coding` | Start worker with coding workflow (autopilot/ralplan) |
| `coding-worker workflows` | List registered workflows |
| `coding-worker trigger [description]` | Trigger a coding task workflow |

### Trigger a Task

```bash
# Specify workflow name and description directly
coding-worker trigger coding-workflow-my-project "Fix the login button styling"

# Autopilot mode (coding workflow)
coding-worker trigger coding-workflow-my-project "autopilot Refactor the auth module"

# Ralplan mode — plan first, then execute (coding workflow)
coding-worker trigger coding-workflow-my-project "ralplan Add user profile page with avatar upload"

# Use -d flag for description
coding-worker trigger coding-workflow-my-project -d "Add unit tests"

# Omit workflow name — interactive selection from available workflows
coding-worker trigger "Fix typo in README"

# Fire and forget (no log streaming)
coding-worker trigger coding-workflow-my-project "Fix typo in README" --no-wait

# Specify working directory
coding-worker trigger coding-workflow-my-project "Add unit tests" --work-dir /path/to/project
```

> **Workflow resolution:** If the first positional argument matches a registered workflow name, it's used as the workflow and the second argument is the description. If it doesn't match any workflow, it's treated as the description and you'll be prompted to select a workflow.

### CLI Options (for `start` and `coding`)

```
--token <token>            Hatchet API Token (JWT)
--host-port <host:port>    gRPC address
--api-url <url>            REST API address
--tenant-id <id>           Tenant ID
--tls-strategy <strategy>  TLS strategy: tls, mtls, none (default: none)
--name <name>              Override auto-generated worker name
--workflow-suffix <suffix> Workflow name suffix
--slots <n>                Max concurrent tasks
--work-dir <path>          Claude Code working directory
--omc-dir <path>           oh-my-claudecode plugin directory
--config <path>            Config file path (default: .coding-worker.yaml)
```

## Process Management with PM2

Use [PM2](https://pm2.keymetrics.io/) to run the worker as a persistent daemon.

### Install PM2

```bash
npm install -g pm2
```

### Start the Worker

Since `coding-worker` is installed as an npm bin command, you can start it directly:

```bash
# Simple workflow
pm2 start coding-worker --name coding-worker -- start

# Coding workflow with options
pm2 start coding-worker --name coding-worker -- coding \
  --token <your-token> \
  --work-dir /path/to/project \
  --slots 3
```

> **Note:** If `coding-worker` is not found, use `npm link` in the project directory to register the global bin, or use the full path `node dist/bin/coding-worker.js` instead.

### Using an Ecosystem File

Create `ecosystem.config.js`:

```js
module.exports = {
  apps: [
    {
      name: 'coding-worker',
      script: 'coding-worker',   // npm bin command
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

Then start with:

```bash
pm2 start ecosystem.config.js
```

### Common PM2 Commands

```bash
pm2 list                    # View all processes
pm2 logs coding-worker      # Stream logs
pm2 restart coding-worker   # Restart the worker
pm2 stop coding-worker      # Stop the worker
pm2 delete coding-worker    # Remove from PM2
pm2 monit                   # Real-time monitoring dashboard
```

### Auto-start on Boot

`pm2 startup` registers PM2 as a system service (LaunchDaemon on macOS, systemd on Linux). After a machine reboot, PM2 starts automatically and restores all processes saved with `pm2 save`.

```bash
pm2 startup                 # Outputs a sudo command — run it to register the service
pm2 save                    # Save current process list (so they restart after reboot)
```

## How It Works

1. **Worker connects** to your Hatchet instance and registers a workflow
2. **Task received** — when a task is pushed to the queue, the worker picks it up
3. **Prepare** — a git worktree is created on an isolated branch (skipped if not a git repo)
4. **Execute** — Claude Code runs the task prompt in the worktree directory
   - `simple` mode: prompt is passed directly
   - `autopilot` mode: prompt is prefixed with `/autopilot`
   - `ralplan` mode: first `/ralplan` for planning, then `/team ralph` for execution
5. **Commit** — changes are auto-committed to the branch, worktree is removed, branch is preserved

## License

MIT
