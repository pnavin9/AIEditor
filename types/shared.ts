/**
 * Shared application types used across components and services.
 * Keep this file free of runtime logic.
 */

/** Chat role for Mistral messages. */
export type ChatRole = 'user' | 'assistant' | 'system';

/** A chat message sent to the LLM. */
export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/** Parameters for text-update operations. */
export interface TextUpdateParams {
  old_text: string;
  new_text: string;
}

/** Result for function execution. */
export interface ExecutionResult<T = unknown> {
  success: boolean;
  result?: T;
  error?: string;
}

// (removed unused types)


