import { HatchetClient } from '@hatchet-dev/typescript-sdk/v1';
import { loadConfig, CliArgs } from './config';
import { generateWorkerName } from './worker-name';
import { ensureOmcPlugin } from './omc-setup';
import { createAutopilotWorkflow } from './workflows/autopilot-workflow';
import { createRalplanWorkflow } from './workflows/ralplan-workflow';
import { createRalphWorkflow } from './workflows/ralph-workflow';

export async function startWorker(cliArgs: CliArgs) {
  console.log('Starting coding-worker...');

  // 1. Load config (host_port/api_url/tenant_id auto-extracted from JWT token)
  const config = loadConfig(cliArgs);

  // 2. Ensure oh-my-claudecode plugin is available
  await ensureOmcPlugin(config.omc_dir);

  // 3. Resolve worker name
  const workerName = config.worker_name || generateWorkerName();
  console.log(`Worker name: ${workerName}`);

  // 4. Initialize Hatchet client with TLS disabled (HTTP)
  const hatchet = HatchetClient.init({
    token: config.token,
    host_port: config.host_port,
    api_url: config.api_url,
    tenant_id: config.tenant_id,
    tls_config: {
      tls_strategy: config.tls_strategy,
    },
  });

  // 5. Register workflows
  const autopilotWorkflow = createAutopilotWorkflow(hatchet);
  const ralplanWorkflow = createRalplanWorkflow(hatchet);
  const ralphWorkflow = createRalphWorkflow(hatchet);

  // 6. Create and start worker
  const worker = await hatchet.worker(workerName, {
    workflows: [autopilotWorkflow, ralplanWorkflow, ralphWorkflow],
    slots: config.slots,
  });

  console.log(`coding-worker "${workerName}" connected (tls: ${config.tls_strategy})`);
  console.log('Registered workflows: coding-autopilot, coding-ralplan, coding-ralph');
  console.log('Waiting for tasks...');

  await worker.start();
}
