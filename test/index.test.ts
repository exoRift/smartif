import { expect, test, spyOn } from 'bun:test'

import smart, { type Proceed } from '..'

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
    firstCallback: (v: any, proceed: Proceed<any>) => { return proceed.next() },
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
    firstCallback: (v: any, proceed: Proceed<any>) => { return proceed.forfeit('foo') },
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
      .if(0, (v) => v)
      .else.if(false, (v) => v)
      .else(() => 789)
      .unwrap(),
    'else statement'
  ).toBe(789)

  expect(
    smart
      .if(123, (v, proceed) => proceed.next())
      .else.if(456, (v) => v)
      .else(() => 789)
      .unwrap(),
    'else if statement from next'
  ).toBe(456)

  expect(
    smart
      .if(123, (v, proceed) => proceed.forfeit(789))
      .else.if(456, (v) => v)
      .else((v) => v)
      .unwrap(),
    'else statement from forfeit'
  ).toBe(789)
})

test.todo('preservation', () => {

})

test.todo('lazy if', () => {

})
