# @yagolopez/adk-utils

[![npm version](https://img.shields.io/npm/v/@yagolopez/adk-utils.svg)](https://www.npmjs.com/package/@yagolopez/adk-utils)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

This npm package is a set of utilities for the [Google Agent Development Kit (ADK)](https://google.github.io/adk-docs/) that facilitates the creation of IA Agents using local models with Ollama and Typescript. It also facilitates the management of streaming flows for them.

> [Ollama](https://ollama.com) local models can be very convenient during development time to save tokens

The motivation for this package is that Google Agent Development Kit (ADK) provides [a way to define agents based in local models for Python using the library `litellm`](https://google.github.io/adk-docs/agents/models/litellm/#setup) **but there is no way of using local ollama models if you are using Typescript.**


## 💻 Demo
- https://adk-utils-example.vercel.app


## 🚀 Features

- **OllamaModel**: Custom implementation of ADK's `BaseLlm` to use local Ollama models.
- **Function calling**: OllamaModel allows to use LLM models with tool calling 
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

# IMPORTANT: Use the latest versions of this packages to avoid conflicts
```



## 🛠️ Usage of OllamaModel

The `OllamaModel` class can be used with both **local** and **cloud-hosted** Ollama models to create Agents

### Using a Local Ollama model
Supposing Ollama is installed and running locally: `http://localhost:11434/v1` with the model: `qwen3:0.6b` you can create an ADK Agent that uses the **local Ollama** model this way:

```typescript
// agent1.ts
// (install @google/adk if you dont have this package)

import {OllamaModel} from '@yagolopez/adk-utils';
import {LlmAgent} from '@google/adk';

// Create an instance of an ADK model using a local Ollama model
const agent = new LlmAgent({
  name: 'LocalAgent',
  model: new OllamaModel('qwen3:0.6b', 'http://localhost:11434/v1'),
  description: 'Agent description',
  instruction: `You are a helpful assistant...`,
  tools: [...],
});
```

### Using a Cloud-Hosted Ollama Model
For **cloud-hosted Ollama models** you will need an `OLLAMA_API_KEY`defined in the `.env` file, and pass the following url to the `OllamaModel` constructor: 'https://ollama.com'

> `OLLAMA_API_KEY` can be obtained in https://ollama.com)

Here is an example:

```typescript
// agent2.ts
// (install @google/adk if you dont have this package)

import {OllamaModel} from '@yagolopez/adk-utils';
import {LlmAgent} from '@google/adk';

// Create an instance of an ADK model using a cloud-hosted Ollama model
const agent = new LlmAgent({
  name: 'CloudAgent',
  model: new OllamaModel('qwen2.5:0.5b', 'https://ollama.com'),
  description: 'Agent description',
  instruction: `You are a helpful assistant...`,
  tools: [...],
});
```



## 🛠️ Usage of GenAIAgentService

This package also provides a service called`GenAIAgentService` that simplifies the creation of streaming endpoints (or API routes) in Next.js for ADK agents:

```typescript
// route.ts
// (install @google/adk if you dont have this package)

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
  
  // Create agent service to invoke the agent in the endpoint          
  const service = new GenAIAgentService(agent);

  // Check if the messages sent by the user are valid
  if (!service.validateMessages(messages)) {
    return GenAIAgentService.createErrorResponse('Invalid messages', 400);
  }

  // Invoke the agent with messages from the user and return the agent response in stream format
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
- `src/genai-agent-service.ts`: Porvides streaming logic.
- `src/index.ts`: Package entry point.



## 📄 License

This project is licensed under the MIT License.
