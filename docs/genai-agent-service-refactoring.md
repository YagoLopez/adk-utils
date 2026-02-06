# GenAI Agent Service

## Diagrama de Clases

```mermaid
classDiagram
    class GenAIAgentService {
        -agent: LlmAgent
        -model: BaseLlm
        -tools: ToolUnion[]
        -encoder: TextEncoder
        -MAX_TURNS: number
        +constructor(agent: LlmAgent)
        +validateMessages(messages: UIMessage[]): boolean
        +transformMessagesToContents(messages: UIMessage[]): Content[]
        +formatToolsForGenAI(): FormattedTool[]
        +createStreamingResponse(messages: UIMessage[]): Response
        +createErrorResponse(message: string, status: number, details?: string): Response
        -hasName(tool: ToolUnion): boolean
        -formatSSEChunk(chunk: SSEChunk): string
        -encodeSSEChunk(chunk: SSEChunk): Uint8Array
        -sendStartEvents(controller: ReadableStreamDefaultController): void
        -sendEndEvents(controller: ReadableStreamDefaultController): void
        -sendErrorEvent(controller: ReadableStreamDefaultController, error: unknown): void
        -processTextDelta(part: Part, textBuffer: string, controller: ReadableStreamDefaultController): string
        -findToolByName(name: string): BaseTool
        -executeTool(tool: BaseTool, args: Record): Promise
        -processToolCalls(functionCalls: Part[]): Promise
        -streamTurn(contents: Content[], tools: FormattedTool[], controller: ReadableStreamDefaultController): Promise
        -runConversationLoop(contents: Content[], tools: FormattedTool[], controller: ReadableStreamDefaultController): Promise
    }

    class APIRoute {
        +POST(req: Request): Promise~Response~
    }

    class LlmAgent {
        +canonicalModel: BaseLlm
        +tools: ToolUnion[]
    }

    APIRoute --> GenAIAgentService : usa
    GenAIAgentService --> LlmAgent : recibe
```

## Diagrama de Secuencia - Flujo de Request

```mermaid
sequenceDiagram
    participant Client
    participant APIRoute as POST /api/genai-agent-2
    participant Service as GenAIAgentService
    participant Model as BaseLlm
    participant Tools as Agent Tools

    Client->>APIRoute: POST { messages }
    APIRoute->>Service: new GenAIAgentService(rootAgent)
    APIRoute->>Service: validateMessages(messages)
    
    alt Messages inválidos
        Service-->>APIRoute: false
        APIRoute-->>Client: 400 Error
    else Messages válidos
        Service-->>APIRoute: true
        APIRoute->>Service: createStreamingResponse(messages)
        
        Service->>Service: transformMessagesToContents()
        Service->>Service: formatToolsForGenAI()
        Service->>Service: sendStartEvents()
        
        loop Conversation Loop (max 5 turns)
            Service->>Model: generateContentAsync()
            Model-->>Service: Stream chunks
            
            alt Has Function Calls
                Service->>Tools: executeTool()
                Tools-->>Service: Tool Result
                Service->>Service: Add to conversation history
            else No Function Calls
                Service->>Service: Break loop
            end
        end
        
        Service->>Service: sendEndEvents()
        Service-->>Client: SSE Stream Response
    end
```

## Diagrama de Flujo - Procesamiento de Streaming

```mermaid
flowchart TD
    A[Iniciar Stream] --> B[Enviar Start Events]
    B --> C[Iniciar Loop de Conversación]
    C --> D{turnCount < MAX_TURNS?}
    
    D -->|Sí| E[Llamar generateContentAsync]
    E --> F[Procesar Chunks]
    F --> G{¿Tiene text?}
    G -->|Sí| H[processTextDelta]
    H --> I[Enviar text-delta SSE]
    
    G -->|No| J{¿Tiene functionCall?}
    I --> J
    J -->|Sí| K[Agregar a functionCalls]
    K --> L{¿Más chunks?}
    J -->|No| L
    
    L -->|Sí| F
    L -->|No| M{¿Hay function calls?}
    
    M -->|Sí| N[Agregar model response a history]
    N --> O[processToolCalls]
    O --> P[Agregar tool response a history]
    P --> C
    
    M -->|No| Q[Enviar End Events]
    D -->|No| Q
    Q --> R[Cerrar Controller]
```

## Métodos de la Clase

### Métodos Públicos

| Método | Descripción |
|--------|-------------|
| `validateMessages()` | Valida que el array de mensajes exista y no esté vacío |
| `transformMessagesToContents()` | Convierte `UIMessage[]` de Vercel AI SDK a `Content[]` de ADK |
| `formatToolsForGenAI()` | Adapta las herramientas del agente al formato esperado por GenAI |
| `createStreamingResponse()` | Crea la respuesta SSE con streaming completo |
| `createErrorResponse()` | Método estático para generar respuestas de error HTTP |

### Métodos Privados

| Método | Descripción |
|--------|-------------|
| `hasName()` | Type guard para verificar si una tool tiene propiedad `name` |
| `formatSSEChunk()` | Formatea un chunk para SSE (`data: {...}\n\n`) |
| `encodeSSEChunk()` | Codifica un chunk SSE a `Uint8Array` |
| `sendStartEvents()` | Envía eventos SSE de inicio (`start`, `start-step`, `text-start`) |
| `sendEndEvents()` | Envía eventos SSE de fin (`text-end`, `finish-step`, `finish`) |
| `sendErrorEvent()` | Envía evento SSE de error |
| `processTextDelta()` | Procesa deltas de texto evitando duplicados (comportamiento Gemini) |
| `findToolByName()` | Busca una herramienta por nombre |
| `executeTool()` | Ejecuta una herramienta y retorna el resultado |
| `processToolCalls()` | Procesa múltiples llamadas a funciones |
| `streamTurn()` | Ejecuta un turno de streaming y recolecta function calls |
| `runConversationLoop()` | Ejecuta el loop multi-turno completo |

## Uso

```typescript
import { rootAgent } from '@/app/agents/agent1';
import { GenAIAgentService } from '@/app/lib/genai-agent-service';

// En la API route
const service = new GenAIAgentService(rootAgent);

if (!service.validateMessages(messages)) {
  return GenAIAgentService.createErrorResponse('Messages are required', 400);
}

return service.createStreamingResponse(messages);
```
