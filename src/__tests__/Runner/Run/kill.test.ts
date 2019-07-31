import { StringStream } from '@hermes-serverless/stream-utils'
import execa from 'execa'
import fs from 'fs'
import getStream from 'get-stream'
import os from 'os'
import path from 'path'
import { PassThrough } from 'stream'
import { Logger } from '../../../utils/Logger'
import { checkError, checkResults, checkSuccess, cleanupAndCheck, prepareRun } from './utils'

Logger.enabled = false
process.env.PATH = path.join(__dirname, '..', '..', 'fixtures') + path.delimiter + process.env.PATH
const tmpPath = path.join(os.tmpdir(), 'function-watcher-run-kill-tests')

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

describe('Check if Run finishes on kill', () => {
  test('forever', async () => {
    const { r, waiter, onDone, onError, onSuccess } = prepareRun('forever')
    setTimeout(r.kill, 1000)
    await waiter.finish()
    checkError(r, onError, onSuccess, onDone)
    await checkResults({ r, errorMsg: 'Error - Command was killed with SIGTERM: forever' })
    await cleanupAndCheck(r, tmpPath)
  })

  test('sleeper.py', async () => {
    const io = { input: new StringStream('5'), output: new PassThrough() }
    const { r, waiter, onDone, onError, onSuccess } = prepareRun('sleeper.py', { io })
    setTimeout(r.kill, 2000)
    await waiter.finish()
    checkError(r, onError, onSuccess, onDone)
    const output = 'Sleep 5 seconds\n'
    await checkResults({ r, output, errorMsg: 'Error - Command was killed with SIGTERM: sleeper.py', stdout: output })
    await expect(getStream(io.output)).resolves.toBe(output)
    await cleanupAndCheck(r, tmpPath)
  })

  test('sigterm-catcher-exit-error.py', async () => {
    const io = { input: new StringStream('5'), output: new PassThrough() }
    const { r, waiter, onDone, onError, onSuccess } = prepareRun('sigterm-catcher-exit-error.py', { io })
    setTimeout(r.kill, 2000)
    await waiter.finish()
    checkError(r, onError, onSuccess, onDone)
    const output = 'Sleep 30 seconds\n15 RECEIVED\n'
    const errorMsg = 'Error - Command failed with exit code 1 (EPERM): sigterm-catcher-exit-error.py'
    await checkResults({ r, output, errorMsg, stdout: output })
    await expect(getStream(io.output)).resolves.toBe(output)
    await cleanupAndCheck(r, tmpPath)
  })

  test('sigterm-catcher-exit-success.py', async () => {
    const { r, waiter, onDone, onError, onSuccess } = prepareRun('sigterm-catcher-exit-success.py')
    setTimeout(r.kill, 2000)
    await waiter.finish()
    const output = 'Sleep 30 seconds\n15 RECEIVED\n'
    checkSuccess(r, onError, onSuccess, onDone)
    await checkResults({ r, output, stdout: output })
    await cleanupAndCheck(r, tmpPath)
  })

  test('no-killable', async () => {
    const { r, waiter, onDone, onError, onSuccess } = prepareRun('no-killable')
    setTimeout(r.kill, 1000)
    await waiter.finish()
    checkError(r, onError, onSuccess, onDone)
    const output = 'Received SIGTERM, but we ignore it\n'
    const errorMsg = 'Error - Command was killed with SIGKILL: no-killable'
    await checkResults({ r, output, errorMsg, stdout: output })
    await cleanupAndCheck(r, tmpPath)
  }, 7000)

  test('mixed-output-sleep.py', async () => {
    const io = { input: new StringStream('1000 2000 5000'), output: new PassThrough() }
    const { r, waiter, onDone, onError, onSuccess } = prepareRun('mixed-output-sleep.py', { io })
    setTimeout(r.kill, 2000)
    await waiter.finish()
    expect((await getStream(await r.outputStream)).length).toBe(9000)
    expect((await getStream(await io.output)).length).toBe(9000)
    checkError(r, onError, onSuccess, onDone)
    const s = r.getStatus(['out', 'err'])
    expect(s.error).toBe('Error - Command was killed with SIGTERM: mixed-output-sleep.py')
    expect(s.out).toBe('.'.repeat(1000) + '+'.repeat(2000))
    expect(s.err).toBe('.'.repeat(1000) + '+'.repeat(5000))
    await cleanupAndCheck(r, tmpPath)
  }, 7000)
})
