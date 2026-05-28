interface Else<Return, LastNext> {
  (this: Block<Return, LastNext>, then: (value: LastNext | undefined) => Return): Omit<Block<Exclude<Return, undefined>, LastNext>, 'else'>
  if: Block<Return, LastNext>['if']
}

class Next<T> {
  value: T

  constructor (value: T) {
    this.value = value
  }
}

class Block<Return, LastNext> {
  protected readonly steps: Array<[any, (value: any, next: typeof this.next) => any]>
  protected fallback?: (value: LastNext | undefined) => Return
  protected fulfilled: boolean
  protected runIndex: number
  protected lastValue: Return | LastNext | undefined

  else: Else<Return, LastNext>

  // The types of condition and value must match but this is a private class so we don't care about constraining the constructor
  constructor (condition: any, then: (value: any, next: typeof this.next) => Return | Next<any>) {
    this.steps = [[condition, then]]
    this.fulfilled = false
    this.runIndex = 0

    this.else = function (then) {
      this.fallback = then
      this.evaluate()
      return this as any
    } as Else<Return, LastNext>
    this.else.if = this.if as Else<Return, LastNext>['if']
  }

  protected if<T, R extends Return | Next<any>> (condition: T, then: (value: T | LastNext, next: typeof this.next) => R): Next<any> extends R ? Block<Return | Exclude<R, Next<any>>, LastNext | (R extends Next<infer NewNext> ? NewNext : never)> : Block<Return | R, LastNext> {
    this.steps.push([condition, then])
    this.evaluate()
    return this as any
  }

  protected next<V> (value: V) {
    return new Next(value)
  }

  protected evaluate () {
    while (!this.fulfilled && this.runIndex < this.steps.length) {
      const step = this.steps[this.runIndex]!
      const condition = step[0]

      if (condition) {
        const value = step[1](condition, this.next)

        if (value instanceof Next) this.lastValue = value.value
        else {
          this.lastValue = value
          this.fulfilled = true
        }

        ++this.runIndex
      }
    }

    if (this.fallback !== undefined) {
      this.lastValue = this.fallback(this.lastValue as LastNext | undefined)
      this.fulfilled = true
    }
  }

  unwrap (): Return {
    if (this.fulfilled) return this.lastValue as Return
    else return undefined as Return
  }
}

const smart = {
  if<T, Return> (condition: T, then: (value: T, next: Block<any, any>['next']) => Return): Next<any> extends Return ? Block<(Return extends Next<any> ? never : Return) | undefined, (Return extends Next<infer NewNext> ? NewNext : never)> : Block<Return | undefined, never> {
    const block = new Block(condition, then)

    return block as any
  }
}

export default smart
