interface Else<Return, LastNext> {
  (this: Block<Return, LastNext>, then: (value: LastNext | undefined) => Return): Omit<Block<Exclude<Return, undefined>, LastNext>, 'else'>
  if: Block<Return, LastNext>['if']
}

class Next {}

class Forfeit<T> {
  value: T

  constructor (value: T) {
    this.value = value
  }
}

interface Proceed<T> {
  next: () => Next
  forfeit: (value: T) => Forfeit<T>
}

// TODO: if.lazy
class Block<Return, Forfeiture> {
  protected readonly steps: Array<[any, (value: any, proceed: Proceed<any>) => any]>
  protected fallback?: (value: Forfeiture | undefined) => Return

  protected runIndex: number
  protected fulfilled: boolean
  protected forfeited: boolean

  protected returnValue: Return | undefined
  protected forfeitValue: Forfeiture | undefined

  protected proceed: Proceed<any>

  else: Else<Return, Forfeiture>

  // The types of condition and value must match but this is a private class so we don't care about constraining the constructor
  constructor (condition: any, then: (value: any, proceed: Proceed<any>) => Return | Next | Forfeit<any>) {
    this.proceed = {
      next: this.next,
      forfeit: this.forfeit
    }

    this.steps = [[condition, then]]

    this.runIndex = 0
    this.fulfilled = false
    this.forfeited = false

    this.else = function (then) {
      this.fallback = then
      this.evaluate()
      return this as any
    } as Else<Return, Forfeiture>
    this.else = this.else.bind(this) as Else<Return, Forfeiture>
    this.else.if = this.if.bind(this) as Else<Return, Forfeiture>['if']

    this.evaluate()
  }

  protected if<T, F, R extends Return | Next | Forfeit<F>> (condition: T, then: (value: T, proceed: Proceed<F>) => R): Block<Return | R, Forfeiture | F> {
    this.steps.push([condition, then])
    this.evaluate()
    return this as any
  }

  protected next () {
    return new Next()
  }

  protected forfeit<F> (value: F) {
    return new Forfeit(value)
  }

  protected evaluate () {
    while (!this.fulfilled && !this.forfeited && this.runIndex < this.steps.length) {
      const step = this.steps[this.runIndex]!
      const condition = step[0]

      if (condition) {
        const value = step[1](condition, this.proceed)

        if (!(value instanceof Next)) {
          if (value instanceof Forfeit) {
            this.forfeitValue = value.value
            this.forfeited = true
          } else {
            this.returnValue = value
            this.fulfilled = true
          }
        }
      }

      ++this.runIndex
    }

    if (!this.fulfilled && this.fallback !== undefined) {
      this.returnValue = this.fallback(this.forfeitValue)
      this.fulfilled = true
    }
  }

  unwrap (): Return {
    if (this.fulfilled) return this.returnValue!
    else return undefined as Return
  }
}

const smart = {
  if<T, F, Return> (condition: T, then: (value: T, proceed: Block<any, any>['proceed']) => Return | Next | Forfeit<F>): Block<Return, F> {
    const block = new Block(condition, then)

    return block as any
  }
}

export default smart
