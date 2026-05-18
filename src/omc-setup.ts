import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

export function findOmcPluginDir(customDir?: string): string | null {
  if (customDir) {
    if (fs.existsSync(customDir)) {
      return customDir;
    }
    console.warn(`Custom omc dir not found: ${customDir}`);
    return null;
  }

  const cacheDir = path.join(os.homedir(), '.claude', 'plugins', 'cache', 'omc', 'oh-my-claudecode');
  if (!fs.existsSync(cacheDir)) {
    return null;
  }

  const versions = fs.readdirSync(cacheDir).sort().reverse();
  if (versions.length === 0) {
    return null;
  }

  return path.join(cacheDir, versions[0]);
}

export async function ensureOmcPlugin(customDir?: string): Promise<string | null> {
  let omcDir = findOmcPluginDir(customDir);

  if (omcDir) {
    console.log(`oh-my-claudecode plugin found at: ${omcDir}`);
    return omcDir;
  }

  console.log('oh-my-claudecode plugin not found locally, attempting auto-install...');

  try {
    execSync('claude plugin install oh-my-claudecode', {
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 120_000,
    });
    console.log('oh-my-claudecode plugin installed successfully');
  } catch (err) {
    console.warn(
      'Auto-install failed. Please install manually:\n' +
      '  claude plugin marketplace add https://github.com/Yeachan-Heo/oh-my-claudecode\n' +
      '  claude plugin install oh-my-claudecode'
    );
    return null;
  }

  omcDir = findOmcPluginDir(customDir);
  return omcDir;
}
