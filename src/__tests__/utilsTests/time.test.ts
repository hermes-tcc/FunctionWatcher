import { timeDiff } from '../../utils/time'
import moment = require('moment')

jest.mock('moment', () => {
  return jest.fn().mockImplementation(() => {
    return {
      diff: jest.fn(),
    }
  })
})

const s = 1000
const m = 60 * s
const h = 60 * m

test.each([
  [0, '00:00:00.000'],
  [8, '00:00:00.008'],
  [18, '00:00:00.018'],
  [123, '00:00:00.123'],
  [999, '00:00:00.999'],
  [s, '00:00:01.000'],
  [s + 1, '00:00:01.001'],
  [10 * s, '00:00:10.000'],
  [10 * s + 123, '00:00:10.123'],
  [m, '00:01:00.000'],
  [m + 123, '00:01:00.123'],
  [10 * m, '00:10:00.000'],
  [10 * m + 54 * s + 321, '00:10:54.321'],
  [11 * m + 54 * s + 321, '00:11:54.321'],
  [h, '01:00:00.000'],
  [h + 11 * m + 54 * s + 321, '01:11:54.321'],
  [5 * h + 11 * m + 54 * s + 321, '05:11:54.321'],
  [23 * h + 11 * m + 54 * s + 321, '23:11:54.321'],
  [50 * h, '50:00:00.000'],
  [100 * h + 23 * m + 23 * s + 23, '100:23:23.023'],
  [150 * h + 23 * m + 23 * s + 23, '150:23:23.023'],
  [200 * h + 23 * m + 23 * s + 23, '200:23:23.023'],
  [1123 * h + 23 * m + 23 * s + 23, '1123:23:23.023'],
])('Test %p %p', (diff, expected) => {
  // @ts-ignore
  moment.mockImplementation(() => {
    return {
      diff: jest.fn(() => diff),
    }
  })
  const start = moment()
  const end = moment()
  expect(timeDiff(start, end)).toBe(expected)
  expect(start.diff).toBeCalledTimes(0)
  expect(end.diff).toBeCalledTimes(1)
})
