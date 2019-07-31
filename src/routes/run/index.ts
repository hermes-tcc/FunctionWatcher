import { Router } from 'express'
import {
  deleteHandler,
  killHandler,
  resultInfoHandler,
  resultOutputHandler,
  statusHandler,
  writeRunOnReq,
} from './handlers'
import { syncRunHandler } from './syncRun'
import { asyncRunHandler } from './asyncRun'

export const runRoute = Router()

runRoute.post('/async', [asyncRunHandler])
runRoute.all('/sync', [syncRunHandler])
runRoute.all('/:runID/kill', [writeRunOnReq, killHandler])
runRoute.all('/:runID/status', [writeRunOnReq, statusHandler])
runRoute.all('/:runID/delete', [writeRunOnReq, deleteHandler])
runRoute.all('/:runID/result/output', [writeRunOnReq, resultOutputHandler])
runRoute.all('/:runID/result/info', [writeRunOnReq, resultInfoHandler])
