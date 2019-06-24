import fs from 'fs'
import path from 'path'
import { Readable, Writable } from 'stream'
import { InvalidHandler } from './../errors/RunnerErrors'
import { StringStream } from './../resources/StringStream'
import { createReadStreamPromise, createWriteStreamPromise, fileExists } from './fileSystem'
import { Logger } from './Logger'
import { endPipe, pipeWithoutEnd } from './pipe'

type IOFile = 'in' | 'out' | 'err' | 'rep'

const inBasePath = path.resolve('/', 'app', 'io', 'in')
const ioPaths = {
  in: (runId: string) => path.resolve(inBasePath, runId),
  out: (runId: string) => path.resolve('/', 'app', 'io', 'out', runId),
  err: (runId: string) => path.resolve('/', 'app', 'io', 'err', runId),
  rep: (runId: string) => path.resolve('/', 'app', 'io', 'rep', runId),
}

export const getInBasePath = () => inBasePath

export const getIOPath = (runId: string, file: IOFile) => {
  return ioPaths[file](runId)
}

export const createRunnerWriteStream = (runId: string, fileType: IOFile): Promise<Writable> => {
  return createWriteStreamPromise(ioPaths[fileType](runId), {
    encoding: 'utf-8',
    flags: 'wx',
  })
}

export const createRunnerReadStream = (runId: string, fileType: IOFile): Promise<Readable> => {
  return createReadStreamPromise(ioPaths[fileType](runId), {
    encoding: 'utf-8',
  })
}

export const deleteFiles = (runId: string) => {
  const arr = [
    fs.promises.unlink(getIOPath(runId, 'in')),
    fs.promises.unlink(getIOPath(runId, 'out')),
    fs.promises.unlink(getIOPath(runId, 'err')),
    fs.promises.unlink(getIOPath(runId, 'rep')),
  ]

  return Promise.all(arr)
}

export const getFunctionPath = () => {
  const functionPath = path.join('/', 'app', 'function')
  const hermesConf = JSON.parse(
    fs.readFileSync(path.join(functionPath, 'hermes.config.json'), { encoding: 'utf-8' })
  )
  return path.join(functionPath, hermesConf.handler)
}

export const prepareHandler = async () => {
  const handlerPath = getFunctionPath()
  const handlerExist = await fileExists(handlerPath)
  if (!handlerExist) throw new InvalidHandler(`Handler doesn't exist.`)
  const stats = fs.statSync(handlerPath)
  if (!stats.isFile()) throw new InvalidHandler(`Handler should be a file.`)
  fs.chmodSync(handlerPath, 755)
}

export interface KeyAndStreamValue {
  key: string
  val: Readable
}

export const createReportFile = async (arr: KeyAndStreamValue[], runId: string) => {
  const dest = await createRunnerWriteStream(runId, 'rep')
  for (let i = 0; i < arr.length; i += 1) {
    await pipeWithoutEnd(new StringStream(`\n=======${runId}=======\n${arr[i].key}:\n`), dest)
    await pipeWithoutEnd(arr[i].val, dest)
    Logger.info(`[Runner] Report ${arr[i].key} done`)
  }

  endPipe(dest)
}
