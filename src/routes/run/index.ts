import { parseInput, runHandler, statusHandler, resultHandler, writeRunOnReq } from './handlers'
import { Router } from 'express'

export const runRoute = Router()

runRoute.post('/:runId', [parseInput, runHandler])
runRoute.get('/:runId', [writeRunOnReq, statusHandler])
runRoute.delete('/:runId', [writeRunOnReq, statusHandler])

runRoute.all('/:runId/result', [writeRunOnReq, resultHandler])
