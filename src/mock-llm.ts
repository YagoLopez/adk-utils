import { BaseLlm, BaseLlmConnection, LlmRequest, LlmResponse } from '@google/adk';
import type { Part } from '@google/genai';

/**
 * Mock LLM implementation for testing purposes.
 * Allows simulating streaming and non-streaming responses without external dependencies.
 */
export class MockLlm extends BaseLlm {
  private responseChunks: string[];
  private responseDelay: number;

  constructor(
    modelName: string = 'mock-model',
    delay: number = 0,
    chunks: string[] = ["Hello", " world", "!"],
  ) {
    super({ model: modelName });
    this.responseChunks = chunks;
    this.responseDelay = delay;
  }

  /**
   * Sets the response chunks to be returned by the mock.
   * @param chunks Array of string chunks to simulate streaming
   */
  setMockResponse(chunks: string[]): void {
    this.responseChunks = chunks;
  }

  /**
   * Sets the simulated delay between chunks.
   * @param delayMs Delay in milliseconds
   */
  setResponseDelay(delayMs: number): void {
    this.responseDelay = delayMs;
  }

  connect(): Promise<BaseLlmConnection> {
    throw new Error('Live connections are not supported for MockLlm');
  }

  async *generateContentAsync(
    llmRequest: LlmRequest,
    stream: boolean = true
  ): AsyncGenerator<LlmResponse, void> {
    
    // Simulate processing time if needed
    if (this.responseDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.responseDelay));
    }

    if (stream) {
      for (const chunkText of this.responseChunks) {
        if (this.responseDelay > 0) {
          await new Promise(resolve => setTimeout(resolve, this.responseDelay));
        }

        yield {
          content: {
            role: 'model',
            parts: [{ text: chunkText } as Part],
          },
          partial: true,
        } as LlmResponse;
      }
    } else {
      // Non-streaming: join all chunks and return as one response
      const fullText = this.responseChunks.join('');
      yield {
        content: {
          role: 'model',
          parts: [{ text: fullText } as Part],
        },
        partial: false,
      } as LlmResponse;
    }
  }
}
