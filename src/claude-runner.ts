import { query } from '@anthropic-ai/claude-agent-sdk';

export interface RunClaudeOptions {
  prompt: string;
  workDir: string;
}

export type Logger = (message: string) => Promise<void> | void;

export interface StepEntry {
  step: number;
  type: 'thinking' | 'tool_call' | 'tool_result' | 'result' | 'error';
  content: string;
}

export interface RunClaudeResult {
  steps: StepEntry[];
  summary: string;
}

export async function runClaude(opts: RunClaudeOptions, log?: Logger): Promise<RunClaudeResult> {
  const steps: StepEntry[] = [];
  let stepCount = 0;
  await log?.(`[Claude] 任务接收:${JSON.stringify(opts)}`);
  for await (const message of query({
    prompt: opts.prompt,
    options: {
      cwd: opts.workDir,
      permissionMode: 'bypassPermissions',
    },
  })) {
    const msg = message as any;

    if (msg.type === 'system') {
      if (msg.subtype === 'init') {
        const model = msg.model || 'unknown';
        await log?.(`[System] session init, model=${model}`);
      } else if (msg.subtype === 'success') {
        const result = msg.result || '';
        steps.push({ step: ++stepCount, type: 'result', content: result });
      }
      continue;
    }

    if (msg.type === 'assistant') {
      const blocks = msg.message?.content;
      if (Array.isArray(blocks)) {
        for (const block of blocks) {
          if (block.type === 'text' && block.text) {
            steps.push({ step: ++stepCount, type: 'thinking', content: block.text });
            await log?.(`[Claude] ${block.text}`);
          }
          if (block.type === 'tool_use') {
            const toolName = block.name || 'unknown';
            steps.push({ step: ++stepCount, type: 'tool_call', content: `调用工具: ${toolName}` });
            await log?.(`[Tool] ${toolName}`);
          }
        }
      }
      continue;
    }

    if (msg.type === 'user') {
      const tr = msg.tool_use_result;
      if (tr) {
        const raw = tr.stdout || tr.stderr || JSON.stringify(tr).slice(0, 500);
        steps.push({ step: ++stepCount, type: 'tool_result', content: raw.slice(0, 500) });
        await log?.(`[ToolResult] ${raw.slice(0, 200)}`);
      }
    }
  }

  const explicitResult = steps
    .filter((s) => s.type === 'result')
    .map((s) => s.content)
    .join('\n');
  const thinkingSummary = steps
    .filter((s) => s.type === 'thinking')
    .map((s) => s.content)
    .join('\n');
  const summary = explicitResult || thinkingSummary;

  return { steps, summary };
}
