import { Request } from 'express'
import { Run } from './resources/Runner/Run'

export interface ReqWithRun extends Request {
  run: Run
}
