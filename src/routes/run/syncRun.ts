import { drainStream, streamFinished } from '@hermes-serverless/stream-utils'
import { NextFunction, Request, Response } from 'express'
import { PassThrough, Readable } from 'stream'
import { Runner } from '../../resources/Runner'
import { Logger } from '../../utils/Logger'
import { MissingHeaderRunID, RunIDAlreadyExists } from './../../errors/RunRouteErrors'

const addName = (msg: string) => {
  return `[syncRun] ${msg}`
}

export const getRunID = (req: Request): string => {
  if (!req.headers['x-run-id']) throw new MissingHeaderRunID()
  return req.headers['x-run-id'] as string
}

const doRun = async (runID: string, input: Readable, res: Response) => {
  const runExists = Runner.getRun(runID)
  if (runExists) {
    drainStream(input)
    throw new RunIDAlreadyExists(runID)
  }

  const doneInput = streamFinished(input)
  const run = Runner.createRun(runID)
  const output = new PassThrough()
  const outputFinishPromise = streamFinished(output)
  output.pipe(
    res,
    { end: false }
  )

  run.start({ input, output })

  try {
    await doneInput
    await run.donePromise
    await outputFinishPromise
    Logger.info(addName('Done'))
    res.addTrailers({ 'x-result': 'success', 'x-error': '' })
  } catch (err) {
    Logger.error(addName('Error'), err)
    run.kill()
    output.unpipe()
    drainStream(output)
    res.addTrailers({ 'x-result': `error`, 'x-error': `${err.constructor.name} - ${err.message}` })
  }
}

export const syncRunHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.method === 'POST') {
      Logger.info('[syncRun]')
      const runID = getRunID(req)
      res.setHeader('Trailer', 'x-result; x-error')
      res.setHeader('content-type', 'text/plain')
      res.writeHead(200)
      await doRun(runID, req, res)
      res.end()
    } else {
      res.status(405).send('This route only accepts POST requests')
    }
  } catch (err) {
    next(err)
  }
}
