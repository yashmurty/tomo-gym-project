import type { MessageParam, Tool } from '@anthropic-ai/sdk/resources/messages';

// The one seam between the agent loop and the model provider. Requests use
// the Anthropic SDK's own param types, so a real client is a thin call to
// `messages.create`. Responses use a narrow internal shape (the SDK's
// Message type has many required fields a stub shouldn't have to fake);
// a real client maps onto it.

export interface LlmRequest {
  model: string;
  system: string;
  messages: MessageParam[];
  tools: Tool[];
  maxTokens: number;
}

export interface LlmTextBlock {
  type: 'text';
  text: string;
}

export interface LlmToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: unknown;
}

export type LlmContentBlock = LlmTextBlock | LlmToolUseBlock;

export interface LlmResponse {
  model: string;
  content: LlmContentBlock[];
  // Messages API stop reasons; the loop only branches on 'tool_use'.
  stopReason: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
  };
}

export interface LlmClient {
  createMessage(request: LlmRequest): Promise<LlmResponse>;
}

export const LLM_CLIENT = Symbol('LLM_CLIENT');
