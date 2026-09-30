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

test('sheet-qualified references convert but the sheet name is left alone', () => {
  const origin = { row: 5, col: 3 };
  assert.equal(convertA1ToR1C1('=Sheet2!B4', origin), '=Sheet2!R[-1]C[-1]');
  assert.equal(convertA1ToR1C1("='Q1 B2'!$B$4", origin), "='Q1 B2'!R4C2");
  assert.equal(convertA1ToR1C1("='It''s A1'!B4", origin), "='It''s A1'!R[-1]C[-1]");
  assert.equal(convertA1ToR1C1('=Q1!B4+B4', origin), '=Q1!R[-1]C[-1]+R[-1]C[-1]');
  assert.equal(convertA1ToR1C1('=SUM(Data!A1:A3)', { row: 1, col: 1 }), '=SUM(Data!RC:R[2]C)');
});

test('convertR1C1ToA1 leaves sheet names that look like references alone', () => {
  const origin = { row: 5, col: 3 };
  assert.equal(convertR1C1ToA1('=RC2!R[-1]C[-1]', origin), '=RC2!B4');
  assert.equal(convertR1C1ToA1("='R1C1'!R4C2", origin), "='R1C1'!$B$4");
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
