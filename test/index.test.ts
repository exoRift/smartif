import { expect, test, spyOn } from 'bun:test'

import smart, { type Next, type Proceed } from '..'

test('base if statement no unwrap', () => {
  const callbacks = {
    trueCallback: () => {},
    falseCallback: () => {}
  }
  const trueSpy = spyOn(callbacks, 'trueCallback')
  const falseSpy = spyOn(callbacks, 'falseCallback')

  smart.if('truthy', callbacks.trueCallback)
  smart.if(false, callbacks.falseCallback)

  expect(trueSpy, 'true condition ran').toHaveBeenCalledTimes(1)
  expect(trueSpy, 'true condition passed value').toHaveBeenCalledWith('truthy', expect.anything())
  expect(falseSpy, 'false condition did not run').not.toHaveBeenCalled()
})

test('if else (if) statement short circuit', () => {
  const callbacks = {
    firstCallback: () => {},
    secondCallback: () => {}
  }
  const firstSpy = spyOn(callbacks, 'firstCallback')
  const secondSpy = spyOn(callbacks, 'secondCallback')

  smart
    .if(true, callbacks.firstCallback)
    .else.if(false, callbacks.secondCallback)

  expect(firstSpy, 'first condition ran').toHaveBeenCalledTimes(1)
  expect(firstSpy, 'first condition passed value').toHaveBeenCalledWith(true, expect.anything())
  expect(secondSpy, 'second condition did not run').not.toHaveBeenCalled()
})

test('else if statement', () => {
  const callbacks = {
    firstCallback: () => {},
    secondCallback: () => {}
  }
  const firstSpy = spyOn(callbacks, 'firstCallback')
  const secondSpy = spyOn(callbacks, 'secondCallback')

  smart
    .if(false, callbacks.firstCallback)
    .else.if(false, callbacks.secondCallback)

  expect(firstSpy, 'first condition did not run').not.toHaveBeenCalled()
  expect(secondSpy, 'second condition did not run').not.toHaveBeenCalled()

  smart
    .if(false, callbacks.firstCallback)
    .else.if('truthy', callbacks.secondCallback)

  expect(firstSpy, 'first condition did not run').not.toHaveBeenCalled()
  expect(secondSpy, 'second condition ran').toHaveBeenCalledTimes(1)
  expect(secondSpy, 'second condition passed value').toHaveBeenCalledWith('truthy', expect.anything())
})

test('else statement', () => {
  const callbacks = {
    firstCallback: () => {},
    secondCallback: () => {},
    thirdCallback: () => {}
  }
  const firstSpy = spyOn(callbacks, 'firstCallback')
  const secondSpy = spyOn(callbacks, 'secondCallback')
  const thirdSpy = spyOn(callbacks, 'thirdCallback')

  smart
    .if(false, callbacks.firstCallback)
    .else.if(true, callbacks.secondCallback)
    .else(callbacks.thirdCallback)

  expect(firstSpy, 'first condition did not run').not.toHaveBeenCalled()
  expect(secondSpy, 'second condition ran').toHaveBeenCalledTimes(1)
  expect(thirdSpy, 'third condition did not run').not.toHaveBeenCalled()

  secondSpy.mockClear()

  smart
    .if(false, callbacks.firstCallback)
    .else.if(0, callbacks.secondCallback)
    .else(callbacks.thirdCallback)

  expect(firstSpy, 'first condition did not run').not.toHaveBeenCalled()
  expect(secondSpy, 'second condition did not run').not.toHaveBeenCalled()
  expect(thirdSpy, 'third condition ran').toHaveBeenCalledTimes(1)
})

test('next statement', () => {
  const callbacks = {
    firstCallback: (v: any, proceed: Proceed) => { return proceed.next() },
    secondCallback: () => {}
  }
  const firstSpy = spyOn(callbacks, 'firstCallback')
  const secondSpy = spyOn(callbacks, 'secondCallback')

  smart
    .if(true, callbacks.firstCallback)
    .else.if(false, callbacks.secondCallback)

  expect(firstSpy, 'first condition ran').toHaveBeenCalledTimes(1)
  expect(secondSpy, 'second did not not run').not.toHaveBeenCalled()

  firstSpy.mockClear()

  smart
    .if(true, callbacks.firstCallback)
    .else.if(true, callbacks.secondCallback)

  expect(firstSpy, 'first condition ran').toHaveBeenCalledTimes(1)
  expect(secondSpy, 'second condition ran').toHaveBeenCalledTimes(1)
})

test('forfeit statement', () => {
  const callbacks = {
    firstCallback: (v: any, proceed: Proceed) => { return proceed.forfeit('foo') },
    secondCallback: () => {},
    thirdCallback: () => {}
  }
  const firstSpy = spyOn(callbacks, 'firstCallback')
  const secondSpy = spyOn(callbacks, 'secondCallback')
  const thirdSpy = spyOn(callbacks, 'thirdCallback')

  smart
    .if(true, callbacks.firstCallback)
    .else.if(true, callbacks.secondCallback)
    .else(callbacks.thirdCallback)

  expect(firstSpy, 'first condition ran').toHaveBeenCalledTimes(1)
  expect(secondSpy, 'second did not not run').not.toHaveBeenCalled()
  expect(thirdSpy, 'third ran').toHaveBeenCalledTimes(1)
  expect(thirdSpy, 'third supplied forfeit value').toHaveBeenCalledWith('foo')
})

test('value unwrapping', () => {
  expect(
    smart
      .if(123, (v) => v)
      .else.if(456, (v) => v)
      .unwrap(),
    'if statement'
  ).toBe(123)

  expect(
    smart
      .if(0, (v) => v)
      .else.if(456, (v) => v)
      .unwrap(),
    'else if statement'
  ).toBe(456)

  expect(
    smart
      .if(0, (v): number | boolean => v)
      .else.if(false, (v) => v)
      .else(() => 789)
      .unwrap(),
    'else statement'
  ).toBe(789)

  expect(
    smart
      .if(123, (v, proceed): Next | number => proceed.next())
      .else.if(456, (v) => v)
      .else(() => 789)
      .unwrap(),
    'else if statement from next'
  ).toBe(456)

  expect(
    smart
      .if(false, () => 5) // Needed to infer return type number without explicitly setting forfeiture type so that is also implied
      .else.if(123, (v, proceed) => proceed.forfeit(789))
      .else.if(456, (v) => v)
      .else((v) => v ?? 890)
      .unwrap(),
    'else statement from forfeit'
  ).toBe(789)
})

test('preservation', () => {
  type Union = {
    type: 'number'
    field: number
  } | {
    type: 'string'
    field: string
  }

  const foo: Union = {
    type: 'number',
    field: 123
  }

  const ret = smart
    .if.preserve(() => foo, (v) => v.field)
    .unwrap()

  expect(ret, 'Proper value returned').toBe(123)

  const callbacks = {
    failure: () => {}
  }
  const spy = spyOn(callbacks, 'failure')

  smart.if.preserve((fail) => fail, callbacks.failure)

  expect(spy, 'failure does not invoke callback').not.toBeCalled()
})

test('lazy if', () => {
  const shortedConditions = {
    shorted: () => 123
  }
  const shortedSpy = spyOn(shortedConditions, 'shorted')

  smart
    .if(true, () => {})
    .else.if.lazy(shortedConditions.shorted, () => {})

  expect(shortedSpy, 'shorted lazy eval not evaled').not.toHaveBeenCalled()

  const evaledConditions = {
    evaled: () => 123
  }
  const evaledSpy = spyOn(evaledConditions, 'evaled')

  smart
    .if(false, () => {})
    .else.if.lazy(evaledConditions.evaled, () => {})

  expect(evaledSpy, 'shorted lazy eval not evaled').toHaveBeenCalledTimes(1)
})

test('async then clauses', async () => {
  function sleep (ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  const ret = smart
    .if(true, () => sleep(50).then(() => 123))
    .unwrap()

  expect(ret, 'returned value is promise').toBeInstanceOf(Promise)
  expect(await ret, 'promise returns proper value').toBe(123)

  const secondRet = smart
    .if(false, async () => 123)
    .else(async () => await sleep(50).then(() => 456))
    .unwrap()

  expect(secondRet, 'returned value is promise').toBeInstanceOf(Promise)
  expect(await secondRet, 'promise returns proper value').toBe(456)
})

test('async condition clauses', async () => {
  function sleep (ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  const shortedRet = smart
    .if(true, () => 123)
    .else.if.async(async () => await sleep(10), () => 456)
    .unwrap()

  expect(shortedRet, 'returned value is promise').toBeInstanceOf(Promise)
  expect(await shortedRet, 'promise returns proper value').toBe(123)

  const evaledRet = smart
    .if(false, () => 123)
    .else.if.async(async () => true, () => 456)
    .unwrap()

  expect(evaledRet, 'returned value is promise').toBeInstanceOf(Promise)
  expect(await evaledRet, 'promise returns proper value').toBe(456)

  const prom = smart
    .if(false, () => 123)
    .else.if.async(async () => { throw new Error('condition should fail') }, () => 456)
    .else(() => 789)
  await prom.unwrap()

  const erroredRet = smart
    .if(false, () => 123)
    .else.if.async(async () => { throw new Error('condition should fail') }, () => 456)
    .else(() => 789)
    .unwrap()

  expect(erroredRet, 'returned value is promise').toBeInstanceOf(Promise)
  expect(() => erroredRet, 'promise doesn\'t throw').not.toThrow()
  expect(await erroredRet, 'promise returns proper value').toBe(789)
})
