import { fileExists } from '@hermes-serverless/fs-utils'
import { randomBytes } from 'crypto'
import execa from 'execa'
import fs from 'fs'
import getStream from 'get-stream'
import os from 'os'
import path from 'path'
import RunFileManager from '../../resources/Runner/RunFileManager'
import { Logger } from '../../utils/Logger'

Logger.enabled = false

const tmpPath = path.join(os.tmpdir(), 'run-file-manager-tests')

beforeEach(() => {
  execa.sync('rm', ['-rf', tmpPath])
  if (!fs.existsSync(tmpPath)) fs.mkdirSync(tmpPath, { recursive: true })
})

describe('ioPaths are correct', () => {
  test.each(['in', 'all'])('Test $p', (fileType: any) => {
    const id = randomBytes(8).toString('hex')
    const fm = new RunFileManager(id)
    expect(fm.getIOPath(fileType)).toEqual(`/app/io/${fileType}/${id}`)
  })
})

describe('Files created and read work correctly', () => {
  test.each(['in', 'all'])('createRunWriteStream: %p', async (fileType: any) => {
    const filePath = path.join(tmpPath, fileType)
    const id = randomBytes(8).toString('hex')
    const fm = new RunFileManager(id)
    fm.getIOPath = jest.fn().mockImplementation(() => filePath)
    const s = await fm.createRunWriteStream(fileType)

    expect(s.path).toEqual(filePath)
    expect(fm.getIOPath).toBeCalledTimes(1)
    expect(fm.getIOPath).toHaveBeenCalledWith(fileType)

    s.end('test')
    expect(fileExists(filePath))
  })

  test.each(['in', 'all'])('createRunReadStream: %p', async (fileType: any) => {
    const filePath = path.join(tmpPath, fileType)
    fs.writeFileSync(filePath, `${fileType}`.repeat(10000))

    const id = randomBytes(8).toString('hex')
    const fm = new RunFileManager(id)
    fm.getIOPath = jest.fn().mockImplementation(() => filePath)
    const s = await fm.createRunReadStream(fileType)

    expect(s.path).toEqual(filePath)
    expect(fm.getIOPath).toBeCalledTimes(1)
    expect(fm.getIOPath).toHaveBeenCalledWith(fileType)
    expect(await getStream(s)).toEqual(`${fileType}`.repeat(10000))
  })
})

describe('Delete files work', () => {
  const unlinkMock = jest.fn()
  const fileExistsMock = jest.fn()
  let RunFileManagerMock: typeof RunFileManager
  beforeAll(() => {
    jest.resetModules()
    jest.doMock('fs', () => {
      return {
        promises: {
          unlink: unlinkMock,
        },
      }
    })

    jest.doMock('@hermes-serverless/fs-utils', () => {
      return {
        fileExists: fileExistsMock,
      }
    })

    RunFileManagerMock = require('../../resources/Runner/RunFileManager').default
  })

  afterAll(() => {
    jest.unmock('@hermes-serverless/fs-utils')
    jest.unmock('fs')
  })

  afterEach(() => {
    unlinkMock.mockReset()
    fileExistsMock.mockReset()
  })

  test('Unlink is called correctly', async () => {
    unlinkMock.mockResolvedValue(undefined)
    fileExistsMock.mockResolvedValue(true)
    const id = randomBytes(8).toString('hex')
    const fm = new RunFileManagerMock(id)
    await fm.deleteFiles()
    expect(fileExistsMock).toBeCalledTimes(2)
    expect(fileExistsMock).toHaveBeenNthCalledWith(1, `/app/io/in/${id}`)
    expect(fileExistsMock).toHaveBeenNthCalledWith(2, `/app/io/all/${id}`)
    expect(unlinkMock).toBeCalledTimes(2)
    expect(unlinkMock).toHaveBeenNthCalledWith(1, `/app/io/in/${id}`)
    expect(unlinkMock).toHaveBeenNthCalledWith(2, `/app/io/all/${id}`)
  })

  test('If file doesnt exist doesnt unlink', async () => {
    unlinkMock.mockResolvedValue(undefined)
    fileExistsMock.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    const id = randomBytes(8).toString('hex')
    const fm = new RunFileManagerMock(id)
    await fm.deleteFiles()
    expect(fileExistsMock).toBeCalledTimes(2)
    expect(fileExistsMock).toHaveBeenNthCalledWith(1, `/app/io/in/${id}`)
    expect(fileExistsMock).toHaveBeenNthCalledWith(2, `/app/io/all/${id}`)
    expect(unlinkMock).toBeCalledTimes(1)
    expect(unlinkMock).toHaveBeenNthCalledWith(1, `/app/io/in/${id}`)
  })

  test('Error is catched and ignored', async () => {
    fileExistsMock.mockResolvedValue(true)
    unlinkMock.mockImplementationOnce(() => Promise.resolve()).mockImplementationOnce(() => Promise.reject())
    const id = randomBytes(8).toString('hex')
    const fm = new RunFileManagerMock(id)
    await fm.deleteFiles()
    expect(fileExistsMock).toBeCalledTimes(2)
    expect(fileExistsMock).toHaveBeenNthCalledWith(1, `/app/io/in/${id}`)
    expect(fileExistsMock).toHaveBeenNthCalledWith(2, `/app/io/all/${id}`)
    expect(unlinkMock).toBeCalledTimes(2)
    expect(unlinkMock).toHaveBeenNthCalledWith(1, `/app/io/in/${id}`)
    expect(unlinkMock).toHaveBeenNthCalledWith(2, `/app/io/all/${id}`)
  })
})
