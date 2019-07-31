import { setHandlerPath, setRunSpies } from './utils'
jest.resetModules()

import { Waiter } from '@hermes-serverless/custom-promises'
import { StringStream, WritableWithEnd } from '@hermes-serverless/stream-utils'
import { Subprocess } from '@hermes-serverless/subprocess'
import execa from 'execa'
import fs, { ReadStream, WriteStream } from 'fs'
import getStream from 'get-stream'
import moment from 'moment'
import os from 'os'
import path from 'path'
import { PassThrough } from 'stream'
import { MAX_OUTPUT_SIZE, MAX_QUEUE_BUFFER_SIZE } from '../../../limits'
import { IO, Run } from '../../../resources/Runner/Run'
import { Logger } from '../../../utils/Logger'

Logger.enabled = false

const tmpPath = path.join(os.tmpdir(), 'function-watcher-run-flow-tests')

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

let RunMock: typeof Run
let SubprocessMock: jest.Mock<Subprocess>
const run = jest.fn()
SubprocessMock = jest.fn().mockImplementation(() => {
  return {
    run,
  }
})

jest.doMock('@hermes-serverless/subprocess', () => {
  return { Subprocess: SubprocessMock }
})

RunMock = require('../../../resources/Runner/Run').Run

beforeEach(() => {
  if (!fs.existsSync(tmpPath)) fs.mkdirSync(tmpPath, { recursive: true })
  if (!fs.existsSync(path.join(tmpPath, 'in'))) fs.mkdirSync(path.join(tmpPath, 'in'), { recursive: true })
  if (!fs.existsSync(path.join(tmpPath, 'all'))) fs.mkdirSync(path.join(tmpPath, 'all'), { recursive: true })
})

afterEach(() => {
  execa.sync('rm', ['-rf', tmpPath])
})

describe('Tests with mocked Subprocess', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Subprocess constructor tests', () => {
    test('Subprocess is called correctly', () => {
      setHandlerPath('hello.sh')
      const r = new RunMock('1')
      expect(SubprocessMock).toBeCalledWith('hello.sh', {
        id: '1',
        maxBufferSize: MAX_QUEUE_BUFFER_SIZE,
        maxOutputSize: MAX_OUTPUT_SIZE,
        logger: Logger,
      })
    })

    test('Subprocess is called correctly', () => {
      setHandlerPath('test')
      const r = new RunMock('1', { maxBufferSize: 0, maxOutputSize: 0 })
      expect(SubprocessMock).toBeCalledWith('test', {
        id: '1',
        maxBufferSize: 0,
        maxOutputSize: 0,
        logger: Logger,
      })
    })

    test('Subprocess is called correctly', () => {
      setHandlerPath('test')
      const r = new RunMock('2', { maxBufferSize: 123, maxOutputSize: 234 })
      expect(SubprocessMock).toBeCalledWith('test', {
        id: '2',
        maxBufferSize: 123,
        maxOutputSize: 234,
        logger: Logger,
      })
    })
  })

  describe('start tests', () => {
    const commonChecks = (r: Run, spies: any, doneRes: string, io?: IO) => {
      expect(spies._run).toBeCalledTimes(1)
      expect(spies._run).toBeCalledWith(io)
      expect(spies._getStreams).toBeCalledTimes(1)
      expect(spies._getStreams).toBeCalledWith(io)
      // @ts-ignore
      expect(r.endTime).toBeInstanceOf(moment)
      // @ts-ignore
      expect(r.startTime).toBeInstanceOf(moment)
      // @ts-ignore
      expect(r.status).toBe(doneRes)
    }

    test('Sucess test', async () => {
      const done = new Waiter()
      const onDone = done.resolve
      run.mockResolvedValueOnce({})
      const r = new RunMock('2', { onDone })
      const spies = setRunSpies(r)
      r.start()
      await done.finish()
      expect(run).toBeCalled()
      expect(run.mock.calls[0][0].input).toBeInstanceOf(StringStream)
      expect(run.mock.calls[0][0].all.length).toBe(1)
      expect(run.mock.calls[0][0].all[0].stream).toBeInstanceOf(WriteStream)
      expect(run.mock.calls[0][0].all[0].end).toBe(true)
      // @ts-ignore
      expect(r.runError).toBeUndefined()
      commonChecks(r, spies, 'success')
    })

    test('start uses given IO', async () => {
      const io = { input: new PassThrough(), output: new PassThrough() }
      const done = new Waiter()
      const onDone = done.resolve
      run.mockResolvedValueOnce({})
      const r = new RunMock('2', { onDone })
      const spies = setRunSpies(r)
      r.start(io)
      await done.finish()

      expect(run).toBeCalled()
      expect(run.mock.calls[0][0].input).toBe(io.input)
      expect(run.mock.calls[0][0].all.length).toBe(2)
      expect(run.mock.calls[0][0].all[0].stream).toBeInstanceOf(WriteStream)
      expect(run.mock.calls[0][0].all[0].end).toBe(true)
      expect(run.mock.calls[0][0].all[1]).toBe(io.output)

      // @ts-ignore
      expect(r.runError).toBeUndefined()
      commonChecks(r, spies, 'success', io)
    })

    test('_getStreams error', async () => {
      const done = new Waiter()
      const onDone = done.resolve
      const r = new RunMock('2', { onDone })
      const err = new Error('TEST_ERROR')
      const spies = setRunSpies(r)
      spies._getStreams.mockRejectedValueOnce(err)
      r.start()
      await done.finish()

      // @ts-ignore
      expect(r.runError).toBe(err)
      expect(run).not.toBeCalled()
      commonChecks(r, spies, 'error')
    })

    test('Error on run', async () => {
      const done = new Waiter()
      const onDone = done.resolve
      const err = new Error('TEST_ERROR')
      run.mockRejectedValueOnce(err)

      const r = new RunMock('2', { onDone })
      const spies = setRunSpies(r)
      r.start()
      await done.finish()

      expect(run).toBeCalled()
      expect(run.mock.calls[0][0].input).toBeInstanceOf(StringStream)
      expect(run.mock.calls[0][0].all.length).toBe(1)
      expect(run.mock.calls[0][0].all[0].stream).toBeInstanceOf(WriteStream)
      expect(run.mock.calls[0][0].all[0].end).toBe(true)
      // @ts-ignore
      expect(r.runError).toBe(err)
      commonChecks(r, spies, 'error')
    })
  })

  describe('_getStreams test', () => {
    test('all error', async () => {
      const r = new RunMock('2')
      const err = new Error('TEST_ERROR')
      // @ts-ignore
      r.fileManager.createRunWriteStream = jest.fn().mockRejectedValue(err)
      await expect(r._getStreams()).rejects.toThrow(err)
    })

    test('input stream open error', async () => {
      createInputFile('asfd', '2')
      const r = new RunMock('2')
      const err = new Error('TEST_ERROR')
      // @ts-ignore
      r.fileManager.createRunWriteStream = jest.fn().mockResolvedValue(new PassThrough())
      // @ts-ignore
      r.fileManager.createRunReadStream = jest.fn().mockRejectedValue(err)
      await expect(r._getStreams()).rejects.toThrow(err)
    })

    test('Input doesnt exist and io is not given: Should be empty StringStream', async () => {
      const r = new RunMock('2')
      // @ts-ignore
      r.fileManager.createRunWriteStream = jest.fn().mockResolvedValue(new PassThrough())
      const s = await r._getStreams()
      expect(s.all.length).toBe(1)
      expect((s.all[0] as WritableWithEnd).stream).toBeInstanceOf(PassThrough)
      expect((s.all[0] as WritableWithEnd).end).toBe(true)
      expect(s.input).toBeInstanceOf(StringStream)
      // @ts-ignore
      expect(s.input.str).toBe('')
    })

    test('IO is given: All should be io.output and input shoulbe be io.input', async () => {
      createInputFile('asfd', '2')
      const r = new RunMock('2')
      const io = { input: new PassThrough(), output: new PassThrough() }
      // @ts-ignore
      r.fileManager.createRunWriteStream = jest.fn().mockResolvedValue(new PassThrough())
      const s = await r._getStreams(io)
      expect(s.all.length).toBe(2)
      expect((s.all[0] as WritableWithEnd).stream).toBeInstanceOf(PassThrough)
      expect((s.all[0] as WritableWithEnd).end).toBe(true)
      expect(s.all[1]).toBe(io.output)
      expect(s.input).toBe(io.input)
    })

    test('IO is given: All should be io.output and input shoulbe be io.input', async () => {
      const r = new RunMock('2')
      const io = { input: new PassThrough(), output: new PassThrough() }
      // @ts-ignore
      r.fileManager.createRunWriteStream = jest.fn().mockResolvedValue(new PassThrough())
      const s = await r._getStreams(io)
      expect(s.all.length).toBe(2)
      expect((s.all[0] as WritableWithEnd).stream).toBeInstanceOf(PassThrough)
      expect((s.all[0] as WritableWithEnd).end).toBe(true)
      expect(s.all[1]).toBe(io.output)
      expect(s.input).toBe(io.input)
    })

    test('IO is not given and input file exists', async () => {
      createInputFile('.'.repeat(1000), '2')
      const r = new RunMock('2')
      // @ts-ignore
      r.fileManager.createRunWriteStream = jest.fn().mockResolvedValue(new PassThrough())
      const s = await r._getStreams()
      expect(s.all.length).toBe(1)
      expect((s.all[0] as WritableWithEnd).stream).toBeInstanceOf(PassThrough)
      expect((s.all[0] as WritableWithEnd).end).toBe(true)
      expect(s.input).toBeInstanceOf(ReadStream)
      await expect(getStream(s.input)).resolves.toBe('.'.repeat(1000))
    })
  })

  describe('getStatus tests', () => {
    const runningTimeReg = /^[0-9]*[0-9][0-9]:[0-9][0-9]:[0-9][0-9]\.[0-9][0-9][0-9]$/

    test('Sucess', async () => {
      const done = new Waiter()
      const onDone = done.resolve
      const r = new RunMock('2', { onDone })
      r.start()
      await done.finish()
      const s = r.getStatus()
      expect(s.status).toBe('success')
      expect(s.runningTime).toEqual(expect.stringMatching(runningTimeReg))
      expect(s.startTime).toBeInstanceOf(moment)
      expect(s.endTime).toBeInstanceOf(moment)
      expect(s.error).toBeUndefined()
      expect(s.out).toBeUndefined()
      expect(s.err).toBeUndefined()
    })

    test('Error', async () => {
      const done = new Waiter()
      const onDone = done.resolve
      const err = new Error('TEST_ERROR')
      run.mockRejectedValueOnce(err)
      const r = new RunMock('2', { onDone })
      r.start()
      await done.finish()
      const s = r.getStatus()
      expect(s.status).toBe('error')
      expect(s.runningTime).toEqual(expect.stringMatching(runningTimeReg))
      expect(s.startTime).toBeInstanceOf(moment)
      expect(s.endTime).toBeInstanceOf(moment)
      expect(s.error).toBe('Error - TEST_ERROR')
      expect(s.out).toBeUndefined()
      expect(s.err).toBeUndefined()
    })

    test('Before start', async () => {
      const r = new RunMock('2')
      const s = r.getStatus()
      expect(s.status).toBe('not-started')
      expect(s.runningTime).toBeUndefined()
      expect(s.startTime).toBeUndefined()
      expect(s.endTime).toBeUndefined()
      expect(s.error).toBeUndefined()
      expect(s.out).toBeUndefined()
      expect(s.err).toBeUndefined()
    })

    test('Running', async done => {
      const waiter = new Waiter()
      run.mockReturnValueOnce(waiter.finish())
      const r = new RunMock('2')
      r.start()
      setTimeout(() => {
        const s = r.getStatus()
        expect(s.status).toBe('running')
        expect(s.runningTime).toEqual(expect.stringMatching(runningTimeReg))
        expect(s.startTime).toBeInstanceOf(moment)
        expect(s.endTime).toBeUndefined()
        expect(s.error).toBeUndefined()
        expect(s.out).toBeUndefined()
        expect(s.err).toBeUndefined()
        waiter.resolve()
        done()
      }, 1000)
    })

    test('Out and Err', async () => {
      const done = new Waiter()
      const onDone = done.resolve
      const r = new RunMock('2', { onDone })
      r.start()
      await done.finish()
      // @ts-ignore
      r.process.stdoutBuffer = '.'.repeat(1000)
      // @ts-ignore
      r.process.stderrBuffer = '+'.repeat(1000)

      const s = r.getStatus(['out', 'err'])
      expect(s.status).toBe('success')
      expect(s.runningTime).toEqual(expect.stringMatching(runningTimeReg))
      expect(s.startTime).toBeInstanceOf(moment)
      expect(s.endTime).toBeInstanceOf(moment)
      expect(s.error).toBeUndefined()
      expect(s.out).toBe('.'.repeat(1000))
      expect(s.err).toBe('+'.repeat(1000))
    })

    test('Out', async () => {
      const done = new Waiter()
      const onDone = done.resolve
      const r = new RunMock('2', { onDone })
      r.start()
      await done.finish()
      // @ts-ignore
      r.process.stdoutBuffer = '.'.repeat(1000)
      // @ts-ignore
      r.process.stderrBuffer = '+'.repeat(1000)

      const s = r.getStatus(['out'])
      expect(s.runningTime).toEqual(expect.stringMatching(runningTimeReg))
      expect(s.startTime).toBeInstanceOf(moment)
      expect(s.endTime).toBeInstanceOf(moment)
      expect(s.error).toBeUndefined()
      expect(s.err).toBeUndefined()
      expect(s.out).toBe('.'.repeat(1000))
    })
  })
})
