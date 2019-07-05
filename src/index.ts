import { Logger } from './utils/Logger'
import { WatcherServer } from './WatcherServer'

process.on('exit', code => {
  Logger.info(`About to exit with code: ${code}`)
})

WatcherServer.start()
