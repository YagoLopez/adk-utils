"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockLlm = void 0;
const adk_1 = require("@google/adk");
/**
 * Mock LLM implementation for testing purposes.
 * Allows simulating streaming and non-streaming responses without external dependencies.
 */
class MockLlm extends adk_1.BaseLlm {
    constructor(modelName = 'mock-model', delay = 0, chunks = ["Hello", " world", "!"]) {
        super({ model: modelName });
        this.responseChunks = chunks;
        this.responseDelay = delay;
    }
    /**
     * Sets the response chunks to be returned by the mock.
     * @param chunks Array of string chunks to simulate streaming
     */
    setMockResponse(chunks) {
        this.responseChunks = chunks;
    }
    /**
     * Sets the simulated delay between chunks.
     * @param delayMs Delay in milliseconds
     */
    setResponseDelay(delayMs) {
        this.responseDelay = delayMs;
    }
    connect() {
        throw new Error('Live connections are not supported for MockLlm');
    }
    async *generateContentAsync(llmRequest, stream = true) {
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
                        parts: [{ text: chunkText }],
                    },
                    partial: true,
                };
            }
        }
        else {
            // Non-streaming: join all chunks and return as one response
            const fullText = this.responseChunks.join('');
            yield {
                content: {
                    role: 'model',
                    parts: [{ text: fullText }],
                },
                partial: false,
            };
        }
    }
}
exports.MockLlm = MockLlm;
