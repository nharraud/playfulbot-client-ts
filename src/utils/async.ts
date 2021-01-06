import { Observable } from '@apollo/client/utilities';

class DeferredPromise<T> {
  promise: Promise<T>
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason?: any) => void

  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
}

class ChainedPromise<T> extends DeferredPromise<ChainedPromise<T>> {
  value: T

  constructor(value: T) {
    super();
    this.value = value;
  }
}

export function asyncStream<T>() {
  let lastPromise = [new DeferredPromise<ChainedPromise<T>>()];
  const firstPromise = lastPromise[0].promise;

  function push(value: T) {
    const chainedPromise = new ChainedPromise<T>(value);
    lastPromise[0].resolve(chainedPromise);
    lastPromise[0] = chainedPromise;
  }

  function complete() {
    lastPromise[0].resolve(null);
  }

  async function* out() {
    let currentPromise = firstPromise;
    while (true) {
      const result = await currentPromise;
      if (!result)
        break;
      yield result.value;
      currentPromise = result.promise;
    }
  }

  function reject(err?: any) {
    lastPromise[0].reject(err);
  }

  return {push, reject, complete, out};
}

export function observableToAsyncGenerator<T>(observable: Observable<T>) {
  const {push, reject, complete, out} = asyncStream();

  const subscription = observable.subscribe({
    next(data: T) {
      push(data);
    },
    error(err) {
      reject(err);
    },
    complete() {
      complete();
    }
  });

  return out();
}