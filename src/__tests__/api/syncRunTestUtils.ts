import fs from 'fs'
import request from 'request'
import { RedisEvents } from '../../resources/RedisEvents'
import { ioPaths } from '../../resources/Runner/Paths'

interface CheckArgs {
  err: any
  res: request.Response
  body: any
  runID: string
  output?: string
  len?: number
}

export const checkSuccess = ({ err, res, body, runID, output, len }: CheckArgs) => {
  expect(err).toBeNull()
  if (output != null) {
    expect(body).toBe(output)
    expect(fs.readFileSync(ioPaths.all(runID), { encoding: 'utf-8' })).toBe(output)
  } else if (len != null) {
    expect(body.length).toBe(len)
    expect(fs.readFileSync(ioPaths.all(runID), { encoding: 'utf-8' }).length).toBe(len)
  }
  expect(RedisEvents.runDone).toBeCalledTimes(1)
  expect(res.headers['trailer']).toBe('x-result; x-error')
  expect(res.headers['content-type']).toBe('text/plain')
  expect(res.trailers['x-result']).toBe('success')
  expect(res.trailers['x-error']).toBe('')
}

export const checkRunError = ({ err, res, body, runID, output, len }: CheckArgs) => {
  expect(err).toBeNull()
  if (output != null) {
    expect(body).toBe(output)
    expect(fs.readFileSync(ioPaths.all(runID), { encoding: 'utf-8' })).toBe(output)
  } else if (len != null) {
    expect(body.length).toBe(len)
    expect(fs.readFileSync(ioPaths.all(runID), { encoding: 'utf-8' }).length).toBe(len)
  }
  expect(RedisEvents.runDone).toBeCalledTimes(1)
  expect(res.headers['trailer']).toBe('x-result; x-error')
  expect(res.headers['content-type']).toBe('text/plain')
  expect(res.trailers['x-result']).toBe('error')
  expect(res.trailers['x-error'].length).toBeGreaterThan(0)
}
