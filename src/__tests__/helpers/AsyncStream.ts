export class DeferredPromise<T> {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;

  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
}

class ChainedPromise<T> extends DeferredPromise<ChainedPromise<T>> {
  value: T;

  constructor(value: T) {
    super();
    this.value = value;
  }
}

export class AsyncStream<T> implements AsyncIterator<T, undefined> {
  lastPromise: DeferredPromise<ChainedPromise<T>>;
  currentPromise: Promise<ChainedPromise<T>>;

  constructor() {
    this.lastPromise = new DeferredPromise<ChainedPromise<T>>();
    this.currentPromise = this.lastPromise.promise;
  }

  [Symbol.asyncIterator](): AsyncIterator<T, undefined> {
    return this;
  }

  push(value: T): void {
    const chainedPromise = new ChainedPromise<T>(value);
    this.lastPromise.resolve(chainedPromise);
    this.lastPromise = chainedPromise;
  }

  async next(): Promise<IteratorResult<T, undefined>> {
    const result = await this.currentPromise;
    if (!result) {
      return { value: undefined, done: true };
    }
    this.currentPromise = result.promise;
    return { value: result.value, done: false };
  }

  return(): Promise<IteratorResult<T, undefined>> {
    this.lastPromise.resolve(undefined);
    return Promise.resolve({ value: undefined, done: true });
  }

  throw(err?: unknown): Promise<IteratorResult<T, undefined>> {
    this.lastPromise.reject(err);
    return Promise.reject(err);
  }

  complete(): void {
    this.lastPromise.resolve(undefined);
  }
}