export class InvalidHandler extends Error {
  constructor(msg: string) {
    super(msg)
  }
}

export class MaxOutputSizeReached extends Error {
  constructor(maxSize: number) {
    super(`Max output size reached: ${maxSize}`)
  }
}

export class NonZeroReturnCode extends Error {
  constructor(retCode: number) {
    super(`Process returned non zero: ${retCode}`)
  }
}
