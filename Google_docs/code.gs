/**
 * ============================================================================
 * API DE PÁNUCO · REGISTRO DE FIERROS QUEMADORES
 * VERSIÓN 4.1 · 10/Oct/2026
 * 
 * CAMBIOS v4.1:
 *   - ✅ NUEVO: subirArchivo — Sube PDFs a Google Drive
 *   - ✅ NUEVO: actualizarUrlsRecibo — Actualiza URLs de recibo en PAGOS
 *   - ✅ Columnas de evidencias completas (url_miniatura_fierro, url_reporte,
 *      url_recibo_cloudinary, url_recibo_drive, url_constancia_cloudinary,
 *      url_constancia_drive, url_guia_cloudinary, url_guia_drive)
 * 
 * CAMBIOS v4.0:
 *   - ✅ confirmarPagoRecibido — Cierra orden con datos de recibo
 *   - ✅ marcarEntregaCompletada — Marca entrega de docs
 * 
 * Endpoints:
 *   GET  ?action=health
 *   POST ?action=guardarRegistro
 *   POST ?action=subirImagen
 *   POST ?action=subirArchivo                   ← NUEVO v4.1
 *   GET  ?action=obtenerRegistros
 *   GET  ?action=obtenerRegistro&folio=XXX
 *   POST ?action=guardarPago
 *   GET  ?action=obtenerPagos
 *   POST ?action=actualizarPagoEstatus
 *   POST ?action=eliminarPago
 *   POST ?action=confirmarPagoRecibido
 *   POST ?action=marcarEntregaCompletada
 *   POST ?action=actualizarUrlsRecibo           ← NUEVO v4.1
 *   POST ?action=revalidarRegistro
 *   POST ?action=cancelarRegistro
 *   POST ?action=emitirConstancia
 *   GET  ?action=buscarPropietario&q=XXX
 *   POST ?action=registrarDeguello
 *   GET  ?action=obtenerConstancias
 *   GET  ?action=obtenerDeguellos
 * ============================================================================
 */

const SHEET_NAME = 'REGISTROS';
const SHEET_PAGOS = 'PAGOS';
const SHEET_CONSTANCIAS = 'CONSTANCIAS';
const SHEET_DEGUELLOS = 'DEGÜELLOS';

const CLOUDINARY_CLOUD_NAME = 'up9bfdww';
const CLOUDINARY_UPLOAD_PRESET = 'panuco_fierros';
const CLOUDINARY_FOLDER_ROOT = 'panuco_fierros';

const COLUMNAS_REGISTROS = [
  'id_registro', 'id_registro_tipo', 'folio', 'fecha_captura', 'operador',
  'nombre_productor', 'curp', 'rfc', 'ine', 'telefono', 'email',
  'domicilio', 'municipio', 'ejido',
  'predio', 'superficie', 'tenencia', 'cantidad_ganado', 'especie',
  'fin_zootecnico', 'upp',
  'numero_registro', 'libro', 'foja', 'fecha_expedicion', 'vigencia',
  'iniciales', 'hash_vector',
  'vector_64d', 'vector_checksum', 'vector_density',
  'vector_symmetry_h', 'vector_symmetry_v', 'vector_proportions', 'vector_varianza',
  'url_ine', 'url_ficha', 'url_fierro', 'url_certificado',
  'url_foto_titular', 'url_firma',
  'estatus', 'fecha_baja', 'motivo_baja', 'operador_baja',
  'url_miniatura_fierro', 'url_reporte'
];

const COLUMNAS_PAGOS = [
  'id_pago', 'folio', 'folio_fierro', 'ejercicio', 'periodo',
  'taxpayer_name', 'rfc', 'curp', 'address',
  'concepts', 'amount', 'date', 'status',
  'cashier_name', 'notes', 'referencia_pago', 'metodo_pago',
  'created_at', 'updated_at',
  'fecha_pago', 'cajero_confirmo', 'operador_entrego', 'recibo_tesoreria', 'fecha_entrega',
  'url_recibo_cloudinary', 'url_recibo_drive', 'url_reporte'
];

const COLUMNAS_CONSTANCIAS = [
  'id_constancia', 'folio_constancia', 'folio_fierro', 'tipo',
  'nombre_productor', 'curp', 'rfc', 'proposito',
  'operador', 'fecha_emision', 'url_pdf',
  'url_constancia_cloudinary', 'url_constancia_drive'
];

const COLUMNAS_DEGUELLOS = [
  'id_deguello', 'folio_guia', 'folio_fierro', 'nombre_introductor',
  'especie', 'numero_cabezas', 'cuota_por_cabeza', 'monto_total',
  'instalacion', 'guia_transito', 'certificado_sanitario',
  'inspector_mvz', 'fecha_sacrificio', 'operador',
  'url_guia_cloudinary', 'url_guia_drive'
];

// ============================================================================
// MANEJADORES HTTP
// ============================================================================

function doPost(e) { return handleRequest(e, 'POST'); }
function doGet(e)  { return handleRequest(e, 'GET'); }

function handleRequest(e, method) {
  try {
    const params = e.parameter || {};
    const action = params.action;
    
    let payload = {};
    if (method === 'POST' && e.postData && e.postData.contents) {
      try { payload = JSON.parse(e.postData.contents); } catch (err) { payload = {}; }
    }
    
    if (action !== 'health') {
      const token = params.token || payload.token || null;
      const secret = PropertiesService.getScriptProperties().getProperty('SECRET_TOKEN');
      
      if (token !== secret) {
        return jsonResponse({
          success: false,
          error: 'Token inválido',
          received: token,
          expected: secret ? 'SET' : 'NOT_SET'
        });
      }
    }
    
    switch (action) {
      case 'health':                  return jsonResponse({ status: 'ok', service: 'panuco-fierros-api', version: '4.1', timestamp: new Date().toISOString() });
      case 'guardarRegistro':         return guardarRegistro(payload);
      case 'subirImagen':             return subirImagen(payload);
      case 'subirArchivo':            return subirArchivo(payload);
      case 'obtenerRegistros':        return obtenerRegistros(params);
      case 'obtenerRegistro':         return obtenerRegistro(params.folio);
      case 'guardarPago':             return guardarPago(payload);
      case 'obtenerPagos':            return obtenerPagos(params);
      case 'actualizarPagoEstatus':   return actualizarPagoEstatus(payload);
      case 'eliminarPago':            return eliminarPago(payload);
      case 'confirmarPagoRecibido':   return confirmarPagoRecibido(payload);
      case 'marcarEntregaCompletada': return marcarEntregaCompletada(payload);
      case 'actualizarUrlsRecibo':    return actualizarUrlsRecibo(payload);
      case 'revalidarRegistro':       return revalidarRegistro(payload);
      case 'cancelarRegistro':        return cancelarRegistro(payload);
      case 'emitirConstancia':        return emitirConstancia(payload);
      case 'buscarPropietario':       return buscarPropietario(params);
      case 'registrarDeguello':       return registrarDeguello(payload);
      case 'obtenerConstancias':      return obtenerConstancias(params);
      case 'obtenerDeguellos':        return obtenerDeguellos(params);
      default:
        return jsonResponse({ success: false, error: 'Action no reconocida: ' + action });
    }
  } catch (err) {
    return jsonResponse({ success: false, error: err.message || String(err) });
  }
}

// ============================================================================
// REGISTROS
// ============================================================================

function guardarRegistro(payload) {
  const sheet = getSheet(SHEET_NAME);
  const data = payload.data || payload;
  
  if (data.vector_64d && Array.isArray(data.vector_64d)) {
    data.vector_64d = JSON.stringify(data.vector_64d);
  }
  
  const row = COLUMNAS_REGISTROS.map(function(col) {
    var val = data[col];
    if (col === 'fecha_captura' && !val) return new Date().toISOString();
    if (col === 'estatus' && !val) return 'ACTIVO';
    return val !== undefined && val !== null ? val : '';
  });
  
  const existing = buscarFilaPorFolio(SHEET_NAME, data.folio);
  if (existing > 0) {
    const existingValues = sheet.getRange(existing, 1, 1, COLUMNAS_REGISTROS.length).getValues()[0];
    for (var i = 0; i < COLUMNAS_REGISTROS.length; i++) {
      var col = COLUMNAS_REGISTROS[i];
      if (data[col] !== undefined && data[col] !== null) {
        existingValues[i] = data[col];
      }
    }
    sheet.getRange(existing, 1, 1, COLUMNAS_REGISTROS.length).setValues([existingValues]);
    return jsonResponse({ success: true, action: 'updated', folio: data.folio, row: existing });
  } else {
    sheet.appendRow(row);
    return jsonResponse({ success: true, action: 'inserted', folio: data.folio, row: sheet.getLastRow() });
  }
}

function obtenerRegistros(params) {
  const sheet = getSheet(SHEET_NAME);
  const lastRow = sheet.getLastRow();
  
  if (lastRow <= 1) return jsonResponse({ success: true, registros: [], total: 0 });
  
  const lastCol = Math.max(sheet.getLastColumn(), COLUMNAS_REGISTROS.length);
  const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  
  const registros = data
    .filter(function(row) { return row[0] || row[1] || row[2]; })
    .map(function(row) {
      var obj = {};
      headers.forEach(function(h, i) {
        var val = row[i];
        if (h === 'vector_64d' && val && typeof val === 'string') {
          try { val = JSON.parse(val); } catch (e) { val = null; }
        }
        obj[h] = val === '' ? null : val;
      });
      if (!obj.estatus) obj.estatus = 'ACTIVO';
      return obj;
    });
  
  var filtrados = registros;
  if (params.folio) {
    filtrados = registros.filter(function(r) { return String(r.folio).indexOf(params.folio) > -1; });
  }
  if (params.estatus) {
    filtrados = filtrados.filter(function(r) { return String(r.estatus) === String(params.estatus); });
  }
  
  return jsonResponse({
    success: true,
    total: filtrados.length,
    registros: filtrados.slice(0, 5000)
  });
}

function obtenerRegistro(folio) {
  if (!folio) return jsonResponse({ success: false, error: 'Falta el folio' });
  
  const sheet = getSheet(SHEET_NAME);
  const row = buscarFilaPorFolio(SHEET_NAME, folio);
  if (row <= 0) return jsonResponse({ success: false, error: 'Registro no encontrado' });
  
  const lastCol = Math.max(sheet.getLastColumn(), COLUMNAS_REGISTROS.length);
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const values = sheet.getRange(row, 1, 1, lastCol).getValues()[0];
  
  var registro = {};
  headers.forEach(function(h, i) {
    var val = values[i];
    if (h === 'vector_64d' && val && typeof val === 'string') {
      try { val = JSON.parse(val); } catch (e) { val = null; }
    }
    registro[h] = val === '' ? null : val;
  });
  if (!registro.estatus) registro.estatus = 'ACTIVO';
  
  return jsonResponse({ success: true, registro: registro });
}

// ============================================================================
// PAGOS
// ============================================================================

function guardarPago(payload) {
  const sheet = getSheet(SHEET_PAGOS);
  const data = payload.data || payload;
  
  if (data.concepts && Array.isArray(data.concepts)) {
    data.concepts = JSON.stringify(data.concepts);
  }
  
  const row = COLUMNAS_PAGOS.map(function(col) {
    var val = data[col];
    if (col === 'created_at' && !val) return new Date().toISOString();
    if (col === 'updated_at') return new Date().toISOString();
    return val !== undefined && val !== null ? val : '';
  });
  
  const existing = buscarFilaPorFolio(SHEET_PAGOS, data.folio);
  if (existing > 0) {
    sheet.getRange(existing, 1, 1, COLUMNAS_PAGOS.length).setValues([row]);
    return jsonResponse({ success: true, action: 'updated', folio: data.folio, row: existing });
  } else {
    sheet.appendRow(row);
    return jsonResponse({ success: true, action: 'inserted', folio: data.folio, row: sheet.getLastRow() });
  }
}

function obtenerPagos(params) {
  const sheet = getSheet(SHEET_PAGOS);
  const lastRow = sheet.getLastRow();
  
  if (lastRow <= 1) return jsonResponse({ success: true, pagos: [], total: 0 });
  
  const lastCol = Math.max(sheet.getLastColumn(), COLUMNAS_PAGOS.length);
  const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  
  const pagos = data
    .filter(function(row) { return row[0] || row[1] || row[2]; })
    .map(function(row) {
      var obj = {};
      headers.forEach(function(h, i) {
        var val = row[i];
        if (h === 'concepts' && val && typeof val === 'string') {
          try { val = JSON.parse(val); } catch (e) { val = []; }
        }
        obj[h] = val === '' ? null : val;
      });
      return obj;
    });
  
  var filtrados = pagos;
  if (params.folio) {
    filtrados = filtrados.filter(function(p) { return String(p.folio) === String(params.folio); });
  }
  if (params.folioFierro) {
    filtrados = filtrados.filter(function(p) { return String(p.folio_fierro) === String(params.folioFierro); });
  }
  if (params.curp) {
    filtrados = filtrados.filter(function(p) { return String(p.curp) === String(params.curp); });
  }
  if (params.status) {
    filtrados = filtrados.filter(function(p) { return String(p.status) === String(params.status); });
  }
  
  return jsonResponse({ success: true, total: filtrados.length, pagos: filtrados });
}

function actualizarPagoEstatus(payload) {
  const data = payload.data || payload;
  if (!data.folio || !data.status) return jsonResponse({ success: false, error: 'Falta folio o status' });
  
  const sheet = getSheet(SHEET_PAGOS);
  const row = buscarFilaPorFolio(SHEET_PAGOS, data.folio);
  if (row <= 0) return jsonResponse({ success: false, error: 'Pago no encontrado: ' + data.folio });
  
  const statusCol = COLUMNAS_PAGOS.indexOf('status') + 1;
  const updatedCol = COLUMNAS_PAGOS.indexOf('updated_at') + 1;
  
  sheet.getRange(row, statusCol).setValue(data.status);
  sheet.getRange(row, updatedCol).setValue(new Date().toISOString());
  
  return jsonResponse({ success: true, folio: data.folio, status: data.status });
}

function eliminarPago(payload) {
  const data = payload.data || payload;
  if (!data.folio) return jsonResponse({ success: false, error: 'Falta folio' });
  
  const sheet = getSheet(SHEET_PAGOS);
  const row = buscarFilaPorFolio(SHEET_PAGOS, data.folio);
  if (row <= 0) return jsonResponse({ success: false, error: 'Pago no encontrado' });
  
  sheet.deleteRow(row);
  return jsonResponse({ success: true, folio: data.folio, action: 'deleted' });
}

function confirmarPagoRecibido(payload) {
  const data = payload.data || payload;
  
  if (!data.folio) return jsonResponse({ success: false, error: 'Falta folio de la orden' });
  if (!data.recibo_tesoreria) return jsonResponse({ success: false, error: 'Falta número de recibo de Tesorería' });
  if (!data.cajero_confirmo) return jsonResponse({ success: false, error: 'Falta nombre del cajero' });
  
  const sheet = getSheet(SHEET_PAGOS);
  const row = buscarFilaPorFolio(SHEET_PAGOS, data.folio);
  if (row <= 0) return jsonResponse({ success: false, error: 'Orden no encontrada: ' + data.folio });
  
  const statusCol = COLUMNAS_PAGOS.indexOf('status') + 1;
  const fechaPagoCol = COLUMNAS_PAGOS.indexOf('fecha_pago') + 1;
  const cajeroCol = COLUMNAS_PAGOS.indexOf('cajero_confirmo') + 1;
  const operadorCol = COLUMNAS_PAGOS.indexOf('operador_entrego') + 1;
  const reciboCol = COLUMNAS_PAGOS.indexOf('recibo_tesoreria') + 1;
  const updatedCol = COLUMNAS_PAGOS.indexOf('updated_at') + 1;
  
  const statusActual = String(sheet.getRange(row, statusCol).getValue() || '').toUpperCase();
  if (statusActual === 'PAID') {
    return jsonResponse({
      success: false,
      error: 'Esta orden YA fue pagada',
      folio: data.folio,
      status: 'PAID'
    });
  }
  if (statusActual === 'CANCELLED') {
    return jsonResponse({
      success: false,
      error: 'No se puede pagar una orden CANCELADA',
      folio: data.folio
    });
  }
  
  const now = new Date().toISOString();
  sheet.getRange(row, statusCol).setValue('PAID');
  sheet.getRange(row, fechaPagoCol).setValue(now);
  sheet.getRange(row, cajeroCol).setValue(data.cajero_confirmo);
  sheet.getRange(row, operadorCol).setValue(data.operador_entrego || '');
  sheet.getRange(row, reciboCol).setValue(data.recibo_tesoreria);
  sheet.getRange(row, updatedCol).setValue(now);
  
  return jsonResponse({
    success: true,
    action: 'pago_confirmado',
    folio: data.folio,
    status: 'PAID',
    fecha_pago: now,
    recibo_tesoreria: data.recibo_tesoreria,
    cajero_confirmo: data.cajero_confirmo
  });
}

function marcarEntregaCompletada(payload) {
  const data = payload.data || payload;
  
  if (!data.folio) return jsonResponse({ success: false, error: 'Falta folio de la orden' });
  if (!data.operador_entrego_docs) return jsonResponse({ success: false, error: 'Falta nombre del operador que entrega' });
  
  const sheet = getSheet(SHEET_PAGOS);
  const row = buscarFilaPorFolio(SHEET_PAGOS, data.folio);
  if (row <= 0) return jsonResponse({ success: false, error: 'Orden no encontrada: ' + data.folio });
  
  const statusCol = COLUMNAS_PAGOS.indexOf('status') + 1;
  const fechaEntregaCol = COLUMNAS_PAGOS.indexOf('fecha_entrega') + 1;
  const operadorCol = COLUMNAS_PAGOS.indexOf('operador_entrego') + 1;
  const updatedCol = COLUMNAS_PAGOS.indexOf('updated_at') + 1;
  
  const statusActual = String(sheet.getRange(row, statusCol).getValue() || '').toUpperCase();
  if (statusActual !== 'PAID') {
    return jsonResponse({
      success: false,
      error: 'Solo se pueden entregar documentos de órdenes PAGADAS. Estado actual: ' + statusActual,
      folio: data.folio,
      status_actual: statusActual
    });
  }
  
  const now = new Date().toISOString();
  sheet.getRange(row, statusCol).setValue('DELIVERED');
  sheet.getRange(row, fechaEntregaCol).setValue(now);
  sheet.getRange(row, operadorCol).setValue(data.operador_entrego_docs);
  sheet.getRange(row, updatedCol).setValue(now);
  
  return jsonResponse({
    success: true,
    action: 'entrega_completada',
    folio: data.folio,
    status: 'DELIVERED',
    fecha_entrega: now,
    operador_entrego_docs: data.operador_entrego_docs
  });
}

/**
 * NUEVO v4.1: Actualiza las URLs del recibo (Cloudinary + Drive) en PAGOS
 */
function actualizarUrlsRecibo(payload) {
  const data = payload.data || payload;
  
  if (!data.folio) return jsonResponse({ success: false, error: 'Falta folio de la orden' });
  
  const sheet = getSheet(SHEET_PAGOS);
  const row = buscarFilaPorFolio(SHEET_PAGOS, data.folio);
  if (row <= 0) return jsonResponse({ success: false, error: 'Orden no encontrada: ' + data.folio });
  
  const updatedCol = COLUMNAS_PAGOS.indexOf('updated_at') + 1;
  
  if (data.url_recibo_cloudinary !== undefined) {
    const col = COLUMNAS_PAGOS.indexOf('url_recibo_cloudinary') + 1;
    if (col > 0) sheet.getRange(row, col).setValue(data.url_recibo_cloudinary || '');
  }
  if (data.url_recibo_drive !== undefined) {
    const col = COLUMNAS_PAGOS.indexOf('url_recibo_drive') + 1;
    if (col > 0) sheet.getRange(row, col).setValue(data.url_recibo_drive || '');
  }
  if (data.url_reporte !== undefined) {
    const col = COLUMNAS_PAGOS.indexOf('url_reporte') + 1;
    if (col > 0) sheet.getRange(row, col).setValue(data.url_reporte || '');
  }
  
  sheet.getRange(row, updatedCol).setValue(new Date().toISOString());
  
  return jsonResponse({
    success: true,
    action: 'urls_recibo_actualizadas',
    folio: data.folio
  });
}

// ============================================================================
// TRÁMITES 2026
// ============================================================================

function revalidarRegistro(payload) {
  const data = payload.data || payload;
  if (!data.folio) return jsonResponse({ success: false, error: 'Falta folio' });
  
  const sheet = getSheet(SHEET_NAME);
  const row = buscarFilaPorFolio(SHEET_NAME, data.folio);
  if (row <= 0) return jsonResponse({ success: false, error: 'Registro no encontrado: ' + data.folio });
  
  const colVigencia = COLUMNAS_REGISTROS.indexOf('vigencia') + 1;
  const colFechaExp = COLUMNAS_REGISTROS.indexOf('fecha_expedicion') + 1;
  const colOperador = COLUMNAS_REGISTROS.indexOf('operador') + 1;
  const colEstatus = COLUMNAS_REGISTROS.indexOf('estatus') + 1;
  
  if (data.fecha_nueva_vigencia) {
    sheet.getRange(row, colVigencia).setValue(data.fecha_nueva_vigencia);
  }
  sheet.getRange(row, colFechaExp).setValue(new Date().toISOString());
  if (data.operador) {
    sheet.getRange(row, colOperador).setValue(data.operador);
  }
  sheet.getRange(row, colEstatus).setValue('REVALIDADO');
  
  return jsonResponse({
    success: true,
    action: 'revalidado',
    folio: data.folio,
    row: row,
    fecha_nueva_vigencia: data.fecha_nueva_vigencia || null,
    estatus: 'REVALIDADO'
  });
}

function cancelarRegistro(payload) {
  const data = payload.data || payload;
  if (!data.folio) return jsonResponse({ success: false, error: 'Falta folio' });
  
  const sheet = getSheet(SHEET_NAME);
  const row = buscarFilaPorFolio(SHEET_NAME, data.folio);
  if (row <= 0) return jsonResponse({ success: false, error: 'Registro no encontrado: ' + data.folio });
  
  const colEstatus = COLUMNAS_REGISTROS.indexOf('estatus') + 1;
  const colFechaBaja = COLUMNAS_REGISTROS.indexOf('fecha_baja') + 1;
  const colMotivoBaja = COLUMNAS_REGISTROS.indexOf('motivo_baja') + 1;
  const colOperadorBaja = COLUMNAS_REGISTROS.indexOf('operador_baja') + 1;
  
  const estatusActual = String(sheet.getRange(row, colEstatus).getValue() || '');
  if (estatusActual === 'CANCELADO') {
    return jsonResponse({
      success: false,
      error: 'El registro ya está cancelado',
      folio: data.folio
    });
  }
  
  const motivo = data.motivo || 'SIN_MOTIVO';
  sheet.getRange(row, colEstatus).setValue('CANCELADO');
  sheet.getRange(row, colFechaBaja).setValue(new Date().toISOString());
  sheet.getRange(row, colMotivoBaja).setValue(motivo);
  sheet.getRange(row, colOperadorBaja).setValue(data.operador || 'SISTEMA');
  
  return jsonResponse({
    success: true,
    action: 'cancelado',
    folio: data.folio,
    motivo: motivo,
    row: row,
    estatus: 'CANCELADO'
  });
}

function emitirConstancia(payload) {
  const data = payload.data || payload;
  if (!data.folio) return jsonResponse({ success: false, error: 'Falta folio' });
  
  const row = buscarFilaPorFolio(SHEET_NAME, data.folio);
  if (row <= 0) return jsonResponse({ success: false, error: 'Registro no encontrado: ' + data.folio });
  
  const timestamp = Date.now();
  const year = new Date().getFullYear();
  const tipo = data.tipo || 'CONSTANCIA';
  const prefijo = tipo === 'REPOSICION_PATENTE' ? 'REP' : 'CONST';
  const folioConstancia = prefijo + '-' + year + '-' + String(timestamp).slice(-6);
  const idConstancia = 'const-' + timestamp;
  
  try {
    const sheetConstancias = getSheet(SHEET_CONSTANCIAS);
    
    const registroConstancia = {
      id_constancia: idConstancia,
      folio_constancia: folioConstancia,
      folio_fierro: data.folio,
      tipo: tipo,
      nombre_productor: data.nombre_productor || '',
      curp: data.curp || '',
      rfc: data.rfc || '',
      proposito: data.proposito || '',
      operador: data.operador || '',
      fecha_emision: new Date().toISOString(),
      url_pdf: '',
      url_constancia_cloudinary: '',
      url_constancia_drive: ''
    };
    
    const fila = COLUMNAS_CONSTANCIAS.map(function(col) {
      var val = registroConstancia[col];
      return val !== undefined && val !== null ? val : '';
    });
    
    sheetConstancias.appendRow(fila);
    
    return jsonResponse({
      success: true,
      action: 'constancia_emitida',
      id_constancia: idConstancia,
      folio_original: data.folio,
      folio_constancia: folioConstancia,
      tipo: tipo,
      row: sheetConstancias.getLastRow()
    });
    
  } catch (err) {
    return jsonResponse({
      success: false,
      error: 'Error al guardar constancia: ' + err.message
    });
  }
}

function buscarPropietario(params) {
  const q = String(params.q || '').trim().toLowerCase();
  if (!q) return jsonResponse({ success: false, error: 'Falta criterio q' });
  
  const sheet = getSheet(SHEET_NAME);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return jsonResponse({ success: false, error: 'Sin registros en el padrón' });
  
  const lastCol = Math.max(sheet.getLastColumn(), COLUMNAS_REGISTROS.length);
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  
  const idxCurp = COLUMNAS_REGISTROS.indexOf('curp');
  const idxRfc = COLUMNAS_REGISTROS.indexOf('rfc');
  const idxNombre = COLUMNAS_REGISTROS.indexOf('nombre_productor');
  const idxFolio = COLUMNAS_REGISTROS.indexOf('folio');
  
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var curp = String(row[idxCurp] || '').toLowerCase();
    var rfc = String(row[idxRfc] || '').toLowerCase();
    var nombre = String(row[idxNombre] || '').toLowerCase();
    var folio = String(row[idxFolio] || '').toLowerCase();
    
    if (curp === q || rfc === q || folio === q || nombre.indexOf(q) > -1) {
      var registro = {};
      headers.forEach(function(h, j) {
        var val = row[j];
        if (h === 'vector_64d' && val && typeof val === 'string') {
          try { val = JSON.parse(val); } catch (e) { val = null; }
        }
        registro[h] = val === '' ? null : val;
      });
      if (!registro.estatus) registro.estatus = 'ACTIVO';
      return jsonResponse({ success: true, registro: registro });
    }
  }
  
  return jsonResponse({ success: false, error: 'Propietario no encontrado' });
}

function registrarDeguello(payload) {
  const data = payload.data || payload;
  if (!data.folio_fierro) {
    return jsonResponse({ success: false, error: 'Falta folio_fierro' });
  }
  if (!data.numero_cabezas) {
    return jsonResponse({ success: false, error: 'Falta numero_cabezas' });
  }
  
  const row = buscarFilaPorFolio(SHEET_NAME, data.folio_fierro);
  if (row <= 0) {
    return jsonResponse({ success: false, error: 'Fierro no encontrado: ' + data.folio_fierro });
  }
  
  const cabezas = Number(data.numero_cabezas);
  if (isNaN(cabezas) || cabezas <= 0) {
    return jsonResponse({ success: false, error: 'Número de cabezas inválido' });
  }
  
  const cuotaPorCabeza = Number(data.cuota_por_cabeza) || 90;
  const monto = cuotaPorCabeza * cabezas;
  const timestamp = Date.now();
  const folioGuia = 'GUIA-' + new Date().getFullYear() + '-' + String(timestamp).slice(-6);
  const idDeguello = 'deg-' + timestamp;
  
  try {
    const sheetDeguellos = getSheet(SHEET_DEGUELLOS);
    
    const registroDeguello = {
      id_deguello: idDeguello,
      folio_guia: folioGuia,
      folio_fierro: data.folio_fierro,
      nombre_introductor: data.nombre_introductor || '',
      especie: data.especie || 'BOVINO',
      numero_cabezas: cabezas,
      cuota_por_cabeza: cuotaPorCabeza,
      monto_total: monto,
      instalacion: data.instalacion || '',
      guia_transito: data.guia_transito || '',
      certificado_sanitario: data.certificado_sanitario || '',
      inspector_mvz: data.inspector_mvz || '',
      fecha_sacrificio: data.fecha_sacrificio || '',
      operador: data.operador || '',
      url_guia_cloudinary: '',
      url_guia_drive: ''
    };
    
    const fila = COLUMNAS_DEGUELLOS.map(function(col) {
      var val = registroDeguello[col];
      return val !== undefined && val !== null ? val : '';
    });
    
    sheetDeguellos.appendRow(fila);
    
    return jsonResponse({
      success: true,
      action: 'deguello_registrado',
      id_deguello: idDeguello,
      folio_fierro: data.folio_fierro,
      numero_cabezas: cabezas,
      monto: monto,
      folio_guia: folioGuia,
      row: sheetDeguellos.getLastRow()
    });
    
  } catch (err) {
    return jsonResponse({
      success: false,
      error: 'Error al guardar degüello: ' + err.message
    });
  }
}

// ============================================================================
// LECTURA DE CONSTANCIAS Y DEGÜELLOS
// ============================================================================

function obtenerConstancias(params) {
  const sheet = getSheet(SHEET_CONSTANCIAS);
  const lastRow = sheet.getLastRow();
  
  if (lastRow <= 1) return jsonResponse({ success: true, constancias: [], total: 0 });
  
  const lastCol = Math.max(sheet.getLastColumn(), COLUMNAS_CONSTANCIAS.length);
  const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  
  const constancias = data
    .filter(function(row) { return row[0] || row[1]; })
    .map(function(row) {
      var obj = {};
      headers.forEach(function(h, i) {
        obj[h] = row[i] === '' ? null : row[i];
      });
      return obj;
    });
  
  var filtrados = constancias;
  if (params.folio_fierro) {
    filtrados = filtrados.filter(function(c) { return String(c.folio_fierro) === String(params.folio_fierro); });
  }
  if (params.curp) {
    filtrados = filtrados.filter(function(c) { return String(c.curp) === String(params.curp); });
  }
  
  return jsonResponse({ success: true, total: filtrados.length, constancias: filtrados });
}

function obtenerDeguellos(params) {
  const sheet = getSheet(SHEET_DEGUELLOS);
  const lastRow = sheet.getLastRow();
  
  if (lastRow <= 1) return jsonResponse({ success: true, deguellos: [], total: 0 });
  
  const lastCol = Math.max(sheet.getLastColumn(), COLUMNAS_DEGUELLOS.length);
  const data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  
  const deguellos = data
    .filter(function(row) { return row[0] || row[1]; })
    .map(function(row) {
      var obj = {};
      headers.forEach(function(h, i) {
        obj[h] = row[i] === '' ? null : row[i];
      });
      return obj;
    });
  
  var filtrados = deguellos;
  if (params.folio_fierro) {
    filtrados = filtrados.filter(function(d) { return String(d.folio_fierro) === String(params.folio_fierro); });
  }
  
  return jsonResponse({ success: true, total: filtrados.length, deguellos: filtrados });
}

// ============================================================================
// SUBIR IMAGEN A CLOUDINARY
// ============================================================================

function subirImagen(payload) {
  const imageBase64 = payload.imageBase64;
  const filename = payload.filename || 'imagen_' + Date.now() + '.jpg';
  const carpeta = payload.subfolder || 'sin-carpeta';
  
  if (!imageBase64) {
    return jsonResponse({ success: false, error: 'Falta imageBase64' });
  }
  
  let base64Data = imageBase64;
  let contentType = 'image/jpeg';
  if (base64Data.indexOf('base64,') > -1) {
    const parts = base64Data.split('base64,');
    const meta = parts[0];
    if (meta.indexOf('image/png') > -1) contentType = 'image/png';
    else if (meta.indexOf('image/webp') > -1) contentType = 'image/webp';
    else if (meta.indexOf('image/svg') > -1) contentType = 'image/svg+xml';
    base64Data = parts[1];
  }
  
  const publicId = filename.replace(/\.[^.]+$/, '');
  const folder = CLOUDINARY_FOLDER_ROOT + '/' + carpeta;
  
  try {
    const url = 'https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD_NAME + '/image/upload';
    
    const formData = {
      file: 'data:' + contentType + ';base64,' + base64Data,
      upload_preset: CLOUDINARY_UPLOAD_PRESET,
      folder: folder,
      public_id: publicId
    };
    
    const options = {
      method: 'post',
      payload: formData,
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const status = response.getResponseCode();
    const body = response.getContentText();
    
    if (status !== 200) {
      return jsonResponse({
        success: false,
        error: 'Cloudinary HTTP ' + status,
        detail: body.substring(0, 300)
      });
    }
    
    const data = JSON.parse(body);
    return jsonResponse({
      success: true,
      url: data.secure_url,
      publicId: data.public_id,
      filename: filename,
      provider: 'cloudinary',
      bytes: data.bytes,
      format: data.format
    });
    
  } catch (err) {
    return jsonResponse({
      success: false,
      error: 'Error Cloudinary: ' + (err.message || String(err))
    });
  }
}

// ============================================================================
// NUEVO v4.1 · SUBIR ARCHIVO A GOOGLE DRIVE
// ============================================================================

/**
 * Sube un archivo (PDF, PNG) a Google Drive.
 * Crea la subcarpeta si no existe.
 * Devuelve la URL pública de descarga + preview.
 */
function subirArchivo(payload) {
  const fileBase64 = payload.fileBase64;
  const filename = payload.filename || 'archivo_' + Date.now() + '.pdf';
  const subfolder = payload.subfolder || null;
  const mimeType = payload.mimeType || 'application/pdf';

  if (!fileBase64) {
    return jsonResponse({ success: false, error: 'Falta fileBase64' });
  }

  let base64Data = fileBase64;
  if (base64Data.indexOf('base64,') > -1) {
    base64Data = base64Data.split('base64,')[1];
  }

  let blob;
  try {
    blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, filename);
  } catch (decodeErr) {
    return jsonResponse({ success: false, error: 'Base64 inválido: ' + decodeErr.message });
  }

  const parentId = PropertiesService.getScriptProperties().getProperty('DRIVE_FOLDER_ID');
  if (!parentId) {
    return jsonResponse({ success: false, error: 'DRIVE_FOLDER_ID no configurado' });
  }

  try {
    let folder;
    if (subfolder) {
      const parentFolder = DriveApp.getFolderById(parentId);
      const subs = parentFolder.getFoldersByName(subfolder);
      folder = subs.hasNext() ? subs.next() : parentFolder.createFolder(subfolder);
    } else {
      folder = DriveApp.getFolderById(parentId);
    }

    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return jsonResponse({
      success: true,
      fileId: file.getId(),
      url: 'https://drive.google.com/uc?export=view&id=' + file.getId(),
      urlPreview: 'https://drive.google.com/file/d/' + file.getId() + '/view',
      filename: filename,
      provider: 'gdrive'
    });
  } catch (err) {
    return jsonResponse({
      success: false,
      error: 'Error Drive: ' + (err.message || String(err))
    });
  }
}

// ============================================================================
// HELPERS INTERNOS
// ============================================================================

function getSheet(sheetName) {
  const sheetId = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!sheetId) throw new Error('SHEET_ID no configurado.');
  
  const ss = SpreadsheetApp.openById(sheetId);
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Hoja "' + sheetName + '" no existe.');
  return sheet;
}

function buscarFilaPorFolio(sheetName, folio) {
  if (!folio) return -1;
  const sheet = getSheet(sheetName);
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return -1;
  
  // FIX_COLUMNA_FOLIO: en PAGOS el folio está en columna 2, en otras hojas en columna 3
  const colFolio = (sheetName === SHEET_PAGOS) ? 2 : 3;
  
  const folios = sheet.getRange(2, colFolio, lastRow - 1, 1).getValues();
  for (var i = 0; i < folios.length; i++) {
    if (String(folios[i][0]).trim() === String(folio).trim()) {
      return i + 2;
    }
  }
  return -1;
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}