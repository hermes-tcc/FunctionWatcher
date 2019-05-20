import redis from 'redis'

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

  public static okEvent() {
    RedisEvents.client.publish(RedisEvents.channel, 'OK')
    RedisEvents.log(`Publish OK on ${RedisEvents.channel}`)
  }

  public static errorEvent() {
    RedisEvents.client.publish(RedisEvents.channel, 'ERROR')
    RedisEvents.log(`Publish ERROR on ${RedisEvents.channel}`)
  }

  public static quit() {
    RedisEvents.client.quit()
  }
}

RedisEvents.client.monitor((err, res) => {
  console.log('Redis client entered monitor mode')
})

RedisEvents.client.on('monitor', (time, args, raw_reply) => {
  console.log(`[redis monitor] ${time}: ${args}`)
})
