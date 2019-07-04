import { WatcherServer } from './../WatcherServer'
import { Router } from 'express'

export const shutdownRoute = Router()

shutdownRoute.use('/', (req, res, next) => {
  res.setHeader('Connection', 'close')
  res.status(200).end()
  WatcherServer.shutdown()
})
