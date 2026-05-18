import { HatchetClient } from '@hatchet-dev/typescript-sdk';
import { CodingTaskInput, CodingTaskInputSchema } from './schemas';
import { runClaude } from '../claude-runner';

export function createRalplanWorkflow(hatchet: HatchetClient) {
  const workflow = hatchet.workflow<CodingTaskInput>({
    name: 'coding-ralplan',
    inputValidator: CodingTaskInputSchema,
    description: 'Complex coding task - planning phase using ralplan consensus workflow',
  });

  workflow.task({
    name: 'plan',
    fn: async (input: CodingTaskInput) => {
      const result = await runClaude({
        prompt: `/oh-my-claudecode:ralplan ${input.description}`,
        workDir: input.workDir || process.cwd(),
      });
      return { plan: result };
    },
  });

  return workflow;
}
