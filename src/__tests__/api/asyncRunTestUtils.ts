import fs from 'fs'
import request from 'request'
import { RedisEvents } from '../../resources/RedisEvents'
import { ioPaths } from '../../resources/Runner/Paths'
import { Runner } from '../../resources/Runner'
import { requestResultOutput, requestStatus } from './utils'

interface CheckBasicsArgs {
  port: number
  runID: string
  output?: string
  len?: number
  status: string
  err?: string
}

export const checkBody = (runID: string, body: any, input: string) => {
  expect(fs.readFileSync(ioPaths.in(runID), { encoding: 'utf-8' })).toBe(input)
  expect(JSON.parse(body).runID).toBe(runID)
}

export const checkBasics = async ({ port, runID, output, len, status, err }: CheckBasicsArgs) => {
  const run = Runner.getRun(runID)
  try {
    await run.donePromise
  } catch (err) {}
  const out = await requestResultOutput(runID, port)
  if (output != null) {
    expect(out).toBe(output)
    expect(fs.readFileSync(ioPaths.all(runID), { encoding: 'utf-8' })).toBe(output)
  } else if (len != null) {
    expect(out.length).toBe(len)
    expect(fs.readFileSync(ioPaths.all(runID), { encoding: 'utf-8' }).length).toBe(len)
  }
  expect(RedisEvents.runDone).toBeCalledTimes(1)
  const stat = await requestStatus({ runID, port })
  expect(stat.status).toBe(status)
  expect(stat.error).toBe(err)
}
