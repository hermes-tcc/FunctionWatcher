import { Router } from 'express'
import { WatcherServer } from './../WatcherServer'

export const aliveRouter = Router()

aliveRouter.use('/', (req, res, next) => {
  res.status(200).end()
  WatcherServer.resetTimer()
})
