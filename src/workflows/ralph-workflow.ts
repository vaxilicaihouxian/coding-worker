import { HatchetClient } from '@hatchet-dev/typescript-sdk';
import { RalphTaskInput, RalphTaskInputSchema } from './schemas';
import { runClaude } from '../claude-runner';

export function createRalphWorkflow(hatchet: HatchetClient) {
  const workflow = hatchet.workflow<RalphTaskInput>({
    name: 'coding-ralph',
    inputValidator: RalphTaskInputSchema,
    description: 'Complex coding task - execution phase using ralph persistence loop',
  });

  workflow.task({
    name: 'execute',
    fn: async (input: RalphTaskInput) => {
      const result = await runClaude({
        prompt: `/oh-my-claudecode:ralph team ralph 按你规划的去实现吧！`,
        workDir: input.workDir || process.cwd(),
      });
      return { result };
    },
  });

  return workflow;
}
