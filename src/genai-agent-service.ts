import type { Content, Part, FunctionDeclaration as GenAIFunctionDeclaration } from '@google/genai';
import type { ToolUnion, BaseTool, LlmRequest, ToolContext, LlmAgent, BaseLlm } from '@google/adk';
import { UIMessage } from 'ai';

// Type definitions for streaming and SSE
interface StreamChunk {
  content?: {
    parts?: Part[];
  };
}

interface SSEChunk {
  type: string;
  id?: string;
  delta?: string;
  error?: string;
  finishReason?: string;
}

// Type for formatted tools compatible with GenAI
interface FormattedTool {
  functionDeclarations: GenAIFunctionDeclaration[];
}

/**
 * Service class to handle GenAI agent interactions with streaming support.
 * Provides a modular, testable structure for the API route logic.
 */
export class GenAIAgentService {
  private agent: LlmAgent;
  private model: BaseLlm;
  private tools: ToolUnion[];
  private encoder: TextEncoder;
  private readonly MAX_TURNS = 5;

  constructor(agent: LlmAgent) {
    this.agent = agent;
    this.model = agent.canonicalModel;
    this.tools = agent.tools || [];
    this.encoder = new TextEncoder();
  }

  /**
   * Validates the incoming messages array.
   */
  validateMessages(messages: UIMessage[] | undefined): messages is UIMessage[] {
    return Boolean(messages && Array.isArray(messages) && messages.length > 0);
  }

  /**
   * Transforms Vercel AI SDK UIMessage format to ADK Content format.
   */
  transformMessagesToContents(messages: UIMessage[]): Content[] {
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
  private hasName(tool: ToolUnion): tool is BaseTool {
    return 'name' in tool && true;
  }

  /**
   * Formats agent tools to be compatible with GenAI's expected tool format.
   */
  formatToolsForGenAI(): FormattedTool[] {
    return this.tools.map((t: ToolUnion) => {
      // If it's already a GenAI Tool with function declarations, return it as-is
      if ('functionDeclarations' in t || 'function_declarations' in t) {
        return t as unknown as FormattedTool;
      }

      // Otherwise, it's a BaseTool - extract its declaration
      const baseTool = t as BaseTool;
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
  private formatSSEChunk(chunk: SSEChunk): string {
    return `data: ${JSON.stringify(chunk)}\n\n`;
  }

  /**
   * Encodes and returns an SSE chunk as Uint8Array.
   */
  private encodeSSEChunk(chunk: SSEChunk): Uint8Array {
    return this.encoder.encode(this.formatSSEChunk(chunk));
  }

  /**
   * Enqueues one or more SSE chunks to the controller.
   */
  private sendSSEChunks(controller: ReadableStreamDefaultController<Uint8Array>, ...chunks: SSEChunk[]): void {
    chunks.forEach(chunk => controller.enqueue(this.encodeSSEChunk(chunk)));
  }

  /**
   * Sends SSE start events to the controller.
   */
  private sendStartEvents(controller: ReadableStreamDefaultController<Uint8Array>): void {
    this.sendSSEChunks(controller,
      { type: 'start' },
      { type: 'start-step' },
      { type: 'text-start', id: 'text-1' }
    );
  }

  /**
   * Sends SSE end events to the controller.
   */
  private sendEndEvents(controller: ReadableStreamDefaultController<Uint8Array>): void {
    this.sendSSEChunks(controller,
      { type: 'text-end', id: 'text-1' },
      { type: 'finish-step' },
      { type: 'finish', finishReason: 'stop' }
    );
  }

  /**
   * Processes a text delta, handling Gemini's accumulated text behavior.
   */
  private processTextDelta(
    part: Part,
    textBuffer: string,
    controller: ReadableStreamDefaultController<Uint8Array>
  ): string {
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
    } else if (textBuffer.length > 0 && part.text === textBuffer) {
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
  private findToolByName(name: string): BaseTool | undefined {
    const tool = this.tools.find((t: ToolUnion) => this.hasName(t) && t.name === name);
    return tool ? (tool as BaseTool) : undefined;
  }

  /**
   * Executes a single tool and returns the result.
   */
  private async executeTool(tool: BaseTool, args: Record<string, unknown>): Promise<Record<string, unknown>> {
    try {
      return await tool.runAsync({
        args,
        toolContext: {} as unknown as ToolContext // Minimal context
      }) as Record<string, unknown>;
    } catch (e) {
      return { error: String(e) };
    }
  }

  /**
   * Processes all function calls and returns the tool response parts.
   */
  private async processToolCalls(functionCalls: Part[]): Promise<Part[]> {
    // Map each call to a promise
    const toolPromises = functionCalls.map(async (callPart) => {
      if (!callPart.functionCall) return null;

      const call = callPart.functionCall;
      if (!call.name) return null;
      const tool = this.findToolByName(call.name);
      let toolResult: Record<string, unknown> = { error: 'Tool not found' };

      if (tool) {
        toolResult = await this.executeTool(tool, (call.args || {}) as Record<string, unknown>);
      }
      return {
        functionResponse: {
          name: call.name,
          response: {
            name: call.name,
            content: toolResult
          }
        }
      } as Part;
    });
    // Execute in parallel and filter out nulls
    const results = await Promise.all(toolPromises);
    return results.filter((part): part is Part => part !== null);
  }

  /**
   * Streams a single turn of the conversation and collects any function calls.
   */
  private async streamTurn(
    contents: Content[],
    formattedTools: FormattedTool[],
    controller: ReadableStreamDefaultController<Uint8Array>
  ): Promise<{ functionCalls: Part[]; textBuffer: string }> {
    const llmResponse = this.model.generateContentAsync({
      contents,
      config: { tools: formattedTools }
    } as Partial<LlmRequest> as LlmRequest, true);

    const functionCalls: Part[] = [];
    let textBuffer = '';

    for await (const chunk of llmResponse as AsyncIterable<StreamChunk>) {
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
  private async runConversationLoop(
    initialContents: Content[],
    formattedTools: FormattedTool[],
    controller: ReadableStreamDefaultController<Uint8Array>
  ): Promise<void> {
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
        } as Content);
      } else {
        // No function calls, conversation complete
        break;
      }
    }
  }

  /**
   * Creates the streaming response for the API.
   */
  createStreamingResponse(messages: UIMessage[]): Response {
    const adkContents = this.transformMessagesToContents(messages);
    const formattedTools = this.formatToolsForGenAI();

    const stream = new ReadableStream<Uint8Array>({
      start: async (controller) => {
        try {
          this.sendStartEvents(controller);
          await this.runConversationLoop(adkContents, formattedTools, controller);
          this.sendEndEvents(controller);
          controller.close();
        } catch (error) {
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
  static createErrorResponse(message: string, status: number, details?: string): Response {
    const body = details
      ? { error: message, details }
      : { error: message };

    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
