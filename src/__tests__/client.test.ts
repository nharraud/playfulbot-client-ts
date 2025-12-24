import { describe, test, expect } from 'vitest';
import { createBackendClient, createRunnerClient } from "../grpc/client";

describe('Backend Client', () => {
  test('should fail after timeout', async () => {
    const promise = createBackendClient('unknown', { timeout: 10 });
    return expect(promise).rejects.toThrow('Failed to connect before the deadline');
  });
});

describe('Runnner Client', () => {
  test('should fail after timeout', async () => {
    const promise = createRunnerClient('unknown', { timeout: 10 });
    return expect(promise).rejects.toThrow('Failed to connect before the deadline');
  });
});
