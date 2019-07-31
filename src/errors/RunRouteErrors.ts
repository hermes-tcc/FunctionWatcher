import { RouteError } from './RouteError'

export class RunIDAlreadyExists extends Error {
  constructor(runID: string) {
    super(`RunID ${runID} already exists`)
  }
}

export class MissingHeaderRunID extends RouteError {
  constructor() {
    super({
      errorName: 'MissingHeaderRunID',
      message: 'Missing header x-run-id',
      statusCode: 400,
    })
  }
}

export class NoSuchRun extends RouteError {
  constructor(id: string) {
    super({
      errorName: 'NoSuchRun',
      message: `Run ${id} doesn't exist`,
      statusCode: 404,
    })
  }
}

export class ProcessNotFinished extends RouteError {
  constructor(runID: string) {
    super({
      errorName: 'ProcessNotFinished',
      message: `The run ${runID} is not finished yet`,
      statusCode: 409,
    })
  }
}

export class RunsLimitReached extends RouteError {
  constructor(limit: number) {
    super({
      errorName: 'RunsLimitReached',
      message: `Runs limit[${limit}] reached for this server`,
      statusCode: 400,
    })
  }
}
