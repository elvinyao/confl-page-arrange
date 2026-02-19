import { DeploymentType } from '@confl/shared';
import { CloudConfluenceAdapter } from './cloud.js';
import { DcConfluenceAdapter } from './dc.js';
import { AdapterConfig, ConfluenceAdapter } from './types.js';

export function createAdapter(config: AdapterConfig): ConfluenceAdapter {
  if (config.deploymentType === 'cloud') {
    return new CloudConfluenceAdapter(config);
  }
  return new DcConfluenceAdapter(config);
}

export function parseDeploymentType(value: string): DeploymentType {
  if (value === 'cloud' || value === 'dc') {
    return value;
  }
  throw new Error(`Unsupported deployment type: ${value}`);
}

export * from './types.js';
