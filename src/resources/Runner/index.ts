import R from 'ramda'
import { RunsLimitReached } from '../../errors/RunRouteErrors'
import { Logger } from '../../utils/Logger'
import { RedisEvents } from '../RedisEvents'
import { Run } from './Run'

export class Runner {
  private static PARALLEL_RUNS_LIMIT = 1
  private static curRuns = 0
  private static succRuns = 0
  private static errRuns = 0
  private static runs: Run[] = []

  public static get parallelRunsLimit() {
    return Runner.PARALLEL_RUNS_LIMIT
  }

  public static setParallelRunsLimit = (newVal: number) => {
    Runner.PARALLEL_RUNS_LIMIT = newVal
  }

  public static get currentRuns() {
    return Runner.curRuns
  }

  public static get successRuns() {
    return Runner.succRuns
  }

  public static get errorRuns() {
    return Runner.errRuns
  }

  public static reset = async () => {
    for (let i = 0; i < Runner.runs.length; i += 1) {
      await Runner.removeRun(Runner.runs[i].runID)
    }

    Runner.curRuns = 0
    Runner.succRuns = 0
    Runner.errRuns = 0
    Runner.runs = []
  }

  public static getRun = (runID: string): Run | null => {
    const run = R.find(el => el.runID === runID, Runner.runs)
    if (run == null) return null
    return run
  }

  public static createRun = (runID: string) => {
    Logger.info('[Runner] Try to create run', { curRuns: Runner.curRuns })
    if (Runner.curRuns === Runner.PARALLEL_RUNS_LIMIT) throw new RunsLimitReached(Runner.PARALLEL_RUNS_LIMIT)

    Runner.curRuns += 1
    const onError = () => {
      Runner.curRuns -= 1
      Runner.errRuns += 1
    }

    const onSuccess = () => {
      Runner.curRuns -= 1
      Runner.succRuns += 1
    }

    const run = new Run(runID, {
      onError,
      onSuccess,
      onDone: RedisEvents.runDone,
    })

    Runner.runs.push(run)
    return run
  }

  public static removeRun = async (runID: string) => {
    const run = R.find(el => el.runID === runID, Runner.runs)
    if (run == null) return null
    Runner.runs = Runner.runs.filter(el => el.runID !== runID)
    await run.cleanup()
    return run
  }
}
