# Anti-Patterns Checklist

Check code against these patterns during Pass 1 (Quality). These are commonly produced by AI-generated code and frequently missed in review. This is a living document — add new patterns as they are identified.

## Error Handling
- Swallowed exceptions with generic fallbacks (catch → console.log → return default value)
- Try/catch wrapping entire functions instead of specific risky operations
- Returning null/undefined instead of throwing when callers need to know about failure
- Empty catch blocks or catch blocks that only re-throw without additional context
- Catching broad exception types (Exception, Error) when specific types are available

## Over-Engineering
- Factory/strategy/builder patterns for single-use cases
- Abstract base classes with only one implementation
- Dependency injection containers in scripts with 3 dependencies
- Configuration objects for values that never change
- Generic type parameters that are always the same concrete type
- Wrapper classes that add no behavior (pass-through delegation)

## Dead Code & Cargo Cult
- Backward-compatibility shims for code that was just written
- Feature flags for features that are always on
- Commented-out code blocks "for reference"
- Unused imports, variables, functions left behind after refactoring
- Re-exporting removed types/functions as undefined
- Copied boilerplate (logging setup, error handlers) that doesn't match the project's existing patterns

## False Safety
- Null checks on values that can't be null (TypeScript strict mode, required fields, just-constructed objects)
- Validation at internal boundaries (function A validates, passes to function B, B re-validates the same thing)
- Defensive copies of immutable data
- Type assertions immediately after type guards that already narrowed the type
- Optional chaining on values that are guaranteed to exist by the surrounding logic

## Documentation
- Over-commenting obvious code (`// increment counter` above `counter++`)
- Under-commenting tricky code (complex regex, bit manipulation, non-obvious algorithms)
- JSDoc that restates the function name (`@description Gets the user` on `getUser()`)
- TODO comments with no context, owner, or tracking reference
- Comments describing what code does instead of why (the code already says what)

## Structure
- God functions (>50 lines doing multiple unrelated things)
- Premature abstraction (helper/utility created for a single call site)
- Deep nesting (>3 levels of if/for/try — flatten with early returns or extraction)
- Inconsistent patterns across the codebase (some files use pattern X, others use Y for the same thing)
- Mixing concerns in a single function (I/O + business logic + formatting)
