type GetReturn<T> = Exclude<T, Next | Forfeit<any>> | (Next extends T ? void : never)
type GetForfeiture<T> = T extends Forfeit<infer F> ? F : never

interface Else<Return, Forfeiture, HasAsync extends boolean> {
  /**
   * Perform an "else" operation
   * @param then The "then" clause
   * @returns    The logical block (with only .unwrap() available)
   */
  <NewReturn, R extends NewReturn | Return>(then: (value: Forfeiture | undefined) => R): Omit<Block<Exclude<Return, void> | R, Forfeiture, HasAsync>, 'else'>

  /**
   * Perform an "else if" operation
   * @param
   */
  if: If<Return, Forfeiture, HasAsync>
}

interface ElseExclude<Return, Forfeiture, HasAsync extends boolean, Preserved> {
  exclude: <T, NewReturn, R extends NewReturn | Return>(excluded: T, then: (value: Exclude<T, Preserved> | Forfeiture | undefined) => R) => Omit<Block<Exclude<Return, void> | R, Forfeiture, HasAsync>, 'else' | 'if'>
}

interface If<Return, Forfeiture, HasAsync extends boolean> {
  /**
   * Perform an "if" statement
   * @param condition The condition to evaluate
   * @param then      The "then" clause
   * @returns         The logical block
   */
  <T, F, NewReturn, R extends void | NewReturn | Return | Next | Forfeit<F>>(condition: T, then: (value: T, proceed: Proceed) => R): Block<Return | GetReturn<R>, Forfeiture | GetForfeiture<R>, HasAsync>
  /**
   * Perform an "if" statement lazily (the condition will only be evaluated if all previous conditions failed)
   * @param condition A callback containing the condition to evaluate
   * @param then      The "then" clause
   * @returns         The logical block
   */
  lazy: <T, F, NewReturn, R extends void | NewReturn | Return | Next | Forfeit<F>>(condition: () => T, then: (value: T, proceed: Proceed) => R) => Block<Return | GetReturn<R>, Forfeiture | GetForfeiture<R>, HasAsync>
  /**
   * Perform an "if" statement with preservation (and laziness). This allows you to take advantage of TypeScript's implicit type narrowing\
   * to ensure that the value passed to the "then" clause is sufficiently narrowed.\
   * An example of using this would be a union type with a "type" discriminator property\
   * `smart.if.preserve((fail) => foo.type === 'bar' ? foo : fail)`
   * @param condition The condition to evaluate
   * @param then      The "then" clause
   * @returns         The logical block
   */
  preserve: <T, F, NewReturn, R extends void | NewReturn | Return | Next | Forfeit<F>>(condition: (fail: Failure) => T | Failure, then: (value: T, proceed: Proceed) => R) => Block<Return | GetReturn<R>, Forfeiture | GetForfeiture<R>, HasAsync, T>

  /**
   * Perform an "if" statement on an async function (lazily). Will check if the final resolved value is truthy.\
   * Errors will be caught and treated as falsy
   * @param condition The async condition function to evaluate
   * @param then      The "then" clause
   * @returns         The logical block
   */
  async: <T, F, R extends void | Return | Next | Forfeit<F>>(condition: () => Promise<T>, then: (value: T, proceed: Proceed) => R) => Block<Return | GetReturn<R>, Forfeiture | GetForfeiture<R>, true>
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

type ConditionType = 'regular' | 'lazy' | 'preserve' | 'async'

/**
 * A smart if condition block (chain of conditions)
 */
class Block<Return, Forfeiture, HasAsync extends boolean, Preserved = unknown> {
  static NEXT = new Next()
  static FAILURE = new Failure()

  protected readonly steps: Array<[type: ConditionType, any, (value: any, proceed: Proceed) => any]>
  protected fallback?: (value: any) => any

  protected runIndex: number
  protected fulfilled: boolean
  protected forfeited: boolean
  protected currentlyEvaluatingAsyncCondition: boolean
  protected evaluationPromise: undefined | Promise<void>

  protected returnValue: Return | undefined | void
  protected forfeitValue: Forfeiture | undefined | void

  protected proceed: Proceed

  if: If<Return, Forfeiture, HasAsync>
  else: unknown extends Preserved ? Else<Return, Forfeiture, HasAsync> : Else<Return, Forfeiture, HasAsync> & ElseExclude<Return, Forfeiture, HasAsync, Preserved>

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
    this.currentlyEvaluatingAsyncCondition = false

    this.if = this.insertCondition.bind(this, 'regular') as If<Return, Forfeiture, HasAsync>
    this.if.lazy = this.insertCondition.bind(this, 'lazy') as If<Return, Forfeiture, HasAsync>['lazy']
    this.if.preserve = this.insertCondition.bind(this, 'preserve') as If<Return, Forfeiture, HasAsync>['preserve']
    this.if.async = this.insertCondition.bind(this, 'async') as If<Return, Forfeiture, HasAsync>['async']

    this.else = this.setFallback.bind(this) as typeof this.else
    this.else.if = this.if
    ;(this.else as any).exclude = this.setExcludingFallback.bind(this)
  }

  /**
   * Perform an "if" statement (this is protected because this if will always be called as a .else.if)
   * @param type      The condition type (the way in which the condition is evaluated)
   * @param condition The condition to evaluate
   * @param then      The "then" clause
   * @returns         The logical block
   */
  protected insertCondition<T, F, NewReturn, R extends void | NewReturn | Return | Next | Forfeit<F>> (type: ConditionType, condition: T, then: (value: T, proceed: Proceed) => R): Block<Return | GetReturn<R>, Forfeiture | GetForfeiture<R>, HasAsync> {
    if (type === 'async') this.evaluationPromise ??= Promise.resolve()

    this.steps.push([type, condition, then])
    this.evaluate()
    return this as any
  }

  /**
   * Set a fallback that excludes certain values (can be invoked after .preserve). Sets forfeit value if not already set
   * @param excluded The excluded value to supply to the callback
   * @param then     The "then" clause
   * @returns        The logical block
   */
  protected setExcludingFallback<T, NewReturn, R extends NewReturn | Return> (excluded: T, then: (value: Exclude<T, Preserved> | Forfeiture | undefined) => R): Omit<Block<Exclude<Return, void> | R, Forfeiture, HasAsync>, 'else'> {
    this.forfeitValue ??= excluded as any
    this.fallback = then
    this.evaluate()
    return this as any
  }

  /**
   * Set the fallback behavior if no other conditions are met
   * @param then The behavior
   * @returns    The logical block
   */
  protected setFallback<NewReturn, R extends NewReturn | Return> (then: (value: Forfeiture | undefined) => R): Omit<Block<Exclude<Return, void> | R, Forfeiture, HasAsync>, 'else'> {
    this.fallback = then
    this.evaluate()
    return this as any
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
    if (this.currentlyEvaluatingAsyncCondition) return

    while (!this.fulfilled && !this.forfeited && this.runIndex < this.steps.length) {
      const step = this.steps[this.runIndex]!
      const type = step[0]

      if (type === 'async') {
        const condition = step[1]()
          .catch(() => false)

        this.currentlyEvaluatingAsyncCondition = true
        this.evaluationPromise = (this.evaluationPromise ?? Promise.resolve())
          .then(() => condition)
          .then((result) => {
            step[0] = 'regular'
            step[1] = result

            this.currentlyEvaluatingAsyncCondition = false
            this.evaluate()
          })
        return
      }

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
  unwrap (): HasAsync extends true ? Promise<Awaited<Return>> : Return {
    this.evaluate()

    return (this.evaluationPromise
      ? this.evaluationPromise.then(() => this.fulfilled ? this.returnValue : undefined)
      : this.fulfilled ? this.returnValue : undefined) as ReturnType<typeof this.unwrap>
  }
}

/**
 * Begin a smart if condition chain with an if statement
 * @param condition The condition to check
 * @param then      The "then" clause of the if statement
 * @returns         The condition block to chain operators on
 */
function baseIfRegular<T, F, Return, R extends void | Return | Next | Forfeit<F>> (condition: T, then: (value: T, proceed: Proceed) => R): Block<GetReturn<R>, GetForfeiture<R>, false> {
  const block = new Block<GetReturn<R>, GetForfeiture<R>, false>()
  block.if(condition, then)
  return block
}
/**
 * Perform an "if" statement with preservation (and laziness). This allows you to take advantage of TypeScript's implicit type narrowing\
 * to ensure that the value passed to the "then" clause is sufficiently narrowed.\
 * An example of using this would be a union type with a "type" discriminator property\
 * `smart.if.preserve((fail) => foo.type === 'bar' ? foo : fail)`
 * @param condition The condition to evaluate
 * @param then      The "then" clause of the if statement
 * @returns         The condition block to chain operators on
 */
baseIfRegular.preserve = function baseIfPreserve<T, F, Return, R extends void | Return | Next | Forfeit<F>> (condition: (fail: Failure) => T | Failure, then: (value: Exclude<T, Failure>, proceed: Proceed) => R): Block<GetReturn<R>, GetForfeiture<R>, false, T> {
  const block = new Block<GetReturn<R>, GetForfeiture<R>, false, T>()
  block.if.preserve(condition, then as any)
  return block
}
/**
 * Perform an "if" statement with preservation (and laziness). This allows you to take advantage of TypeScript's implicit type narrowing\
 * to ensure that the value passed to the "then" clause is sufficiently narrowed.\
 * An example of using this would be a union type with a "type" discriminator property\
 * `smart.if.preserve((fail) => foo.type === 'bar' ? foo : fail)`
 * @param condition The condition to evaluate
 * @param then      The "then" clause
 * @returns         The logical block
 */
baseIfRegular.async = function asyncIfPreserve<T, F, Return, R extends void | Return | Next | Forfeit<F>> (condition: () => Promise<T>, then: (value: Exclude<T, Failure>, proceed: Proceed) => R): Block<GetReturn<R>, GetForfeiture<R>, true> {
  const block = new Block<GetReturn<R>, GetForfeiture<R>, true>()
  block.if.lazy(condition, then as any)
  return block
}

const smart = {
  if: baseIfRegular satisfies Omit<If<any, any, any>, 'lazy'>
}

export default smart
export type { Forfeit, Next }
