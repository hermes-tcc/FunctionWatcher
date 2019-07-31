import execa from 'execa'
import fs from 'fs'
import getStream from 'get-stream'
import os from 'os'
import path from 'path'
import { PassThrough } from 'stream'
import { Logger } from '../../../utils/Logger'
import { checkResults, checkSuccess, cleanupAndCheck, prepareRun } from './utils'

Logger.enabled = false
process.env.PATH = path.join(__dirname, '..', '..', 'fixtures') + path.delimiter + process.env.PATH
const tmpPath = path.join(os.tmpdir(), 'function-watcher-run-success-tests')

const createInputFile = (str: string, runID: string) => {
  fs.writeFileSync(path.join(tmpPath, 'in', runID), str, { encoding: 'utf-8' })
}

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

describe('Check if Run finishes successfully', () => {
  test('hello.sh', async () => {
    const { r, waiter, onDone, onError, onSuccess } = prepareRun('hello.sh')
    await waiter.finish()
    checkSuccess(r, onError, onSuccess, onDone)
    const output = 'Hello World\n'
    await checkResults({ r, output, stdout: output })
    await cleanupAndCheck(r, tmpPath)
  })

  test('command with space', async () => {
    const { r, waiter, onDone, onError, onSuccess } = prepareRun('command with space')
    await waiter.finish()
    checkSuccess(r, onError, onSuccess, onDone)
    const output = 'Hello World\n'
    await checkResults({ r, output, stdout: output })
    await cleanupAndCheck(r, tmpPath)
  })

  test('stdin->stdout - using io', async () => {
    const io = { input: new PassThrough(), output: new PassThrough() }
    const { r, waiter, onDone, onError, onSuccess } = prepareRun('stdin->stdout', { io })
    setTimeout(() => io.input.write('.'.repeat(1000)), 500)
    setTimeout(() => io.input.end('+'.repeat(1000)), 1000)
    await waiter.finish()
    await expect(getStream(await io.output)).resolves.toBe('.'.repeat(1000) + '+'.repeat(1000))
    checkSuccess(r, onError, onSuccess, onDone)
    const output = '.'.repeat(1000) + '+'.repeat(1000)
    await checkResults({ r, output, stdout: output })
    await cleanupAndCheck(r, tmpPath)
  })

  test('stdin->stdout - using input file', async () => {
    const runID = '123'
    createInputFile('.'.repeat(5000), runID)
    const { r, waiter, onDone, onError, onSuccess } = prepareRun('stdin->stdout', { runID })
    await waiter.finish()
    const output = '.'.repeat(5000)
    await checkResults({ r, output, stdout: output })
    checkSuccess(r, onError, onSuccess, onDone)
    await cleanupAndCheck(r, tmpPath)
  })

  test('stdin->stderr - using io', async () => {
    const io = { input: new PassThrough(), output: new PassThrough() }
    const { r, waiter, onDone, onError, onSuccess } = prepareRun('stdin->stderr', { io })
    setTimeout(() => io.input.write('.'.repeat(1000)), 500)
    setTimeout(() => io.input.end('+'.repeat(1000)), 1000)
    await waiter.finish()
    await expect(getStream(await io.output)).resolves.toBe('.'.repeat(1000) + '+'.repeat(1000))
    checkSuccess(r, onError, onSuccess, onDone)
    const output = '.'.repeat(1000) + '+'.repeat(1000)
    await checkResults({ r, output, stderr: output })
    await cleanupAndCheck(r, tmpPath)
  })

  test('sleeper.py - using io', async () => {
    const io = { input: new PassThrough(), output: new PassThrough() }
    const { r, waiter, onDone, onError, onSuccess } = prepareRun('sleeper.py', { io })
    expect.assertions(16)
    setTimeout(() => io.input.end('2'), 1000)
    setTimeout(() => {
      const s = r.getStatus(['out', 'err'])
      expect(s.out).toBe('Sleep 2 seconds\n')
      expect(s.err).toBe('')
    }, 2000)
    await waiter.finish()
    await expect(getStream(await io.output)).resolves.toBe('Sleep 2 seconds\nDone sleeping\n')
    checkSuccess(r, onError, onSuccess, onDone)
    const output = 'Sleep 2 seconds\nDone sleeping\n'
    await checkResults({ r, output, stdout: output })
    await cleanupAndCheck(r, tmpPath)
  })

  test('mixed-output.py - using io', async () => {
    const io = { input: new PassThrough(), output: new PassThrough() }
    const { r, waiter, onDone, onError, onSuccess } = prepareRun('mixed-output.py', { io })
    io.input.end('1000 2000 3000')
    await waiter.finish()
    expect((await getStream(await r.outputStream)).length).toBe(7000)
    expect((await getStream(await io.output)).length).toBe(7000)
    checkSuccess(r, onError, onSuccess, onDone)
    const s = r.getStatus(['out', 'err'])
    expect(s.out).toBe('.'.repeat(1000) + '+'.repeat(2000))
    expect(s.err).toBe('.'.repeat(1000) + '+'.repeat(3000))
    await cleanupAndCheck(r, tmpPath)
  })

  test('stdin->stdout - using io, without emit end', async done => {
    const runID = '123'
    const io = { input: new PassThrough(), output: { stream: new PassThrough(), end: false } }
    io.input.end('.'.repeat(5000))
    const errcb = jest.fn()
    io.output.stream.on('error', errcb)
    const { r, waiter, onDone, onError, onSuccess } = prepareRun('stdin->stdout', { runID, io })
    await waiter.finish()
    io.output.stream.end('finish-output')
    checkSuccess(r, onError, onSuccess, onDone)
    const output = '.'.repeat(5000)
    await checkResults({ r, output, stdout: output })
    expect(await getStream(io.output.stream)).toBe(output + 'finish-output')
    await cleanupAndCheck(r, tmpPath)
    setTimeout(async () => {
      expect(errcb).not.toBeCalled()
      done()
    }, 1000)
  })

  test('stdin->stdout - using io, emit end', async done => {
    const runID = '123'
    const io = { input: new PassThrough(), output: { stream: new PassThrough(), end: true } }
    io.input.end('.'.repeat(5000))
    const errcb = jest.fn()
    io.output.stream.on('error', errcb)
    const { r, waiter, onDone, onError, onSuccess } = prepareRun('stdin->stdout', { runID, io })
    await waiter.finish()
    io.output.stream.end('finish-output')
    checkSuccess(r, onError, onSuccess, onDone)
    const output = '.'.repeat(5000)
    await checkResults({ r, output, stdout: output })
    expect(await getStream(io.output.stream)).toBe(output)
    await cleanupAndCheck(r, tmpPath)
    setTimeout(async () => {
      expect(errcb).toBeCalled()
      done()
    }, 1000)
  })

  test('multi-query.py', async () => {
    const io = { input: new PassThrough(), output: new PassThrough() }
    let cycles = 5
    io.input.write('s\n')
    io.output.on('data', c => {
      if (cycles > 0) expect(c.toString()).toBe('Continue\n')
      else if (cycles === 0) expect(c.toString()).toBe('Done\n')
      else expect(true).toBe(false)
      if (cycles > 1) setTimeout(() => io.input.write('s\n'), 400)
      else if (cycles === 1) setTimeout(() => io.input.end('n\n'), 400)
      cycles -= 1
    })

    const { r, waiter, onDone, onError, onSuccess } = prepareRun('multi-query.py', { io })
    await waiter.finish()
    checkSuccess(r, onError, onSuccess, onDone)
    await cleanupAndCheck(r, tmpPath)
  })
})
