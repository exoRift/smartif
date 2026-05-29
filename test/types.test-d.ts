import { test } from 'bun:test'
import { expectType } from 'tsd'

import smart from '../src'

test('if let type', () => {
  smart
    .if(123, (v) => expectType<number>(v))
    .else.if('foo', (v) => expectType<string>(v))
})

test('if, elseif, else return type', () => {
  const elseRet = smart
    .if(true, () => 123)
    .else.if(true, () => 'foo')
    .else(() => false)

  expectType<number | string | boolean>(elseRet.unwrap())

  const noElseRet = smart
    .if(true, () => 123)
    .else.if(true, () => 'foo')
    .else.if(true, () => false)

  expectType<number | string | boolean | undefined>(noElseRet.unwrap())
})

test('lazy if let type', () => {
  smart
    .if(false, () => {})
    .else.if.lazy(() => 123, (v) => expectType<number>(v))
})

test('preserve if let type', () => {
  type Union = {
    type: 'number'
    field: number
  } | {
    type: 'string'
    field: string
  }

  const foo = {
    type: 'number',
    field: 123
  } as Union

  smart
    .if.preserve((fail) => foo.type === 'number' ? foo : fail, (v) => expectType<number>(v.field))
})

test('preserve -> excluded if let type', () => {
  type Union = {
    type: 'number'
    field: number
  } | {
    type: 'string'
    field: string
  }

  const foo = {
    type: 'number',
    field: 123
  } as Union

  smart
    .if.preserve((fail) => foo.type === 'string' ? foo : fail, (v) => expectType<string>(v.field))
    .else.exclude(foo, (v) => expectType<number>(v.field))
})

test('async if let type', () => {
  smart
    .if.async(async () => Promise.resolve(true), (v) => expectType<boolean>(v))
})

test('forfeit type', () => {
  smart
    .if(true, (_, proceed) => proceed.forfeit('foo'))
    .else((v) => expectType<string | undefined>(v))
})

test('next type is ignored', () => {
  const noElseRet = smart
    .if(Math.random() > 0.5, (_, proceed) => {
      if (Math.random() > 0.5) return proceed.next()
      else return 123 // Lowkey have no idea why this is interpreted by TS as a number literal instead of number but whatever
    })
    .unwrap()

  expectType<123 | void>(noElseRet)

  const elseRet = smart
    .if(Math.random() > 0.5, (_, proceed) => {
      if (Math.random() > 0.5) return proceed.next()
      else return 123
    })
    .else(() => 456)
    .unwrap()

  expectType<number>(elseRet)
})

test('async return type', () => {
  const noElseRet = smart
    .if.async(async () => Promise.resolve(true), () => 'foo')
    .unwrap()

  expectType<Promise<string | undefined>>(noElseRet)

  const elseRet = smart
    .if.async(async () => Promise.resolve(true), () => 'foo')
    .else(() => 'bar')
    .unwrap()

  expectType<Promise<string>>(elseRet)
})
