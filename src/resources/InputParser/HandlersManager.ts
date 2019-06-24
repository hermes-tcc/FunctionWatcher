import { Waiter } from '../../utils/CustomPromises'
import { Logger } from '../../utils/Logger'
import { Counter } from './Counter'

export class HandlersManager {
  private pendingHandlers: Counter
  private finishedHandlers: Waiter<void>

  constructor(doneEmitting: Waiter<void>) {
    this.pendingHandlers = new Counter()
    this.finishedHandlers = new Waiter()

    doneEmitting.then(() => {
      Logger.info('[HandlersManager] - Emitting is finished - Busboy finish')
      this.pendingHandlers.onceZero(this.finishedHandlers.resolve)
    })
  }

  public incrementPendingHandler = () => {
    this.pendingHandlers.increment()
  }

  public decrementPendingHandler = () => {
    this.pendingHandlers.decrement()
  }

  public finishAllHandlers = () => {
    return this.finishedHandlers
  }

  public isFinished = () => {
    return this.finishedHandlers.isDone()
  }
}
