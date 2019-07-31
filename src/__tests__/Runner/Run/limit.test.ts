import { StringStream } from '@hermes-serverless/stream-utils'
import execa from 'execa'
import fs from 'fs'
import getStream from 'get-stream'
import os from 'os'
import path from 'path'
import { PassThrough } from 'stream'
import { MAX_QUEUE_BUFFER_SIZE } from '../../../limits'
import { Logger } from '../../../utils/Logger'
import { checkError, cleanupAndCheck, prepareRun } from './utils'

Logger.enabled = false
process.env.PATH = path.join(__dirname, '..', '..', 'fixtures') + path.delimiter + process.env.PATH
const tmpPath = path.join(os.tmpdir(), 'function-watcher-run-limit-tests')

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

describe('Check if Run finishes on limit', () => {
  test('Limit 100KB - stdout', async () => {
    const maxOutputSize = 100 * 1000
    const io = { input: new StringStream('stdout 1000000'), output: new PassThrough() }
    const allOutPromise = getStream(io.output)
    const { r, waiter, onDone, onError, onSuccess } = prepareRun('max-buffer', { io, maxOutputSize })
    await waiter.finish()
    expect((await allOutPromise).length).toBeGreaterThanOrEqual(maxOutputSize)
    expect((await getStream(await r.outputStream)).length).toBeGreaterThanOrEqual(maxOutputSize)
    checkError(r, onError, onSuccess, onDone)
    const s = r.getStatus(['out', 'err'])
    expect(s.out).toBe('.'.repeat(MAX_QUEUE_BUFFER_SIZE))
    expect(s.err).toBe('')
    expect(s.error).toBe(`MaxOutputSizeReached - Max output size reached: ${maxOutputSize}`)
    await cleanupAndCheck(r, tmpPath)
  })

  test('Limit 100KB - stderr', async () => {
    const maxOutputSize = 100 * 1000
    const io = { input: new StringStream('stderr 1000000'), output: new PassThrough() }
    const allOutPromise = getStream(io.output)
    const { r, waiter, onDone, onError, onSuccess } = prepareRun('max-buffer', { io, maxOutputSize })
    await waiter.finish()
    expect((await allOutPromise).length).toBeGreaterThanOrEqual(maxOutputSize)
    expect((await getStream(await r.outputStream)).length).toBeGreaterThanOrEqual(maxOutputSize)
    checkError(r, onError, onSuccess, onDone)
    const s = r.getStatus(['out', 'err'])
    expect(s.out).toBe('')
    expect(s.err).toBe('.'.repeat(MAX_QUEUE_BUFFER_SIZE))
    expect(s.error).toBe(`MaxOutputSizeReached - Max output size reached: ${maxOutputSize}`)
    await cleanupAndCheck(r, tmpPath)
  })
})
