import { query } from '@anthropic-ai/claude-agent-sdk';

export interface RunClaudeOptions {
  prompt: string;
  workDir: string;
}

export async function runClaude(opts: RunClaudeOptions): Promise<string> {
  let result = '';

  for await (const message of query({
    prompt: opts.prompt,
    options: {
      cwd: opts.workDir,
      permissionMode: 'bypassPermissions',
    },
  })) {
    if (message.type === 'result' && message.subtype === 'success') {
      result = message.result;
    }
  }

  return result;
}
