import { Moment } from 'moment'

export const timeDiff = (start: Moment, end: Moment) => {
  const padZero = (n: number, size: number) => {
    let s = n.toString(10)
    while (s.length < size) s = `0${s}`
    return s
  }

  let diff = end.diff(start)

  const ms = diff % 1000
  diff = (diff - ms) / 1000

  const s = diff % 60
  diff = (diff - s) / 60

  const m = diff % 60
  diff = (diff - m) / 60

  const h = diff

  return `${padZero(h, 2)}:${padZero(m, 2)}:${padZero(s, 2)}.${padZero(ms, 3)}`
}
