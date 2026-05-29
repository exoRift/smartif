# Smart If
#### A smarter way to compose if-else blocks in TypeScript, leveraging convenient patterns and sugars from other languages like Rust and Zig

## if (let ...) - Rust
```ts
import smart from 'smartif'

// Assume that `users.lookup()` is an expensive operation
// If we want to see if a user is authorized, we have to checked if they've provided an email, then look up the user,
// and finally get their admin status. If the user hasn't provided an email, we don't want to bother with lookups

// ################### EXAMPLE 1 ###################
if (email && (users.lookup(email)?.getIsGlobalAdmin() || users.lookup(email)?.getGroup(group))) {
  // We don't have access to the user object or the group in this scope
  // We can't define variables above because we don't know if email is supplied and we don't want to run lookup unnecessarily
}
// #################################################

// ################### EXAMPLE 2 ###################
if (email) {
  const user = users.lookup(email)
  const settings = getSettings()

  if (user.getIsGlobalAdmin()) {
    // We now have the user object, but the code is messy and managing the control group can be difficult, especially as complexity scales
  } else if (user?.getGroup(group).admin) {
    // Once again, we don't have the group here, but don't want to get it above because we only need if if the user is not a global admin
  }
} else if (authorizedGuest) {
  // We don't have access to settings and need to call the function again (duplicate code).
  // Moving the call above the statements is out of the question because it's only needed if either of these conditions are satisfied
}
// #################################################

// ################ SMARTIF EXAMPLE ################
// This example is a bit contrived and possibly more complicated than those above, but its purpose is to to showcase the API
smart
  .if(email && users.lookup(email), (user) => {
    // user is defined
    smart
      .if(user?.getIsGlobalAdmin(), () => { /* ... */ })
      .else.if(user?.getGroup(group), (group) => {
        if (group.admin) {
          /* ... */
        }
      })
  })
  .else.if(authorizedGuest, () => { /* ... */ })
  .else(() => { /* ... */ })
// #################################################
```

## if expressions - Zig

## chain skipping

## forfeiting

## lazy evaluation

## preserving evaluation

## async evaluation