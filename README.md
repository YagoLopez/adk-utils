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
- **MockModel**: Mock implementation of `BaseLlm` for testing and development without API costs or dependencies.
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


## 🛠️ GenAIAgentService

This package also provides a service called `GenAIAgentService` that simplifies the creation of streaming endpoints (or API routes) in **Next.js** for ADK agents:

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





## 🛠️ MockModel

The package also includes the `MockModel` class which is a mock implementation of ADK's `BaseLlm` designed for testing and development. It allows you to simulate LLM responses with custom chunks and delays without making real API calls.

```typescript
import { MockModel } from '@yagolopez/adk-utils';
import { LlmAgent } from '@google/adk';

// Create a mock model with custom response chunks and delay
const mockModel = new MockModel(
    'test-model', 
    50, // 50ms delay between chunks
    ['Hello', ' this is', ' a mock response']
);

const agent = new LlmAgent({
    name: 'MockAgent',
    model: mockModel,
    description: 'Testing Agent',
    instruction: 'You are a test agent',
});
```

You can also dynamically change the mock response and delay:

```typescript
mockModel.setMockResponse(['New', ' custom', ' response']);
mockModel.setResponseDelay(100);
```


### 🧪 Using MockModel in Playwright E2E tests

`MockModel` is particularly useful for **Playwright** end-to-end tests because it allows you to test your application's UI and agent logic without needing a running Ollama instance or incurring in API costs.

This is an example of a playwright test using MockModel:

```typescript
// example.spec.ts

mport { test, expect } from "@playwright/test";
import { MockModel, GenAIAgentService } from "@yagolopez/adk-utils";
import { LlmAgent } from "@google/adk";

test.describe("Chat Functionality", () => {
  test("user can send a message and receive a response", async ({ page }) => {
    await page.route("/api/genai-agent", async (route) => {
      const { messages } = route.request().postDataJSON();

      // Create agent with mock model
      const agent = new LlmAgent({
        name: "test_agent",
        description: "test-description",
        model: new MockModel("mock-model", 0, ["Response from mock model"]), 👈
        instruction: "You are a test agent.",
      });

      const service = new GenAIAgentService(agent);
      const response = service.createStreamingResponse(messages);
      const bodyBuffer = await response.arrayBuffer();

      await route.fulfill({
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        contentType:
          response.headers.get("content-type") || "text/event-stream",
        body: Buffer.from(bodyBuffer),
      });
    });

    await page.goto("/");

    const input = page.getByPlaceholder("Ask the agent...");
    await input.fill("hola");

    const sendButton = page.getByRole("button", { name: "Send message" });
    await sendButton.click();

    await expect(page.getByText("Response from mock model")).toBeVisible();
  });
});
```



## 🧪 Unit Testing

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
- `src/mock-model.ts`: Mock LLM implementation for testing.
- `src/genai-agent-service.ts`: Porvides streaming logic.
- `src/index.ts`: Package entry point.



## 📄 License

This project is licensed under the MIT License.
