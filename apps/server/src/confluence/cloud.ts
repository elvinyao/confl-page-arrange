import { BaseConfluenceAdapter } from './base.js';
import { AdapterConfig } from './types.js';

export class CloudConfluenceAdapter extends BaseConfluenceAdapter {
  constructor(config: AdapterConfig) {
    super(config);
  }

  protected restBasePath(): string {
    return '/wiki/rest/api';
  }
}
