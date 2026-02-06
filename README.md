# @yagolopez/adk-utils

[![npm version](https://img.shields.io/npm/v/@yagolopez/adk-utils.svg)](https://www.npmjs.com/package/@yagolopez/adk-utils)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

This npm package is a set of utilities for the **Google Agent Development Kit (ADK)** that facilitates the creation of IA Agents using local models with Ollama and Typescript. It also facilitates the management of streaming flows for them.

> [Ollama](https://ollama.com) local models can be very convenient during development time to save tokens

The motivation for this package is that Google Agent Development Kit (ADK) provides [a way to define agents based in local ollama for Python](https://google.github.io/adk-docs/agents/models/litellm/#setup) **but not for Typescript.**



## 🚀 Features

- **OllamaModel**: Custom implementation of ADK's `BaseLlm` to use local Ollama models.
- **GenAIAgentService**: Modular service to handle agent interactions, with native support for **Streaming** and **Server-Sent Events (SSE)**.
- **Compatibility**: Designed to work seamlessly with the Vercel AI SDK and the Google GenAI ecosystem.



## 📦 Installation

- Install the package:

```bash
npm install @yagolopez/adk-utils
```

- Depending on your project you might need to install other dependencies:

```bash
npm install @google/adk @google/genai ai ollama
```



## 🛠️ Usage of OllamaModel

The `OllamaModel` class is flexible and can be used with both **local** instances and **cloud-hosted** Ollama services.

### Using a Local Ollama Instance
Supposing Ollama is installed and running locally: `http://localhost:11434/v1` with the model: `qwen3:0.6b`:

```typescript
import { OllamaModel } from '@yagolopez/adk-utils';

// Create model from local Ollama
const model = new OllamaModel('qwen3:0.6b', 'http://localhost:11434/v1');

// Use the model with an ADK Agent
const agent = new LlmAgent({
  name: 'LocalAgent',
  model: model,
  tools: [{...}]
});
```

### Using a Cloud-Hosted Ollama Model
You can specify a custom base URL for cloud-hosted instances (e.g., via a proxy or specialized provider). Make sure to set `OLLAMA_API_KEY` in your environment variables if authentication is required. (For [Ollama Cloud](https://docs.ollama.com/cloud) models, `OLLAMA_API_KEY` can be obtained in https://ollama.com)

```typescript
import { OllamaModel } from '@yagolopez/adk-utils';

// Connects to a cloud-hosted Ollama instance
const model = new OllamaModel(
  'qwen2.5:0.5b', 
  'https://ollama.com',  // Or other provider url: 'https://your-cloud-ollama-provider.com/v1'
);

// Use with an ADK Agent
const agent = new LlmAgent({
  name: 'CloudAgent',
  model: model,
  tools: [...]
});
```



## 🛠️ Usage of GenAIAgentService

This package also provides a class service`GenAIAgentService` that simplifies the creation of streaming endpoints (or API routes) in Next.js for ADK agents:

```typescript
import { GenAIAgentService, OllamaModel } from '@yagolopez/adk-utils';
import { LlmAgent } from '@google/adk';

export async function POST(req: Request) {
  // Get user messages from the frontend
  const { messages } = await req.json();
    
  // Create instance of ADK agent  
  const agent = new LlmAgent({
    name: 'my-agent',
  	model: new OllamaModel('qwen2.5:0.5b', 'https://ollama.com'),
   	description: 'Agent description',
  	instruction: `You are a helpful assistant...`,
  	tools: [...],
  });
  
  // Create agent service to use the agent in the endpoint          
  const service = new GenAIAgentService(agent);

  if (!service.validateMessages(messages)) {
    return GenAIAgentService.createErrorResponse('Invalid messages', 400);
  }

  // Invoke the agent with the messages from the user and return the response
  return service.createStreamingResponse(messages);
}
```



## 🧪 Testing

The package includes a comprehensive suite of unit tests using Jest.

```bash
# Run tests
npm test

# View test coverage
npm run test:coverage
```



## 📃Documentation

Check the `/docs` directory



## 📜 Project Structure

- `src/ollama-model.ts`: LLM provider for Ollama.
- `src/genai-agent-service.ts`: Negotiation and streaming logic.
- `src/index.ts`: Package entry point.



## 📄 License

This project is licensed under the MIT License.
