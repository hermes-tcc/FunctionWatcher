import execa from 'execa'
import fs from 'fs'
import { Server } from 'http'
import os from 'os'
import path from 'path'
import { Runner } from '../../resources/Runner'
import { serverProto } from '../../serverProto'
import { Logger } from '../../utils/Logger'
import { checkRunError, checkSuccess } from './syncRunTestUtils'
import {
  requestDelete,
  requestKill,
  requestResultInfo,
  requestResultOutput,
  requestStatus,
  setup,
  sleep,
  wrongSetup,
} from './utils'

Logger.enabled = false
const tmpPath = path.join(os.tmpdir(), 'function-watcher-sync-run-tests')
process.env.PATH = path.join(__dirname, '..', 'fixtures') + path.delimiter + process.env.PATH
let handlerPath: string

const setHandler = (fixtureProgram: string) => {
  handlerPath = fixtureProgram
}
jest.mock('../../utils/functionHandler', () => {
  return { getHandlerPath: () => handlerPath }
})

jest.mock('../../resources/Runner/Paths', () => {
  return {
    getInBasePath: () => path.join(tmpPath, 'in'),
    ioPaths: {
      in: (runID: string) => path.join(tmpPath, 'in', runID),
      all: (runID: string) => path.join(tmpPath, 'all', runID),
    },
  }
})

jest.mock('../../resources/RedisEvents', () => {
  return {
    RedisEvents: {
      runDone: jest.fn(),
    },
  }
})

let app: Server
const port = 9091
beforeAll(done => {
  app = serverProto.listen(port, err => {
    console.log(`LISTENING ${port}`)
    done()
  })
})

afterAll(done => {
  app.close(err => {
    console.log('CLOSED SERVER')
    done()
  })
})

beforeEach(async () => {
  execa.sync('rm', ['-rf', tmpPath])
  if (!fs.existsSync(tmpPath)) fs.mkdirSync(tmpPath, { recursive: true })
  if (!fs.existsSync(path.join(tmpPath, 'in'))) fs.mkdirSync(path.join(tmpPath, 'in'), { recursive: true })
  if (!fs.existsSync(path.join(tmpPath, 'all'))) fs.mkdirSync(path.join(tmpPath, 'all'), { recursive: true })
  jest.clearAllMocks()
  await Runner.reset()
})

describe('delete', () => {
  test('Delete after success - stdin->stdout', async () => {
    setHandler('stdin->stdout')
    const output = '.'.repeat(1000)
    const { runID, s, wait } = setup(port, 'sync', async (err, res, body) => {
      checkSuccess({ err, res, body, output, runID })
      await expect(requestDelete(runID, port)).resolves.toEqual({ deletedRun: runID })
    })
    s.end(output)
    await wait.finish()
  })
})

describe('error', () => {
  test('fail', async () => {
    setHandler('fail')
    const { runID, s, wait } = setup(port, 'sync', (err, res, body) => {
      checkRunError({ err, res, body, runID, output: '' })
      expect(res.trailers['x-error']).toBe('Error - Command failed with exit code 2 (ENOENT): fail')
    })
    s.end()
    await wait.finish()
  })

  test('fail-message', async () => {
    setHandler('fail-message')
    const { runID, s, wait } = setup(port, 'sync', (err, res, body) => {
      checkRunError({ err, res, body, runID, output: 'fail\n' })
      expect(res.trailers['x-error']).toBe('Error - Command failed with exit code 2 (ENOENT): fail-message')
    })
    s.end()
    await wait.finish()
  })

  test('input-parser error', async () => {
    setHandler('fail')
    const { s, wait } = wrongSetup(port, 'sync', (err, res, body) => {
      expect(err).not.toBeUndefined()
      expect(body).toBe('{"error":"MissingHeaderRunID","message":"Missing header x-run-id"}')
    })
    s.end()
    await wait.finish()
  })
})

describe('kill', () => {
  test('forever', async () => {
    setHandler('forever')
    const { runID, s, wait } = setup(port, 'sync', (err, res, body) => {
      checkRunError({ err, res, body, runID, output: '' })
      expect(res.trailers['x-error']).toBe('Error - Command was killed with SIGTERM: forever')
    })
    s.end()
    await sleep(1000)
    await requestKill(runID, port)
    await wait.finish()
  })

  test('mixed-output-sleep.py', async () => {
    setHandler('mixed-output-sleep.py')
    const { runID, s, wait } = setup(port, 'sync', (err, res, body) => {
      checkRunError({ err, res, body, runID, len: 5000 })
      expect(res.trailers['x-error']).toBe('Error - Command was killed with SIGTERM: mixed-output-sleep.py')
    })
    s.end('1000 2000 1000')
    await sleep(1000)
    await requestKill(runID, port)
    await wait.finish()
  })

  test('no-killable', async () => {
    setHandler('no-killable')
    const { runID, s, wait } = setup(port, 'sync', (err, res, body) => {
      checkRunError({ err, res, body, runID, output: 'Received SIGTERM, but we ignore it\n' })
      expect(res.trailers['x-error']).toBe('Error - Command was killed with SIGKILL: no-killable')
    })
    s.end()
    await sleep(500)
    await requestKill(runID, port)
    await wait.finish()
  }, 9000)

  test('sigterm-catcher-exit-error.py', async () => {
    setHandler('sigterm-catcher-exit-error.py')
    const { runID, s, wait } = setup(port, 'sync', (err, res, body) => {
      checkRunError({ err, res, body, runID, output: 'Sleep 30 seconds\n15 RECEIVED\n' })
      expect(res.trailers['x-error']).toBe(
        'Error - Command failed with exit code 1 (EPERM): sigterm-catcher-exit-error.py'
      )
    })
    s.end()
    await sleep(500)
    await requestKill(runID, port)
    await wait.finish()
  })

  test('sigterm-catcher-exit-success.py', async () => {
    setHandler('sigterm-catcher-exit-success.py')
    const { runID, s, wait } = setup(port, 'sync', (err, res, body) => {
      checkSuccess({ err, res, body, runID, output: 'Sleep 30 seconds\n15 RECEIVED\n' })
    })
    s.end()
    await sleep(500)
    await requestKill(runID, port)
    await wait.finish()
  })

  test('sleeper.py', async () => {
    setHandler('sleeper.py')
    const { runID, s, wait } = setup(port, 'sync', (err, res, body) => {
      checkRunError({ err, res, body, runID, output: 'Sleep 30 seconds\n' })
      expect(res.trailers['x-error']).toBe('Error - Command was killed with SIGTERM: sleeper.py')
    })
    s.end('30')
    await sleep(500)
    await requestKill(runID, port)
    await wait.finish()
  })
})

describe('result', () => {
  test('Success - stdin->stdout', async () => {
    setHandler('stdin->stdout')
    const output = '.'.repeat(1000000)
    const { runID, s, wait } = setup(port, 'sync', async (err, res, body) => {
      checkSuccess({ err, res, body, output, runID })
    })
    s.end(output)
    await wait.finish()
    const stat = await requestResultInfo(runID, port)
    const out = await requestResultOutput(runID, port)
    expect(stat.status).toBe('success')
    expect(stat.error).toBeUndefined()
    expect(out).toBe(output)
  })

  test('Error - fail-message', async () => {
    setHandler('fail-message')
    const { runID, s, wait } = setup(port, 'sync', async (err, res, body) => {
      checkRunError({ err, res, body, runID, output: 'fail\n' })
    })
    s.end()
    await wait.finish()
    const stat = await requestResultInfo(runID, port)
    const out = await requestResultOutput(runID, port)
    expect(stat.status).toBe('error')
    expect(stat.error).toBe('Error - Command failed with exit code 2 (ENOENT): fail-message')
    expect(out).toBe('fail\n')
  })

  test('Mid-run - stdin->stdout', async () => {
    setHandler('stdin->stdout')
    const output = '.'.repeat(1000000)
    const { runID, s, wait } = setup(port, 'sync', async (err, res, body) => {
      checkSuccess({ err, res, body, output, runID })
    })
    expect.assertions(10)
    s.write(output)
    await sleep(2000)
    try {
      await requestResultInfo(runID, port)
    } catch (err) {
      expect(err.response.data).toEqual({
        error: 'ProcessNotFinished',
        message: `The run ${runID} is not finished yet`,
      })
    }

    try {
      await requestResultOutput(runID, port)
    } catch (err) {
      expect(err.response.data).toEqual({
        error: 'ProcessNotFinished',
        message: `The run ${runID} is not finished yet`,
      })
    }

    s.end()
    await wait.finish()
  })
})

describe('status', () => {
  test('Ended success - stdin->stdout', async () => {
    setHandler('stdin->stdout')
    const { runID, s, wait } = setup(port, 'sync', async (err, res, body) => {
      checkSuccess({ err, res, body, runID, output: '.'.repeat(1000) })
    })

    s.write('.'.repeat(500))
    await sleep(500)
    const stat1 = await requestStatus({ port, runID, which: ['out', 'err'] })
    expect(stat1.status).toBe('running')
    expect(stat1.out).toBe('.'.repeat(500))
    expect(stat1.err).toBe('')
    s.end('.'.repeat(500))
    await wait.finish()
    const stat2 = await requestStatus({ port, runID, which: ['out', 'err'] })
    expect(stat2.status).toBe('success')
    expect(stat2.out).toBe('.'.repeat(1000))
    expect(stat2.err).toBe('')
  })

  test('Ended success - stdin->stdout - no out or err', async () => {
    setHandler('stdin->stdout')
    const { runID, s, wait } = setup(port, 'sync', (err, res, body) => {
      checkSuccess({ err, res, body, runID, output: '.'.repeat(500) })
    })
    s.end('.'.repeat(500))
    await wait.finish()
    const stat = await requestStatus({ port, runID })
    expect(stat.status).toBe('success')
    expect(stat.err).toBeUndefined()
    expect(stat.out).toBeUndefined()
  })

  test('Ended success - stdin->stderr', async () => {
    setHandler('stdin->stderr')
    const { runID, s, wait } = setup(port, 'sync', (err, res, body) => {
      checkSuccess({ err, res, body, runID, output: '.'.repeat(1000) })
    })
    s.write('.'.repeat(500))

    await sleep(500)
    const stat1 = await requestStatus({ port, runID, which: ['out', 'err'] })
    expect(stat1.status).toBe('running')
    expect(stat1.err).toBe('.'.repeat(500))
    expect(stat1.out).toBe('')
    s.end('.'.repeat(500))

    await wait.finish()
    const stat2 = await requestStatus({ port, runID, which: ['out', 'err'] })
    expect(stat2.status).toBe('success')
    expect(stat2.err).toBe('.'.repeat(1000))
    expect(stat2.out).toBe('')
  })

  test('End error - fail-message', async () => {
    setHandler('fail-message')
    const { runID, s, wait } = setup(port, 'sync', (err, res, body) => {
      checkRunError({ err, res, body, runID, output: 'fail\n' })
    })
    s.end()
    await wait.finish()
    const stat = await requestStatus({ port, runID, which: ['out', 'err'] })
    expect(stat.status).toBe('error')
    expect(stat.error).toBe('Error - Command failed with exit code 2 (ENOENT): fail-message')
    expect(stat.out).toBe('fail\n')
    expect(stat.err).toBe('')
  })
})

describe('stdin', () => {
  test('stdin->stdout - Immediatelly end input stream', async () => {
    setHandler('stdin->stdout')
    const output = '.'.repeat(1000)
    const { runID, s, wait } = setup(port, 'sync', (err, res, body) => {
      checkSuccess({ err, res, body, output, runID })
    })
    s.end(output)
    await wait.finish()
  })

  test('stdin->stderr - Immediatelly end input stream', async () => {
    setHandler('stdin->stderr')
    const output = '.'.repeat(50 * 1000)
    const { runID, s, wait } = setup(port, 'sync', (err, res, body) => {
      checkSuccess({ err, res, body, output, runID })
    })
    s.end(output)
    await wait.finish()
  })

  test.each([[2, 500], [2, 1000], [2, 2000], [3, 500], [3, 1000], [3, 1500]])(
    'stdin->stdout - Many writes for some interval',
    async (writes, timeout) => {
      setHandler('stdin->stdout')
      const output = '.'.repeat(writes * 1000000)
      const { runID, s, wait } = setup(port, 'sync', (err, res, body) => {
        checkSuccess({ err, res, body, output, runID })
      })

      let remaining = writes
      const prepare = () => {
        if (remaining === 1) {
          s.end('.'.repeat(1000000))
        } else {
          s.write('.'.repeat(1000000))
          setTimeout(prepare, timeout)
        }
        remaining -= 1
      }
      setTimeout(prepare, timeout)
      await wait.finish()
    }
  )

  test('stdin->stdout - Long 20s timeout to end', async () => {
    setHandler('stdin->stdout')
    const output = '.'.repeat(1000000)
    const { runID, s, wait } = setup(port, 'sync', (err, res, body) => {
      checkSuccess({ err, res, body, output, runID })
    })
    await sleep(20 * 1000)
    s.end(output)
    await wait.finish()
  }, 21000)

  test('multi-query.py', async () => {
    setHandler('multi-query.py')
    let output = ''
    const { runID, s, req, wait } = setup(port, 'sync', (err, res, body) => {
      checkSuccess({ err, res, body, output, runID })
    })

    let cycles = 5
    s.write('s\n')
    req.on('data', c => {
      output += c.toString()
      if (cycles > 0) expect(c.toString()).toBe('Continue\n')
      else if (cycles === 0) expect(c.toString()).toBe('Done\n')
      else expect(true).toBe(false)
      if (cycles > 1) setTimeout(() => s.write('s\n'), 400)
      else if (cycles === 1) setTimeout(() => s.end('n\n'), 400)
      cycles -= 1
    })
    await wait.finish()
  })
})
