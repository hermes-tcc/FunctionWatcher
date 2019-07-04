import { Logger } from '../utils/Logger'

type ResolveFunction<T> = (value?: T | PromiseLike<T>) => void
type RejectFunction<T> = (reason?: any) => void
type Executor<T> = (resolve: ResolveFunction<T>, reject: RejectFunction<T>) => void

class TimeoutError extends Error {
  constructor() {
    super('Timeout error on Promise')
  }
}

export class Waiter<T> {
  public promise: Promise<T>
  public resolve: ResolveFunction<T>
  public reject: RejectFunction<T>
  private done: boolean
  private error: boolean
  private err: any

  constructor(executor?: Executor<T>) {
    this.done = false
    this.error = false
    this.err = null

    this.promise = new Promise((resolve, reject) => {
      this.resolve = val => {
        this.done = true
        resolve(val)
      }

      this.reject = reason => {
        this.done = true
        this.error = true
        this.err = reason
        reject(reason)
      }

      if (executor) executor(this.resolve, this.reject)
    })

    this.promise.catch(err => {
      Logger.info('Waiter promise error', err)
    })
  }

  public finish = async () => {
    const ret = await this.promise
    if (this.error) throw this.err
    return ret
  }

  public isDone = () => {
    return this.done
  }

  public then = (onFulfilled: (...args: any) => any, onRejected?: (...args: any) => any) => {
    this.promise.then(onFulfilled, onRejected ? onRejected : () => {})
  }
}

export class TimedWaiter<T> extends Waiter<T> {
  constructor(ms: number, executor?: Executor<T>) {
    super((resolve, reject) => {
      if (executor) executor(resolve, reject)
    })

    let timer: NodeJS.Timeout
    const clear = () => {
      clearTimeout(timer)
    }

    this.then(clear, clear)

    timer = setTimeout(() => {
      this.reject(new TimeoutError())
    }, ms)
  }
}
