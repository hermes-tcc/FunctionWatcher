import express, { NextFunction, Request, Response } from 'express'
import morgan from 'morgan'
import { aliveRouter } from './routes/alive'
import { runRoute } from './routes/run/index'
import { shutdownRoute } from './routes/shutdown'
import { Logger } from './utils/Logger'

const serverProto = express()

serverProto.use(morgan('dev'))
serverProto.use('/run', runRoute)
serverProto.use('/shutdown', shutdownRoute)
serverProto.use('/alive', aliveRouter)

serverProto.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (!err.getStatusCode) err.getStatusCode = () => 500
  if (!err.getResponseObject) {
    err.getResponseObject = () => {
      return { error: 'InternalServerError', message: `${err.constructor.name} - ${err.message}` }
    }
  }
  Logger.error(`Error ${err.constructor.name}`, err)
  if (err.detail) Logger.info(`Error details`, err.detail)
  res.status(err.getStatusCode()).send(err.getResponseObject())
})

serverProto.use('/', (_, res) => {
  res.status(404).send('Not found')
})

export { serverProto }
