import { BaseLlm, BaseLlmConnection, LlmRequest, LlmResponse } from '@google/adk';
/**
 * Mock LLM implementation for testing purposes.
 * Allows simulating streaming and non-streaming responses without external dependencies.
 */
export declare class MockLlm extends BaseLlm {
    private responseChunks;
    private responseDelay;
    constructor(modelName?: string, delay?: number, chunks?: string[]);
    /**
     * Sets the response chunks to be returned by the mock.
     * @param chunks Array of string chunks to simulate streaming
     */
    setMockResponse(chunks: string[]): void;
    /**
     * Sets the simulated delay between chunks.
     * @param delayMs Delay in milliseconds
     */
    setResponseDelay(delayMs: number): void;
    connect(): Promise<BaseLlmConnection>;
    generateContentAsync(llmRequest: LlmRequest, stream?: boolean): AsyncGenerator<LlmResponse, void>;
}
