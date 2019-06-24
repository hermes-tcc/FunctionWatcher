import { Moment } from 'moment'

export const timeDiff = (start: Moment, end: Moment) => {
  const padZero = (n: number) => {
    return n < 10 ? `0${n}`.slice(-2) : n
  }

  let diff = end.diff(start)

  const ms = diff % 1000
  diff = (diff - ms) / 1000

  const s = diff % 60
  diff = (diff - s) / 60

  const m = diff % 60
  diff = (diff - m) / 60

  const h = diff % 60
  diff = (diff - h) / 60

  return `${padZero(h)}:${padZero(m)}:${padZero(s)}.${ms}`
}
