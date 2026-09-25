import { test } from 'node:test';
import assert from 'node:assert/strict';
import { columnIndexToLetter, columnLetterToIndex, convertA1ToR1C1, convertR1C1ToA1 } from '../src/index.js';

test('columnIndexToLetter and columnLetterToIndex round-trip', () => {
  const cases: Array<[number, string]> = [
    [1, 'A'],
    [26, 'Z'],
    [27, 'AA'],
    [52, 'AZ'],
    [703, 'AAA'],
  ];
  for (const [index, letters] of cases) {
    assert.equal(columnIndexToLetter(index), letters);
    assert.equal(columnLetterToIndex(letters), index);
  }
});

test('convertA1ToR1C1 turns relative refs into offsets from the origin', () => {
  const origin = { row: 5, col: 3 }; // C5
  assert.equal(convertA1ToR1C1('=C5', origin), '=RC');
  assert.equal(convertA1ToR1C1('=B4', origin), '=R[-1]C[-1]');
  assert.equal(convertA1ToR1C1('=D6', origin), '=R[1]C[1]');
});

test('convertA1ToR1C1 keeps $ anchored parts absolute', () => {
  const origin = { row: 5, col: 3 };
  assert.equal(convertA1ToR1C1('=$B$4', origin), '=R4C2');
  assert.equal(convertA1ToR1C1('=B$4', origin), '=R4C[-1]');
  assert.equal(convertA1ToR1C1('=$B4', origin), '=R[-1]C2');
});

test('convertA1ToR1C1 handles ranges and multiple refs in one formula', () => {
  const origin = { row: 1, col: 1 }; // A1
  assert.equal(convertA1ToR1C1('=SUM(A1:A10)+$B$1', origin), '=SUM(RC:R[9]C)+R1C2');
});

test('convertA1ToR1C1 leaves string literals untouched', () => {
  const origin = { row: 1, col: 1 };
  assert.equal(convertA1ToR1C1('=IF(A1="B2","yes","no")', origin), '=IF(RC="B2","yes","no")');
});

test('convertA1ToR1C1 does not mistake function names for references', () => {
  const origin = { row: 1, col: 1 };
  assert.equal(convertA1ToR1C1('=LOG10(A1)+ATAN2(1,B2)', origin), '=LOG10(RC)+ATAN2(1,R[1]C[1])');
});

test('convertR1C1ToA1 is the inverse of convertA1ToR1C1', () => {
  const origin = { row: 5, col: 3 };
  const samples = ['=RC', '=R[-1]C[-1]', '=R4C2', '=R4C[-1]', '=R[-1]C2'];
  for (const formula of samples) {
    const a1 = convertR1C1ToA1(formula, origin);
    assert.equal(convertA1ToR1C1(a1, origin), formula);
  }
});

test('convertR1C1ToA1 rejects references that resolve off the sheet', () => {
  assert.throws(() => convertR1C1ToA1('=R[-1]C', { row: 1, col: 1 }), RangeError);
});
