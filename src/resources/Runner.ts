import moment, { Moment } from 'moment'
import { forEachObjIndexed } from 'ramda'
import { Readable } from 'stream'
import { InternalServerError } from '../errors/RouteError'
import { RunsLimitReached } from '../errors/RunRouteErrors'
import { Logger } from '../utils/Logger'
import { timeDiff } from '../utils/time'
import {
  createReportFile,
  createRunnerReadStream,
  createRunnerWriteStream,
  deleteFiles,
  getFunctionPath,
  KeyAndStreamValue,
} from './../utils/runner'
import { RedisEvents } from './RedisEvents'
import { StringStream } from './StringStream'
import { Subprocess } from './Subprocess'

export interface ActiveRun {
  runId: string
  run: Runner
}

interface RunnerConstructorArgs {
  runId: string
  input?: Readable
}

const getErrorString = (err: Error) => {
  return `${err.constructor.name} - ${err.message}`
}

export class Runner {
  private static PARALLEL_RUNS_LIMIT = 1
  private static curRuns = 0
  private static succRuns = 0
  private static errRuns = 0
  private static runs: ActiveRun[] = []

  public static getParallelRunsLimit() {
    return this.PARALLEL_RUNS_LIMIT
  }

  public static setParallelRunsLimit(newVal: number) {
    this.PARALLEL_RUNS_LIMIT = newVal
  }

  public static getCurrentRuns() {
    return this.curRuns
  }

  public static getSuccessRuns() {
    return this.succRuns
  }

  public static getErrorRuns() {
    return this.errRuns
  }

  public static getRun(runId: string): ActiveRun | null {
    const runArr = this.runs.filter(el => {
      return el.runId === runId
    })
    if (runArr.length === 0) return null
    return runArr[0]
  }

  public static addRun(run: Runner) {
    this.runs.push({
      run,
      runId: run.getId(),
    })
  }

  public static removeRun(runId: string) {
    this.runs = this.runs.filter(el => {
      return el.runId !== runId
    })
  }

  private id: string
  private process: Subprocess
  private input: Readable
  private status: string
  private startTime: Moment
  private endTime: Moment
  private runError?: Error
  private processFinished: boolean
  private reportReady: boolean

  constructor({ runId, input }: RunnerConstructorArgs) {
    this.id = runId
    this.input = input
    this.processFinished = false
    this.reportReady = false
    this.status = 'not-started'
    Runner.addRun(this)
  }

  public start() {
    Logger.info('[Runner] Try to start', { curRuns: Runner.curRuns })
    if (Runner.curRuns === Runner.PARALLEL_RUNS_LIMIT) throw new RunsLimitReached()

    Runner.curRuns += 1
    this.startTime = moment()

    this.process = new Subprocess({
      path: getFunctionPath(),
      id: this.id,
    })

    this.run()
    return {
      startTime: this.startTime,
      processFinish: this.process.finish,
    }
  }

  public getStatus() {
    return {
      status: this.status,
      ...(this.runError != null ? { error: getErrorString(this.runError) } : {}),
      runningTime: timeDiff(this.startTime, this.endTime || moment()),
      out: this.process.getOut(),
      err: this.process.getErr(),
    }
  }

  public kill() {
    this.process.kill()
  }

  public isProcessDone() {
    return this.processFinished
  }

  public isReportReady() {
    return this.reportReady
  }

  public getId() {
    return this.id
  }

  public async cleanup() {
    try {
      this.process.kill()
      await this.process.finish()
      Runner.removeRun(this.id)
      await deleteFiles(this.id)
    } catch (err) {
      Logger.error('[Runner] Error on cleanup', err)
    }
  }

  private async run() {
    this.status = 'running'
    try {
      Logger.info('[Runner] Run: try to create out and err streams')
      const out = await createRunnerWriteStream(this.id, 'out')
      const err = await createRunnerWriteStream(this.id, 'err')
      Logger.info('[Runner] Run: created out and err streams')

      this.process.start({
        out,
        err,
        in: this.input,
      })

      await this.process.finish()
      this.runError = this.process.getError()
      if (this.runError) this.error()
      else this.success()
    } catch (err) {
      Logger.error('[Runner] Run function error', err)
      this.runError = new InternalServerError()
      this.error()
    }
  }

  private error() {
    Runner.errRuns += 1
    this.done('error')
  }

  private success() {
    Runner.succRuns += 1
    this.done('success')
  }

  private async done(status: string) {
    Runner.curRuns -= 1
    this.status = status
    this.processFinished = true
    this.endTime = moment()
    await this.prepareRunReportFile()
    RedisEvents.runDone(this.id)
    Logger.info(`[Runner] Run finished ${this.status}`, {
      status: this.status,
      ...(this.runError != null ? { error: getErrorString(this.runError) } : {}),
      startTime: this.startTime,
      endTime: this.endTime,
      pastTime: timeDiff(this.startTime, this.endTime),
      curRuns: Runner.curRuns,
      errRuns: Runner.errRuns,
      succRuns: Runner.succRuns,
    })
  }

  private async prepareRunReportFile() {
    try {
      const errorField =
        this.runError != null ? new StringStream(getErrorString(this.runError)) : null

      const obj = {
        status: new StringStream(this.status),
        ...(errorField ? { error: errorField } : {}),
        startTime: new StringStream(this.startTime.toString()),
        endTime: new StringStream(this.endTime.toString()),
        pastTime: new StringStream(timeDiff(this.startTime, this.endTime).toString()),
        err: await createRunnerReadStream(this.id, 'err'),
        out: await createRunnerReadStream(this.id, 'out'),
      }

      const arr: KeyAndStreamValue[] = []
      forEachObjIndexed((val, key) => arr.push({ key, val }), obj)
      await createReportFile(arr, this.id)
      this.reportReady = true
      Logger.info('[Runner] Created report file')
    } catch (err) {
      Logger.error('[Runner] Error creating report file', err)
    }
  }
}
