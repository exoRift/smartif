# Smart If
#### A smarter way to compose if-else blocks in TypeScript, leveraging convenient patterns and sugars from other languages like Rust and Zig

## Installation
`npm i smartif`

## if (let ...) - (comparable to Rust)
The concept of `if ... let` allows you to define a variable localized to the "then" scope of an if statement, assuming the condition holds

### Traditional approach

```ts
// Expensive operation called multiple times or called unnecessarily
if (configPath) {
  const config = loadConfigFile(configPath) // Expensive I/O operation

  if (config && config.database?.url) {
    initializeDatabase(config.database.url) // Have to check config again
  } else if (config && process.env.DATABASE_URL) {
    // Redundant: already checked config above
    initializeDatabase(process.env.DATABASE_URL)
  } else {
    initializeDatabase(DEFAULT_DB_URL)
  }
} else if (process.env.DATABASE_URL) {
  // Code duplication: Same initialization logic repeated
  initializeDatabase(process.env.DATABASE_URL)
} else {
  initializeDatabase(DEFAULT_DB_URL)
}
```

```ts
// Variables leak into outer scope (polluting namespace)
let config: Config | undefined
let dbUrl: string | undefined

if (configPath) {
  config = loadConfigFile(configPath) // Now pollutes the outer scope
}

if (config && config.database?.url) {
  dbUrl = config.database.url
  initializeDatabase(dbUrl)
} else if (process.env.DATABASE_URL) {
  dbUrl = process.env.DATABASE_URL
  initializeDatabase(dbUrl)
}
// config and dbUrl are now in scope everywhere below, even where they're not needed
```

### With smartif

```ts
import smart from 'smartif'

smart
  // No wasted operations: loadConfigFile() only called if configPath is truthy
  .if(configPath && loadConfigFile(configPath), (config) => {
    // Scoped variables: config only exists within this branch
    smart
      .if(config.database?.url, (dbUrl) => {
        // Clearer intent: condition and extracted value are visually connected
        initializeDatabase(dbUrl)
      })
      // No code duplication: initializeDatabase() logic not repeated
      .else.if(process.env.DATABASE_URL, (dbUrl) => {
        initializeDatabase(dbUrl)
      })
      .else(() => {
        initializeDatabase(DEFAULT_DB_URL)
      })
  })
  .else.if(process.env.DATABASE_URL, (dbUrl) => {
    initializeDatabase(dbUrl)
  })
  .else(() => {
    initializeDatabase(DEFAULT_DB_URL)
  })

// config and dbUrl don't pollute the outer scope
```

## if expressions (comparable to Zig)
`if expressions` allow an if statement to evaluate to a value that can be used, similar to a ternary, except it provides a scope for temporary variable definition and cleanup

```ts
import smart from 'smartif'

const ret = smart
  .if(cond1, () => { return 123 })
  .else(() => { return '456' })
  .unwrap()

ret
// ^?: number | string
```

## chain skipping
Chain skipping allows you to abort your logic within a "then" clause and instead move on to the next condition as if this condition were falsy

```ts
import smart from 'smartif'

smart
  .if(user.hasNotificationsOn(), (_, proceed) => {
    const settings = user.getChannelSettings(channel)

    if (settings.muted) return proceed.next() // move onto the `else if` statement (will run if notification.isImportant())

    /* ... */
  })
  .else.if(notification.isImportant(), () => { /* ... */ })
  .else(() => { /* ... */ })
```

## forfeiting
Forfeiting allows you to give up on an entire chain and skip straight to the `else` statement, optionally supplying a value if desired

### Traditional approach

```ts
import smart from 'smartif'

// Requires a callback to be defined that remains in scope
const defaultBehavior = () => {
  // ...
}

if (user.hasNotificationsOn()) {
  const settings = user.getChannelSettings(channel)

  if (settings.muted) defaultBehavior()
  else {
    // ...
  }
} else if (notification.isImportant()) {
  // ...
} else defaultBehavior()
```

### With smartif

```ts
import smart from 'smartif'

smart
  .if(user.hasNotificationsOn(), (_, proceed) => {
    const settings = user.getChannelSettings(channel)

    if (settings.muted) return proceed.forfeit('muted') // move onto the else statement (and provide it with 'muted') (skip the other if)

    /* ... */
  })
  .else.if(notification.isImportant(), () => { /* ... */ })
  .else((v) => {
    v
    // ^?: 'muted' | undefined
  })
```

## lazy evaluation
Lazy evaluation only checks a condition when it's required, thus if your else-if block has a lot of expensive operations you don't want to unnecessarily execute, you can use `if.lazy()`

> [!NOTE]
> Since the first if statement is always evaluated, lazy evaluation doesn't provide any benefit which is why it's not available on the first `if`

```ts
import smart from 'smartif'

smart
  .if(expensiveOperation(), () => { /* ... */ })
  .else.if.lazy(() => otherExpensiveOperation(), () => { /* ... */ })
```

## preserving evaluation
An important feature of TypeScript is type narrowing, which is lost upon entering a callback scope. To facilitate this, you can call `if.preserve`. (lazily evaluated)

```ts
import smart from 'smartif'

type DataPoint = {
  type: 'number'
  field: number
} | {
  type: 'string'
  field: string
}

declare const point: DataPoint

smart
  .if.preserve((fail) => point.type === 'number' ? point : fail, (v) => {
    v
    // ^?: { type: 'number', field: number }
  })
```

After a preserving `if`, you can call `else.exclude` to handle the else case, where the passed value type will be the provided variable type, excluding the preserved type. (This forces the if else block to terminate)

```ts
smart
  .if.preserve((fail) => point.type === 'number' ? point : fail, (v) => {
    v
    // ^?: { type: 'number', field: number }
  })
  .else.exclude(point, (v) => {
    v
    // ^?: { type: 'string', field: string }
  })
```

## async evaluation
Calling `if.async` allows an async condition callback to be supplied (lazily evaluated) which will pass upon an awaited truthy value. Errors are caught and treated as falsy. Calling `if.async` will cause `.unwrap()` to always return a promise.

```ts
import smart from 'smartif'

async function getUser (id): Promise<User | null> {
  // ...
}

const ret = smart
  .if.async(() => getUser(id), (u) => {
    u
    // ^?: User

    return u.name
  })
  .unwrap()

ret
// ^?: User | undefined
```