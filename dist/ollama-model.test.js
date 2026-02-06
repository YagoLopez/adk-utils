"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ollama_model_1 = require("./ollama-model");
const ollama_1 = require("ollama");
// Mock the 'ollama' module
jest.mock('ollama');
describe('OllamaModel', () => {
    let model;
    let mockOllamaInstance;
    const mockChat = jest.fn();
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.OLLAMA_API_KEY = 'test-key';
        mockOllamaInstance = {
            chat: mockChat,
        };
        ollama_1.Ollama.mockImplementation(() => mockOllamaInstance);
    });
    it('should initialize with default values', () => {
        model = new ollama_model_1.OllamaModel();
        expect(ollama_1.Ollama).toHaveBeenCalledWith({
            host: 'http://localhost:11434/v1',
            headers: { Authorization: 'Bearer test-key' },
        });
        expect(model.model).toBe('qwen3:0.6b');
    });
    it('should initialize with custom values', () => {
        model = new ollama_model_1.OllamaModel('llama3', 'http://custom-host:11434');
        expect(ollama_1.Ollama).toHaveBeenCalledWith({
            host: 'http://custom-host:11434',
            headers: { Authorization: 'Bearer test-key' },
        });
        expect(model.model).toBe('llama3');
    });
    it('should throw error on connect', () => {
        model = new ollama_model_1.OllamaModel();
        expect(() => model.connect()).toThrow('Live connections are not supported for OllamaModel');
    });
    describe('generateContentAsync', () => {
        beforeEach(() => {
            model = new ollama_model_1.OllamaModel();
        });
        it('should handle streaming response', async () => {
            const mockResponse = (async function* () {
                yield { message: { content: 'Hello' } };
                yield { message: { content: ' world' } };
            })();
            mockChat.mockReturnValue(mockResponse);
            const request = {
                contents: [{ role: 'user', parts: [{ text: 'Hi' }] }],
            };
            const generator = model.generateContentAsync(request, true);
            const results = [];
            for await (const result of generator) {
                results.push(result);
            }
            expect(mockChat).toHaveBeenCalledWith(expect.objectContaining({
                model: 'qwen3:0.6b',
                messages: [{ role: 'user', content: 'Hi' }],
                stream: true,
            }));
            expect(results).toHaveLength(2);
            expect(results[0].content?.parts?.[0].text).toBe('Hello');
            expect(results[1].content?.parts?.[0].text).toBe(' world');
        });
        it('should handle non-streaming response', async () => {
            mockChat.mockResolvedValue({
                message: { content: 'Full response' },
            });
            const request = {
                contents: [{ role: 'user', parts: [{ text: 'Hi' }] }],
            };
            const generator = model.generateContentAsync(request, false);
            const results = [];
            for await (const result of generator) {
                results.push(result);
            }
            expect(mockChat).toHaveBeenCalledWith(expect.objectContaining({
                model: 'qwen3:0.6b',
                stream: false,
            }));
            expect(results).toHaveLength(1);
            expect(results[0].content?.parts?.[0].text).toBe('Full response');
        });
        it('should handle tool calls in streaming response', async () => {
            const mockResponse = (async function* () {
                yield {
                    message: {
                        tool_calls: [{
                                function: {
                                    name: 'get_weather',
                                    arguments: { city: 'Paris' }
                                }
                            }]
                    }
                };
            })();
            mockChat.mockReturnValue(mockResponse);
            const request = {
                contents: [{ role: 'user', parts: [{ text: 'Weather in Paris?' }] }],
                config: {
                    tools: [{
                            functionDeclarations: [{
                                    name: 'get_weather',
                                    description: 'Get weather',
                                    parameters: { type: 'OBJECT', properties: { city: { type: 'STRING' } } }
                                }]
                        }]
                }
            };
            const generator = model.generateContentAsync(request, true);
            const results = [];
            for await (const result of generator) {
                results.push(result);
            }
            expect(mockChat).toHaveBeenCalledWith(expect.objectContaining({
                tools: expect.arrayContaining([
                    expect.objectContaining({
                        type: 'function',
                        function: expect.objectContaining({
                            name: 'get_weather',
                            // Verify sanitization happened (lowercase types)
                            parameters: expect.objectContaining({
                                type: 'object',
                                properties: { city: { type: 'string' } }
                            })
                        })
                    })
                ])
            }));
            expect(results).toHaveLength(1);
            expect(results[0].content?.parts?.[0].functionCall).toEqual({
                name: 'get_weather',
                args: { city: 'Paris' }
            });
        });
        it('should handle tool calls in non-streaming response', async () => {
            mockChat.mockResolvedValue({
                message: {
                    tool_calls: [{
                            function: {
                                name: 'get_weather',
                                arguments: { city: 'London' }
                            }
                        }]
                }
            });
            const request = {
                contents: [{ role: 'user', parts: [{ text: 'Weather in London?' }] }],
            };
            const generator = model.generateContentAsync(request, false);
            const results = [];
            for await (const result of generator) {
                results.push(result);
            }
            expect(results).toHaveLength(1);
            expect(results[0].content?.parts?.[0].functionCall).toEqual({
                name: 'get_weather',
                args: { city: 'London' }
            });
        });
        it('should correctly convert tool responses in messages', async () => {
            mockChat.mockResolvedValue({ message: { content: 'It is sunny' } });
            const request = {
                contents: [
                    { role: 'user', parts: [{ text: 'Weather?' }] },
                    { role: 'model', parts: [{ functionCall: { name: 'get_weather', args: {} } }] },
                    { role: 'tool', parts: [{ functionResponse: { name: 'get_weather', response: { weather: 'sunny' } } }] }
                ]
            };
            const generator = model.generateContentAsync(request, false);
            for await (const _ of generator) { }
            expect(mockChat).toHaveBeenCalledWith(expect.objectContaining({
                messages: [
                    { role: 'user', content: 'Weather?' },
                    {
                        role: 'assistant',
                        content: '',
                        tool_calls: [{ function: { name: 'get_weather', arguments: {} } }]
                    },
                    {
                        role: 'tool',
                        content: '{"weather":"sunny"}'
                    }
                ]
            }));
        });
        it('should handle errors from ollama.chat', async () => {
            mockChat.mockRejectedValue(new Error('Ollama connection failed'));
            const request = {
                contents: [{ role: 'user', parts: [{ text: 'Hi' }] }],
            };
            const generator = model.generateContentAsync(request, false);
            await expect(async () => {
                for await (const _ of generator) { }
            }).rejects.toThrow('Error: Ollama connection failed');
        });
        it('should sanitize complex nested schemas', async () => {
            mockChat.mockResolvedValue({ message: { content: 'OK' } });
            const request = {
                contents: [{ role: 'user', parts: [{ text: 'Do task' }] }],
                config: {
                    tools: [{
                            functionDeclarations: [{
                                    name: 'complex_tool',
                                    parameters: {
                                        type: 'OBJECT',
                                        properties: {
                                            details: {
                                                type: 'OBJECT',
                                                properties: {
                                                    count: { type: 'INTEGER' }
                                                }
                                            },
                                            list: {
                                                type: 'ARRAY',
                                                items: { type: 'STRING' }
                                            }
                                        }
                                    }
                                }]
                        }]
                }
            };
            const generator = model.generateContentAsync(request, false);
            for await (const _ of generator) { }
            expect(mockChat).toHaveBeenCalledWith(expect.objectContaining({
                tools: expect.arrayContaining([
                    expect.objectContaining({
                        function: expect.objectContaining({
                            name: 'complex_tool',
                            parameters: expect.objectContaining({
                                type: 'object', // Lowercased
                                properties: expect.objectContaining({
                                    details: expect.objectContaining({
                                        type: 'object', // Lowercased
                                        properties: { count: { type: 'integer' } } // Lowercased
                                    }),
                                    list: expect.objectContaining({
                                        type: 'array', // Lowercased
                                        items: { type: 'string' } // Lowercased - assuming recursion works on items if it was an object, but simulate sanitizeSchema logic
                                    })
                                })
                            })
                        })
                    })
                ])
            }));
        });
        it('should handle tools defined in snake_case function_declarations', async () => {
            mockChat.mockResolvedValue({ message: { content: 'OK' } });
            const request = {
                contents: [{ role: 'user', parts: [{ text: 'Do task' }] }],
                config: {
                    tools: [{
                            function_declarations: [{
                                    name: 'snake_tool',
                                    parameters: { type: 'OBJECT' }
                                }]
                        }]
                }
            };
            const generator = model.generateContentAsync(request, false);
            for await (const _ of generator) { }
            expect(mockChat).toHaveBeenCalledWith(expect.objectContaining({
                tools: expect.arrayContaining([
                    expect.objectContaining({
                        function: expect.objectContaining({
                            name: 'snake_tool'
                        })
                    })
                ])
            }));
        });
        it('should handle tool response messages correctly (role: function)', async () => {
            mockChat.mockResolvedValue({ message: { content: 'Result received' } });
            const request = {
                contents: [
                    { role: 'model', parts: [{ functionCall: { name: 'test_tool', args: {} } }] },
                    { role: 'function', parts: [{ functionResponse: { name: 'test_tool', response: { status: 'success' } } }] }
                ]
            };
            const generator = model.generateContentAsync(request, false);
            for await (const _ of generator) { }
            expect(mockChat).toHaveBeenCalledWith(expect.objectContaining({
                messages: expect.arrayContaining([
                    {
                        role: 'assistant',
                        tool_calls: [{ function: { name: 'test_tool', arguments: {} } }],
                        content: ''
                    },
                    {
                        role: 'tool',
                        content: '{"status":"success"}'
                    }
                ])
            }));
        });
        it('should ignore non-tool parts if multiple part types exist in a tool config but not match', async () => {
            mockChat.mockResolvedValue({ message: { content: 'OK' } });
            // ADK sometimes sends mixed tool configs? Or just testing robust filtering
            const request = {
                contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
                config: {
                    tools: [
                        { invalid: 'schema' },
                        null,
                        { functionDeclarations: [] }
                    ]
                }
            };
            const generator = model.generateContentAsync(request, false);
            for await (const _ of generator) { }
            // Should not crash and valid call made
            expect(mockChat).toHaveBeenCalled();
        });
    });
});
