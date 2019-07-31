import { NextFunction, Response } from 'express'
import R from 'ramda'
import { Runner } from '../../resources/Runner'
import { ReqWithRun } from '../../typings'
import { Logger } from '../../utils/Logger'
import { NoSuchRun, ProcessNotFinished } from './../../errors/RunRouteErrors'

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

export const deleteHandler = async (req: ReqWithRun, res: Response, next: NextFunction) => {
  try {
    if (req.method === 'DELETE') {
      Runner.removeRun(req.run.runID)
      const ret = { deletedRun: req.run.runID }
      res.status(200).send(ret)
    } else {
      res.status(405).send('This route only accepts GET and DELETE requests')
    }
  } catch (err) {
    next(err)
  }
}

export const statusHandler = async (req: ReqWithRun, res: Response, next: NextFunction) => {
  try {
    if (req.method === 'GET') {
      Logger.info('[StatusHandler]', req.run.getStatus())
      const which = R.toPairs(req.query).map(el => el[1]) as string[]
      const status = which.length > 0 ? req.run.getStatus(which) : req.run.getStatus()
      res.status(200).send(status)
    } else {
      res.status(405).send('This route only accepts GET requests')
    }
  } catch (err) {
    next(err)
  }
}

export const killHandler = async (req: ReqWithRun, res: Response, next: NextFunction) => {
  try {
    if (req.method === 'POST') {
      Logger.info(`[killHandler] ${req.run.runID}`)
      req.run.kill()
      res.status(200).send()
    } else {
      res.status(405).send('This route only accepts POST requests')
    }
  } catch (err) {
    next(err)
  }
}

export const resultInfoHandler = async (req: ReqWithRun, res: Response, next: NextFunction) => {
  try {
    if (req.method === 'GET') {
      Logger.info('[ResultInfoHandler]', req.run.getStatus())
      if (!req.run.isProcessDone) throw new ProcessNotFinished(req.run.runID)
      res.status(200).send(req.run.getStatus())
    } else {
      res.status(405).send('This route only accepts GET and DELETE requests')
    }
  } catch (err) {
    next(err)
  }
}

export const resultOutputHandler = async (req: ReqWithRun, res: Response, next: NextFunction) => {
  try {
    if (req.method === 'GET') {
      Logger.info('[ResultOutputHandler]', req.run.getStatus())
      if (!req.run.isProcessDone) throw new ProcessNotFinished(req.run.runID)
      res.status(200)
      const fileStream = await req.run.outputStream
      fileStream.pipe(res)
    } else {
      res.status(405).send('This route only accepts GET and DELETE requests')
    }
  } catch (err) {
    next(err)
  }
}
