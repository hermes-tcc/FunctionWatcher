import { createFsWriteStream } from '@hermes-serverless/fs-utils'
import { NextFunction, Request, Response } from 'express'
import { pipeline } from 'stream'
import util from 'util'
import { Runner } from '../../resources/Runner'
import { ioPaths } from '../../resources/Runner/Paths'
import { Logger } from '../../utils/Logger'
import { RunIDAlreadyExists } from './../../errors/RunRouteErrors'
import { getRunID } from './syncRun'

const addName = (msg: string, runID?: string) => {
  return `[asyncRun ${runID}] ${msg}`
}

export const asyncRunHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.method === 'POST') {
      const runID = getRunID(req)
      const runExists = Runner.getRun(runID)
      if (runExists) throw new RunIDAlreadyExists(runID)
      Logger.info(addName('Start upload', runID))
      await util.promisify(pipeline)([req, await createFsWriteStream(ioPaths.in(runID))])
      Logger.info(addName('Finished uploading file', runID))
      const run = Runner.createRun(runID)
      const { startTime } = run.start()
      res.status(200).send({ startTime, runID })
    } else {
      res.status(405).send('This route only accepts POST requests')
    }
  } catch (err) {
    next(err)
  }
}
