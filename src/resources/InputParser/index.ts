import Busboy from 'busboy'
import { Request } from 'express'
import onFinished from 'on-finished'
import R from 'ramda'
import { Readable } from 'stream'
import {
  FieldnameSizeExceeded,
  FieldsLimitExceeded,
  FileSizeExceeded,
  ParsingErrors,
  TruncatedField,
  UnsupportedContentType,
} from '../../errors/RunRouteErrors'
import { TimedWaiter, Waiter } from '../../utils/CustomPromises'
import { Logger } from '../../utils/Logger'
import { StringStream } from '../StringStream'
import {
  BusboyLimits,
  FieldToPersist,
  FileInfo,
  ReadableWithTruncatedFlag,
} from './../../typings.d'
import { FileUploader } from './FileUploader'
import { HandlersManager } from './HandlersManager'

/* This class was written based on multer busboy error handling:
 *  https://github.com/expressjs/multer/blob/master/lib/make-middleware.js
 */

interface InputToParse {
  fieldname: string
  fileStream?: ReadableWithTruncatedFlag
  val?: string
  valTruncated?: boolean
  nameTruncated?: boolean
}

const SECOND = 1000
const DEFAULT_MAX_BUSBOY_FINISH_TIME = 120 * SECOND

const drainStream = (stream: Readable) => {
  stream.on('readable', stream.read.bind(stream))
}

export class InputParser {
  private busboyLimits: BusboyLimits
  private partsToPersist: FieldToPersist[]

  private req: Request
  private busboy: busboy.Busboy
  private fileUploader: FileUploader
  private handlersManager: HandlersManager

  private finishParsing: Waiter<FileInfo[]>
  private finishBusboy: TimedWaiter<void>

  private isDone: boolean
  private abortFlag: boolean
  private cleanFlag: boolean

  private errors: Error[]

  constructor(
    req: Request,
    { limits }: busboy.BusboyConfig,
    uploadPath: string,
    partsToPersist: FieldToPersist[],
    maxFinishTime?: number
  ) {
    this.req = req
    this.partsToPersist = partsToPersist

    this.busboyLimits = {
      fieldNameSize: 100,
      fieldSize: 1024,
      ...limits,
    }

    this.isDone = false
    this.abortFlag = false
    this.cleanFlag = false

    this.errors = []

    const maxTime = maxFinishTime ? maxFinishTime : DEFAULT_MAX_BUSBOY_FINISH_TIME
    this.finishBusboy = new TimedWaiter(maxTime)
    this.finishParsing = new Waiter()

    this.handlersManager = new HandlersManager(this.finishBusboy)
    this.fileUploader = new FileUploader(uploadPath, this.finishBusboy, this.busboyLimits.fileSize)

    try {
      this.busboy = new Busboy({
        headers: this.req.headers,
        limits: this.busboyLimits,
      })
    } catch (err) {
      Logger.error(`[InputParser] Busboy constructor error`, err)
      this.finishBusboy.reject(err)
      this.abortParsing(new UnsupportedContentType())
      return
    }
  }

  public parse(): Promise<FileInfo[]> {
    if (this.isDone) return
    this.setupBusboy()
    this.req.pipe(this.busboy)
    return this.finishParsing.finish()
  }

  public cleanup = async () => {
    if (this.cleanFlag) return
    this.cleanFlag = true
    try {
      await this.fileUploader.removeUploadedFiles()
    } catch (err) {
      Logger.error(`[InputParser] Error on cleanup`, err)
    }
  }

  private abortParsing = async (err: Error) => {
    Logger.error('[InputParser] Error registered\n', err)
    this.errors.push(err)
    if (this.abortFlag) return
    Logger.error('[InputParser] Aborting...\n', err)
    this.abortFlag = true

    await this.handlersManager.finishAllHandlers()
    this.done()
    this.cleanup()
  }

  private done() {
    if (this.isDone) return
    Logger.info('[InputParser] Done. Finalizing...')
    this.isDone = true

    this.req.unpipe(this.busboy)
    drainStream(this.req)
    this.busboy.removeAllListeners()

    onFinished(this.req, finishError => {
      if (this.errors.length > 0) return this.finishParsing.reject(new ParsingErrors(this.errors))
      if (finishError) return this.finishParsing.reject(finishError)
      Logger.info('[InputParser] Finished request receiving')
      return this.finishParsing.resolve(this.fileUploader.getUploadedFiles())
    })
  }

  private partialDone = () => {
    const handlersFinished = this.handlersManager.isFinished()
    const busboyFinished = this.finishBusboy.isDone()
    Logger.info(`[InputParser] PartialDone`, {
      busboyFinished,
      handlersFinished,
      abortFlag: this.abortFlag,
    })
    if (busboyFinished && handlersFinished && !this.abortFlag) this.done()
  }

  private setupBusboy = () => {
    const handleInput = async (input: InputToParse) => {
      const { fieldname, fileStream, val, valTruncated, nameTruncated } = input
      const { fileSize, fieldNameSize } = this.busboyLimits

      const fileToPersist = R.find(el => fieldname === el.fieldname, this.partsToPersist)
      if (this.abortFlag || fileToPersist == null) {
        return fileStream && fileStream.resume()
      }

      this.handlersManager.incrementPendingHandler()
      Logger.info('[InputParser] handler', {
        fieldname,
        ...(fileStream != null ? { fileStreamTruncated: fileStream.truncated } : {}),
        ...(valTruncated != null ? { valTruncated } : {}),
        ...(nameTruncated != null ? { nameTruncated } : {}),
      })

      try {
        if (fileStream && fileStream.truncated) throw new FileSizeExceeded(fileSize)
        if (nameTruncated) throw new TruncatedField()
        if (valTruncated) throw new TruncatedField(fieldname)
        if (fieldname.length > fieldNameSize) throw new FieldnameSizeExceeded(fieldNameSize)

        const stream = fileStream || new StringStream(val)
        const fileInfo = await this.fileUploader.uploadFile(fileToPersist.filename, stream)
        Logger.info('[InputParser][handler] File Uploaded', fileInfo)

        this.handlersManager.decrementPendingHandler()
        this.partialDone()
        Logger.info(`[InputParser][handler] ${fieldname} Done`)
      } catch (err) {
        if (fileStream) fileStream.resume()
        this.handlersManager.decrementPendingHandler()
        this.abortParsing(err)
        Logger.error(`[InputParser][handler] ${fieldname} Done with Error`)
      }
    }

    const fieldException = (type: string, cnt: number) => () =>
      this.abortParsing(new FieldsLimitExceeded(type, cnt))
    this.busboy.on('fieldsLimit', fieldException('field(s)', this.busboyLimits.fields))
    this.busboy.on('filesLimit', fieldException('file(s)', this.busboyLimits.files))
    this.busboy.on('partsLimit', fieldException('part(s)', this.busboyLimits.parts))

    this.busboy.on('finish', async () => {
      this.finishBusboy.resolve()
      await this.handlersManager.finishAllHandlers()
      this.partialDone()
    })

    this.busboy.on('file', (fieldname: string, fileStream: ReadableWithTruncatedFlag) =>
      handleInput({ fieldname, fileStream })
    )

    this.busboy.on('field', async (fieldname, val, nameTruncated, valTruncated) =>
      handleInput({ fieldname, val, nameTruncated, valTruncated })
    )
  }
}
