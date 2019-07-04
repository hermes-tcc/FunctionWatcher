import { Server } from 'http'
import { MAX_IDLE_TIME } from './limits/index'
import { RedisEvents } from './resources/RedisEvents'
import { serverProto } from './serverProto'
import { prepareHandler } from './utils/functionHandler'
import { Logger } from './utils/Logger'

export class WatcherServer {
  private static server: Server
  private static timer: NodeJS.Timeout

  public static setServer = (server: Server) => {
    WatcherServer.server = server
  }

  public static startTimer = () => {
    Logger.info('[WatcherServer] Start timer')
    WatcherServer.timer = setTimeout(WatcherServer.shutdown, MAX_IDLE_TIME)
  }

  public static stopTimer = () => {
    Logger.info('[WatcherServer] Stop timer')
    clearTimeout(WatcherServer.timer)
  }

  public static shutdown = async () => {
    WatcherServer.stopTimer()
    Logger.info('[WatcherServer] Shutting down')
    WatcherServer.server.close(err => {
      if (err) {
        Logger.info(`[WatcherServer] Server close error`, err)
        return process.exit(1)
      }

      Logger.info('[WatcherServer] Server closed')
    })
  }

  public static start = async () => {
    try {
      await prepareHandler()
      const PORT = process.env.PORT || 8080
      WatcherServer.setServer(
        serverProto.listen(PORT, () => {
          Logger.info(`Server listening on port http://localhost:${PORT}`)
          RedisEvents.startupSuccess()
          WatcherServer.startTimer()
        })
      )
    } catch (err) {
      Logger.error('Error on server init', err)
      RedisEvents.startupError()
    }
  }
}
