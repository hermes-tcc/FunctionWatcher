import { Readable, Writable } from 'stream'
import { Waiter } from './CustomPromises'
import { Logger } from './Logger'

export const pipeWithoutEnd = (src: Readable, dest: Writable) => {
  const finishSrc = new Waiter()
  const finishPipe = new Waiter()
  let isDrained = true

  const onData = (chunk: Buffer | string) => {
    const ret = dest.write(chunk)
    if (!ret) {
      isDrained = false
      src.pause()
    }
  }

  const onDrain = () => {
    isDrained = true
    if (finishSrc.isDone()) {
      cleanup()
      finishPipe.resolve()
    }
    src.resume()
  }

  let isCleaned = false
  const cleanup = () => {
    if (isCleaned) return
    dest.removeListener('drain', onDrain)
    dest.removeListener('error', onError)
    src.removeListener('close', onSrcClose)
    src.removeListener('error', onError)
    src.removeListener('end', onSrcEnd)
    src.removeListener('data', onData)
    isCleaned = true
  }

  const closingSrc = () => {
    finishSrc.resolve()
    if (isDrained) {
      cleanup()
      finishPipe.resolve()
    }
    Logger.info('[pipeWithoutEnd] Closed src')
  }

  const onSrcEnd = closingSrc
  const onSrcClose = closingSrc

  const onError = (err: any) => {
    Logger.error(`[pipeWithoutEnd] Error`, err)
    cleanup()
    finishSrc.reject(err)
    finishPipe.reject(err)
  }

  const setup = () => {
    dest.on('drain', onDrain)
    dest.on('error', onError)
    src.on('close', onSrcClose)
    src.on('error', onError)
    src.on('end', onSrcEnd)
    src.on('data', onData)
  }

  setup()
  return finishPipe.finish()
}

export const endPipe = (stream: Writable) => {
  stream.end()
}
