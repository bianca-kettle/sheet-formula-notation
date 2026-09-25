# sheet-formula-notation

Converts spreadsheet formulas between the two cell reference styles that
Excel and Google Sheets both understand: **A1** (`=SUM(A1:A10)+$B$1`) and
**R1C1** (`=SUM(RC:R[9]C)+R1C2`).

A1 is what everyone sees in the formula bar. R1C1 is what you get from
Excel's COM/VBA API (`Range.FormulaR1C1`), from some export formats, and
it's the only sane way to describe formulas that get filled across a range
with relative references — "the cell one row up, same column" instead of a
different absolute address on every row.

Converting between the two isn't just text substitution: an R1C1 reference
like `R[-1]C` only means something relative to *where the formula lives*.
That's why every function here takes the formula's own cell as an explicit
argument, rather than guessing it.

## Usage

```ts
import { convertA1ToR1C1, convertR1C1ToA1 } from './src/index.js';

// A formula that lives in cell C5 (row 5, column 3)
const origin = { row: 5, col: 3 };

convertA1ToR1C1('=B4+$B$1', origin);
// '=R[-1]C[-1]+R1C2'

convertR1C1ToA1('=R[-1]C[-1]+R1C2', origin);
// '=B4+$B$1'
```

`$` in A1 marks a row or column as absolute; that becomes a bare (unbracketed)
number in R1C1. Everything without a `$` is relative, and comes out as an
offset from the origin cell, e.g. `R[-1]` for "one row up".

Text inside quoted string literals (`"like this"`) is left alone, and
function names that happen to end in digits (`LOG10`, `ATAN2`) are not
mistaken for cell references.

## API

- `convertA1ToR1C1(formula: string, origin: CellAddress): string`
- `convertR1C1ToA1(formula: string, origin: CellAddress): string`
- `columnIndexToLetter(index: number): string` — 1 → `'A'`, 27 → `'AA'`
- `columnLetterToIndex(letters: string): string` — inverse of the above

`CellAddress` is `{ row: number; col: number }`, both 1-based, matching how
spreadsheets label rows and columns. All four functions are pure: same
input, same output, no shared state, which is what makes them easy to unit
test (see `tests/convert.test.ts`).

## Status

Early skeleton. Handles single-cell and range references in both directions.
Not yet handled: sheet-qualified references (`Sheet2!A1`), 3-D ranges, and
whole-row/whole-column references (`R1C1` doesn't have a clean equivalent for
`A:A`). See the project's roadmap for what's next.

## Building

No dependencies, so there's nothing to install. Compile with any TypeScript
compiler you have on hand, e.g. `tsc`, then run the compiled tests with
`node --test dist/tests`.
