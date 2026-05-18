import * as os from 'os';
import * as path from 'path';

export function generateWorkerName(): string {
  const hostname = os.hostname();
  const dirName = path.basename(process.cwd());
  return `${hostname}-${dirName}`;
}

export const WORKFLOW_PREFIX = 'coding-workflow-';

export function generateWorkflowName(suffix?: string): string {
  if (suffix) return `${WORKFLOW_PREFIX}${suffix}`;
  const hostname = os.hostname();
  const dirName = path.basename(process.cwd());
  return `${WORKFLOW_PREFIX}${hostname}-${dirName}`;
}
