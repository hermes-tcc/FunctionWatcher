import R from 'ramda'
import { RunsLimitReached } from '../../errors/RunRouteErrors'
import { Logger } from '../../utils/Logger'
import { Run } from './Run'

export class Runner {
  private static PARALLEL_RUNS_LIMIT = 1
  private static curRuns = 0
  private static succRuns = 0
  private static errRuns = 0
  private static runs: Run[] = []

  public static getParallelRunsLimit = () => {
    return Runner.PARALLEL_RUNS_LIMIT
  }

  public static setParallelRunsLimit = (newVal: number) => {
    Runner.PARALLEL_RUNS_LIMIT = newVal
  }

  public static getCurrentRuns = () => {
    return Runner.curRuns
  }

  public static getSuccessRuns = () => {
    return Runner.succRuns
  }

  public static getErrorRuns = () => {
    return Runner.errRuns
  }

  public static getRun = (runID: string): Run | null => {
    const run = R.find(el => el.getID() === runID, Runner.runs)
    if (run == null) return null
    return run
  }

  public static createRun = (runID: string) => {
    Logger.info('[Runner] Try to create run', { curRuns: Runner.curRuns })
    if (Runner.curRuns === Runner.PARALLEL_RUNS_LIMIT) {
      throw new RunsLimitReached(Runner.PARALLEL_RUNS_LIMIT)
    }

    Runner.curRuns += 1
    const onError = () => {
      Runner.curRuns -= 1
      Runner.errRuns += 1
    }

    const onSuccess = () => {
      Runner.curRuns -= 1
      Runner.succRuns += 1
    }

    const run = new Run({
      runID,

      onError,
      onSuccess,
    })

    Runner.runs.push(run)
    return run
  }

  public static removeRun = async (runID: string) => {
    const run = R.find(el => el.getID() === runID, Runner.runs)
    if (run == null) return null
    run.setDeleted()
    await run.cleanup()
    Runner.runs = Runner.runs.filter(el => el.getID() !== runID)
    return run
  }
}
