import type { IModelVendor } from '../IModelVendor';
import type { OpenAIAccessSchema } from '../../server/openai/openai.router';

import { ModelVendorOpenAI } from '../openai/openai.vendor';


export interface DOpenPipeServiceSettings {
  openPipeKey: string;
  openPipeTags: string; // hack: this will travel as 'oaiOrg' in the access schema - then interpreted in the openAIAccess() function
}

export const ModelVendorOpenPipe: IModelVendor<DOpenPipeServiceSettings, OpenAIAccessSchema> = {
  id: 'openpipe',
  name: 'OpenPipe',
  displayRank: 42,
  location: 'cloud',
  instanceLimit: 1,
  hasServerConfigKey: 'hasLlmOpenPipe',

  // functions
  initializeSetup: () => ({
    openPipeKey: '',
    openPipeTags: '',
  }),
  validateSetup: (setup) => {
    return setup.openPipeKey?.length >= 40;
  },
  getTransportAccess: (partialSetup) => ({
    dialect: 'openpipe',
    oaiKey: partialSetup?.openPipeKey || '',
    oaiOrg: partialSetup?.openPipeTags || '', // HACK: use tags for org - should use type discrimination
    oaiHost: '',
    heliKey: '',
    moderationCheck: false,
  }),

  // OpenAI transport ('openpipe' dialect in 'access')
  rpcUpdateModelsOrThrow: ModelVendorOpenAI.rpcUpdateModelsOrThrow,

};
