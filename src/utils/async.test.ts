import { asyncStream } from './async';

test('asyncStream returns every value', async () => {
  const {push, reject, complete, out} = asyncStream();
  const expected = [1, 2, 3, 4];
  for (const val of expected) {
    push(val);
  }
  complete();
  const result = []
  for await (const val of out()) {
    result.push(val)
  }
  expect(result).toEqual(expected);
});

test('asyncStream throws when reject is used', async () => {
  const {push, reject, complete, out} = asyncStream();
  const expected = [1, 2, 3, 4];
  for (const val of expected) {
    push(val);
  }
  const error = new Error("my error");
  reject(error);
  const result: any[] = [];
  async function pull() {
    for await (const val of out()) {
      result.push(val)
    }
  }
  await expect(pull()).rejects.toThrowError(error);
  expect(result).toEqual(expected);
});
