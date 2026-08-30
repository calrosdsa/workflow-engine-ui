import type { ComponentType } from 'react'
import { OpenAILogo } from './OpenAILogo'
import { GeminiLogo } from './GeminiLogo'
import { VoyageLogo } from './VoyageLogo'
import { AnthropicLogo } from './AnthropicLogo'
import { DeepSeekLogo } from './DeepSeekLogo'
import type { ProviderType } from '../types'

export const PROVIDER_LOGOS: Record<ProviderType, ComponentType<{ size?: number }>> = {
  openai: OpenAILogo,
  gemini: GeminiLogo,
  voyage: VoyageLogo,
  anthropic: AnthropicLogo,
  deepseek: DeepSeekLogo,
}

export const PROVIDER_LABELS: Record<ProviderType, string> = {
  openai: 'OpenAI',
  gemini: 'Gemini',
  voyage: 'Voyage',
  anthropic: 'Anthropic',
  deepseek: 'DeepSeek',
}
