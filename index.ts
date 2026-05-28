interface Else<Return, Forfeiture> {
  /**
   * Perform an "else" operation
   * @param then The "then" clause
   * @returns    The logical block (with only .unwrap() available)
   */
  <R extends Return>(this: Block<Return, Forfeiture>, then: (value: Forfeiture | undefined) => void | R): Omit<Block<Return | R, Forfeiture>, 'else'>
  /**
   * Perform an "else if" operation
   * @param
   */
  if: Block<Return, Forfeiture>['if']
}

/**
 * A "Next" operation, telling the block to move onto the next condition step in the chain
 */
class Next {} // eslint-disable-line @typescript-eslint/no-extraneous-class

/**
 * A "Forfeit" operation, telling the block to give up on the chain and jump to the "else"
 */
class Forfeit<T> {
  /** The forfeit value */
  value: T

  /**
   * Construct a forfeiture
   */
  constructor (value: T) {
    this.value = value
  }
}

export interface Proceed<T> {
  /**
   * Return me in a condition clause to skip to the next "else if" clause
   * @returns The operation
   */
  next: () => Next
  /**
   * Return me in a condition clause to skip straight to the "else" clause
   * @param value The value to pass to the else "then" clause
   * @returns     The operation
   */
  forfeit: (value?: T) => Forfeit<T>
}

// TODO: if.lazy
/**
 * A smart if condition block (chain of conditions)
 */
class Block<Return, Forfeiture> {
  protected readonly steps: Array<[any, (value: any, proceed: Proceed<any>) => any]>
  protected fallback?: (value: Forfeiture | undefined) => void | Return

  protected runIndex: number
  protected fulfilled: boolean
  protected forfeited: boolean

  protected returnValue: Return | undefined | void
  protected forfeitValue: Forfeiture | undefined

  protected proceed: Proceed<any>

  else: Else<Return, Forfeiture>

  /**
   * Construct a condition block
   * @note The types of condition and value must match but this is a private class so we don't care about constraining the constructor
   * @param condition The first condition
   * @param then      The first "then" clause
   */
  constructor (condition: any, then: (value: any, proceed: Proceed<any>) => void | Return | Next | Forfeit<any>) {
    this.proceed = {
      next: this.next.bind(this),
      forfeit: this.forfeit.bind(this)
    }

    this.steps = [[condition, then]]

    this.runIndex = 0
    this.fulfilled = false
    this.forfeited = false

    this.else = function (this: Block<Return, Forfeiture>, elsethen: Parameters<Else<Return, Forfeiture>>[0]) {
      this.fallback = elsethen
      this.evaluate()
      return this
    }.bind(this) as unknown as Else<Return, Forfeiture>
    this.else.if = this.if.bind(this)

    this.evaluate()
  }

  /**
   * Perform an "if" statement (this is protected because this if will always be called as a .else.if)
   * @param condition The condition to evaluate
   * @param then      The "then" clause
   * @returns         The logical block
   */
  protected if<T, F, R extends Return | Next | Forfeit<F>> (condition: T, then: (value: T, proceed: Proceed<F>) => void | R): Block<Return | R, Forfeiture | F> {
    this.steps.push([condition, then])
    this.evaluate()
    return this as any
  }

  /**
   * Return a new "next" operation instance
   * @returns The operation
   */
  protected next (): Next {
    return new Next()
  }

  /**
   * Return a new "forfeit" operation instance
   * @param value The value to pass to the else "then" clause
   * @returns     The operation
   */
  protected forfeit<F> (value: F): Forfeit<F> {
    return new Forfeit(value)
  }

  /**
   * Perform the next evaluation steps available in the chain
   */
  protected evaluate (): void {
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

  /**
   * Return the value returned by the evaluated condition clause
   * @returns The final resolved value
   */
  unwrap (): Return {
    if (this.fulfilled) return this.returnValue!
    else return undefined as Return
  }
}

const smart = {
  if<T, F, Return> (condition: T, then: (value: T, proceed: Block<any, any>['proceed']) => void | Return | Next | Forfeit<F>): Block<Return, F> {
    const block = new Block(condition, then)

    return block as any
  }
}

export default smart
export type { Forfeit, Next }
