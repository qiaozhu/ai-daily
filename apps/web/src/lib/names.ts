import type { SourcePost } from '@ai-daily/shared';

// display names returned by X user expansions during collection; unknown handles fall back to @handle
const NAMES: Record<string, string> = {
  claudeai: 'Claude',
  AnthropicAI: 'Anthropic',
  elonmusk: 'Elon Musk',
  HYJsfn9h: 'H YJ',
  OpenAIDevs: 'OpenAI Developers',
  peterwildeford: 'Peter Wildeford',
  IGraceAshford: 'Grace Ashford',
  Alibaba_Qwen: 'Qwen',
  StepFun_ai: 'StepFun',
  fkysly: '马天翼',
  faststocknewss: 'FSMN',
  Mr_Salio: 'Salio',
  AI_Screening: 'Pranav Reddy',
  aakashgupta: 'Aakash Gupta',
  TheZvi: 'Zvi Mowshowitz',
  Nyxelarm: 'Nyxelarm',
  demishassabis: 'Demis Hassabis',
  Google: 'Google',
  AIStockSavvy: 'Hardik Shah',
  ReutersChina: 'Reuters China',
  nvidia: 'NVIDIA',
  unusual_whales: 'unusual_whales',
  lmoroney: 'Laurence Moroney',
  NFT_Chen: 'SuSu_酥酥',
  xiax0603: 'xiax｜AI & Agents',
  ppmmzzcn: 'AI观察者 | 平行世界',
  OpenAI: 'OpenAI',
  GoogleDeepMind: 'Google DeepMind',
  sama: 'Sam Altman',
  xai: 'xAI',
  grok: 'Grok',
};

export const displayName = (p: Pick<SourcePost, 'handle' | 'name'>): string => p.name || NAMES[p.handle] || p.handle;
