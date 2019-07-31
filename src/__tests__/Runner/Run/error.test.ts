import execa from 'execa'
import fs from 'fs'
import getStream from 'get-stream'
import os from 'os'
import path from 'path'
import { Logger } from '../../../utils/Logger'
import { checkResults, prepareRun } from './utils'

Logger.enabled = false
process.env.PATH = path.join(__dirname, '..', '..', 'fixtures') + path.delimiter + process.env.PATH
const tmpPath = path.join(os.tmpdir(), 'function-watcher-run-error-tests')

jest.mock('../../../resources/Runner/Paths', () => {
  return {
    ioPaths: {
      in: (runID: string) => path.join(tmpPath, 'in', runID),
      all: (runID: string) => path.join(tmpPath, 'all', runID),
    },
  }
})

beforeEach(() => {
  if (!fs.existsSync(tmpPath)) fs.mkdirSync(tmpPath, { recursive: true })
  if (!fs.existsSync(path.join(tmpPath, 'in'))) fs.mkdirSync(path.join(tmpPath, 'in'), { recursive: true })
  if (!fs.existsSync(path.join(tmpPath, 'all'))) fs.mkdirSync(path.join(tmpPath, 'all'), { recursive: true })
})

afterEach(() => {
  execa.sync('rm', ['-rf', tmpPath])
})

const checkError = (onError: any, onSuccess: any, onDone: any, runID: string) => {
  expect(onSuccess).not.toBeCalled()
  expect(onError).toBeCalledTimes(1)
  expect(onDone).toBeCalledTimes(1)
  expect(onDone).toBeCalledWith(runID)
}

const cleanupAndCheck = async (r: any) => {
  expect(fs.readdirSync(path.join(tmpPath, 'all')).length).toBe(1)
  await expect(r.cleanup()).resolves.toBeUndefined()
  expect(fs.readdirSync(path.join(tmpPath, 'in')).length).toBe(0)
  expect(fs.readdirSync(path.join(tmpPath, 'all')).length).toBe(0)
}

describe('Check if Run finishes even with error', () => {
  test('fail', async () => {
    const { r, waiter, onDone, onError, onSuccess } = prepareRun('fail')
    await waiter.finish()
    await expect(getStream(await r.outputStream)).resolves.toBe('')
    checkError(onError, onSuccess, onDone, r.runID)
    const errorMsg = 'Error - Command failed with exit code 2 (ENOENT): fail'
    await checkResults({ r, errorMsg })
    await cleanupAndCheck(r)
  })

  test('fail-message', async () => {
    const { r, waiter, onDone, onError, onSuccess } = prepareRun('fail-message')
    await waiter.finish()
    await expect(getStream(await r.outputStream)).resolves.toBe('fail\n')
    checkError(onError, onSuccess, onDone, r.runID)
    const output = 'fail\n'
    const errorMsg = 'Error - Command failed with exit code 2 (ENOENT): fail-message'
    await checkResults({ r, errorMsg, output, stdout: output })
    await cleanupAndCheck(r)
  })
})
