import type { Content, FunctionDeclaration as GenAIFunctionDeclaration } from '@google/genai';
import type { LlmAgent } from '@google/adk';
import { UIMessage } from 'ai';
interface FormattedTool {
    functionDeclarations: GenAIFunctionDeclaration[];
}
/**
 * Service class to handle GenAI agent interactions with streaming support.
 * Provides a modular, testable structure for the API route logic.
 */
export declare class GenAIAgentService {
    private agent;
    private model;
    private tools;
    private encoder;
    private readonly MAX_TURNS;
    constructor(agent: LlmAgent);
    /**
     * Validates the incoming messages array.
     */
    validateMessages(messages: UIMessage[] | undefined): messages is UIMessage[];
    /**
     * Transforms Vercel AI SDK UIMessage format to ADK Content format.
     */
    transformMessagesToContents(messages: UIMessage[]): Content[];
    /**
     * Type guard to check if a tool has a name property.
     */
    private hasName;
    /**
     * Formats agent tools to be compatible with GenAI's expected tool format.
     */
    formatToolsForGenAI(): FormattedTool[];
    /**
     * Formats an SSE chunk for streaming.
     */
    private formatSSEChunk;
    /**
     * Encodes and returns an SSE chunk as Uint8Array.
     */
    private encodeSSEChunk;
    /**
     * Enqueues one or more SSE chunks to the controller.
     */
    private sendSSEChunks;
    /**
     * Sends SSE start events to the controller.
     */
    private sendStartEvents;
    /**
     * Sends SSE end events to the controller.
     */
    private sendEndEvents;
    /**
     * Processes a text delta, handling Gemini's accumulated text behavior.
     */
    private processTextDelta;
    /**
     * Finds a tool by name from the agent's tools.
     */
    private findToolByName;
    /**
     * Executes a single tool and returns the result.
     */
    private executeTool;
    /**
     * Processes all function calls and returns the tool response parts.
     */
    private processToolCalls;
    /**
     * Streams a single turn of the conversation and collects any function calls.
     */
    private streamTurn;
    /**
     * Runs the multi-turn conversation loop with tool execution.
     */
    private runConversationLoop;
    /**
     * Creates the streaming response for the API.
     */
    createStreamingResponse(messages: UIMessage[]): Response;
    /**
     * Creates an error response.
     */
    static createErrorResponse(message: string, status: number, details?: string): Response;
}
export {};
