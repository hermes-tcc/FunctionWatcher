import { fileExists } from '@hermes-serverless/fs-utils'
import fs from 'fs'
import path from 'path'
import { InvalidHandler } from '../errors/RunnerErrors'

export const getHandlerPath = () => {
  const functionPath = path.join('/', 'app', 'function')
  const hermesConf = JSON.parse(
    fs.readFileSync(path.join(functionPath, 'hermes.config.json'), { encoding: 'utf-8' })
  )
  return path.join(functionPath, hermesConf.handler)
}

export const prepareHandler = async () => {
  const handlerPath = getHandlerPath()
  const handlerExist = await fileExists(handlerPath)
  if (!handlerExist) throw new InvalidHandler(`Handler doesn't exist.`)
  const stats = fs.statSync(handlerPath)
  if (!stats.isFile()) throw new InvalidHandler(`Handler should be a file.`)
  fs.chmodSync(handlerPath, 755)
}
