import { columnIndexToLetter, columnLetterToIndex } from './columns.js';

export interface CellAddress {
  /** 1-based row number, matching how spreadsheets label rows. */
  row: number;
  /** 1-based column number, where A=1, B=2, ... */
  col: number;
}

// Matches an A1-style reference (optional $ before column and/or row) that isn't
// glued to an identifier on either side and isn't immediately followed by "(",
// which would make it a function call like LOG10(...) rather than a cell ref.
const A1_REF = /(?<![A-Za-z0-9_])(\$?)([A-Za-z]{1,3})(\$?)(\d{1,7})(?![A-Za-z0-9_(])/g;

// Matches an R1C1-style reference. R and C are each optionally followed by either
// a bare integer (absolute) or a bracketed signed integer (relative offset).
// A bare "R" or "C" with nothing after it means "same row"/"same column".
const R1C1_REF = /(?<![A-Za-z0-9_])R(\[-?\d+\]|\d+)?C(\[-?\d+\]|\d+)?(?![A-Za-z0-9_])/g;

function assertValidOrigin(origin: CellAddress): void {
  if (!Number.isInteger(origin.row) || origin.row < 1) {
    throw new RangeError(`origin.row must be a positive integer, got ${origin.row}`);
  }
  if (!Number.isInteger(origin.col) || origin.col < 1) {
    throw new RangeError(`origin.col must be a positive integer, got ${origin.col}`);
  }
}

// An unquoted sheet prefix such as Sheet2! or Q1!. Sheet names are free text, so
// a name like Q1 or RC2 looks exactly like a cell reference and has to be
// skipped rather than converted.
const UNQUOTED_SHEET_PREFIX = /([A-Za-z_][A-Za-z0-9_.]*!)/;

// Returns the index just past the closing `quote` of the literal starting at
// `start`. A doubled quote inside the literal is an escaped quote, not the end.
function skipQuoted(formula: string, start: number, quote: string): number {
  let j = start + 1;
  while (j < formula.length) {
    if (formula[j] === quote) {
      if (formula[j + 1] === quote) {
        j += 2;
        continue;
      }
      return j + 1;
    }
    j += 1;
  }
  return j;
}

// Applies `transform` to every part of `formula` that is not a "string literal"
// or a 'quoted sheet name'!, and not an unquoted sheet name before "!". Text in
// those places can look like a cell reference (the formula
// =IF(A1="R1C1","yes","no"), or the sheet in ='Q1 B2'!A1) but is not one.
function mapOutsideStringLiterals(formula: string, transform: (segment: string) => string): string {
  let result = '';
  let i = 0;
  while (i < formula.length) {
    if (formula[i] === '"' || formula[i] === "'") {
      const j = skipQuoted(formula, i, formula[i]);
      result += formula.slice(i, j);
      i = j;
    } else {
      let j = i;
      while (j < formula.length && formula[j] !== '"' && formula[j] !== "'") j += 1;
      const parts = formula.slice(i, j).split(UNQUOTED_SHEET_PREFIX);
      // With a capture group, split puts the matched prefixes at odd indices.
      result += parts.map((part, k) => (k % 2 === 1 ? part : transform(part))).join('');
      i = j;
    }
  }
  return result;
}

function rowOffsetPart(offset: number): string {
  return offset === 0 ? 'R' : `R[${offset}]`;
}

function colOffsetPart(offset: number): string {
  return offset === 0 ? 'C' : `C[${offset}]`;
}

/**
 * Rewrites every A1-style cell reference in `formula` (e.g. B3, $B$3, B$3)
 * into R1C1 style, relative to `origin` — the cell the formula lives in.
 * A `$` on a row or column marks it absolute in A1; that becomes an
 * unbracketed R/C number in R1C1. Everything else becomes a bracketed
 * offset from `origin`.
 */
export function convertA1ToR1C1(formula: string, origin: CellAddress): string {
  assertValidOrigin(origin);
  return mapOutsideStringLiterals(formula, (segment) =>
    segment.replace(A1_REF, (_match, colDollar: string, colLetters: string, rowDollar: string, rowDigits: string) => {
      const col = columnLetterToIndex(colLetters);
      const row = Number(rowDigits);
      const rowPart = rowDollar === '$' ? `R${row}` : rowOffsetPart(row - origin.row);
      const colPart = colDollar === '$' ? `C${col}` : colOffsetPart(col - origin.col);
      return rowPart + colPart;
    }),
  );
}

interface ResolvedAxis {
  value: number;
  absolute: boolean;
}

function resolveAxis(spec: string | undefined, origin: number): ResolvedAxis {
  if (spec === undefined) {
    return { value: origin, absolute: false };
  }
  if (spec.startsWith('[')) {
    const offset = Number(spec.slice(1, -1));
    return { value: origin + offset, absolute: false };
  }
  return { value: Number(spec), absolute: true };
}

/**
 * Rewrites every R1C1-style cell reference in `formula` (e.g. R3C2, RC,
 * R[-1]C[1]) into A1 style, relative to `origin` — the cell the formula
 * lives in. Bracketed numbers are relative offsets from `origin`; bare
 * numbers are absolute rows/columns and come out with a `$`.
 */
export function convertR1C1ToA1(formula: string, origin: CellAddress): string {
  assertValidOrigin(origin);
  return mapOutsideStringLiterals(formula, (segment) =>
    segment.replace(R1C1_REF, (_match, rowSpec: string | undefined, colSpec: string | undefined) => {
      const row = resolveAxis(rowSpec, origin.row);
      const col = resolveAxis(colSpec, origin.col);
      if (row.value < 1 || col.value < 1) {
        throw new RangeError(`reference resolves outside the sheet: row ${row.value}, col ${col.value}`);
      }
      const colLetters = columnIndexToLetter(col.value);
      return `${col.absolute ? '$' : ''}${colLetters}${row.absolute ? '$' : ''}${row.value}`;
    }),
  );
}
