export interface ReadableWithTruncatedFlag extends NodeJS.ReadableStream {
  truncated?: boolean
}

export interface BusboyLimits {
  fieldNameSize?: number
  fieldSize?: number
  fields?: number
  fileSize?: number
  files?: number
  parts?: number
  headerPairs?: number
}

export interface FileInfo {
  filename: string
  path: string
  size: number
}
