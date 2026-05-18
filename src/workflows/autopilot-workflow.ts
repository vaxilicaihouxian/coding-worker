import { HatchetClient } from '@hatchet-dev/typescript-sdk';
import { CodingTaskInput, CodingTaskInputSchema } from './schemas';
import { runClaude } from '../claude-runner';

export function createAutopilotWorkflow(hatchet: HatchetClient) {
  const workflow = hatchet.workflow<CodingTaskInput>({
    name: 'coding-autopilot',
    inputValidator: CodingTaskInputSchema,
    description: 'Simple coding task using autopilot mode - full autonomous execution from idea to working code',
  });

  workflow.task({
    name: 'execute',
    fn: async (input: CodingTaskInput) => {
      const result = await runClaude({
        prompt: `/oh-my-claudecode:autopilot ${input.description}`,
        workDir: input.workDir || process.cwd(),
      });
      return { result };
    },
  });

  return workflow;
}
