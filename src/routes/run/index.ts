import { parseInput, runHandler, statusHandler, resultHandler, writeRunOnReq } from './handlers'
import { Router } from 'express'

export const runRoute = Router()

runRoute.post('/:runID', [parseInput, runHandler])
runRoute.get('/:runID', [writeRunOnReq, statusHandler])
runRoute.delete('/:runID', [writeRunOnReq, statusHandler])

runRoute.all('/:runID/result', [writeRunOnReq, resultHandler])
