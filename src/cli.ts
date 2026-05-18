import { Command } from 'commander';
import { startWorker } from './start';

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

program.parse();
