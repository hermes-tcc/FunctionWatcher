import { NextFunction, Request, Response } from 'express'
import { Readable } from 'stream'
import util from 'util'
import { InputParser } from '../../resources/InputParser'
import { Runner } from '../../resources/Runner'
import { Logger } from '../../utils/Logger'
import { createRunnerReadStream, getInBasePath, getIOPath } from '../../utils/runner'
import {
  MissingInputField,
  NoSuchRun,
  ProcessNotFinished,
  ReportNotReady,
  RunIdAlreadyExists,
} from './../../errors/RunRouteErrors'
import { BusboyLimits, FileInfo } from './../../typings.d'

const KILOBYTE = 1024
const MEGABYTE = 1024 * KILOBYTE
const MAX_FILE_SIZE = 100 * MEGABYTE

interface RunArgs {
  input: Readable
  runId: string
}

interface ReqWithRunArgs extends Request {
  runArgs: RunArgs
}

interface ReqWithRun extends Request {
  run: Runner
}

const getRunInput = async (inputArr: FileInfo[]): Promise<RunArgs> => {
  if (inputArr.length === 0) throw new MissingInputField()
  const runId = inputArr[0].filename
  return {
    runId,
    input: await createRunnerReadStream(runId, 'in'),
  }
}

export const parseInput = async (req: ReqWithRunArgs, res: Response, next: NextFunction) => {
  try {
    if (req.method === 'POST') {
      const limits: BusboyLimits = {
        parts: 1,
        fileSize: MAX_FILE_SIZE,
      }

      const inputParser = new InputParser(req, { limits }, getInBasePath())
      const inputFileArr = await inputParser.parse()
      Logger.info('[parseInput]', { inputFileArr: util.inspect(inputFileArr) })
      req.runArgs = await getRunInput(inputFileArr)
      next()
    } else {
      res.status(405).send('This route only accepts POST requests')
    }
  } catch (err) {
    next(err)
  }
}

export const runHandler = async (req: ReqWithRunArgs, res: Response, next: NextFunction) => {
  try {
    const runExists = Runner.getRun(req.runArgs.runId)
    if (runExists) throw new RunIdAlreadyExists(req.runArgs.runId)
    const runRequest = new Runner(req.runArgs)
    const { startTime } = runRequest.start()
    res.status(200).send({ startTime })
  } catch (err) {
    next(err)
  }
}

export const writeRunOnReq = async (req: ReqWithRun, res: Response, next: NextFunction) => {
  try {
    const id = req.params.runId
    const runData = Runner.getRun(id)
    if (!runData) throw new NoSuchRun(id)
    req.run = runData.run
    next()
  } catch (err) {
    next(err)
  }
}

export const statusHandler = async (req: ReqWithRun, res: Response, next: NextFunction) => {
  try {
    if (req.method === 'GET') {
      Logger.info('status', req.run.getStatus())
      res.status(200).send(req.run.getStatus())
    } else if (req.method === 'DELETE') {
      req.run.cleanup()
      const ret = { deletedProcess: req.run.getId() }
      res.status(200).send(ret)
    } else {
      res.status(405).send('This route only accepts GET and DELETE requests')
    }
  } catch (err) {
    next(err)
  }
}

export const resultHandler = async (req: ReqWithRun, res: Response, next: NextFunction) => {
  try {
    if (req.method === 'GET') {
      const id = req.run.getId()
      if (!req.run.isProcessDone()) throw new ProcessNotFinished(id)
      if (!req.run.isReportReady()) throw new ReportNotReady(id)
      res.sendFile(getIOPath(id, 'rep'))
    } else {
      res.status(405).send('This route only accepts GET requests')
    }
  } catch (err) {
    next(err)
  }
}
