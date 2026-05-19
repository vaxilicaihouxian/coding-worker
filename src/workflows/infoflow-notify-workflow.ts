import { HatchetClient } from '@hatchet-dev/typescript-sdk';
import { FinishEventPayloadSchema, FinishEventPayload, finishEventName } from '../notify';

export function createInfoflowNotifyWorkflow(hatchet: HatchetClient, workflowName: string) {
  const eventName = finishEventName(workflowName);
  const suffix = workflowName.replace(/^coding-workflow-/, '');
  const notifyWorkflowName = suffix ? `infoflow-notify-${suffix}` : 'infoflow-notify';

  const workflow = hatchet.workflow<FinishEventPayload>({
    name: notifyWorkflowName,
    description: `Listens for ${eventName} events and sends Infoflow webhook notification`,
    onEvents: [eventName],
    inputValidator: FinishEventPayloadSchema,
  });

  workflow.task({
    name: 'send-infoflow',
    executionTimeout: '2m',
    retries: 3,
    fn: async (input: FinishEventPayload, ctx: any) => {
      const webhookUrl = process.env.INFOFLOW_WEBHOOK_URL;
      if (!webhookUrl) {
        throw new Error('INFOFLOW_WEBHOOK_URL environment variable is not set');
      }

      const trunc = (s: string, max: number) =>
        s.length > max ? s.slice(0, max - 3) + '...' : s;

      const header = [
        '# Coding Task Completed',
        '',
        '| Field | Value |',
        '|----|----|',
        `| Run ID | ${input.runId} |`,
        `| Workflow | ${input.workflowName} |`,
        `| Status | ${input.status} |`,
        `| Branch | ${input.branch || '-'} |`,
        `| Committed | ${input.committed != null ? input.committed : '-'} |`,
        `| Timestamp | ${input.timestamp} |`,
      ].join('\n');

      const MAX = 2000;
      let budget = MAX - header.length - 40;
      const outputBudget = Math.floor(budget * 0.85);
      const promptBudget = budget - outputBudget;

      const content = header + [
        '',
        '## Prompt',
        trunc(input.prompt, promptBudget),
        '',
        '## Output',
        '',
        trunc(input.codingOutput, outputBudget),
        '',
      ].join('\n');

      const payload = {
        message: {
          header: {
            eventType: eventName,
            runId: input.runId,
            workflowName: input.workflowName,
            status: input.status,
            timestamp: input.timestamp,
          },
          body: [
            {
              type: 'MD',
              content,
            },
          ],
        },
      };

      await ctx.logger.info(`[Infoflow] sending to ${webhookUrl}`);

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Infoflow webhook failed: ${response.status} ${response.statusText}`);
      }

      await ctx.logger.info(`[Infoflow] sent successfully, status=${response.status}`);
      return { status: 'sent', webhookStatus: response.status };
    },
  });

  return workflow;
}
