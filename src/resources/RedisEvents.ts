import redis from 'redis'
import { Runner } from './Runner'

const clientMock = {
  quit() {},
  publish() {},
  monitor() {},
  on() {},
}

export class RedisEvents {
  static client =
    process.env.DEBUG === 'true'
      ? clientMock
      : redis.createClient({
          host: 'event-broker',
          port: 6379,
        })

  static channel: string = process.env.REDIS_CHANNEL

  public static log(m: string) {
    if (process.env.DEBUG === 'true') {
      console.log(`[redis mock] ${m}`)
    } else console.log(m)
  }

  private static publish(ev: string) {
    RedisEvents.client.publish(RedisEvents.channel, ev)
    RedisEvents.log(`Publish ${ev} on ${RedisEvents.channel}`)
  }

  public static startupSuccess() {
    this.publish(`STARTUP-SUCCESS [${Runner.getParallelRunsLimit()}]`)
  }

  public static startupError() {
    this.publish('STARTUP-ERROR')
  }

  public static runDone(runId: string) {
    this.publish(`RUN-DONE ${runId}`)
  }

  public static quit() {
    RedisEvents.client.quit()
  }
}
