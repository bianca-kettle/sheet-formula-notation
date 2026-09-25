// Spreadsheet columns are base-26 but with no digit for zero (A=1 ... Z=26, AA=27),
// so the usual base conversion needs a "-1" tucked into each step.

export function columnIndexToLetter(index: number): string {
  if (!Number.isInteger(index) || index < 1) {
    throw new RangeError(`column index must be a positive integer, got ${index}`);
  }
  let n = index;
  let letters = '';
  while (n > 0) {
    const remainder = (n - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

export function columnLetterToIndex(letters: string): number {
  const upper = letters.toUpperCase();
  if (!/^[A-Z]{1,3}$/.test(upper)) {
    throw new RangeError(`not a valid spreadsheet column: ${letters}`);
  }
  let index = 0;
  for (const ch of upper) {
    index = index * 26 + (ch.charCodeAt(0) - 64);
  }
  return index;
}
