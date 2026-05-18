import { query } from '@anthropic-ai/claude-agent-sdk';
import * as path from 'path';
import { findOmcPluginDir } from './omc-setup';

export interface RunClaudeOptions {
  prompt: string;
  workDir: string;
  omcDir?: string;
}

export async function runClaude(opts: RunClaudeOptions): Promise<string> {
  const omcDir = findOmcPluginDir(opts.omcDir);

  const queryOptions: Record<string, unknown> = {
    cwd: opts.workDir,
  };

  if (omcDir) {
    queryOptions.pluginDir = [omcDir];
  }

  let result = '';

  for await (const message of query({
    prompt: opts.prompt,
    options: queryOptions as Parameters<typeof query>[0]['options'],
  })) {
    if (message.type === 'result' && message.subtype === 'success') {
      result = message.result;
    }
  }

  return result;
}
