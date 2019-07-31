import { Waiter } from '@hermes-serverless/custom-promises'
import axios from 'axios'
import { randomBytes } from 'crypto'
import queryString from 'querystring'
import request, { RequestCallback } from 'request'
import { PassThrough } from 'stream'

interface RequestStatusArgs {
  runID: string
  port: number
  which?: any
}

export const setup = (port: number, runType: 'sync' | 'async', cb?: RequestCallback) => {
  const runID = randomBytes(8).toString('hex')
  const s = new PassThrough()
  const wait = new Waiter()
  const callback = async (err: any, res: request.Response, body: any) => {
    try {
      if (cb) await cb(err, res, body)
      wait.resolve()
    } catch (err) {
      wait.reject(err)
    }
  }
  const req = request.post(`http://localhost:${port}/run/${runType}`, { headers: { 'x-run-id': runID } }, callback)
  s.pipe(req)
  return { s, req, runID, wait }
}

export const wrongSetup = (port: number, runType: 'sync' | 'async', cb?: RequestCallback) => {
  const s = new PassThrough()
  const wait = new Waiter()
  const callback = async (err: any, res: request.Response, body: any) => {
    try {
      if (cb) await cb(err, res, body)
      wait.resolve()
    } catch (err) {
      wait.reject(err)
    }
  }
  const req = request.post(`http://localhost:${port}/run/${runType}`, callback)
  s.pipe(req)
  return { s, req, wait }
}

export const requestKill = async (runID: string, port: number) => {
  const res = await axios.post(`http://localhost:${port}/run/${runID}/kill`)
  return res.data
}

export const requestDelete = async (runID: string, port: number): Promise<any> => {
  const res = await axios.delete(`http://localhost:${port}/run/${runID}/delete`)
  return res.data
}

export const requestResultInfo = async (runID: string, port: number): Promise<any> => {
  const res = await axios.get(`http://localhost:${port}/run/${runID}/result/info`)
  return res.data
}

export const requestResultOutput = async (runID: string, port: number): Promise<any> => {
  const res = await axios.get(`http://localhost:${port}/run/${runID}/result/output`)
  return res.data
}

export const requestStatus = async ({ runID, port, which }: RequestStatusArgs): Promise<any> => {
  const res = await axios.get(`http://localhost:${port}/run/${runID}/status?` + queryString.stringify(which || []))
  return res.data
}

export const sleep = (ms: number) => {
  const wait = new Waiter()
  setTimeout(wait.resolve, ms)
  return wait.finish()
}
