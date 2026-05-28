type GetReturn<T> = Exclude<T, Next | Forfeit<any>>
type GetForfeiture<T> = T extends Forfeit<infer F> ? F : never

interface Else<Return, Forfeiture> {
  /**
   * Perform an "else" operation
   * @param then The "then" clause
   * @returns    The logical block (with only .unwrap() available)
   */
  <R extends Return>(this: Block<Return, Forfeiture>, then: (value: Forfeiture | undefined) => R): Omit<Block<Return | R, Forfeiture>, 'else'>
  /**
   * Perform an "else if" operation
   * @param
   */
  if: If<Return, Forfeiture>
}

interface If<Return, Forfeiture> {
  /**
   * Perform an "if" statement
   * @param condition The condition to evaluate
   * @param then      The "then" clause
   * @returns         The logical block
   */
  <T, F, R extends void | Return | Next | Forfeit<F>>(condition: T, then: (value: T, proceed: Proceed) => R): Block<Return | GetReturn<R>, Forfeiture | GetForfeiture<R>>
  /**
   * Perform an "if" statement lazily (the condition will only be evaluated if all previous conditions failed)
   * @param condition A callback containing the condition to evaluate
   * @param then      The "then" clause
   * @returns         The logical block
   */
  lazy: <T, F, R extends void | Return | Next | Forfeit<F>>(condition: () => T, then: (value: T, proceed: Proceed) => R) => Block<Return | GetReturn<R>, Forfeiture | GetForfeiture<R>>
  /**
   * Perform an "if" statement with preservation. This allows you to take advantage of TypeScript's implicit type narrowing\
   * to ensure that the value passed to the "then" clause is sufficiently narrowed.\
   * An example of using this would be a union type with a "type" discriminator property\
   * `smart.if.preserve((fail) => foo.type === 'bar' ? foo : fail)`
   * @param condition The condition to evaluate
   * @param then      The "then" clause
   * @returns         The logical block
   */
  preserve: <T, F, R extends void | Return | Next | Forfeit<F>>(condition: (fail: Failure) => T | Failure, then: (value: T, proceed: Proceed) => R) => Block<Return | GetReturn<R>, Forfeiture | GetForfeiture<R>>
}

/**
 * A "Next" operation, telling the block to move onto the next condition step in the chain
 */
class Next {
  __brand = 'next'
}

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

/**
 * A "Failure" operation, used for preserving if conditions
 */
class Failure {
  __brand = 'failure'
}

export interface Proceed {
  /**
   * Return me in a condition clause to skip to the next "else if" clause
   * @returns The operation
   */
  next: () => Next
  /**
   * Return me in a condition clause to skip straight to the "else" clause
   * @note Weird type signature to force 1 param whilst making it optional with type inference + forced matching
   * @param value The value to pass to the else "then" clause
   * @returns     The operation
   */
  forfeit: <F extends [any] | []>(...value: F) => Forfeit<F[0]>
}

type ConditionType = 'regular' | 'lazy' | 'preserve'

/**
 * A smart if condition block (chain of conditions)
 */
class Block<Return, Forfeiture> {
  static NEXT = new Next()
  static FAILURE = new Failure()

  protected readonly steps: Array<[type: ConditionType, any, (value: any, proceed: Proceed) => any]>
  protected fallback?: (value: Forfeiture | undefined) => void | Return

  protected runIndex: number
  protected fulfilled: boolean
  protected forfeited: boolean

  protected returnValue: Return | undefined | void
  protected forfeitValue: Forfeiture | undefined

  protected proceed: Proceed

  if: If<Return, Forfeiture>
  else: Else<Return, Forfeiture>

  /**
   * Construct a condition block
   */
  constructor () {
    this.steps = []
    this.proceed = {
      next: this.next.bind(this),
      forfeit: this.forfeit.bind(this)
    }

    this.runIndex = 0
    this.fulfilled = false
    this.forfeited = false

    this.if = this.insertCondition.bind(this, 'regular') as If<Return, Forfeiture>
    this.if.lazy = this.insertCondition.bind(this, 'lazy') as If<Return, Forfeiture>['lazy']
    this.if.preserve = this.insertCondition.bind(this, 'preserve') as If<Return, Forfeiture>['preserve']

    this.else = this.setFallback.bind(this) as Else<Return, Forfeiture>
    this.else.if = this.if
  }

  /**
   * Perform an "if" statement (this is protected because this if will always be called as a .else.if)
   * @param type      The condition type (the way in which the condition is evaluated)
   * @param condition The condition to evaluate
   * @param then      The "then" clause
   * @returns         The logical block
   */
  protected insertCondition<T, F, R extends void | Return | Next | Forfeit<F>> (type: ConditionType, condition: T, then: (value: T, proceed: Proceed) => R): Block<Return | GetReturn<R>, Forfeiture | GetForfeiture<R>> {
    this.steps.push([type, condition, then])
    this.evaluate()
    return this as any
  }

  /**
   * Set the fallback behavior if no other conditions are met
   * @param then The behavior
   * @returns    The logical block
   */
  protected setFallback<R extends Return> (then: (value: Forfeiture | undefined) => R): Omit<Block<Return | R, Forfeiture>, 'else'> {
    this.fallback = then
    this.evaluate()
    return this
  }

  /**
   * Return a new "next" operation instance
   * @returns The operation
   */
  protected next (): Next {
    return Block.NEXT
  }

  /**
   * Return a new "forfeit" operation instance
   * @note Weird type signature to force 1 param whilst making it optional with type inference + forced matching
   * @param value The value to pass to the else "then" clause
   * @returns     The operation
   */
  protected forfeit<F extends [any] | []> (...value: F): Forfeit<F[0]> {
    return new Forfeit(value[0])
  }

  /**
   * Perform the next evaluation steps available in the chain
   */
  protected evaluate (): void {
    while (!this.fulfilled && !this.forfeited && this.runIndex < this.steps.length) {
      const step = this.steps[this.runIndex]!
      const type = step[0]
      let condition
      switch (type) {
        case 'regular': condition = step[1]; break
        case 'lazy': condition = step[1](); break
        case 'preserve': condition = step[1](Block.FAILURE); break
      }

      if (condition && (type !== 'preserve' || !(condition instanceof Failure))) {
        const value = step[2](condition, this.proceed)

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
    this.evaluate()
    if (this.fulfilled) return this.returnValue as Return
    else return undefined as Return
  }
}

/**
 * Begin a smart if condition chain with an if statement
 * @param condition The condition to check
 * @param then      The "then" clause of the if statement
 * @returns         The condition block to chain operators on
 */
function baseIfRegular<T, F, Return, R extends void | Return | Next | Forfeit<F>> (condition: T, then: (value: T, proceed: Proceed) => R): Block<GetReturn<R>, GetForfeiture<R>> {
  const block = new Block<GetReturn<R>, GetForfeiture<R>>()
  block.if(condition, then as any)
  return block
}
/**
 * Perform an "if" statement with preservation. This allows you to take advantage of TypeScript's implicit type narrowing\
 * to ensure that the value passed to the "then" clause is sufficiently narrowed.\
 * An example of using this would be a union type with a "type" discriminator property\
 * `smart.if.preserve((fail) => foo.type === 'bar' ? foo : fail)`
 * @param condition The condition to evaluate
 * @param then      The "then" clause of the if statement
 * @returns         The condition block to chain operators on
 */
baseIfRegular.preserve = function baseIfPreserve<T, F, Return, R extends void | Return | Next | Forfeit<F>> (condition: (fail: Failure) => T | Failure, then: (value: Exclude<T, Failure>, proceed: Proceed) => R): Block<GetReturn<R>, GetForfeiture<R>> {
  const block = new Block<GetReturn<R>, GetForfeiture<R>>()
  block.if.preserve(condition, then as any)
  return block
}

const smart = {
  if: baseIfRegular/*  satisfies Omit<If<any, any>, 'lazy'> */
}

export default smart
export type { Forfeit, Next }
