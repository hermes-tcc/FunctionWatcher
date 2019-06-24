import { parseInput, runHandler, statusHandler, resultHandler, writeRunOnReq } from './handlers'
import { Router } from 'express'

export const runRoute = Router()

runRoute.all('/', [parseInput, runHandler])
runRoute.all('/:runId', [writeRunOnReq, statusHandler])
runRoute.all('/:runId/result', [writeRunOnReq, resultHandler])
