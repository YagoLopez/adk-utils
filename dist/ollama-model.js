"use strict";
// todo: allow local ollama with docker
// todo: rate liminting for demo purposes
Object.defineProperty(exports, "__esModule", { value: true });
exports.OllamaModel = void 0;
const adk_1 = require("@google/adk");
const ollama_1 = require("ollama");
/**
 * Custom Ollama model class that extends BaseLlm to work with local and cloud Ollama models
 */
class OllamaModel extends adk_1.BaseLlm {
    constructor(modelName = 'qwen3:0.6b', baseURL = 'http://localhost:11434/v1') {
        super({ model: modelName });
        this.baseURL = baseURL;
        this.model = modelName;
        this.ollama = new ollama_1.Ollama({
            host: this.baseURL,
            headers: {
                Authorization: `Bearer ${process.env.OLLAMA_API_KEY}`,
            }
        });
    }
    connect() {
        throw new Error('Live connections are not supported for OllamaModel');
    }
    async *generateContentAsync(llmRequest, stream = true) {
        // Convert ADK LlmRequest to Ollama chat format
        const messages = this.convertToOllamaMessages(llmRequest.contents);
        // Prepare tools if available in the request
        let tools;
        if (llmRequest.config?.tools) {
            const declarations = llmRequest.config.tools.flatMap((t) => {
                // Handle both ADK Tool format and custom ToolConfig format
                if (typeof t === 'object' && t !== null) {
                    if ('functionDeclarations' in t && Array.isArray(t.functionDeclarations)) {
                        return t.functionDeclarations;
                    }
                    if ('function_declarations' in t && Array.isArray(t.function_declarations)) {
                        return t.function_declarations;
                    }
                }
                return [];
            });
            if (declarations.length > 0) {
                tools = declarations
                    .filter((decl) => !!decl.name)
                    .map((decl) => ({
                    type: 'function',
                    function: {
                        name: decl.name,
                        description: decl.description || '',
                        parameters: this.sanitizeSchema(decl.parameters),
                    },
                }));
            }
        }
        try {
            if (stream) {
                // Handle streaming response
                const streamRequest = {
                    model: this.model,
                    messages,
                    stream: true,
                };
                // Only add tools if they exist
                if (tools && tools.length > 0) {
                    streamRequest.tools = tools;
                }
                const response = await this.ollama.chat(streamRequest);
                for await (const part of response) {
                    // Check for tool calls
                    if (part.message && part.message.tool_calls) {
                        const toolCallParts = part.message.tool_calls.map((tc) => ({
                            functionCall: {
                                name: tc.function.name,
                                args: tc.function.arguments,
                            },
                        }));
                        yield {
                            content: {
                                role: 'model',
                                parts: toolCallParts,
                            },
                            partial: false,
                        };
                    }
                    // Check for content
                    if (part.message && part.message.content) {
                        const content = {
                            role: 'model',
                            parts: [{ text: part.message.content }],
                        };
                        yield {
                            content,
                            partial: true,
                        };
                    }
                }
            }
            else {
                // Handle non-streaming response
                const nonStreamRequest = {
                    model: this.model,
                    messages,
                    stream: false,
                };
                // Only add tools if they exist
                if (tools && tools.length > 0) {
                    nonStreamRequest.tools = tools;
                }
                const response = await this.ollama.chat(nonStreamRequest);
                let parts = [];
                if (response.message.tool_calls) {
                    parts = parts.concat(response.message.tool_calls.map((tc) => ({
                        functionCall: {
                            name: tc.function.name,
                            args: tc.function.arguments,
                        },
                    })));
                }
                if (response.message.content) {
                    parts.push({ text: response.message.content });
                }
                const content = {
                    role: 'model',
                    parts,
                };
                yield {
                    content,
                };
            }
        }
        catch (error) {
            throw new Error(String(error));
        }
    }
    /**
     * Converts ADK Content format to Ollama message format.
     */
    convertToOllamaMessages(contents) {
        return contents.flatMap((content) => {
            const role = content.role === 'model' ? 'assistant' : (content.role ?? 'user');
            const parts = content.parts || [];
            const toolCallParts = parts.filter(p => 'functionCall' in p);
            const functionResponseParts = parts.filter(p => 'functionResponse' in p);
            const textParts = parts.filter((part) => 'text' in part).map((part) => part.text).join('\n');
            const resultMessages = [];
            // If it's a tool response (functionResponse), it must be role 'tool'
            if (functionResponseParts.length > 0) {
                functionResponseParts.forEach(p => {
                    const resp = p.functionResponse;
                    resultMessages.push({
                        role: 'tool',
                        content: JSON.stringify(resp?.response),
                    });
                });
                // Ignore text parts if mixed with tool response? Usually not mixed.
                return resultMessages;
            }
            // Otherwise (user/assistant)
            const message = { role, content: textParts };
            if (toolCallParts.length > 0) {
                message.tool_calls = toolCallParts
                    .filter((p) => 'functionCall' in p)
                    .map((p) => ({
                    function: {
                        name: p.functionCall.name,
                        arguments: p.functionCall.args
                    }
                }));
            }
            if (message.content || message.tool_calls) {
                resultMessages.push(message);
            }
            return resultMessages;
        });
    }
    /**
     * Helper to sanitize JSON schema, specifically converting capitalized types to lowercase.
     */
    sanitizeSchema(schema) {
        if (!schema || typeof schema !== 'object')
            return schema;
        if (Array.isArray(schema))
            return schema.map((item) => this.sanitizeSchema(item));
        const newSchema = { ...schema };
        if (newSchema.type) {
            newSchema.type = newSchema.type.toLowerCase();
        }
        if (newSchema.properties && typeof newSchema.properties === 'object') {
            const newProps = {};
            for (const [key, value] of Object.entries(newSchema.properties)) {
                newProps[key] = this.sanitizeSchema(value);
            }
            newSchema.properties = newProps;
        }
        // Recursively sanitize other object values that might contain schemas (like items, etc.)
        for (const key in newSchema) {
            if (key !== 'type' && key !== 'properties' && typeof newSchema[key] === 'object') {
                newSchema[key] = this.sanitizeSchema(newSchema[key]);
            }
        }
        return newSchema;
    }
}
exports.OllamaModel = OllamaModel;
