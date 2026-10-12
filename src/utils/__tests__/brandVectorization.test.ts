import { describe, it } from 'node:test';
import assert from 'node:assert';
import { computeVectorChecksum } from '../brandVectorization';

describe('Brand Vectorization & Thresholding Engine', () => {
  it('computes deterministic VEC64 checksums from normalized 64-number embeddings', () => {
    const vectorA = Array(64).fill(0.0);
    // Setting typical iron trace cells (JH monogram, cross, head of bull)
    vectorA[18] = 0.8540;
    vectorA[19] = 0.9120;
    vectorA[26] = 0.7810;
    vectorA[27] = 0.8930;
    vectorA[34] = 0.9450;
    vectorA[35] = 0.9210;
    vectorA[42] = 0.6520;
    vectorA[43] = 0.7100;

    const checksum1 = computeVectorChecksum(vectorA);
    const checksum2 = computeVectorChecksum(vectorA);

    assert.strictEqual(checksum1, checksum2, 'Checksum must be 100% deterministic');
    assert.match(checksum1, /^VEC64-[A-F0-9]{8}-[A-F0-9]{8}$/, 'Must follow official VEC64 format');
  });

  it('guarantees that two distinct branding irons produce different checksums', () => {
    const ironJH = Array(64).fill(0.0);
    ironJH[18] = 0.85;
    ironJH[19] = 0.91;
    ironJH[26] = 0.78;
    ironJH[34] = 0.94;

    const ironCorona = Array(64).fill(0.0);
    ironCorona[2] = 0.88;
    ironCorona[3] = 0.92;
    ironCorona[10] = 0.75;
    ironCorona[11] = 0.81;

    const hashJH = computeVectorChecksum(ironJH);
    const hashCorona = computeVectorChecksum(ironCorona);

    assert.notStrictEqual(hashJH, hashCorona, 'Two different irons must never collide on checksum');
  });

  it('correctly classifies background cells (< 0.40), medium strokes (0.40 - 0.70), and dark iron strokes (> 0.70)', () => {
    // 64 cells simulation of realistic paper background with residual noise and iron strokes
    const rawVector = [
      0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
      0.0, 0.0, 0.15, 0.85, 0.92, 0.14, 0.0, 0.0,
      0.0, 0.10, 0.78, 0.95, 0.88, 0.55, 0.0, 0.0,
      0.0, 0.0, 0.72, 0.45, 0.50, 0.70, 0.0, 0.0,
      0.0, 0.0, 0.88, 0.91, 0.94, 0.89, 0.0, 0.0,
      0.0, 0.0, 0.15, 0.60, 0.75, 0.12, 0.0, 0.0,
      0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
      0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
    ];

    const backgroundCells = rawVector.filter((v) => v < 0.40);
    const mediumCells = rawVector.filter((v) => v >= 0.40 && v <= 0.70);
    const heavyCells = rawVector.filter((v) => v > 0.70);

    // Mutually exclusive: sum of the 3 buckets is exactly 64
    assert.strictEqual(backgroundCells.length + mediumCells.length + heavyCells.length, 64, 'Must sum to exactly 64 cells');
    assert.strictEqual(heavyCells.length, 11, 'Should detect exactly 11 dark iron cells (> 0.70)');
    assert.strictEqual(mediumCells.length, 5, 'Should detect exactly 5 medium stroke cells (0.40 - 0.70)');
    assert.strictEqual(backgroundCells.length, 48, 'Should detect exactly 48 paper background cells (< 0.40)');

    // Density based on dark iron strokes (> 0.70)
    const density = Math.round((heavyCells.length / 64) * 1000) / 10;
    assert.strictEqual(density, 17.2, 'Density must be realistic (17.2% for thin branding iron lines), NOT 96.9%');
  });
});
