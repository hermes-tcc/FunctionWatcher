import { Waiter } from '@hermes-serverless/custom-promises'
import { randomBytes } from 'crypto'
import fs from 'fs'
import getStream from 'get-stream'
import path from 'path'
import { IO, Run } from '../../../resources/Runner/Run'

let handlerPath: string
jest.mock('../../../utils/functionHandler', () => {
  return {
    getHandlerPath: () => handlerPath,
  }
})

export const setHandlerPath = (file: string) => {
  handlerPath = file
}

export const setRunSpies = (runObj: Run) => {
  return {
    start: jest.spyOn(runObj, 'start'),
    getStatus: jest.spyOn(runObj, 'getStatus'),
    kill: jest.spyOn(runObj, 'kill'),
    cleanup: jest.spyOn(runObj, 'cleanup'),
    _getStreams: jest.spyOn(runObj, '_getStreams'),
    _run: jest.spyOn(runObj, '_run'),
  }
}

interface PrepareRunOpts {
  io?: IO
  runID?: string
  maxOutputSize?: number
}

export const prepareRun = (file: string, options?: PrepareRunOpts) => {
  const opts = options || {}
  const id = opts.runID || randomBytes(8).toString('hex')
  const waiter = new Waiter()
  const onDone = jest.fn(waiter.resolve)
  const onError = jest.fn()
  const onSuccess = jest.fn()
  handlerPath = file
  const r = new Run(id, { onDone, onError, onSuccess, maxOutputSize: opts.maxOutputSize })
  const spies = setRunSpies(r)
  r.start(opts.io)
  return { onDone, onError, onSuccess, r, waiter, spies }
}

export const cleanupAndCheck = async (r: any, tmpPath: string) => {
  expect(fs.readdirSync(path.join(tmpPath, 'all')).length).toBe(1)
  await expect(r.cleanup()).resolves.toBeUndefined()
  expect(fs.readdirSync(path.join(tmpPath, 'in')).length).toBe(0)
  expect(fs.readdirSync(path.join(tmpPath, 'all')).length).toBe(0)
}

export const checkError = (r: any, onError: any, onSuccess: any, onDone: any) => {
  const s = r.getStatus()
  expect(s.status).toBe('error')
  expect(onSuccess).not.toBeCalled()
  expect(onError).toBeCalledTimes(1)
  expect(onDone).toBeCalledTimes(1)
  expect(onDone).toBeCalledWith(r.runID)
}

export const checkSuccess = (r: any, onError: any, onSuccess: any, onDone: any) => {
  const s = r.getStatus()
  expect(s.status).toBe('success')
  expect(onError).not.toBeCalled()
  expect(onSuccess).toBeCalledTimes(1)
  expect(onDone).toBeCalledTimes(1)
  expect(onDone).toBeCalledWith(r.runID)
}

export const checkResults = async ({ r, errorMsg, stdout = '', stderr = '', output = '' }: any) => {
  await expect(getStream(await r.outputStream)).resolves.toBe(output)
  const s = r.getStatus(['out', 'err'])
  expect(s.error).toBe(errorMsg)
  expect(s.out).toBe(stdout)
  expect(s.err).toBe(stderr)
}
