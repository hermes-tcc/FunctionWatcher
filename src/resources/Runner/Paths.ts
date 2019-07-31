import path from 'path'

export type IOFile = 'in' | 'all'

const inBasePath = path.resolve('/', 'app', 'io', 'in')
export const getInBasePath = () => inBasePath

export const ioPaths = {
  in: (runID: string) => path.resolve(inBasePath, runID),
  all: (runID: string) => path.resolve('/', 'app', 'io', 'all', runID),
}
