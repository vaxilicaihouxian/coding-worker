import { HatchetClient } from '@hatchet-dev/typescript-sdk';
import z from 'zod/v4';

export function finishEventName(workflowName: string): string {
  return `${workflowName}.finish`;
}

export const FinishEventPayloadSchema = z.object({
  runId: z.string(),
  workflowName: z.string(),
  prompt: z.string(),
  codingOutput: z.string(),
  status: z.string(),
  branch: z.string().optional(),
  committed: z.boolean().optional(),
  timestamp: z.string(),
});

export type FinishEventPayload = z.infer<typeof FinishEventPayloadSchema>;

export async function emitFinishEvent(
  hatchet: HatchetClient,
  workflowName: string,
  payload: Omit<FinishEventPayload, 'timestamp'>,
) {
  const event = finishEventName(workflowName);
  const fullPayload = { ...payload, timestamp: new Date().toISOString() };
  await hatchet.events.push(event, fullPayload);
}
