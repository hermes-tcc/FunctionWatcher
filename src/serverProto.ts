import express, { NextFunction, Request, Response } from 'express'
import morgan from 'morgan'
import { runRoute } from './routes/run/index'
import { Logger } from './utils/Logger'

const serverProto = express()

serverProto.use(morgan('dev'))
serverProto.use('/run', runRoute)

serverProto.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (!err.getStatusCode) err.getStatusCode = () => 500
  if (!err.getResponseObject) {
    err.getResponseObject = () => {
      return { error: 'InternalServerError', message: 'Something broke in the function server' }
    }
  }
  Logger.error(`Error ${err.constructor.name}`, err)
  if (err.detail) Logger.info(`Error details`, err.detail)
  res.setHeader('Connection', 'close')
  res.status(err.getStatusCode()).send(err.getResponseObject())
})

serverProto.use('/', (_, res) => {
  res.status(404).send('Not found')
})

export { serverProto }
