import { MockLlm } from './mock-llm';
import { LlmRequest, LlmResponse } from '@google/adk';

describe('MockLlm', () => {
  let mockLlm: MockLlm;

  beforeEach(() => {
    mockLlm = new MockLlm();
  });

  it('should initialize with default values', () => {
    expect(mockLlm).toBeDefined();
    // Access private property for testing if needed, or rely on behavior
  });

  it('should generate content in streaming mode', async () => {
    const request = {} as LlmRequest;
    const generator = mockLlm.generateContentAsync(request, true);
    const results: LlmResponse[] = [];

    for await (const result of generator) {
      results.push(result);
    }

    expect(results.length).toBe(3); // Default chunks: "Hello", " world", "!"
    expect(results[0].content?.parts?.[0].text).toBe('Hello');
    expect(results[2].content?.parts?.[0].text).toBe('!');
  });

  it('should generate content in non-streaming mode', async () => {
    const request = {} as LlmRequest;
    const generator = mockLlm.generateContentAsync(request, false);
    const results: LlmResponse[] = [];

    for await (const result of generator) {
      results.push(result);
    }

    expect(results.length).toBe(1);
    expect(results[0].content?.parts?.[0].text).toBe('Hello world!');
  });

  it('should allow updating mock responses', async () => {
    mockLlm.setMockResponse(['New', ' ', 'Response']);
    const request = {} as LlmRequest;
    const generator = mockLlm.generateContentAsync(request, true);
    const results: LlmResponse[] = [];

    for await (const result of generator) {
      results.push(result);
    }

    expect(results.length).toBe(3);
    expect(results[0].content?.parts?.[0].text).toBe('New');
  });

  it('should throw error on connect', () => {
    expect(() => mockLlm.connect()).toThrow('Live connections are not supported for MockLlm');
  });
});
