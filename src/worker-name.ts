import * as os from 'os';
import * as path from 'path';
import { execSync } from 'child_process';

export function generateWorkerName(): string {
  const hostname = os.hostname();
  const dirName = path.basename(process.cwd());
  const branch = getGitBranch() || 'nobranch';
  return `${hostname}-${dirName}-${branch}`;
}

function getGitBranch(): string | null {
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return branch || null;
  } catch {
    return null;
  }
}
