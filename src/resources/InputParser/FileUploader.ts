import fs from 'fs'
import path from 'path'
import { FileSizeExceeded, RunIDAlreadyExists } from '../../errors/RunRouteErrors'
import { Waiter } from '../../utils/CustomPromises'
import { Logger } from '../../utils/Logger'
import { FileInfo, ReadableWithTruncatedFlag } from './../../typings.d'
import { fileExists } from './../../utils/fileSystem'
import { Counter } from './Counter'

class DeleteErrors extends Error {
  constructor(errors: Error[]) {
    const msg = errors.reduce((acum: string, el: Error) => {
      return `${acum}\n${el.name}: ${el.message}`
    }, '')

    super(msg)
  }
}

export class FileUploader {
  private basePath: string
  private pendingFiles: Counter
  private uploadedFiles: string[]
  private uploadedFilesInfo: FileInfo[]
  private doneUploading: Waiter<any>
  private fileSizeLimit: number

  constructor(basePath: string, doneEmitting: Waiter<void>, fileSizeLimit: number) {
    this.basePath = basePath
    this.pendingFiles = new Counter()
    this.uploadedFiles = []
    this.uploadedFilesInfo = []
    this.fileSizeLimit = fileSizeLimit
    this.doneUploading = new Waiter()
    doneEmitting.then(() => {
      this.pendingFiles.onceZero(this.doneUploading.resolve)
    })
  }

  public getUploadedFiles = (): FileInfo[] => {
    return this.uploadedFilesInfo
  }

  public uploadFile = async (
    filename: string,
    input: ReadableWithTruncatedFlag
  ): Promise<FileInfo> => {
    const filePath = path.join(this.basePath, filename)
    const fileExistsFlag = await fileExists(filePath)
    if (fileExistsFlag) throw new RunIDAlreadyExists(filename)

    this.pendingFiles.increment()
    this.uploadedFiles.push(filePath)
    try {
      const fileSize = await this.pipeToFile(filePath, input)
      this.pendingFiles.decrement()
      const fileInfo = {
        filename,
        path: filePath,
        size: fileSize,
      }
      this.uploadedFilesInfo.push(fileInfo)
      return fileInfo
    } catch (err) {
      this.pendingFiles.decrement()
      throw err
    }
  }

  public removeUploadedFiles = async (): Promise<string[]> => {
    Logger.info('[FileUploader] Try to delete uploaded files', this.uploadedFiles)
    await this.doneUploading
    const errors: Error[] = []
    for (let i = 0; i < this.uploadedFiles.length; i += 1) {
      try {
        await fs.promises.unlink(this.uploadedFiles[i])
      } catch (err) {
        errors.push(err)
      }
    }
    if (errors.length > 0) throw new DeleteErrors(errors)
    Logger.info('[FileUploader]', { deletedFiles: this.uploadedFiles })
    return this.uploadedFiles
  }

  public finishUploadings = (): Waiter<any> => {
    return this.doneUploading
  }

  public isDoneUploading = () => {
    return this.doneUploading.isDone()
  }

  private pipeToFile = (filePath: string, input: ReadableWithTruncatedFlag): Promise<number> => {
    if (input.truncated) throw new FileSizeExceeded(this.fileSizeLimit)
    const file = fs.createWriteStream(filePath, { encoding: 'utf-8', flags: 'wx' })
    const finishPipe: Waiter<number> = new Waiter()
    input.on('limit', () => {
      input.unpipe(file)
      finishPipe.reject(new FileSizeExceeded(this.fileSizeLimit))
    })

    file.on('ready', () => {
      input.pipe(file)
    })

    file.on('error', (err: any) => {
      input.unpipe(file)
      finishPipe.reject(err)
    })

    file.on('finish', async () => {
      const size = fs.statSync(filePath).size
      finishPipe.resolve(size)
    })

    return finishPipe.finish()
  }
}
