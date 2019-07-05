import { NextFunction, Request, Response } from 'express'
import util from 'util'
import { InputParser } from '../../resources/InputParser'
import { Runner } from '../../resources/Runner'
import { Run } from '../../resources/Runner/Run'
import { getInBasePath } from '../../resources/Runner/RunFileManager'
import { Logger } from '../../utils/Logger'
import {
  MissingInputField,
  NoSuchRun,
  ProcessNotFinished,
  ReportNotReady,
  RunIDAlreadyExists,
} from './../../errors/RunRouteErrors'
import { MAX_INPUT_SIZE } from './../../limits/index'
import { BusboyLimits, FieldToPersist } from './../../typings.d'

interface ReqWithRunID extends Request {
  runID: string
}

interface ReqWithRun extends Request {
  run: Run
}

export const parseInput = async (req: ReqWithRunID, res: Response, next: NextFunction) => {
  try {
    if (req.method === 'POST') {
      const limits: BusboyLimits = {
        parts: 1,
        fileSize: MAX_INPUT_SIZE,
      }

      const partsToPersist: FieldToPersist[] = [
        {
          fieldname: 'input',
          filename: req.params.runID,
        },
      ]

      const inputParser = new InputParser(req, { limits }, getInBasePath(), partsToPersist)
      const inputFileArr = await inputParser.parse()
      Logger.info('[parseInput]', { inputFileArr: util.inspect(inputFileArr) })

      if (inputFileArr.length === 0) throw new MissingInputField()
      req.runID = inputFileArr[0].filename
      next()
    } else {
      res.status(405).send('This route only accepts POST requests')
    }
  } catch (err) {
    next(err)
  }
}

export const runHandler = async (req: ReqWithRunID, res: Response, next: NextFunction) => {
  try {
    const { runID } = req

    const runExists = Runner.getRun(runID)
    if (runExists) throw new RunIDAlreadyExists(runID)

    const run = Runner.createRun(runID)
    const { startTime } = run.start()
    res.status(200).send({ startTime, runID })
  } catch (err) {
    next(err)
  }
}

export const writeRunOnReq = async (req: ReqWithRun, res: Response, next: NextFunction) => {
  try {
    const { runID } = req.params
    const run = Runner.getRun(runID)
    if (!run) throw new NoSuchRun(runID)
    req.run = run
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
      Runner.removeRun(req.run.getID())
      const ret = { deletedRun: req.run.getID() }
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
      const { run } = req
      const runID = run.getID()
      if (!run.isProcessDone()) throw new ProcessNotFinished(runID)
      if (!run.isReportReady()) throw new ReportNotReady(runID)
      res.sendFile(run.getResultPath(), err => {
        if (err) Logger.error('Error sending file', err)
        else Logger.info('Done sending file')
      })
    } else {
      res.status(405).send('This route only accepts GET requests')
    }
  } catch (err) {
    next(err)
  }
}
