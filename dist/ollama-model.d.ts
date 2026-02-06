import { BaseLlm, BaseLlmConnection, LlmRequest, LlmResponse } from '@google/adk';
/**
 * Custom Ollama model class that extends BaseLlm to work with local and cloud Ollama models
 */
export declare class OllamaModel extends BaseLlm {
    private readonly baseURL;
    private ollama;
    model: string;
    constructor(modelName?: string, baseURL?: string);
    connect(): Promise<BaseLlmConnection>;
    generateContentAsync(llmRequest: LlmRequest, stream?: boolean): AsyncGenerator<LlmResponse, void>;
    /**
     * Converts ADK Content format to Ollama message format.
     */
    private convertToOllamaMessages;
    /**
     * Helper to sanitize JSON schema, specifically converting capitalized types to lowercase.
     */
    private sanitizeSchema;
}
