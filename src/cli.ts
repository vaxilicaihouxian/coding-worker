import { Command } from 'commander';
import * as readline from 'readline';
import { startWorker } from './start';
import { WorkflowType } from './start';
import { loadConfig } from './config';
import { generateWorkflowName, WORKFLOW_PREFIX } from './worker-name';
import { HatchetClient } from '@hatchet-dev/typescript-sdk/v1';

const program = new Command();

program
  .name('coding-worker')
  .description('A Hatchet worker that executes coding tasks via Claude Code with oh-my-claudecode')
  .version('1.0.0');

program
  .command('start')
  .description('Start the coding worker')
  .option('--token <token>', 'Hatchet API Token (JWT, contains connection addresses)')
  .option('--host-port <host:port>', 'gRPC address (override JWT default)')
  .option('--api-url <url>', 'REST API address (override JWT default)')
  .option('--tenant-id <id>', 'Tenant ID (override JWT default)')
  .option('--tls-strategy <strategy>', 'TLS strategy: tls, mtls, none (default: none)', 'none')
  .option('--name <name>', 'Override auto-generated worker name')
  .option('--workflow-suffix <suffix>', 'Workflow name suffix (full name: coding-workflow-{suffix})')
  .option('--slots <n>', 'Max concurrent tasks', parseInt)
  .option('--work-dir <path>', 'Claude Code working directory')
  .option('--omc-dir <path>', 'oh-my-claudecode plugin directory')
  .option('--config <path>', 'Config file path (default: .coding-worker.yaml)')
  .action(async (opts) => {
    try {
      await startWorker(opts);
    } catch (err: any) {
      console.error('Failed to start coding-worker:', err.message);
      process.exit(1);
    }
  });

program
  .command('coding')
  .description('Start the coding worker with autopilot/ralplan workflow')
  .option('--token <token>', 'Hatchet API Token (JWT, contains connection addresses)')
  .option('--host-port <host:port>', 'gRPC address (override JWT default)')
  .option('--api-url <url>', 'REST API address (override JWT default)')
  .option('--tenant-id <id>', 'Tenant ID (override JWT default)')
  .option('--tls-strategy <strategy>', 'TLS strategy: tls, mtls, none (default: none)', 'none')
  .option('--name <name>', 'Override auto-generated worker name')
  .option('--workflow-suffix <suffix>', 'Workflow name suffix (full name: coding-workflow-{suffix})')
  .option('--slots <n>', 'Max concurrent tasks', parseInt)
  .option('--work-dir <path>', 'Claude Code working directory')
  .option('--omc-dir <path>', 'oh-my-claudecode plugin directory')
  .option('--config <path>', 'Config file path (default: .coding-worker.yaml)')
  .action(async (opts) => {
    try {
      await startWorker(opts, 'coding');
    } catch (err: any) {
      console.error('Failed to start coding-worker:', err.message);
      process.exit(1);
    }
  });

// ── helpers ──────────────────────────────────────────────────
function initClientFromOpts(opts: any) {
  const config = loadConfig(opts);
  return HatchetClient.init({
    token: config.token,
    host_port: config.host_port,
    api_url: config.api_url,
    tenant_id: config.tenant_id,
    tls_config: { tls_strategy: config.tls_strategy },
  });
}

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (ans) => { rl.close(); resolve(ans.trim()); }));
}

// ── workflows 子命令 ──────────────────────────────────────────
program
  .command('workflows')
  .description('List coding-workflow-* workflows')
  .option('--token <token>', 'Hatchet API Token')
  .option('--host-port <host:port>', 'gRPC address')
  .option('--api-url <url>', 'REST API address')
  .option('--tenant-id <id>', 'Tenant ID')
  .option('--tls-strategy <strategy>', 'TLS strategy', 'none')
  .option('--config <path>', 'Config file path')
  .option('--all', 'List all workflows, not just coding-workflow-*')
  .action(async (opts) => {
    try {
      const client = await initClientFromOpts(opts);
      const res = await client.workflows.list();
      const workflows = (res as any).rows || res;
      if (!Array.isArray(workflows) || workflows.length === 0) {
        console.log('No workflows found.');
        return;
      }
      const filtered = opts.all
        ? workflows
        : workflows.filter((w: any) => w.name?.startsWith(WORKFLOW_PREFIX));
      if (filtered.length === 0) {
        console.log(`No ${opts.all ? '' : 'coding-workflow-'} workflows found.`);
        return;
      }
      console.log(`${'Name'.padEnd(50)} ${'Paused'.padEnd(8)} ${'ID'.padEnd(40)}`);
      console.log('-'.repeat(98));
      for (const w of filtered) {
        const name = (w.name || '-').padEnd(50);
        const paused = String(w.isPaused ?? '-').padEnd(8);
        const id = (w.metadata?.id || '-').padEnd(40);
        console.log(`${name} ${paused} ${id}`);
      }
    } catch (err: any) {
      console.error('Failed to list workflows:', err.message);
      process.exit(1);
    }
  });

// ── trigger 子命令 ────────────────────────────────────────────
program
  .command('trigger [description]')
  .description('Trigger a coding-task workflow')
  .option('-d, --description <text>', 'Task description (alternative to positional arg)')
  .option('-w, --work-dir <path>', 'Working directory for Claude Code')
  .option('--workflow-suffix <suffix>', 'Workflow name suffix (full name: coding-workflow-{suffix})')
  .option('--no-wait', 'Fire and forget (do not stream logs)')
  .option('--token <token>', 'Hatchet API Token')
  .option('--host-port <host:port>', 'gRPC address')
  .option('--api-url <url>', 'REST API address')
  .option('--tenant-id <id>', 'Tenant ID')
  .option('--tls-strategy <strategy>', 'TLS strategy', 'none')
  .option('--config <path>', 'Config file path')
  .action(async (positionalDesc, opts) => {
    try {
      const client = await initClientFromOpts(opts);

      // 1. Show available workflows
      const res = await client.workflows.list();
      const workflows = (res as any).rows || res;
      const codingWorkflows = Array.isArray(workflows)
        ? workflows.filter((w: any) => w.name?.startsWith(WORKFLOW_PREFIX))
        : [];
      if (codingWorkflows.length > 0) {
        console.log('\nAvailable workflows:');
        for (const w of codingWorkflows) {
          console.log(`  - ${w.name}`);
        }
        console.log();
      } else {
        console.log('\nNo coding-workflow-* workflows found.\n');
      }

      // 2. Resolve workflow name — let user pick from list
      let workflowName = '';
      if (codingWorkflows.length === 0) {
        console.error('No coding-workflow-* workflows found. Cannot trigger.');
        process.exit(1);
      } else if (codingWorkflows.length === 1) {
        workflowName = codingWorkflows[0].name;
        console.log(`Auto-selected: ${workflowName}\n`);
      } else {
        console.log('Select a workflow:');
        codingWorkflows.forEach((w: any, i: number) => {
          console.log(`  ${i + 1}. ${w.name}`);
        });
        const ans = await ask('Enter number: ');
        const idx = parseInt(ans, 10) - 1;
        if (isNaN(idx) || idx < 0 || idx >= codingWorkflows.length) {
          console.error('Invalid selection.');
          process.exit(1);
        }
        workflowName = codingWorkflows[idx].name;
        console.log(`Selected: ${workflowName}\n`);
      }

      // 3. Get description
      let description = positionalDesc || opts.description;
      if (!description) {
        description = await ask('Enter task description: ');
        if (!description) {
          console.error('No description provided.');
          process.exit(1);
        }
      }

      const input: Record<string, any> = { description };
      if (opts.workDir) input.workDir = opts.workDir;

      // 4. Trigger
      const ref = await client.runNoWait(workflowName, input, {});
      const runId = await ref.runId;
      console.log(`Workflow triggered: runId=${runId}`);

      if (!opts.wait) return;

      // 5. Stream logs
      console.log('Streaming logs...\n');
      try {
        const stream = await client.runs.subscribeToStream(runId);
        for await (const chunk of stream) {
          process.stdout.write(chunk);
        }
      } catch {
        // subscribeToStream may not be available; fallback to polling
        let lastStatus = '';
        for (let i = 0; i < 360; i++) {
          await new Promise((r) => setTimeout(r, 5000));
          const run = await client.runs.get(runId);
          const task = (run as any).tasks?.[0];
          const status = task?.status || (run as any).status || '';
          if (status !== lastStatus) {
            console.log(`[${new Date().toISOString()}] status=${status}`);
            lastStatus = status;
          }
          if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(status)) {
            const output = task?.output || (run as any).output;
            if (output) console.log('\nResult:', JSON.stringify(output, null, 2));
            break;
          }
        }
      }
    } catch (err: any) {
      console.error('Trigger failed:', err.message);
      process.exit(1);
    }
  });

program.parse();
