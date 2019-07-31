import { randomBytes } from 'crypto'
import { RunsLimitReached } from '../../errors/RunRouteErrors'
import { RedisEvents } from '../../resources/RedisEvents'
import { Runner } from '../../resources/Runner'
import { Run, RunOptions } from '../../resources/Runner/Run'
import { Logger } from '../../utils/Logger'

Logger.enabled = false

jest.mock('../../resources/Runner/Run', () => ({
  Run: jest.fn().mockImplementation((runID: string, options?: RunOptions) => {
    const opts = options || {}
    return {
      runID,
      onDone: opts.onDone,
      onSuccess: opts.onSuccess,
      onError: opts.onError,
      cleanup: jest.fn(),
    }
  }),
}))

jest.mock('../../resources/RedisEvents', () => {
  return {
    RedisEvents: {
      runDone: jest.fn(),
    },
  }
})

afterEach(() => jest.clearAllMocks())

const checkRunnerRunsArr = (arr: any) => {
  // @ts-ignore
  expect(Runner.runs).toEqual(arr)
}

const resetRunner = () => {
  // @ts-ignore
  Runner.curRuns = 0
  // @ts-ignore
  Runner.succRuns = 0
  // @ts-ignore
  Runner.errRuns = 0
}

const checkRunsValues = (cur: number, succ: number, err: number) => {
  expect(Runner.currentRuns).toBe(cur)
  expect(Runner.successRuns).toBe(succ)
  expect(Runner.errorRuns).toBe(err)
}

const removeAndCheck = async (id: string, run: any, arr: any) => {
  expect(run.cleanup).toBeCalledTimes(0)
  await expect(Runner.removeRun(id)).resolves.toBe(run)
  await expect(Runner.removeRun(id)).resolves.toBeNull()
  checkRunnerRunsArr(arr)
  expect(run.cleanup).toBeCalledTimes(1)
}

test('createRun and removeRun', async () => {
  const id = randomBytes(8).toString('hex')
  const r = Runner.createRun(id)
  expect(Run).toBeCalledTimes(1)

  // @ts-ignore
  expect(Run.mock.calls[0][0]).toBe(id)
  checkRunnerRunsArr([r])
  expect(Runner.getRun(id)).toBe(r)
  await removeAndCheck(id, r, [])
})

test('onDone given to Run', async () => {
  resetRunner()
  const id = randomBytes(8).toString('hex')
  const r = Runner.createRun(id)
  // @ts-ignore
  r.onDone(id)
  expect(RedisEvents.runDone).toBeCalledTimes(1)
  expect(RedisEvents.runDone).toBeCalledWith(id)
  await removeAndCheck(id, r, [])
})

test('onSuccess given to Run', async () => {
  resetRunner()
  const id = randomBytes(8).toString('hex')
  const r = Runner.createRun(id)
  checkRunsValues(1, 0, 0)
  // @ts-ignore
  r.onSuccess()
  checkRunsValues(0, 1, 0)
  await removeAndCheck(id, r, [])
})

test('onError given to Run', async () => {
  resetRunner()
  const id = randomBytes(8).toString('hex')
  const r = Runner.createRun(id)
  checkRunsValues(1, 0, 0)
  // @ts-ignore
  r.onError()
  checkRunsValues(0, 0, 1)
  await removeAndCheck(id, r, [])
})

test('On Runs limit throws', async () => {
  resetRunner()
  const id1 = randomBytes(8).toString('hex')
  const r1 = Runner.createRun(id1)
  const id2 = randomBytes(8).toString('hex')
  expect(() => Runner.createRun(id2)).toThrow(RunsLimitReached)
  checkRunnerRunsArr([r1])
  checkRunsValues(1, 0, 0)
  await removeAndCheck(id1, r1, [])
})

test('Multiple createRuns', async () => {
  resetRunner()
  const id1 = randomBytes(8).toString('hex')
  const r1 = Runner.createRun(id1)
  checkRunsValues(1, 0, 0)
  // @ts-ignore
  r1.onSuccess()
  const id2 = randomBytes(8).toString('hex')
  const r2 = Runner.createRun(id2)
  checkRunnerRunsArr([r1, r2])
  checkRunsValues(1, 1, 0)
  // @ts-ignore
  r2.onError()
  checkRunsValues(0, 1, 1)
  await removeAndCheck(id1, r1, [r2])
  await removeAndCheck(id2, r2, [])
})
