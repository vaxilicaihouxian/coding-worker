import { z } from 'zod/v4';

export const CodingTaskInputSchema = z.object({
  description: z.string().describe('The coding task description'),
  workDir: z.string().optional().describe('Working directory for Claude Code'),
});

export type CodingTaskInput = z.infer<typeof CodingTaskInputSchema>;

export const RalphTaskInputSchema = z.object({
  planSummary: z.string().optional().describe('Summary of the plan from ralplan phase'),
  workDir: z.string().optional().describe('Working directory for Claude Code'),
});

export type RalphTaskInput = z.infer<typeof RalphTaskInputSchema>;
