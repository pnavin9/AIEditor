import { ChatMessage } from '../types/shared';

/** Simple client for Mistral chat completions. */
export class MistralService {
  private apiKey: string;
  private apiUrl = 'https://api.mistral.ai/v1/chat/completions';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  /**
   * Stream chat completions via SSE. Calls onDelta for each text chunk and onDone at the end.
   */
  async chatStream(
    messages: ChatMessage[],
    onDelta: (text: string) => void,
    onDone: (fullText: string, rawLastFrame?: any) => void,
    signal?: AbortSignal
  ): Promise<void> {
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages,
        temperature: 0.7,
        max_tokens: 1024,
        stream: true
      }),
      signal
    });

    if (!response.ok || !response.body) {
      throw new Error(`Mistral API error: ${response.status} ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    let full = '';
    let lastJson: any = null;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split('\n\n');
      // keep last partial in buffer
      buffer = parts.pop() || '';

      for (const part of parts) {
        const line = part.trim();
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') {
          onDone(full, lastJson || undefined);
          return;
        }
        try {
          const json = JSON.parse(payload);
          lastJson = json;
          const delta = json?.choices?.[0]?.delta?.content ?? '';
          if (delta) {
            full += delta;
            onDelta(delta);
          }
        } catch {
          // ignore JSON parse errors for partial frames
        }
      }
    }
    onDone(full, lastJson || undefined);
  }
}

