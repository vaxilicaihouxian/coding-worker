import { HatchetClient } from '@hatchet-dev/typescript-sdk';
import { CodingTaskInput, CodingTaskInputSchema, parseMode } from './schemas';
import { runClaude } from '../claude-runner';

export function createCodingTaskWorkflow(hatchet: HatchetClient) {
  const workflow = hatchet.workflow<CodingTaskInput>({
    name: 'coding-task',
    inputValidator: CodingTaskInputSchema,
    description: 'Unified coding task. Prefix "autopilot" for simple tasks, "ralplan" for complex tasks (plan then execute automatically).',
  });

  workflow.task({
    name: 'execute',
    fn: async (input: CodingTaskInput) => {
      const { mode, task } = parseMode(input.description);
      const workDir = input.workDir || process.cwd();

      if (mode === 'autopilot') {
        // Simple task: one-shot autopilot
        const result = await runClaude({
          prompt: `autopilot ${task}`,
          workDir,
        });
        return { mode: 'autopilot', result };
      }

      // Complex task: ralplan plan first, then ralph execute
      const planResult = await runClaude({
        prompt: `ralplan ${task}`,
        workDir,
      });

      const executeResult = await runClaude({
        prompt: `team ralph 按你规划的去实现吧！`,
        workDir,
      });

      return { mode: 'ralplan', plan: planResult, result: executeResult };
    },
  });

  return workflow;
}
