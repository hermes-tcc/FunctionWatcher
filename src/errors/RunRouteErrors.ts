import { RouteError } from './RouteError'

export class FieldsLimitExceeded extends Error {
  constructor(fieldType: string, fieldNumber: number) {
    super(`The body is allowed to have ${fieldNumber} ${fieldType}`)
  }
}

export class TruncatedField extends Error {
  constructor(fieldname?: string) {
    if (fieldname) super(`Data for field ${fieldname} is truncated`)
    else super(`A fieldname is truncated`)
  }
}

export class FieldnameSizeExceeded extends Error {
  constructor(limit: number) {
    super(`Fieldname size exceeded. Size limit is ${limit}`)
  }
}

export class FileSizeExceeded extends Error {
  constructor(limit: number) {
    super(`File size exceeded. Size limit is ${limit}`)
  }
}

export class RunIDAlreadyExists extends Error {
  constructor(runID: string) {
    super(`RunID ${runID} already exists`)
  }
}

export class UnsupportedContentType extends Error {
  constructor() {
    super(`Missing content type or unsupported content type.`)
  }
}

export class ParsingErrors extends RouteError {
  constructor(errors: Error[]) {
    super({
      errorName: 'ParsingErrors',
      statusCode: 400,
      message: 'Errors occured when parsing the body given',
      detail: {
        errors: errors.map(el => {
          return `${el.name}: ${el.message}`
        }),
      },
    })
  }
}

export class MissingInputField extends RouteError {
  constructor() {
    super({
      errorName: 'MissingInputField',
      message:
        'Missing input field in the body: Format should be $input: [string or file]. If there is no input string should be empty',
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

export class ReportNotReady extends RouteError {
  constructor(runID: string) {
    super({
      errorName: 'ReportNotReady',
      message: `The report for run ${runID} is not ready yet`,
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

export class RunBeingDeleted extends RouteError {
  constructor(id: string) {
    super({
      errorName: 'RunBeingDeleted',
      message: `Run ${id} is in delete process`,
      statusCode: 409,
    })
  }
}
