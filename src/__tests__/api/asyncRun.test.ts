import execa from 'execa'
import fs from 'fs'
import { Server } from 'http'
import os from 'os'
import path from 'path'
import { Runner } from '../../resources/Runner'
import { serverProto } from '../../serverProto'
import { Logger } from '../../utils/Logger'
import { checkBasics, checkBody } from './asyncRunTestUtils'
import { setup, sleep } from './utils'

Logger.enabled = false
const tmpPath = path.join(os.tmpdir(), 'function-watcher-async-run-tests')
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
const port = 9092
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

describe('stdin', () => {
  test('stdin->stdout - Immediatelly end input stream', async () => {
    setHandler('stdin->stdout')
    const output = '.'.repeat(1000)
    const { runID: runID, s, wait } = setup(port, 'async', (err, res, body) => {
      checkBody(runID, body, output)
    })
    s.end(output)
    await wait.finish()
    await checkBasics({ port, output, runID, status: 'success' })
  })

  test('stdin->stderr - Immediatelly end input stream', async () => {
    setHandler('stdin->stderr')
    const output = '.'.repeat(50 * 1000)
    const { runID: runID, s, wait } = setup(port, 'async', (err, res, body) => {
      checkBody(runID, body, output)
    })
    s.end(output)
    await wait.finish()
    await checkBasics({ port, output, runID, status: 'success' })
  }, 6000)

  test.each([[2, 500], [2, 1000], [2, 2000], [3, 500], [3, 1000], [3, 1500]])(
    'stdin->stdout - Many writes for some interval',
    async (writes, timeout) => {
      setHandler('stdin->stdout')
      const output = '.'.repeat(writes * 1000000)
      const { runID: runID, s, wait } = setup(port, 'async', (err, res, body) => {
        checkBody(runID, body, output)
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
      await checkBasics({ port, output, runID, status: 'success' })
    }
  )

  test('stdin->stdout - Long 20s timeout to end', async () => {
    setHandler('stdin->stdout')
    const output = '.'.repeat(1000000)
    const { runID: runID, s, wait } = setup(port, 'async', (err, res, body) => {
      checkBody(runID, body, output)
    })
    await sleep(20 * 1000)
    s.end(output)
    await wait.finish()
    await checkBasics({ port, output, runID, status: 'success' })
  }, 21000)

  test('multi-query.py', async () => {
    setHandler('multi-query.py')
    const input = 's\ns\nn\n'
    const output = 'Continue\nContinue\nDone\n'
    const { runID: runID, s, wait } = setup(port, 'async', (err, res, body) => {
      checkBody(runID, body, input)
    })
    s.end(input)
    await wait.finish()
    await checkBasics({ port, output, runID, status: 'success' })
  })
})
