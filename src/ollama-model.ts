// todo: allow local ollama with docker
// todo: rate liminting for demo purposes
// todo: update docs for mockModel class

import { BaseLlm, BaseLlmConnection, LlmRequest, LlmResponse } from '@google/adk';
import { Ollama, type Tool as OllamaTool, type Message as OllamaMessage, type ChatRequest } from 'ollama';
import type { Content, Part } from '@google/genai';

// Type definitions for tool declarations and schemas
interface ToolDeclaration {
  name?: string;
  description?: string;
  parameters?: JSONSchema;
}

interface FunctionCall {
  name: string;
  args: Record<string, unknown>;
}

interface JSONSchema {
  type?: string;
  properties?: Record<string, JSONSchema>;
  [key: string]: unknown;
}

interface OllamaMessageWithToolCalls extends OllamaMessage {
  tool_calls?: Array<{
    function: {
      name: string;
      arguments: Record<string, unknown>;
    };
  }>;
}

/**
 * Custom Ollama model class that extends BaseLlm to work with local and cloud Ollama models
 */
export class OllamaModel extends BaseLlm {
  private readonly baseURL: string;
  private ollama: Ollama;
  public model: string;

  constructor(modelName: string = 'qwen3:0.6b', baseURL: string = 'http://localhost:11434/v1') {
    super({ model: modelName });
    this.baseURL = baseURL;
    this.model = modelName;
    this.ollama = new Ollama({
      host: this.baseURL,
      headers: {
        Authorization: `Bearer ${process.env.OLLAMA_API_KEY}`,
      }
    });
  }

  connect(): Promise<BaseLlmConnection> {
    throw new Error('Live connections are not supported for OllamaModel');
  }

  async *generateContentAsync(
    llmRequest: LlmRequest,
    stream: boolean = true
  ): AsyncGenerator<LlmResponse, void> {
    // Convert ADK LlmRequest to Ollama chat format
    const messages = this.convertToOllamaMessages(llmRequest.contents);

    // Prepare tools if available in the request
    let tools: OllamaTool[] | undefined;
    if (llmRequest.config?.tools) {
      const declarations = llmRequest.config.tools.flatMap((t: unknown) => {
        // Handle both ADK Tool format and custom ToolConfig format
        if (typeof t === 'object' && t !== null) {
          if ('functionDeclarations' in t && Array.isArray(t.functionDeclarations)) {
            return t.functionDeclarations as ToolDeclaration[];
          }
          if ('function_declarations' in t && Array.isArray(t.function_declarations)) {
            return t.function_declarations as ToolDeclaration[];
          }
        }
        return [];
      });
      if (declarations.length > 0) {
        tools = declarations
          .filter((decl): decl is ToolDeclaration & { name: string } => !!decl.name)
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
        const streamRequest: ChatRequest & { stream: true } = {
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
            } as Part));

            yield {
              content: {
                role: 'model',
                parts: toolCallParts,
              },
              partial: false,
            } as LlmResponse;
          }

          // Check for content
          if (part.message && part.message.content) {
            const content: Content = {
              role: 'model',
              parts: [{ text: part.message.content } as Part],
            };

            yield {
              content,
              partial: true,
            } as LlmResponse;
          }
        }
      } else {
        // Handle non-streaming response
        const nonStreamRequest: ChatRequest & { stream?: false } = {
          model: this.model,
          messages,
          stream: false,
        };

        // Only add tools if they exist
        if (tools && tools.length > 0) {
          nonStreamRequest.tools = tools;
        }

        const response = await this.ollama.chat(nonStreamRequest);

        let parts: Part[] = [];

        if (response.message.tool_calls) {
          parts = parts.concat(response.message.tool_calls.map((tc) => ({
            functionCall: {
              name: tc.function.name,
              args: tc.function.arguments,
            },
          } as Part)));
        }

        if (response.message.content) {
          parts.push({ text: response.message.content } as Part);
        }

        const content: Content = {
          role: 'model',
          parts,
        };

        yield {
          content,
        } as LlmResponse;
      }
    } catch (error) {
      throw new Error(String(error));
    }
  }


  /**
   * Converts ADK Content format to Ollama message format.
   */
  private convertToOllamaMessages(contents: Content[]): OllamaMessage[] {
    return contents.flatMap((content) => {
      const role = content.role === 'model' ? 'assistant' : (content.role ?? 'user');
      const parts = content.parts || [];

      const toolCallParts = parts.filter(p => 'functionCall' in p);
      const functionResponseParts = parts.filter(p => 'functionResponse' in p);
      const textParts = parts.filter((part): part is { text: string } => 'text' in part).map((part) => part.text).join('\n');

      const resultMessages: OllamaMessage[] = [];

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
      const message: OllamaMessageWithToolCalls = { role, content: textParts };

      if (toolCallParts.length > 0) {
        message.tool_calls = toolCallParts
          .filter((p): p is { functionCall: FunctionCall } => 'functionCall' in p)
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
  private sanitizeSchema(schema: JSONSchema | undefined): JSONSchema | undefined {
    if (!schema || typeof schema !== 'object') return schema;
    if (Array.isArray(schema)) return schema.map((item) => this.sanitizeSchema(item as JSONSchema)) as unknown as JSONSchema;

    const newSchema = { ...schema };
    if (newSchema.type) {
      newSchema.type = newSchema.type.toLowerCase();
    }

    if (newSchema.properties && typeof newSchema.properties === 'object') {
      const newProps: Record<string, JSONSchema> = {};
      for (const [key, value] of Object.entries(newSchema.properties)) {
        newProps[key] = this.sanitizeSchema(value) as JSONSchema;
      }
      newSchema.properties = newProps;
    }

    // Recursively sanitize other object values that might contain schemas (like items, etc.)
    for (const key in newSchema) {
      if (key !== 'type' && key !== 'properties' && typeof newSchema[key] === 'object') {
        newSchema[key] = this.sanitizeSchema(newSchema[key] as JSONSchema);
      }
    }

    return newSchema;
  }
}
