import { HatchetClient } from '@hatchet-dev/typescript-sdk/v1';
import { loadConfig, CliArgs } from './config';
import { generateWorkerName } from './worker-name';
import { createCodingTaskWorkflow } from './workflows/coding-task-workflow';

export async function startWorker(cliArgs: CliArgs) {
  console.log('Starting coding-worker...');

  // 1. Load config (host_port/api_url/tenant_id auto-extracted from JWT token)
  const config = loadConfig(cliArgs);

  // 2. Resolve worker name
  const workerName = config.worker_name || generateWorkerName();
  console.log(`Worker name: ${workerName}`);

  // 3. Initialize Hatchet client
  const hatchet = HatchetClient.init({
    token: config.token,
    host_port: config.host_port,
    api_url: config.api_url,
    tenant_id: config.tenant_id,
    tls_config: {
      tls_strategy: config.tls_strategy,
    },
  });

  // 4. Register workflow
  const codingTaskWorkflow = createCodingTaskWorkflow(hatchet);

  // 5. Create and start worker
  const worker = await hatchet.worker(workerName, {
    workflows: [codingTaskWorkflow],
    slots: config.slots,
  });

  console.log(`coding-worker "${workerName}" connected (tls: ${config.tls_strategy})`);
  console.log('Workflow: coding-task | Plugin: oh-my-claudecode (bundled)');
  console.log('Waiting for tasks...');

  await worker.start();
}
