"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mock_model_1 = require("./mock-model");
describe('MockModel', () => {
    let mockModel;
    beforeEach(() => {
        mockModel = new mock_model_1.MockModel();
    });
    it('should initialize with default values', () => {
        expect(mockModel).toBeDefined();
        // Access private property for testing if needed, or rely on behavior
    });
    it('should generate content in streaming mode', async () => {
        const request = {};
        const generator = mockModel.generateContentAsync(request, true);
        const results = [];
        for await (const result of generator) {
            results.push(result);
        }
        expect(results.length).toBe(3); // Default chunks: "Hello", " world", "!"
        expect(results[0].content?.parts?.[0].text).toBe('Hello');
        expect(results[2].content?.parts?.[0].text).toBe('!');
    });
    it('should generate content in non-streaming mode', async () => {
        const request = {};
        const generator = mockModel.generateContentAsync(request, false);
        const results = [];
        for await (const result of generator) {
            results.push(result);
        }
        expect(results.length).toBe(1);
        expect(results[0].content?.parts?.[0].text).toBe('Hello world!');
    });
    it('should allow updating mock responses', async () => {
        mockModel.setMockResponse(['New', ' ', 'Response']);
        const request = {};
        const generator = mockModel.generateContentAsync(request, true);
        const results = [];
        for await (const result of generator) {
            results.push(result);
        }
        expect(results.length).toBe(3);
        expect(results[0].content?.parts?.[0].text).toBe('New');
    });
    it('should throw error on connect', () => {
        expect(() => mockModel.connect()).toThrow('Live connections are not supported for MockModel');
    });
});
