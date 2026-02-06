"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const genai_agent_service_1 = require("./genai-agent-service");
// Mock dependencies
const mockGenerateContentAsync = jest.fn();
const mockRunAsync = jest.fn();
const mockModel = {
    generateContentAsync: mockGenerateContentAsync,
};
const mockTool = {
    name: 'mockTool',
    _getDeclaration: () => ({
        name: 'mockTool',
        description: 'A mock tool',
        parameters: { type: 'OBJECT', properties: {} },
    }),
    runAsync: mockRunAsync,
};
const mockAgent = {
    canonicalModel: mockModel,
    tools: [mockTool],
};
describe('GenAIAgentService', () => {
    let service;
    beforeAll(() => {
        // Suppress console.error during tests to keep output clean
        jest.spyOn(console, 'error').mockImplementation(() => { });
    });
    afterAll(() => {
        jest.restoreAllMocks();
    });
    beforeEach(() => {
        jest.clearAllMocks();
        service = new genai_agent_service_1.GenAIAgentService(mockAgent);
    });
    describe('validateMessages', () => {
        it('should return true for valid messages', () => {
            const messages = [{ role: 'user', id: '1', parts: [{ type: 'text', text: 'Hello' }] }];
            expect(service.validateMessages(messages)).toBe(true);
        });
        it('should return false for undefined messages', () => {
            expect(service.validateMessages(undefined)).toBe(false);
        });
        it('should return false for empty messages', () => {
            expect(service.validateMessages([])).toBe(false);
        });
    });
    describe('transformMessagesToContents', () => {
        it('should transform UIMessages to Content objects', () => {
            const messages = [
                { role: 'user', id: '1', parts: [{ type: 'text', text: 'Hello' }] },
                { role: 'assistant', id: '2', parts: [{ type: 'text', text: 'Hi' }] },
            ];
            const contents = service.transformMessagesToContents(messages);
            expect(contents).toHaveLength(2);
            expect(contents[0]).toEqual({
                role: 'user',
                parts: [{ text: 'Hello' }]
            });
            expect(contents[1]).toEqual({
                role: 'model',
                parts: [{ text: 'Hi' }]
            });
        });
    });
    describe('formatToolsForGenAI', () => {
        it('should format tools correctly', () => {
            const formattedTools = service.formatToolsForGenAI();
            expect(formattedTools).toHaveLength(1);
            expect(formattedTools[0].functionDeclarations).toHaveLength(1);
            expect(formattedTools[0].functionDeclarations[0].name).toBe('mockTool');
        });
        it('should throw error if tool has no declaration', () => {
            const invalidTool = {
                name: 'invalidTool',
                _getDeclaration: () => undefined
            };
            const invalidAgent = { ...mockAgent, tools: [invalidTool] };
            const invalidService = new genai_agent_service_1.GenAIAgentService(invalidAgent);
            expect(() => invalidService.formatToolsForGenAI()).toThrow('Tool invalidTool does not have a declaration');
        });
    });
    describe('createErrorResponse', () => {
        it('should create an error response', async () => {
            const response = genai_agent_service_1.GenAIAgentService.createErrorResponse('Error message', 500);
            expect(response.status).toBe(500);
            const body = await response.json();
            expect(body).toEqual({ error: 'Error message' });
        });
        it('should create an error response with details', async () => {
            const response = genai_agent_service_1.GenAIAgentService.createErrorResponse('Error message', 500, 'Details');
            expect(response.status).toBe(500);
            const body = await response.json();
            expect(body).toEqual({ error: 'Error message', details: 'Details' });
        });
    });
    describe('createStreamingResponse', () => {
        it('should create a streaming response', async () => {
            // Mock generator for generateContentAsync
            async function* mockGenerator() {
                yield { content: { parts: [{ text: 'Response' }] } };
            }
            mockGenerateContentAsync.mockReturnValue(mockGenerator());
            const messages = [
                { role: 'user', id: '1', parts: [{ type: 'text', text: 'Hello' }] }
            ];
            const response = service.createStreamingResponse(messages);
            expect(response).toBeInstanceOf(Response);
            expect(response.status).toBe(200);
            // Validating the stream content would require reading the stream which is complex in this setup
            // but we can trust the Response object creation and headers
            expect(response.headers.get('Content-Type')).toBe('text/event-stream');
        });
        it('should handle errors during streaming', async () => {
            const streamingError = new Error('Streaming error');
            mockGenerateContentAsync.mockImplementation(() => {
                throw streamingError;
            });
            const messages = [
                { role: 'user', id: '1', parts: [{ type: 'text', text: 'Hello' }] }
            ];
            const response = service.createStreamingResponse(messages);
            const streamText = await response.text();
            const expectedErrorPayload = {
                type: 'text-delta',
                id: 'text-1',
                delta: `❌ System Error: ${streamingError.message}`
            };
            expect(streamText).toContain(`data: ${JSON.stringify(expectedErrorPayload)}\n\n`);
        });
    });
    describe('Complex Flows & Private Methods', () => {
        // Access private methods by casting to any
        describe('processTextDelta', () => {
            it('should handle non-overlapping text parts', () => {
                const processTextDelta = service.processTextDelta.bind(service);
                const mockController = { enqueue: jest.fn() };
                // 1. New text
                let buffer = '';
                const part1 = { text: 'Hello' };
                buffer = processTextDelta(part1, buffer, mockController);
                expect(buffer).toBe('Hello');
                expect(mockController.enqueue).toHaveBeenCalledTimes(1);
                // 2. Additional text
                const part2 = { text: ' World' };
                buffer = processTextDelta(part2, buffer, mockController);
                expect(buffer).toBe('Hello World');
                expect(mockController.enqueue).toHaveBeenCalledTimes(2);
            });
            it('should handle accumulated text (Gemini behavior)', () => {
                const processTextDelta = service.processTextDelta.bind(service);
                const mockController = { enqueue: jest.fn() };
                let buffer = 'Hello';
                // Gemini sometimes sends "Hello World" as the next chunk instead of just " World"
                const part = { text: 'Hello World' };
                buffer = processTextDelta(part, buffer, mockController);
                expect(buffer).toBe('Hello World');
                // Should have emitted only the delta " World"
                expect(mockController.enqueue).toHaveBeenCalledTimes(1);
                const enqueuedCall = mockController.enqueue.mock.calls[0][0];
                const decoded = new TextDecoder().decode(enqueuedCall);
                expect(decoded).toContain('World');
                expect(decoded).not.toContain('Hello World');
            });
            it('should ignore exact duplicate text', () => {
                const processTextDelta = service.processTextDelta.bind(service);
                const mockController = { enqueue: jest.fn() };
                let buffer = 'Hello';
                const part = { text: 'Hello' };
                buffer = processTextDelta(part, buffer, mockController);
                expect(buffer).toBe('Hello');
                expect(mockController.enqueue).not.toHaveBeenCalled();
            });
        });
        describe('runConversationLoop (Tool Execution)', () => {
            it('should execute tools and continue conversation', async () => {
                // Mock a sequence of responses: 
                // 1. Tool Call
                // 2. Final Answer
                async function* generator1() {
                    yield {
                        content: {
                            parts: [{
                                    functionCall: { name: 'mockTool', args: { some: 'arg' } }
                                }]
                        }
                    };
                }
                async function* generator2() {
                    yield { content: { parts: [{ text: 'Final answer' }] } };
                }
                mockGenerateContentAsync
                    .mockReturnValueOnce(generator1())
                    .mockReturnValueOnce(generator2());
                mockRunAsync.mockResolvedValue({ success: true });
                const messages = [
                    { role: 'user', id: '1', parts: [{ type: 'text', text: 'Call tool' }] }
                ];
                const response = service.createStreamingResponse(messages);
                // Consume the stream to trigger execution
                const reader = response.body?.getReader();
                while (true) {
                    const { done } = await reader.read();
                    if (done)
                        break;
                }
                // Verify tool was executed
                expect(mockRunAsync).toHaveBeenCalledWith(expect.objectContaining({
                    args: { some: 'arg' }
                }));
                // Verify loop proceeded to second turn (model response after tool)
                expect(mockGenerateContentAsync).toHaveBeenCalledTimes(2);
            });
            it('should handle tool not found', async () => {
                async function* generator1() {
                    yield {
                        content: {
                            parts: [{
                                    functionCall: { name: 'nonExistentTool', args: {} }
                                }]
                        }
                    };
                }
                // It should try to execute, fail (internally catch or handle), and send result back to model
                // Then model ends.
                async function* generator2() {
                    yield { content: { parts: [{ text: 'I could not find that tool' }] } };
                }
                mockGenerateContentAsync
                    .mockReturnValueOnce(generator1())
                    .mockReturnValueOnce(generator2());
                const messages = [
                    { role: 'user', id: '1', parts: [{ type: 'text', text: 'Call bad tool' }] }
                ];
                const response = service.createStreamingResponse(messages);
                const reader = response.body?.getReader();
                while (true) {
                    const { done } = await reader.read();
                    if (done)
                        break;
                }
                expect(mockRunAsync).not.toHaveBeenCalled();
                // Should still call model again with the "Tool not found" result
                expect(mockGenerateContentAsync).toHaveBeenCalledTimes(2);
            });
            it('should handle tool execution errors gracefully', async () => {
                async function* generator1() {
                    yield {
                        content: {
                            parts: [{
                                    functionCall: { name: 'mockTool', args: {} }
                                }]
                        }
                    };
                }
                async function* generator2() {
                    yield { content: { parts: [{ text: 'Tool failed' }] } };
                }
                mockGenerateContentAsync
                    .mockReturnValueOnce(generator1())
                    .mockReturnValueOnce(generator2());
                // Tool throws
                mockRunAsync.mockRejectedValue(new Error('Tool failed'));
                const messages = [
                    { role: 'user', id: '1', parts: [{ type: 'text', text: 'Call broken tool' }] }
                ];
                const response = service.createStreamingResponse(messages);
                const reader = response.body?.getReader();
                while (true) {
                    const { done } = await reader.read();
                    if (done)
                        break;
                }
                expect(mockRunAsync).toHaveBeenCalled();
                // Should proceed to next turn despite error
                expect(mockGenerateContentAsync).toHaveBeenCalledTimes(2);
            });
        });
    });
});
