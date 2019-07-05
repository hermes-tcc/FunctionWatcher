import redis from 'redis'
import { Waiter } from '../utils/CustomPromises'
import { Logger } from '../utils/Logger'
import { Runner } from './Runner'

const clientMock = {
  quit(callback: () => void) {
    callback()
  },
  publish() {},
  monitor() {},
  on() {},
}

export class RedisEvents {
  private static client =
    process.env.DEBUG === 'true'
      ? clientMock
      : redis.createClient({
          host: 'event-broker',
          port: 6379,
        })

  private static channel: string = process.env.REDIS_CHANNEL

  public static log = (m: string) => {
    if (process.env.DEBUG === 'true') {
      console.log(`[redis mock] ${m}`)
    } else console.log(m)
  }

  private static publish = (ev: string) => {
    RedisEvents.client.publish(RedisEvents.channel, ev)
    RedisEvents.log(`Publish ${ev} on ${RedisEvents.channel}`)
  }

  public static startupSuccess = () => {
    RedisEvents.publish(`STARTUP-SUCCESS [${Runner.getParallelRunsLimit()}]`)
  }

  public static startupError = () => {
    RedisEvents.publish('STARTUP-ERROR')
  }

  public static runDone = (runID: string) => {
    RedisEvents.publish(`RUN-DONE ${runID}`)
  }

  public static shutdown = () => {
    const done = new Waiter()
    RedisEvents.client.quit(() => {
      Logger.info('[RedisEvents] Shutdown redis')
      done.resolve()
    })
    return done.finish()
  }
}
