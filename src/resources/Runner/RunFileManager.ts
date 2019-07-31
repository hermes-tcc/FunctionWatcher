import { createFsReadStream, createFsWriteStream, fileExists } from '@hermes-serverless/fs-utils'
import fs, { ReadStream, WriteStream } from 'fs'
import { Readable } from 'stream'
import { Logger } from '../../utils/Logger'
import { IOFile, ioPaths } from './Paths'

export interface KeyAndStreamValue {
  key: string
  val: Readable
}

export default class RunFileManager {
  private id: string

  constructor(runID: string) {
    this.id = runID
  }

  public getIOPath = (file: IOFile) => {
    return ioPaths[file](this.id)
  }

  public createRunWriteStream = (fileType: IOFile): Promise<WriteStream> => {
    return createFsWriteStream(this.getIOPath(fileType), {
      encoding: 'utf-8',
      flags: 'wx',
    })
  }

  public createRunReadStream = (fileType: IOFile): Promise<ReadStream> => {
    return createFsReadStream(this.getIOPath(fileType), {
      encoding: 'utf-8',
    })
  }

  public deleteFiles = () => {
    const del: IOFile[] = ['in', 'all']
    return Promise.all(
      del.map(async fileType => {
        if (await fileExists(this.getIOPath(fileType))) {
          return fs.promises.unlink(this.getIOPath(fileType)).catch(err => {
            Logger.error(this.addName(`Error deleting ${fileType}`), err)
          })
        }
        return Promise.resolve()
      })
    )
  }

  private addName = (msg: string) => {
    return `[RunFileManager ${this.id}] ${msg}`
  }
}
