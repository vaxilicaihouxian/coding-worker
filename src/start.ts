import { HatchetClient } from '@hatchet-dev/typescript-sdk/v1';
import { loadConfig, CliArgs } from './config';
import { generateWorkerName, generateWorkflowName, generateNotifyName } from './worker-name';
import { finishEventName } from './notify';
import { createCodingTaskWorkflow } from './workflows/coding-task-workflow';
import { createSimpleTaskWorkflow } from './workflows/simple-task-workflow';
import { createInfoflowNotifyWorkflow } from './workflows/infoflow-notify-workflow';

export type WorkflowType = 'simple' | 'coding';

export async function startWorker(cliArgs: CliArgs, workflowType: WorkflowType = 'simple') {
  console.log('Starting coding-worker...');

  // 1. Load config (host_port/api_url/tenant_id auto-extracted from JWT token)
  const config = loadConfig(cliArgs);

  // 2. Resolve worker name and workflow name (same value)
  const workerName = generateWorkerName(config.workflow_suffix);
  const workflowName = generateWorkflowName(config.workflow_suffix);
  console.log(`Worker name: ${workerName}`);
  console.log(`Workflow name: ${workflowName}`);

  // 4. Initialize Hatchet client
  const hatchet = HatchetClient.init({
    token: config.token,
    host_port: config.host_port,
    api_url: config.api_url,
    tenant_id: config.tenant_id,
    tls_config: {
      tls_strategy: config.tls_strategy,
    },
  });

  // 5. Register workflow based on type
  const workflow = workflowType === 'coding'
    ? createCodingTaskWorkflow(hatchet, workflowName)
    : createSimpleTaskWorkflow(hatchet, workflowName);
  console.log(`Workflow type: ${workflowType}`);

  console.log(`Actual slots: ${config.slots}`);
  // 6. Create and start worker
  const worker = await hatchet.worker(workerName, {
    workflows: [workflow],
    slots: config.slots,
  });

  console.log(`coding-worker "${workerName}" connected (tls: ${config.tls_strategy})`);
  console.log(`Workflow: ${workflowName}`);
  console.log('Waiting for tasks...');

  await worker.start();
}

export async function startNotifyWorker(cliArgs: CliArgs) {
  console.log('Starting infoflow notify worker...');

  const config = loadConfig(cliArgs);
  const notifyName = generateNotifyName(config.workflow_suffix);
  const codingWorkflowName = generateWorkflowName(config.workflow_suffix);

  const eventName = finishEventName(codingWorkflowName);
  console.log(`Notify worker name: ${notifyName}`);
  console.log(`Notify workflow name: ${notifyName}`);
  console.log(`Listening for event: ${eventName}`);

  const hatchet = HatchetClient.init({
    token: config.token,
    host_port: config.host_port,
    api_url: config.api_url,
    tenant_id: config.tenant_id,
    tls_config: {
      tls_strategy: config.tls_strategy,
    },
  });

  const infoflowWorkflow = createInfoflowNotifyWorkflow(hatchet, codingWorkflowName, notifyName);

  const worker = await hatchet.worker(notifyName, {
    workflows: [infoflowWorkflow],
  });

  console.log(`infoflow-notify-worker "${notifyName}" connected (tls: ${config.tls_strategy})`);
  console.log('Waiting for finish events...');

  await worker.start();
}
