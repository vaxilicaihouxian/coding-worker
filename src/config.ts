import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { parse as parseYaml } from 'yaml';

export interface Config {
  token: string;
  host_port?: string;
  api_url?: string;
  tenant_id?: string;
  tls_strategy: 'tls' | 'mtls' | 'none';
  worker_name: string;
  workflow_suffix: string;
  slots: number;
  work_dir: string;
}

export interface CliArgs {
  token?: string;
  hostPort?: string;
  apiUrl?: string;
  tenantId?: string;
  tlsStrategy?: 'tls' | 'mtls' | 'none';
  name?: string;
  workflowSuffix?: string;
  slots?: number;
  workDir?: string;
  config?: string;
}

interface FileConfig {
  hatchet?: {
    token?: string;
    host_port?: string;
    api_url?: string;
    tenant_id?: string;
    tls_strategy?: 'tls' | 'mtls' | 'none';
  };
  worker?: {
    name?: string;
    workflow_suffix?: string;
    slots?: number;
    work_dir?: string;
  };
}

function readYamlFile(filePath: string): FileConfig | null {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    return null;
  }
  try {
    const content = fs.readFileSync(resolved, 'utf-8');
    return parseYaml(content) as FileConfig;
  } catch {
    return null;
  }
}

function getAddressesFromJWT(token: string): { serverUrl?: string; grpcBroadcastAddress?: string } {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return {};
    const claimsData = Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
    const claims = JSON.parse(claimsData);
    return {
      serverUrl: claims.server_url,
      grpcBroadcastAddress: claims.grpc_broadcast_address,
    };
  } catch {
    return {};
  }
}

function getTenantIdFromJWT(token: string): string | undefined {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return undefined;
    const claimsData = Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
    const claims = JSON.parse(claimsData);
    return claims.sub;
  } catch {
    return undefined;
  }
}

export function loadConfig(cliArgs: CliArgs = {}): Config {
  const fileConfig = readYamlFile(cliArgs.config || '.coding-worker.yaml');

  const token = cliArgs.token
    ?? process.env.HATCHET_CLIENT_TOKEN
    ?? process.env.HATCHET_TOKEN
    ?? fileConfig?.hatchet?.token;

  if (!token) {
    throw new Error(
      'Hatchet token is required. Set HATCHET_CLIENT_TOKEN env var, use --token flag, or configure in .coding-worker.yaml'
    );
  }

  // Extract addresses from JWT token as defaults
  const jwtAddresses = getAddressesFromJWT(token);
  const jwtTenantId = getTenantIdFromJWT(token);

  return {
    token,
    host_port: cliArgs.hostPort
      ?? process.env.HATCHET_CLIENT_HOST_PORT
      ?? process.env.HATCHET_HOST_PORT
      ?? fileConfig?.hatchet?.host_port
      ?? jwtAddresses.grpcBroadcastAddress,
    api_url: cliArgs.apiUrl
      ?? process.env.HATCHET_CLIENT_API_URL
      ?? process.env.HATCHET_API_URL
      ?? fileConfig?.hatchet?.api_url
      ?? jwtAddresses.serverUrl,
    tenant_id: cliArgs.tenantId
      ?? process.env.HATCHET_CLIENT_TENANT_ID
      ?? process.env.HATCHET_TENANT_ID
      ?? fileConfig?.hatchet?.tenant_id
      ?? jwtTenantId,
    tls_strategy: cliArgs.tlsStrategy
      ?? (process.env.HATCHET_CLIENT_TLS_STRATEGY as 'tls' | 'mtls' | 'none' | undefined)
      ?? fileConfig?.hatchet?.tls_strategy
      ?? 'none',
    worker_name: cliArgs.name
      ?? process.env.CODING_WORKER_NAME
      ?? fileConfig?.worker?.name
      ?? '',
    workflow_suffix: cliArgs.workflowSuffix
      ?? process.env.CODING_WORKER_WORKFLOW_SUFFIX
      ?? fileConfig?.worker?.workflow_suffix
      ?? '',
    slots: cliArgs.slots
      ?? (process.env.CODING_WORKER_SLOTS ? parseInt(process.env.CODING_WORKER_SLOTS, 10) : undefined)
      ?? fileConfig?.worker?.slots
      ?? 10,
    work_dir: cliArgs.workDir
      ?? process.env.CODING_WORKER_WORK_DIR
      ?? fileConfig?.worker?.work_dir
      ?? process.cwd(),
  };
}
