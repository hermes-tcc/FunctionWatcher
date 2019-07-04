import moment, { Moment } from 'moment'
import { forEachObjIndexed } from 'ramda'
import { getHandlerPath } from '../../utils/functionHandler'
import { InternalServerError } from './../../errors/RouteError'
import { RunBeingDeleted } from './../../errors/RunRouteErrors'
import { MAX_OUTPUT_SIZE, MAX_QUEUE_BUFFER_SIZE } from './../../limits/index'
import { Logger } from './../../utils/Logger'
import { timeDiff } from './../../utils/time'
import { RedisEvents } from './../RedisEvents'
import { StringStream } from './../StringStream'
import { Subprocess } from './../Subprocess'
import { KeyAndStreamValue, RunFileManager } from './RunFileManager'

type CallbackFn = () => void

interface RunnerConstructorArgs {
  runID: string
  onError: CallbackFn
  onSuccess: CallbackFn
}

const getErrorString = (err: Error) => {
  return `${err.constructor.name} - ${err.message}`
}

export class Run {
  private id: string
  private process: Subprocess
  private fileManager: RunFileManager

  private status: string
  private startTime: Moment
  private endTime: Moment

  private runError?: Error
  private deleted: boolean
  private processFinished: boolean
  private reportReady: boolean

  private onError: CallbackFn
  private onSuccess: CallbackFn

  constructor({ runID, onError, onSuccess }: RunnerConstructorArgs) {
    this.id = runID
    this.onError = onError
    this.onSuccess = onSuccess

    this.processFinished = false
    this.reportReady = false
    this.status = 'not-started'
    this.fileManager = new RunFileManager(this.id)
    this.deleted = false

    this.process = new Subprocess({
      path: getHandlerPath(),
      id: this.id,
      maxOutputBufferSize: MAX_QUEUE_BUFFER_SIZE,
      maxOutputSize: MAX_OUTPUT_SIZE,
    })
  }

  public start = () => {
    if (this.deleted) throw new RunBeingDeleted(this.id)
    this.startTime = moment()
    this.run()

    return {
      startTime: this.startTime,
      processFinish: this.process.finish,
    }
  }

  public getStatus = () => {
    if (this.deleted) throw new RunBeingDeleted(this.id)
    return {
      status: this.status,
      ...(this.runError != null ? { error: getErrorString(this.runError) } : {}),
      runningTime: timeDiff(this.startTime, this.endTime || moment()),
      out: this.process.getOut(),
      err: this.process.getErr(),
    }
  }

  public kill = () => {
    this.process.kill()
  }

  public isProcessDone = () => {
    return this.processFinished
  }

  public isReportReady = () => {
    return this.reportReady
  }

  public getID = () => {
    return this.id
  }

  public getResultPath = () => {
    if (this.deleted) throw new RunBeingDeleted(this.id)
    return this.fileManager.getIOPath('rep')
  }

  public setDeleted = () => {
    this.deleted = true
  }

  public cleanup = async () => {
    try {
      this.process.kill()
      await this.process.finish()
      await this.fileManager.deleteFiles()
    } catch (err) {
      Logger.error(`[Run ${this.id}] Error on cleanup`, err)
    }
  }

  private async run() {
    this.status = 'running'
    try {
      Logger.info(`[Run ${this.id}] Run: try to create streams`)
      const [input, out, err] = await Promise.all([
        this.fileManager.createRunReadStream('in'),
        this.fileManager.createRunWriteStream('out'),
        this.fileManager.createRunWriteStream('err'),
      ])
      Logger.info(`[Run ${this.id}] Run: created streams`)

      this.process.start({
        out,
        err,
        in: input,
      })

      await this.process.finish()
      this.endTime = moment()
      this.runError = this.process.getError()
      if (this.runError) this.error()
      else this.success()
    } catch (err) {
      Logger.error(`[Run ${this.id}] run() error`, err)
      this.runError = new InternalServerError()
      this.error()
    }
  }

  private error() {
    this.onError()
    this.done('error')
  }

  private success() {
    this.onSuccess()
    this.done('success')
  }

  private async done(status: string) {
    this.status = status
    this.processFinished = true

    await this.prepareRunReportFile()
    RedisEvents.runDone(this.id)
    Logger.info(`[Run ${this.id}] Run finished ${this.status}`, {
      status: this.status,
      ...(this.runError != null ? { error: getErrorString(this.runError) } : {}),
      startTime: this.startTime,
      endTime: this.endTime,
      pastTime: timeDiff(this.startTime, this.endTime),
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
        err: await this.fileManager.createRunReadStream('err'),
        out: await this.fileManager.createRunReadStream('out'),
      }

      const arr: KeyAndStreamValue[] = []
      forEachObjIndexed((val, key) => arr.push({ key, val }), obj)
      await this.fileManager.createReportFile(arr)
      this.reportReady = true
      Logger.info(`[Run ${this.id}] Created report file`)
    } catch (err) {
      Logger.error(`[Run ${this.id}] Error creating report file`, err)
    }
  }
}
