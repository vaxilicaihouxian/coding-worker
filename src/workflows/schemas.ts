import { z } from 'zod/v4';

export const CodingTaskInputSchema = z.object({
  description: z.string().describe('Task description, prefix with "autopilot" or "ralplan" to select mode'),
  workDir: z.string().optional().describe('Working directory for Claude Code'),
});

export type CodingTaskInput = z.infer<typeof CodingTaskInputSchema>;

export type TaskMode = 'autopilot' | 'ralplan';

export function parseMode(description: string): { mode: TaskMode; task: string } {
  const trimmed = description.trim();
  if (trimmed.startsWith('autopilot ')) {
    return { mode: 'autopilot', task: trimmed.slice('autopilot '.length) };
  }
  if (trimmed.startsWith('ralplan ')) {
    return { mode: 'ralplan', task: trimmed.slice('ralplan '.length) };
  }
  // default to autopilot
  return { mode: 'autopilot', task: trimmed };
}
