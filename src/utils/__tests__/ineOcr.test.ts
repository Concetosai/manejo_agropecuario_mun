import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  parseIneTextWithCrossValidation,
  cleanIneName,
  crossValidateCurp,
  crossValidateRfc,
  cleanIneAddress,
  computeExpectedInitials,
  calculateRealConfidenceScore,
  MEXICAN_CURP_REGEX,
  MEXICAN_RFC_REGEX,
} from '../ineOcrUtils.ts';

describe('INE Electoral Card OCR Validation & Transcription - Caso Pánuco', () => {
  it('correctly cleans name, eliminating "SEXO H", "EDAD", and "ETE" noise tokens', () => {
    const rawNoisy = 'ETE HERNANDEZ RAMOS RODRIGO SEXO H EDAD 50';
    const result = cleanIneName(rawNoisy);

    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.fullName, 'HERNANDEZ RAMOS RODRIGO');
    assert.strictEqual(result.firstLastName, 'HERNANDEZ');
    assert.strictEqual(result.secondLastName, 'RAMOS');
    assert.strictEqual(result.names, 'RODRIGO');
    assert.ok(result.noiseDetected.length > 0);
  });

  it('correctly processes real credential text for HERNANDEZ RAMOS RODRIGO without mock data', () => {
    const sampleText = `
      INSTITUTO NACIONAL ELECTORAL
      CREDENCIAL PARA VOTAR
      ETE NOMBRE
      HERNANDEZ
      RAMOS
      RODRIGO
      SEXO H
      DOMICILIO
      BLVD IGNACIO ALLENDE 302
      ZONA CENTRO, C.P. 93990
      PÁNUCO, VERACRUZ
      CLAVE DE ELECTOR: HRRMRD73060930H100
      CURP: HERR730609HVRRMR01
      SECCIÓN: 2841
      VIGENCIA: 2024 - 2034
    `;

    const result = parseIneTextWithCrossValidation(sampleText);

    // Verificación de Nombre Limpio
    assert.strictEqual(result.fullName, 'HERNANDEZ RAMOS RODRIGO');
    assert.ok(!result.fullName.includes('SEXO'));
    assert.ok(!result.fullName.includes('ETE'));

    // Verificación de CURP correcta y congruente
    assert.strictEqual(result.curp, 'HERR730609HVRRMR01');
    assert.notStrictEqual(result.curp, 'GUAA620415HVRRRN08');

    // Verificación de RFC congruente con HERNANDEZ RAMOS RODRIGO
    assert.ok(result.rfc.startsWith('HERR730609'));
    assert.notStrictEqual(result.rfc, 'RMRD7306093H');

    // Verificación de Domicilio sin forzar Ejido Reventadero
    assert.ok(result.address.includes('BLVD IGNACIO ALLENDE 302'));
    assert.ok(result.address.includes('ZONA CENTRO'));
    assert.notStrictEqual(result.address, 'EJIDO REVENTADERO, PÁNUCO, VERACRUZ');

    // Verificación de Confiabilidad Real
    assert.ok(result.confidenceScore >= 80, `Confidence was ${result.confidenceScore}`);
    assert.strictEqual(result.confidenceLevel, 'alta');
    assert.strictEqual(result.crossValidationWarnings.length, 0);
  });

  it('detects cross-validation incongruence when CURP does not match name and drops confidence drastically', () => {
    // Escenario de error real: Nombre es Hernández pero CURP extraída es de Don Aurelio (GUAA...)
    const mismatchedText = `
      INSTITUTO NACIONAL ELECTORAL
      CREDENCIAL PARA VOTAR
      NOMBRE
      HERNANDEZ
      RAMOS
      RODRIGO
      DOMICILIO
      BLVD IGNACIO ALLENDE 302, ZONA CENTRO 93990
      PÁNUCO, VERACRUZ
      CLAVE DE ELECTOR: HRRMRD73060930H100
      CURP: GUAA620415HVRRRN08
    `;

    const result = parseIneTextWithCrossValidation(mismatchedText);

    // El sistema debe rechazar la CURP discordante para no contaminar el expediente
    assert.strictEqual(result.curp, '', 'CURP discordante debe ser rechazada');
    assert.ok(result.crossValidationWarnings.length > 0, 'Debe registrar advertencia de incongruencia');
    assert.ok(
      result.crossValidationWarnings[0].includes('Incongruencia'),
      'El mensaje debe advertir sobre incongruencia'
    );

    // La confiabilidad debe desplomarse drásticamente (menos de 65%)
    assert.ok(
      result.confidenceScore <= 65,
      `Confiabilidad debería ser baja pero fue ${result.confidenceScore}%`
    );
    assert.ok(result.confidenceLevel !== 'alta');
  });

  it('strictly validates 18-character Mexican CURP format with official regex', () => {
    assert.ok(MEXICAN_CURP_REGEX.test('HERR730609HVRRMR01'));
    assert.ok(MEXICAN_CURP_REGEX.test('GUAA620415HVRRRN08'));
    assert.ok(MEXICAN_CURP_REGEX.test('PEZR740920MVRSLS03'));

    // Formatos inválidos (longitud incorrecta o caracteres extraños)
    assert.strictEqual(MEXICAN_CURP_REGEX.test('HERR730609HVRRMR0'), false); // 17 chars
    assert.strictEqual(MEXICAN_CURP_REGEX.test('HERR730609HVRRMR019'), false); // 19 chars
    assert.strictEqual(MEXICAN_CURP_REGEX.test('123456789012345678'), false);
    assert.strictEqual(MEXICAN_CURP_REGEX.test(''), false);
  });

  it('rejects unrelated images or empty text and reports low confidence', () => {
    const invalidResult = parseIneTextWithCrossValidation('Fotografia de una vaca en el campo 12345');
    assert.strictEqual(invalidResult.fullName, '');
    assert.strictEqual(invalidResult.curp, '');
    assert.strictEqual(invalidResult.confidenceScore, 0);
    assert.strictEqual(invalidResult.confidenceLevel, 'baja');

    const blankResult = parseIneTextWithCrossValidation('');
    assert.strictEqual(blankResult.confidenceScore, 0);
    assert.strictEqual(blankResult.confidenceLevel, 'baja');
  });

  it('successfully extracts Don Aurelio credential text with backwards compatibility', () => {
    const sampleText = `
      INSTITUTO NACIONAL ELECTORAL
      CREDENCIAL PARA VOTAR
      NOMBRE: AURELIO GUZMÁN ARADILLAS
      DOMICILIO: CARR. PÁNUCO-TEMPOAL KM 14 INT 2, EJIDO REVENTADERO, C.P. 93990
      PÁNUCO, VERACRUZ
      CLAVE DE ELECTOR: GUAAAR62041530H100
      CURP: GUAA620415HVRRRN08
      SECCIÓN: 2841
      VIGENCIA: 2024 - 2034
    `;

    const result = parseIneTextWithCrossValidation(sampleText);
    assert.strictEqual(result.fullName, 'AURELIO GUZMÁN ARADILLAS');
    assert.strictEqual(result.curp, 'GUAA620415HVRRRN08');
    assert.strictEqual(result.ine, 'GUAAAR62041530H100');
    assert.strictEqual(result.ejido, 'Reventadero');
    assert.strictEqual(result.municipio, 'Pánuco');
    assert.ok(result.confidenceScore >= 80);
  });

  it('successfully extracts Doña Rosa credential text with backwards compatibility', () => {
    const sampleText = `
      INSTITUTO NACIONAL ELECTORAL
      CREDENCIAL PARA VOTAR
      NOMBRE: ROSA ELENA PECERO ZÚÑIGA
      DOMICILIO: AV. HIDALGO NO. 45, CONGREGACIÓN TAMOS, C.P. 93994
      PÁNUCO, VERACRUZ
      CLAVE DE ELECTOR: PEZRE74092030M200
      CURP: PEZR740920MVRSLS03
      SECCIÓN: 2845
      VIGENCIA: 2023 - 2033
    `;

    const result = parseIneTextWithCrossValidation(sampleText);
    assert.strictEqual(result.fullName, 'ROSA ELENA PECERO ZÚÑIGA');
    assert.strictEqual(result.curp, 'PEZR740920MVRSLS03');
    assert.strictEqual(result.ine, 'PEZRE74092030M200');
    assert.strictEqual(result.ejido, 'Tamos');
    assert.ok(result.confidenceScore >= 80);
  });
});

