
## General Rules

- Act based on facts. If you are unsure, state your assumptions.
- Write the minimum code that solves the problem.
- Documents should be always in English.

## Implementation Rules

- Names matter. Always check that class/method/variable names are intentionally revealing. (Long names are fine)
- Always keep the DRY principle to make the code simple and clean.
- When adding a new feature, ensure it is covered by unit tests.

## Key Gotchas

- Timeout on import — Check your dependency order. Try `read_screen` for details (a Pharo debugger window has likely opened).
- **No `eval` hack** for resolving imports: Tonel files should be safely imported via the `st-import` skill. Preparing package loading code yourself could be dangerous.
