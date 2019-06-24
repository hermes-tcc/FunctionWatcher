import express, { NextFunction, Request, Response } from 'express'
import morgan from 'morgan'
import { RedisEvents } from './resources/RedisEvents'
import { runRoute } from './routes/run/index'
import { Logger } from './utils/Logger'
import { prepareHandler } from './utils/runner'

const server = express()
server.use(morgan('dev'))
server.use('/run', runRoute)

server.use((err: any, req: Request, res: Response, next: NextFunction) => {
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

server.use('/', (_, res) => {
  res.status(404).send('Not found')
})

const initServer = async () => {
  try {
    await prepareHandler()

    const PORT = process.env.PORT || 8080

    server.listen(PORT, () => {
      Logger.info(`Server listening on port http://localhost:${PORT}`)
      RedisEvents.startupSuccess()
    })
  } catch (err) {
    Logger.error('Error on server init', err)
    RedisEvents.startupError()
  }
}

initServer()
