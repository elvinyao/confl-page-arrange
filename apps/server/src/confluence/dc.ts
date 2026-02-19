import { BaseConfluenceAdapter } from './base.js';
import { AdapterConfig } from './types.js';

export class DcConfluenceAdapter extends BaseConfluenceAdapter {
  constructor(config: AdapterConfig) {
    super(config);
  }

  protected restBasePath(): string {
    return '/rest/api';
  }
}
