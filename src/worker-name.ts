import * as os from 'os';
import * as path from 'path';

function generateBaseSuffix(): string {
  const hostname = os.hostname();
  const dirName = path.basename(process.cwd());
  return `${hostname}-${dirName}`;
}

export const WORKFLOW_PREFIX = 'coding-worker-';

export function generateWorkerName(suffix?: string): string {
  return `${WORKFLOW_PREFIX}${suffix || generateBaseSuffix()}`;
}

export function generateWorkflowName(suffix?: string): string {
  return `${WORKFLOW_PREFIX}${suffix || generateBaseSuffix()}`;
}

export function generateNotifyName(suffix?: string): string {
  return `infoflow-${suffix || generateBaseSuffix()}`;
}
