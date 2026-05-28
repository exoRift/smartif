import { expect, test, spyOn } from 'bun:test'

import smart from '..'

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
