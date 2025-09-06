import pino from 'pino'
import pinoHttp from 'pino-http'

const logger = pino({ level: process.env.LOG_LEVEL || 'info' })
export const httpLogger = pinoHttp({
  level: process.env.LOG_LEVEL || 'info',
  serializers: {
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res
  }
})
export default logger
