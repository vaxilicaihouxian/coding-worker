import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { HatchetClient } from '@hatchet-dev/typescript-sdk';
import { CodingTaskInput, CodingTaskInputSchema, parseMode } from './schemas';
import { runClaude } from '../claude-runner';
import { emitFinishEvent } from '../notify';

function generateBranchName(): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `coding-${ts}-${rand}`;
}

function isGitRepo(dir: string): boolean {
  try {
    execSync('git rev-parse --is-inside-work-tree', { cwd: dir, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export function createCodingTaskWorkflow(hatchet: HatchetClient, workflowName: string) {
  const workflow = hatchet.workflow<CodingTaskInput>({
    name: workflowName,
    inputValidator: CodingTaskInputSchema,
    description: 'Unified coding task. Prefix "autopilot" for simple tasks, "ralplan" for complex tasks (plan then execute automatically).',
    taskDefaults: {
      executionTimeout: '300m',
      scheduleTimeout: '10h',
    },
  });

  // ── Step 1: prepare — git worktree 隔离 ────────────────────
  const prepareTask = workflow.task({
    name: 'prepare',
    fn: async (input: CodingTaskInput, ctx: any) => {
      const baseDir = input.workDir || process.cwd();
      await ctx.logger.info(`[Prepare] baseDir=${baseDir}`);

      if (!isGitRepo(baseDir)) {
        await ctx.logger.info('[Prepare] not a git repo, skipping worktree isolation');
        return { workDir: baseDir, branch: '', isWorktree: false };
      }

      const branch = generateBranchName();
      const worktreePath = path.join(baseDir, '.worktrees', branch);

      // 确保 .worktrees/ 在 .gitignore 中
      const gitignorePath = path.join(baseDir, '.gitignore');
      const gitignoreContent = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf-8') : '';
      if (!gitignoreContent.split('\n').some((l: string) => l.trim() === '.worktrees')) {
        fs.appendFileSync(gitignorePath, (gitignoreContent && !gitignoreContent.endsWith('\n') ? '\n' : '') + '.worktrees\n');
      }

      await ctx.logger.info(`[Prepare] creating worktree: branch=${branch}, path=${worktreePath}`);
      execSync(`git worktree add "${worktreePath}" -b ${branch}`, { cwd: baseDir, stdio: 'pipe' });
      await ctx.logger.info(`[Prepare] worktree created`);

      return { workDir: worktreePath, branch, isWorktree: true };
    },
  });
  // ── Step 2: execute — 编码 ─────────────────────────────────
  const executeTask = workflow.task({
    name: 'execute',
    parents: [prepareTask],
    fn: async (input: CodingTaskInput, ctx: any) => {
      const prepareResult: any = await ctx.parentOutput(prepareTask);
      const workDir = prepareResult.workDir;
      const { mode, task } = parseMode(input.description);
      const log = (msg: string) => ctx.logger.info(msg);

      await ctx.logger.info(`[Execute] mode=${mode}, workDir=${workDir}`);

      if (mode === 'autopilot') {
        const { steps, summary } = await runClaude({ prompt: `/autopilot ${task}`, workDir }, log);
        return { mode: 'autopilot', result: summary, steps, workDir };
      }

      // ralplan: plan first, then resume session to execute
      await ctx.logger.info('[Execute] ralplan — planning');
      const planResult = await runClaude({ prompt: `/ralplan ${task}`, workDir }, log);

      await ctx.logger.info(`[Execute] ralplan — executing (resuming session ${planResult.sessionId})`);
      const executeResult = await runClaude({
        prompt: `/team ralph 按你规划的去实现吧！`,
        workDir,
        resume: planResult.sessionId,
      }, log);

      return {
        mode: 'ralplan',
        plan: planResult.summary,
        planSteps: planResult.steps,
        result: executeResult.summary,
        resultSteps: executeResult.steps,
        workDir,
      };
    },
  });
  // ── Step 3: commit — git add/commit + emit finish event ──────
  workflow.task({
    name: 'commit',
    parents: [executeTask],
    fn: async (input: CodingTaskInput, ctx: any) => {
      const prepareResult: any = await ctx.parentOutput(prepareTask);
      const executeResult: any = await ctx.parentOutput(executeTask);
      const workDir = prepareResult.workDir;
      const branch = prepareResult.branch;
      const isWorktree = prepareResult.isWorktree;
      let committed = false;

      if (!isWorktree) {
        await ctx.logger.info('[Commit] not a worktree, skipping git commit');
      } else {
        const status = execSync('git status --porcelain', { cwd: workDir, encoding: 'utf-8' }).trim();
        if (!status) {
          await ctx.logger.info(`[Commit] no changes to commit on branch ${branch}`);
        } else {
          await ctx.logger.info(`[Commit] committing changes on branch ${branch}`);
          execSync('git add -A', { cwd: workDir, stdio: 'pipe' });
          const message = `coding-worker: ${input.description.slice(0, 72)}`;
          execSync(`git commit -m ${JSON.stringify(message)}`, { cwd: workDir, stdio: 'pipe' });
          await ctx.logger.info(`[Commit] committed to branch: ${branch}`);

          const baseDir = input.workDir || process.cwd();
          execSync(`git worktree remove "${workDir}"`, { cwd: baseDir, stdio: 'pipe' });
          await ctx.logger.info(`[Commit] worktree removed, branch ${branch} preserved`);
          committed = true;
        }
      }

      const result = executeResult.result || executeResult.plan;

      await emitFinishEvent(hatchet, workflowName, {
        runId: ctx.workflowRunId(),
        workflowName,
        prompt: input.description,
        codingOutput: result,
        status: 'completed',
        branch: branch || undefined,
        committed,
      });
      await ctx.logger.info(`[Commit] finish event emitted for run ${ctx.workflowRunId()}`);

      return {
        branch,
        committed,
        workDir,
        result,
      };
    },
  });

  return workflow;
}
