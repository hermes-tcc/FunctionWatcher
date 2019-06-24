import fs from 'fs'
import { Readable, Writable } from 'stream'
import { Waiter } from './CustomPromises'

interface FsStreamOptions {
  flags?: string
  encoding?: string
  fd?: number
  mode?: number
  autoClose?: boolean
  start?: number
}

export const createReadStreamPromise = (
  filePath: string,
  opts: FsStreamOptions
): Promise<Readable> => {
  const readyWaiter: Waiter<Readable> = new Waiter()
  const stream = fs.createReadStream(filePath, opts)
  stream.on('ready', () => readyWaiter.resolve(stream))
  stream.on('error', readyWaiter.reject)
  return readyWaiter.finish()
}

export const createWriteStreamPromise = (
  filePath: string,
  opts: FsStreamOptions
): Promise<Writable> => {
  const readyWaiter: Waiter<Writable> = new Waiter()
  const stream = fs.createWriteStream(filePath, opts)
  stream.on('ready', () => readyWaiter.resolve(stream))
  stream.on('error', readyWaiter.reject)
  return readyWaiter.finish()
}

export const fileExists = async (filepath: string) => {
  try {
    await fs.promises.access(filepath)
    return true
  } catch (err) {
    return false
  }
}
