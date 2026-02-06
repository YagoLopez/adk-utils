"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenAIAgentService = void 0;
/**
 * Service class to handle GenAI agent interactions with streaming support.
 * Provides a modular, testable structure for the API route logic.
 */
class GenAIAgentService {
    constructor(agent) {
        this.MAX_TURNS = 5;
        this.agent = agent;
        this.model = agent.canonicalModel;
        this.tools = agent.tools || [];
        this.encoder = new TextEncoder();
    }
    /**
     * Validates the incoming messages array.
     */
    validateMessages(messages) {
        return Boolean(messages && Array.isArray(messages) && messages.length > 0);
    }
    /**
     * Transforms Vercel AI SDK UIMessage format to ADK Content format.
     */
    transformMessagesToContents(messages) {
        return messages.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: msg.parts
                .filter(part => part.type === 'text')
                .map(part => ({ text: part.text }))
        }));
    }
    /**
     * Type guard to check if a tool has a name property.
     */
    hasName(tool) {
        return 'name' in tool && true;
    }
    /**
     * Formats agent tools to be compatible with GenAI's expected tool format.
     */
    formatToolsForGenAI() {
        return this.tools.map((t) => {
            // If it's already a GenAI Tool with function declarations, return it as-is
            if ('functionDeclarations' in t || 'function_declarations' in t) {
                return t;
            }
            // Otherwise, it's a BaseTool - extract its declaration
            const baseTool = t;
            const declaration = baseTool._getDeclaration();
            if (!declaration) {
                throw new Error(`Tool ${baseTool.name} does not have a declaration`);
            }
            return {
                functionDeclarations: [declaration]
            };
        });
    }
    /**
     * Formats an SSE chunk for streaming.
     */
    formatSSEChunk(chunk) {
        return `data: ${JSON.stringify(chunk)}\n\n`;
    }
    /**
     * Encodes and returns an SSE chunk as Uint8Array.
     */
    encodeSSEChunk(chunk) {
        return this.encoder.encode(this.formatSSEChunk(chunk));
    }
    /**
     * Enqueues one or more SSE chunks to the controller.
     */
    sendSSEChunks(controller, ...chunks) {
        chunks.forEach(chunk => controller.enqueue(this.encodeSSEChunk(chunk)));
    }
    /**
     * Sends SSE start events to the controller.
     */
    sendStartEvents(controller) {
        this.sendSSEChunks(controller, { type: 'start' }, { type: 'start-step' }, { type: 'text-start', id: 'text-1' });
    }
    /**
     * Sends SSE end events to the controller.
     */
    sendEndEvents(controller) {
        this.sendSSEChunks(controller, { type: 'text-end', id: 'text-1' }, { type: 'finish-step' }, { type: 'finish', finishReason: 'stop' });
    }
    /**
     * Processes a text delta, handling Gemini's accumulated text behavior.
     */
    processTextDelta(part, textBuffer, controller) {
        if (!('text' in part) || !part.text) {
            return textBuffer;
        }
        let delta = part.text;
        // Check if this part is the full accumulated text (Gemini behavior)
        if (delta.startsWith(textBuffer) && textBuffer.length > 0) {
            delta = delta.slice(textBuffer.length);
            if (!delta) {
                return textBuffer;
            }
        }
        else if (textBuffer.length > 0 && part.text === textBuffer) {
            // Exact match - skip duplicate
            return textBuffer;
        }
        if (delta) {
            // Send text delta in correct format
            this.sendSSEChunks(controller, {
                type: 'text-delta',
                id: 'text-1',
                delta: delta
            });
            return textBuffer + delta;
        }
        return textBuffer;
    }
    /**
     * Finds a tool by name from the agent's tools.
     */
    findToolByName(name) {
        const tool = this.tools.find((t) => this.hasName(t) && t.name === name);
        return tool ? tool : undefined;
    }
    /**
     * Executes a single tool and returns the result.
     */
    async executeTool(tool, args) {
        try {
            return await tool.runAsync({
                args,
                toolContext: {} // Minimal context
            });
        }
        catch (e) {
            return { error: String(e) };
        }
    }
    /**
     * Processes all function calls and returns the tool response parts.
     */
    async processToolCalls(functionCalls) {
        // Map each call to a promise
        const toolPromises = functionCalls.map(async (callPart) => {
            if (!callPart.functionCall)
                return null;
            const call = callPart.functionCall;
            if (!call.name)
                return null;
            const tool = this.findToolByName(call.name);
            let toolResult = { error: 'Tool not found' };
            if (tool) {
                toolResult = await this.executeTool(tool, (call.args || {}));
            }
            return {
                functionResponse: {
                    name: call.name,
                    response: {
                        name: call.name,
                        content: toolResult
                    }
                }
            };
        });
        // Execute in parallel and filter out nulls
        const results = await Promise.all(toolPromises);
        return results.filter((part) => part !== null);
    }
    /**
     * Streams a single turn of the conversation and collects any function calls.
     */
    async streamTurn(contents, formattedTools, controller) {
        const llmResponse = this.model.generateContentAsync({
            contents,
            config: { tools: formattedTools }
        }, true);
        const functionCalls = [];
        let textBuffer = '';
        for await (const chunk of llmResponse) {
            if (chunk.content?.parts) {
                for (const part of chunk.content.parts) {
                    // Handle Text
                    if ('text' in part && part.text) {
                        textBuffer = this.processTextDelta(part, textBuffer, controller);
                    }
                    // Handle Function Calls
                    if ('functionCall' in part) {
                        functionCalls.push(part);
                    }
                }
            }
        }
        return { functionCalls, textBuffer };
    }
    /**
     * Runs the multi-turn conversation loop with tool execution.
     */
    async runConversationLoop(initialContents, formattedTools, controller) {
        const currentContents = [...initialContents];
        let turnCount = 0;
        while (turnCount < this.MAX_TURNS) {
            turnCount++;
            const { functionCalls } = await this.streamTurn(currentContents, formattedTools, controller);
            if (functionCalls.length > 0) {
                // Add the model's tool calls to history
                currentContents.push({
                    role: 'model',
                    parts: functionCalls
                });
                // Execute tools and add responses to history
                const toolResponseParts = await this.processToolCalls(functionCalls);
                currentContents.push({
                    role: 'tool',
                    parts: toolResponseParts
                });
            }
            else {
                // No function calls, conversation complete
                break;
            }
        }
    }
    /**
     * Creates the streaming response for the API.
     */
    createStreamingResponse(messages) {
        const adkContents = this.transformMessagesToContents(messages);
        const formattedTools = this.formatToolsForGenAI();
        const stream = new ReadableStream({
            start: async (controller) => {
                try {
                    this.sendStartEvents(controller);
                    await this.runConversationLoop(adkContents, formattedTools, controller);
                    this.sendEndEvents(controller);
                    controller.close();
                }
                catch (error) {
                    console.error('Error streaming response:', error);
                    // Send error as text so it is visible in the chat UI
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    this.sendSSEChunks(controller, {
                        type: 'text-delta',
                        id: 'text-1',
                        delta: `❌ System Error: ${errorMessage}`
                    });
                    this.sendEndEvents(controller);
                    controller.close();
                }
            }
        });
        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });
    }
    /**
     * Creates an error response.
     */
    static createErrorResponse(message, status, details) {
        const body = details
            ? { error: message, details }
            : { error: message };
        return new Response(JSON.stringify(body), {
            status,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
exports.GenAIAgentService = GenAIAgentService;
