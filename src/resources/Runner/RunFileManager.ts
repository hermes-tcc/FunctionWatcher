import fs from 'fs'
import path from 'path'
import { Readable, Writable } from 'stream'
import { Logger } from '../../utils/Logger'
import { endPipe, pipeWithoutEnd } from '../../utils/pipe'
import { StringStream } from '../StringStream'
import { createReadStreamPromise, createWriteStreamPromise } from './../../utils/fileSystem'

type IOFile = 'in' | 'out' | 'err' | 'rep'

const inBasePath = path.resolve('/', 'app', 'io', 'in')
export const getInBasePath = () => inBasePath

const ioPaths = {
  in: (runID: string) => path.resolve(inBasePath, runID),
  out: (runID: string) => path.resolve('/', 'app', 'io', 'out', runID),
  err: (runID: string) => path.resolve('/', 'app', 'io', 'err', runID),
  rep: (runID: string) => path.resolve('/', 'app', 'io', 'rep', runID),
}

export interface KeyAndStreamValue {
  key: string
  val: Readable
}

export class RunFileManager {
  private id: string

  constructor(runID: string) {
    this.id = runID
  }

  public getIOPath = (file: IOFile) => {
    return ioPaths[file](this.id)
  }

  public createRunWriteStream = (fileType: IOFile): Promise<Writable> => {
    return createWriteStreamPromise(ioPaths[fileType](this.id), {
      encoding: 'utf-8',
      flags: 'wx',
    })
  }

  public createRunReadStream = (fileType: IOFile): Promise<Readable> => {
    return createReadStreamPromise(ioPaths[fileType](this.id), {
      encoding: 'utf-8',
    })
  }

  public deleteFiles = () => {
    const arr = [
      fs.promises.unlink(this.getIOPath('in')),
      fs.promises.unlink(this.getIOPath('out')),
      fs.promises.unlink(this.getIOPath('err')),
      fs.promises.unlink(this.getIOPath('rep')),
    ]

    return Promise.all(arr)
  }

  public createReportFile = async (arr: KeyAndStreamValue[]) => {
    const dest = await this.createRunWriteStream('rep')
    for (let i = 0; i < arr.length; i += 1) {
      await pipeWithoutEnd(new StringStream(`\n=======${this.id}=======\n${arr[i].key}:\n`), dest)
      await pipeWithoutEnd(arr[i].val, dest)
      Logger.info(`[Runner] Report ${arr[i].key} done`)
    }

    endPipe(dest)
  }
}
