import * as grpc from '@grpc/grpc-js';
import { createClient } from "../grpc/client";

describe('Client', () => {
  test('should fail after timeout', async () => {
    const promise = createClient('unknown', { timeout: 10 });
    return expect(promise).rejects.toThrow('Failed to connect before the deadline');
  });
});
