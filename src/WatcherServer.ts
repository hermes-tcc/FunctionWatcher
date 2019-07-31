import { Waiter } from '@hermes-serverless/custom-promises'
import { Server } from 'http'
import wtfnode from 'wtfnode'
import { RedisEvents } from './resources/RedisEvents'
import { serverProto } from './serverProto'
import { prepareHandler } from './utils/functionHandler'
import { Logger } from './utils/Logger'

export class WatcherServer {
  private static server: Server

  public static setServer = (server: Server) => {
    WatcherServer.server = server
  }

  public static shutdown = () => {
    const done = new Waiter()
    Logger.info('[WatcherServer] Shutting down')
    WatcherServer.server.close(async err => {
      if (err) {
        Logger.info(`[WatcherServer] Server close error`, err)
        done.reject(err)
        return process.exit(1)
      }

      Logger.info('[WatcherServer] Server closed')
      await RedisEvents.shutdown()
      done.resolve()
      wtfnode.dump()
    })

    return done.finish()
  }

  public static start = async () => {
    const done = new Waiter()
    try {
      await prepareHandler()
      const PORT = process.env.PORT || 8080
      WatcherServer.setServer(
        serverProto.listen(PORT, () => {
          Logger.info(`Server listening on port http://localhost:${PORT}`)
          RedisEvents.startupSuccess()
          done.resolve()
        })
      )
    } catch (err) {
      Logger.error('Error on server init', err)
      RedisEvents.startupError()
      done.reject()
    }

    await done.finish()
  }
}
