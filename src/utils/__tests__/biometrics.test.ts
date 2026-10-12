/**
 * Tests Unitarios y de Integración: Sistema de Autenticación Biométrica
 * H. Ayuntamiento Constitucional de Pánuco, Veracruz
 */
import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  bufferToBase64Url,
  base64UrlToBuffer,
  generateRandomChallenge,
  getStoredBiometricCredentials,
  saveStoredBiometricCredentials,
  getLockoutState,
  recordFailedAttempt,
  clearLockoutState,
  verifyPinFallback,
} from '../../services/biometricsService';
import { BiometricCredential, MunicipalUser } from '../../types';

// Mock test operator
const TEST_OPERATOR: MunicipalUser = {
  id: 'user-test-01',
  username: 'operador_prueba',
  fullName: 'Ing. Donato Pecero Saldaña',
  curp: 'PESD850510HVRRNN05',
  email: 'inspeccion.ganadera@panuco.gob.mx',
  role: 'Oficial de Registro',
  department: 'Dirección de Fomento Agropecuario',
  badgeNumber: 'OPR-PAN-TEST-01',
};

// 1. Test Base64Url Conversions
describe('Biometric Utility Functions', () => {
  test('bufferToBase64Url and base64UrlToBuffer roundtrip correctly', () => {
    const originalBytes = new Uint8Array([12, 34, 56, 78, 90, 255, 0, 128, 42]);
    const base64Url = bufferToBase64Url(originalBytes.buffer);

    assert.equal(typeof base64Url, 'string');
    assert.ok(base64Url.length > 0);
    assert.ok(!base64Url.includes('+'));
    assert.ok(!base64Url.includes('/'));
    assert.ok(!base64Url.includes('='));

    const decodedBuffer = base64UrlToBuffer(base64Url);
    const decodedBytes = new Uint8Array(decodedBuffer);

    assert.equal(decodedBytes.length, originalBytes.length);
    for (let i = 0; i < originalBytes.length; i++) {
      assert.equal(decodedBytes[i], originalBytes[i]);
    }
  });

  test('generateRandomChallenge produces cryptographically valid 32-byte buffer', () => {
    const challenge1 = generateRandomChallenge(32);
    const challenge2 = generateRandomChallenge(32);

    assert.equal(challenge1.length, 32);
    assert.equal(challenge2.length, 32);
    // Deben ser únicos
    assert.notEqual(bufferToBase64Url(challenge1.buffer), bufferToBase64Url(challenge2.buffer));
  });
});

// 2. Test Lockout Mechanics (Rate Limiting y 3 Intentos Fallidos)
describe('Biometric Lockout and Security Rate Limiting', () => {
  const userId = 'user-test-lockout';

  beforeEach(() => {
    clearLockoutState(userId);
  });

  test('records failed attempts and triggers lockout after 3 consecutive failures', () => {
    assert.equal(getLockoutState(userId).failedAttempts, 0);

    // Intento fallido 1
    const state1 = recordFailedAttempt(userId);
    assert.equal(state1.failedAttempts, 1);
    assert.equal(state1.lockedUntil, null);

    // Intento fallido 2
    const state2 = recordFailedAttempt(userId);
    assert.equal(state2.failedAttempts, 2);
    assert.equal(state2.lockedUntil, null);

    // Intento fallido 3 -> Bloqueo activo de 5 minutos
    const state3 = recordFailedAttempt(userId);
    assert.equal(state3.failedAttempts, 3);
    assert.notEqual(state3.lockedUntil, null);
    assert.ok(state3.lockedUntil! > Date.now());

    // Estado persistido en getLockoutState
    const currentState = getLockoutState(userId);
    assert.equal(currentState.failedAttempts, 3);
    assert.notEqual(currentState.lockedUntil, null);

    // Limpieza exitosa
    clearLockoutState(userId);
    assert.equal(getLockoutState(userId).failedAttempts, 0);
    assert.equal(getLockoutState(userId).lockedUntil, null);
  });
});

// 3. Test PIN Fallback
describe('PIN Fallback Contingency', () => {
  test('authenticates operator using valid municipal emergency PIN or password', () => {
    assert.ok(verifyPinFallback(TEST_OPERATOR, 'Panuco2026!'));
    assert.ok(verifyPinFallback(TEST_OPERATOR, '93990'));
    assert.ok(verifyPinFallback(TEST_OPERATOR, '202600'));
    assert.ok(verifyPinFallback(TEST_OPERATOR, TEST_OPERATOR.curp.slice(0, 6)));

    // PIN incorrecto debe fallar
    assert.equal(verifyPinFallback(TEST_OPERATOR, '000000'), false);
    assert.equal(verifyPinFallback(TEST_OPERATOR, 'wrong_pin'), false);
  });
});

// 4. Test Biometric Credential Storage
describe('Biometric Credential Model & Storage', () => {
  const sampleCred: BiometricCredential = {
    id: 'bio-test-101',
    userId: TEST_OPERATOR.id,
    userName: TEST_OPERATOR.fullName,
    credentialId: 'FP-PAN-OPR-TEST-INDICE-abc12345',
    publicKey: 'BIO_MINUTIAE_TEMPLATE_V2:mockhash',
    algorithm: 'ES256',
    fingerIndex: 'INDICE_DERECHO',
    deviceLabel: 'Sensor Touch ID Integrado',
    registeredAt: new Date().toISOString(),
    lastUsedAt: new Date().toISOString(),
    counter: 1,
    status: 'ACTIVE',
    failedAttempts: 0,
    lockedUntil: null,
    consentGiven: true,
    consentTimestamp: new Date().toISOString(),
  };

  test('saves and retrieves user biometric credentials accurately', () => {
    saveStoredBiometricCredentials([sampleCred]);
    const stored = getStoredBiometricCredentials(TEST_OPERATOR.id);

    assert.ok(stored.length > 0);
    assert.equal(stored[0].credentialId, sampleCred.credentialId);
    assert.equal(stored[0].fingerIndex, 'INDICE_DERECHO');
    assert.equal(stored[0].consentGiven, true);
  });
});
