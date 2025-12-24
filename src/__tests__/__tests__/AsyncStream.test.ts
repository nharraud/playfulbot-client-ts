import { describe, test, expect } from 'vitest';
import { AsyncStream } from "../helpers/AsyncStream";

describe('AsyncStream', () => {
  test('should read published data', async () => {
    const stream = new AsyncStream<number>();
    let counter = 0;
    const pushInterval = setInterval(() => {
      if (counter < 6) {
        stream.push(counter++);
      } else {
        stream.complete();
        clearInterval(counter);
      }
    }, 10);

    const result = [];
    for await (const value of stream) {
      result.push(value);
    }
    expect(result).toEqual([0, 1, 2, 3, 4, 5]);
  });
});