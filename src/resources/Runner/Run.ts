import { Waiter } from '@hermes-serverless/custom-promises'
import { fileExists } from '@hermes-serverless/fs-utils'
import { StringStream, WritableWithEnd } from '@hermes-serverless/stream-utils'
import { ProcessResult, Subprocess } from '@hermes-serverless/subprocess'
import moment, { Moment } from 'moment'
import { Readable, Writable } from 'stream'
import { MAX_OUTPUT_SIZE, MAX_QUEUE_BUFFER_SIZE } from '../../limits/index'
import { getHandlerPath } from '../../utils/functionHandler'
import { Logger } from '../../utils/Logger'
import { timeDiff } from '../../utils/time'
import RunFileManager from './RunFileManager'

type CallbackFn = (() => void) | ((runID: string) => void)

export interface RunOptions {
  onError?: CallbackFn
  onSuccess?: CallbackFn
  onDone?: CallbackFn
  maxBufferSize?: number
  maxOutputSize?: number
}

export interface RunStatus {
  status: string
  startTime?: Moment
  endTime?: Moment
  runningTime?: string
  error?: string
  out?: string
  err?: string
}

export interface IO {
  input: Readable
  output: Writable | WritableWithEnd
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
  private processFinished: boolean
  private processPromise: Promise<ProcessResult>
  private done: Waiter<void>

  private onError: CallbackFn
  private onSuccess: CallbackFn
  private onDone: CallbackFn

  constructor(runID: string, options?: RunOptions) {
    this.id = runID
    const opts = options || {}

    this.onError = opts.onError
    this.onSuccess = opts.onSuccess
    this.onDone = opts.onDone
    this.done = new Waiter()

    this.processFinished = false
    this.status = 'not-started'
    this.fileManager = new RunFileManager(this.id)

    this.process = new Subprocess(getHandlerPath(), {
      id: this.id,
      maxBufferSize: opts.maxBufferSize != null ? opts.maxBufferSize : MAX_QUEUE_BUFFER_SIZE,
      maxOutputSize: opts.maxOutputSize != null ? options.maxOutputSize : MAX_OUTPUT_SIZE,
      logger: Logger,
    })
  }

  get isProcessDone() {
    return this.processFinished
  }

  get donePromise() {
    return this.done.finish()
  }

  get runID() {
    return this.id
  }

  get outputStream() {
    return this.fileManager.createRunReadStream('all')
  }

  get statusReport() {
    return this.getStatus()
  }

  public getStatus = (additional?: string[]) => {
    const additionalKeys = additional || []
    const status: RunStatus = {
      status: this.status,
      ...(this.runError ? { error: getErrorString(this.runError) } : {}),
      ...(this.startTime
        ? { startTime: this.startTime, runningTime: timeDiff(this.startTime, this.endTime || moment()) }
        : {}),
      ...(this.endTime ? { endTime: this.endTime } : {}),
      ...(additionalKeys.includes('out') ? { out: this.process.stdoutBuffer } : {}),
      ...(additionalKeys.includes('err') ? { err: this.process.stderrBuffer } : {}),
    }

    return status
  }

  public start = (io?: IO) => {
    this.startTime = moment()
    this._run(io)
    return {
      startTime: this.startTime,
    }
  }

  public kill = () => {
    this.process.kill()
  }

  public cleanup = async () => {
    try {
      await this.done.finish()
    } catch (err) {
      Logger.error(this.addName('Cleanup wait done error\n'), err)
    }

    try {
      await this.fileManager.deleteFiles()
    } catch (err) {
      Logger.error(this.addName(`Error on cleanup\n`), err)
    }
  }

  public _getStreams = async (io?: IO) => {
    const all: (WritableWithEnd | Writable)[] = [
      { stream: await this.fileManager.createRunWriteStream('all'), end: true },
    ]
    if (io) all.push(io.output)

    let input: Readable = new StringStream('')
    if (io) {
      input = io.input
    } else if (await fileExists(this.fileManager.getIOPath('in'))) {
      input = await this.fileManager.createRunReadStream('in')
    }
    return { input, all }
  }

  public _run = async (io?: IO) => {
    this.status = 'running'

    try {
      const streams = await this._getStreams(io)
      this.processPromise = this.process.run(streams)
      await this.processPromise
      this.status = 'success'
      if (this.onSuccess) this.onSuccess(this.id)
    } catch (err) {
      this.status = 'error'
      this.runError = err
      Logger.error(this.addName(`run() error\n`), err)
      if (this.onError) this.onError(this.id)
    }

    this.endTime = moment()
    Logger.info(this.addName(`Run finished ${this.status}`), this.statusReport)
    if (this.onDone) this.onDone(this.id)
    if (this.runError) this.done.reject(this.runError)
    else this.done.resolve()
    this.processFinished = true
  }

  private addName = (msg: string) => {
    return `[Run ${this.id}] ${msg}`
  }
}
