import { executeRoute } from './routes/execute'
import { RedisEvents } from './resources/RedisEvents'
import express from 'express'
import morgan from 'morgan'

try {
  const server = express()

  server.use(express.json())
  server.use(morgan('dev'))

  server.use('/execute', executeRoute)
  server.use('/', (_, res) => {
    res.status(404).send('Not found')
  })

  const PORT = process.env.PORT || 8080
  server.listen(PORT, () => {
    console.log(`Server listening on port http://localhost:${PORT}`)
    RedisEvents.okEvent()
  })
} catch (e) {
  console.log(e)
  RedisEvents.errorEvent()
}
