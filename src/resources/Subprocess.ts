import { ChildProcess, spawn } from 'child_process'
import { Readable, Writable } from 'stream'
import { MaxOutputSizeReached, NonZeroReturnCode } from '../errors/RunnerErrors'
import { QueueBuffer } from '../utils/CircularBuffer'
import { Waiter } from '../utils/CustomPromises'
import { Logger } from '../utils/Logger'

const KBYTE = 1024
const MBYTE = 1024 * 1024
const MAX_QUEUE_BUFFER_SIZE = 10 * KBYTE
const MAX_OUTPUT_SIZE = 10 * MBYTE

interface SubprocessConstructor {
  path: string
  id: string
  args?: string[]
}

interface SubprocessIO {
  in?: Readable
  err?: Writable
  out?: Writable
}

export class Subprocess {
  private path: string
  private args: string[]
  private process: ChildProcess
  private id: string

  private returnCode: number
  private returnSig: string

  private out: QueueBuffer
  private err: QueueBuffer
  private outputSize: number
  private runError?: Error

  private doneProcess: Waiter<any>

  constructor({ path, args, id }: SubprocessConstructor) {
    this.id = id
    this.path = path
    this.args = args ? args : []
    this.doneProcess = new Waiter()
  }

  public start(io: SubprocessIO) {
    Logger.info(`[Subprocess] Spawn process: ${this.id}`, { path: this.path, args: this.args })
    try {
      this.process = spawn(this.path, this.args)

      this.process.on('close', (ret: number, signal: string) => {
        Logger.info(`[Subprocess] Process closed: ${this.id}`, { ret, signal })
        if (ret !== 0 && !this.runError) this.runError = new NonZeroReturnCode(ret)
        this.doneProcess.resolve()
        this.returnCode = ret
        this.returnSig = signal
      })

      this.err = this.setupOutputBuffer(io.err, this.process.stderr)
      this.out = this.setupOutputBuffer(io.out, this.process.stdout)

      this.process.on('error', (err: any) =>
        Logger.error(`[Subprocess] Error event catch ${this.id}`, err)
      )

      if (io.in) {
        io.in
          .pipe(this.process.stdin)
          .on('error', (e: any) => Logger.error(`[Subprocess] Pipe error ${this.id}`, e))
      }
    } catch (err) {
      Logger.error(`[Subprocess] Error catch ${this.id}`, err)
      this.doneProcess.reject(err)
    }
  }

  public getErr() {
    return this.err.getString()
  }

  public getOut() {
    return this.out.getString()
  }

  public getExitCode() {
    return this.returnCode
  }

  public getExitSignal() {
    return this.returnSig
  }

  public finish() {
    return this.doneProcess.finish()
  }

  public getError() {
    return this.runError
  }

  public kill() {
    this.process.kill()
  }

  private setupOutputBuffer = (outputStream: Writable, stdStream: Readable) => {
    this.outputSize = 0
    const queueBuffer = new QueueBuffer(MAX_QUEUE_BUFFER_SIZE)
    if (outputStream) stdStream.pipe(outputStream)
    stdStream.on('data', (data: Buffer) => {
      const str = data.toString('utf-8')
      this.outputSize += str.length
      if (this.outputSize > MAX_OUTPUT_SIZE && this.runError == null) {
        this.runError = new MaxOutputSizeReached(MAX_OUTPUT_SIZE)
        this.process.emit('error', this.runError)
        if (outputStream) stdStream.unpipe(outputStream)
        this.kill()
      }
      queueBuffer.push(str)
    })

    return queueBuffer
  }
}
