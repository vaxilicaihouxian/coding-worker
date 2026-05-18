import { HatchetClient } from '@hatchet-dev/typescript-sdk';
import { CodingTaskInput, CodingTaskInputSchema, parseMode } from './schemas';
import { runClaude } from '../claude-runner';

export function createCodingTaskWorkflow(hatchet: HatchetClient, workflowName: string) {
  const workflow = hatchet.workflow<CodingTaskInput>({
    name: workflowName,
    inputValidator: CodingTaskInputSchema,
    description: 'Unified coding task. Prefix "autopilot" for simple tasks, "ralplan" for complex tasks (plan then execute automatically).',
  });

  workflow.task({
    name: 'execute',
    executionTimeout: '300m',
    fn: async (input: CodingTaskInput, ctx: any) => {
      const { mode, task } = parseMode(input.description);
      const workDir = input.workDir || process.cwd();
      const log = (msg: string) => ctx.logger.info(msg);

      if (mode === 'autopilot') {
        await ctx.logger.info('=== Mode: autopilot ===');
        const { steps, summary } = await runClaude({ prompt: `autopilot ${task}`, workDir }, log);
        return { mode: 'autopilot', result: summary, steps };
      }

      // ralplan: plan first, then execute
      await ctx.logger.info('=== Mode: ralplan — Step 1: Planning ===');
      const planResult = await runClaude({ prompt: `ralplan ${task}`, workDir }, log);

      await ctx.logger.info('=== Mode: ralplan — Step 2: Executing ===');
      const executeResult = await runClaude({ prompt: `team ralph 按你规划的去实现吧！`, workDir }, log);

      return {
        mode: 'ralplan',
        plan: planResult.summary,
        planSteps: planResult.steps,
        result: executeResult.summary,
        resultSteps: executeResult.steps,
      };
    },
  });

  return workflow;
}
