import { apiAsync } from '~/common/util/trpc.client';

import type { GeminiAccessSchema } from '../../server/gemini/gemini.router';
import type { GeminiWire_Safety } from '~/modules/aix/server/dispatch/wiretypes/gemini.wiretypes';
import type { IModelVendor } from '../IModelVendor';


interface DGeminiServiceSettings {
  geminiKey: string;
  geminiHost: string;
  minSafetyLevel: GeminiWire_Safety.HarmBlockThreshold;
}

// interface LLMOptionsGemini {
//   llmRef: string;
//   stopSequences: string[];  // up to 5 sequences that will stop generation (optional)
//   candidateCount: number;   // 1...8 number of generated responses to return (optional)
//   maxOutputTokens: number;  // if unset, this will default to outputTokenLimit (optional)
//   temperature: number;      // 0...1 Controls the randomness of the output. (optional)
//   topP: number;             // 0...1 The maximum cumulative probability of tokens to consider when sampling (optional)
//   topK: number;             // 1...100 The maximum number of tokens to consider when sampling (optional)
// }


export const ModelVendorGemini: IModelVendor<DGeminiServiceSettings, GeminiAccessSchema> = {
  id: 'googleai',
  name: 'Gemini',
  displayRank: 14,
  location: 'cloud',
  instanceLimit: 1,
  hasServerConfigKey: 'hasLlmGemini',

  // functions
  initializeSetup: () => ({
    geminiKey: '',
    geminiHost: '',
    minSafetyLevel: 'HARM_BLOCK_THRESHOLD_UNSPECIFIED',
  }),
  validateSetup: (setup) => {
    return setup.geminiKey?.length > 0;
  },
  getTransportAccess: (partialSetup): GeminiAccessSchema => ({
    dialect: 'gemini',
    geminiKey: partialSetup?.geminiKey || '',
    geminiHost: partialSetup?.geminiHost || '',
    minSafetyLevel: partialSetup?.minSafetyLevel || 'HARM_BLOCK_THRESHOLD_UNSPECIFIED',
  }),

  // List Models
  rpcUpdateModelsOrThrow: async (access) => await apiAsync.llmGemini.listModels.query({ access }),

};
