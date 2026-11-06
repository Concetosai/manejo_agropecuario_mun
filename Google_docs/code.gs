/**
 * ============================================================================
 * API DE PÁNUCO · REGISTRO DE FIERROS QUEMADORES
 * VERSIÓN 4.5 · 15/Oct/2026
 * 
 * CAMBIOS v4.5:
 *   - ✅ FIX: action puede venir de query string O del body
 *   - ✅ LOGS: diagnóstico de payload recibido
 * 
 * CAMBIOS v4.3:
 *   - ✅ NUEVO: guardarChecklistRequisitos — Guarda checklist de requisitos
 *   - ✅ NUEVO: registrarRevalidacionHistorial — Historial de revalidaciones
 *   - ✅ NUEVO: obtenerHistorialRevalidaciones — Consultar historial
 * 
 * CAMBIOS v4.1:
 *   - subirArchivo — Sube PDFs a Google Drive
 *   - actualizarUrlsRecibo — Actualiza URLs de recibo en PAGOS
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
  'url_miniatura_fierro', 'url_reporte', 'url_certificado_imagen', 'qr_code'
];

const COLUMNAS_PAGOS = [
  'id_pago', 'folio', 'folio_fierro', 'ejercicio', 'periodo',
  'taxpayer_name', 'rfc', 'curp', 'address',
  'concepts', 'amount', 'date', 'status',
  'cashier_name', 'notes', 'referencia_pago', 'metodo_pago',
  'created_at', 'updated_at',
  'fecha_pago', 'cajero_confirmo', 'operador_entrego', 'recibo_tesoreria', 'fecha_entrega',
  'url_recibo_cloudinary', 'url_recibo_drive', 'url_reporte', 'url_recibo_drive_id'
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
    
    let payload = {};
    if (method === 'POST' && e.postData && e.postData.contents) {
      try { payload = JSON.parse(e.postData.contents); } catch (err) { payload = {}; }
    }
    
    // FIX_ACTION: action puede venir en query string O en el body
    const action = params.action || payload.action;
    
    // LOGS DE DIAGNÓSTICO
    Logger.log('[handleRequest] method=' + method);
    Logger.log('[handleRequest] e.parameter=' + JSON.stringify(e.parameter));
    Logger.log('[handleRequest] e.postData=' + (e.postData ? e.postData.contents.substring(0, 300) : 'NULL'));
    Logger.log('[handleRequest] action resuelto=' + action);
    Logger.log('[handleRequest] payload=' + JSON.stringify(payload).substring(0, 300));
    
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
      case 'health':                  return jsonResponse({ status: 'ok', service: 'panuco-fierros-api', version: '4.5', timestamp: new Date().toISOString() });
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
      case 'actualizarUrlCertificado': return actualizarUrlCertificado(payload);
      case 'guardarChecklistRequisitos': return guardarChecklistRequisitos(payload);
      case 'registrarRevalidacionHistorial': return registrarRevalidacionHistorial(payload);
      case 'obtenerHistorialRevalidaciones': return obtenerHistorialRevalidaciones(params);
      case 'guardarPasePreCertificado':  return jsonResponse(guardarPasePreCertificado(payload.data || payload));
      case 'listarPasesPreCertificados': return jsonResponse(listarPasesPreCertificados());
      case 'actualizarEstadoPase':       return jsonResponse(actualizarEstadoPase(payload.folio_pase, payload.nuevoEstado, payload.folio_certificado_vinculado));
      case 'actualizarUrlDocumentoPase': return jsonResponse(actualizarUrlDocumentoPase(payload.folio_pase, payload.url_documento_png));
      case 'revalidarRegistro':       return revalidarRegistro(payload);
      case 'cancelarRegistro':        return cancelarRegistro(payload);
      case 'emitirConstancia':        return emitirConstancia(payload);
      case 'buscarPropietario':       return buscarPropietario(params);
      case 'registrarDeguello':       return registrarDeguello(payload);
      case 'obtenerConstancias':      return obtenerConstancias(params);
      case 'obtenerDeguellos':        return obtenerDeguellos(params);
      default:
        return jsonResponse({
          success: false,
          error: 'Action no reconocida: ' + action,
          received_action: action,
          received_params: Object.keys(params),
          received_payload_keys: Object.keys(payload)
        });
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

  asegurarColumna(sheet, 'qr_code');

  if (data.vector_64d && Array.isArray(data.vector_64d)) {
    data.vector_64d = JSON.stringify(data.vector_64d);
  }

  // FIX_COLUMNAS_DINAMICAS: escribir por NOMBRE de encabezado, no por posición.
  // La hoja REGISTROS tiene una columna vacía entre url_reporte y
  // url_certificado_imagen; escribir por posición desplazaba url_certificado_imagen
  // y qr_code una columna a la izquierda (el QR terminaba bajo la columna del
  // certificado y se perdía). Con headers reales el mapeo siempre coincide.
  const headers = getSheetHeaders(sheet);
  const existing = buscarFilaPorFolio(SHEET_NAME, data.folio);

  if (existing > 0) {
    const existingValues = sheet.getRange(existing, 1, 1, headers.length).getValues()[0];
    headers.forEach(function(col, i) {
      if (!col) return; // columna sin encabezado: no tocar
      if (data[col] !== undefined && data[col] !== null) {
        existingValues[i] = data[col];
      }
    });
    sheet.getRange(existing, 1, 1, headers.length).setValues([existingValues]);
    return jsonResponse({ success: true, action: 'updated', folio: data.folio, row: existing });
  }

  const row = headers.map(function(col) {
    if (!col) return '';
    var val = data[col];
    if (col === 'fecha_captura' && !val) return new Date().toISOString();
    if (col === 'estatus' && !val) return 'ACTIVO';
    return val !== undefined && val !== null ? val : '';
  });
  sheet.appendRow(row);
  return jsonResponse({ success: true, action: 'inserted', folio: data.folio, row: sheet.getLastRow() });
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
        if (!h) return; // ignorar columna sin encabezado
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
    if (!h) return; // ignorar columna sin encabezado
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
  if (data.url_recibo_drive_id !== undefined) {
    const col = COLUMNAS_PAGOS.indexOf('url_recibo_drive_id') + 1;
    if (col > 0) sheet.getRange(row, col).setValue(data.url_recibo_drive_id || '');
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

function actualizarUrlCertificado(payload) {
  try {
    const data = payload.data || payload;
    const folio = data.folio;
    const urlCertificadoImagen = data.url_certificado_imagen;

    Logger.log('[actualizarUrlCertificado] folio=' + folio + ' url=' + urlCertificadoImagen);

    if (!folio) return jsonResponse({ success: false, error: 'Falta folio' });
    if (!urlCertificadoImagen) return jsonResponse({ success: false, error: 'Falta URL del certificado' });

    const sheet = getSheet(SHEET_NAME);
    const row = buscarFilaPorFolio(SHEET_NAME, folio);
    if (row <= 0) return jsonResponse({ success: false, error: 'Registro no encontrado: ' + folio });

    const col = asegurarColumna(sheet, 'url_certificado_imagen');
    sheet.getRange(row, col).setValue(urlCertificadoImagen || '');

    Logger.log('[actualizarUrlCertificado] OK folio=' + folio + ' row=' + row + ' col=' + col);

    return jsonResponse({
      success: true,
      action: 'url_certificado_imagen_actualizada',
      folio: folio,
      row: row,
      col: col,
      url: urlCertificadoImagen
    });
  } catch (err) {
    Logger.log('[actualizarUrlCertificado] ERROR: ' + err.message);
    return jsonResponse({ success: false, error: err.message || String(err) });
  }
}

function revalidarRegistro(payload) {
  const data = payload.data || payload;
  if (!data.folio) return jsonResponse({ success: false, error: 'Falta folio' });
  
  const sheet = getSheet(SHEET_NAME);
  const row = buscarFilaPorFolio(SHEET_NAME, data.folio);
  if (row <= 0) return jsonResponse({ success: false, error: 'Registro no encontrado: ' + data.folio });
  
  const colVigencia = asegurarColumna(sheet, 'vigencia');
  const colFechaExp = asegurarColumna(sheet, 'fecha_expedicion');
  const colOperador = asegurarColumna(sheet, 'operador');
  const colEstatus = asegurarColumna(sheet, 'estatus');
  
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
  
  const colEstatus = asegurarColumna(sheet, 'estatus');
  const colFechaBaja = asegurarColumna(sheet, 'fecha_baja');
  const colMotivoBaja = asegurarColumna(sheet, 'motivo_baja');
  const colOperadorBaja = asegurarColumna(sheet, 'operador_baja');
  
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
  
  const idxCurp = headers.indexOf('curp');
  const idxRfc = headers.indexOf('rfc');
  const idxNombre = headers.indexOf('nombre_productor');
  const idxFolio = headers.indexOf('folio');
  
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var curp = String(row[idxCurp] || '').toLowerCase();
    var rfc = String(row[idxRfc] || '').toLowerCase();
    var nombre = String(row[idxNombre] || '').toLowerCase();
    var folio = String(row[idxFolio] || '').toLowerCase();
    
    if (curp === q || rfc === q || folio === q || nombre.indexOf(q) > -1) {
      var registro = {};
      headers.forEach(function(h, j) {
        if (!h) return; // ignorar columna sin encabezado
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
// SUBIR ARCHIVO A GOOGLE DRIVE
// ============================================================================

function subirArchivo(payload) {
  const fileBase64 = payload.fileBase64;
  const filename = payload.filename || 'archivo_' + Date.now() + '.pdf';
  const subfolder = payload.subfolder || null;
  const mimeType = payload.mimeType || 'application/pdf';
  const fileId = payload.fileId || '';

  if (!fileBase64) {
    return jsonResponse({ success: false, error: 'Falta fileBase64' });
  }

  let base64Data = fileBase64;
  if (base64Data.indexOf('base64,') > -1) {
    base64Data = base64Data.split('base64,')[1];
  }

  let bytes;
  try {
    bytes = Utilities.base64Decode(base64Data);
  } catch (decodeErr) {
    return jsonResponse({ success: false, error: 'Base64 inválido: ' + decodeErr.message });
  }

  if (fileId) {
    try {
      const existing = DriveApp.getFileById(fileId);
      existing.setContent(bytes);
      if (existing.getName() !== filename) {
        existing.setName(filename);
      }
      try {
        existing.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (shareErr) {
        Logger.log('No se pudo reafirmar sharing: ' + shareErr.message);
      }
      return jsonResponse({
        success: true,
        fileId: existing.getId(),
        url: 'https://drive.google.com/uc?export=view&id=' + existing.getId(),
        urlPreview: 'https://drive.google.com/file/d/' + existing.getId() + '/view',
        filename: existing.getName(),
        provider: 'gdrive',
        overwritten: true
      });
    } catch (err) {
      Logger.log('No se pudo sobrescribir fileId ' + fileId + ': ' + err.message);
    }
  }

  const parentId = PropertiesService.getScriptProperties().getProperty('DRIVE_FOLDER_ID');
  if (!parentId) {
    return jsonResponse({ success: false, error: 'DRIVE_FOLDER_ID no configurado' });
  }

  let blob;
  try {
    blob = Utilities.newBlob(bytes, mimeType, filename);
  } catch (blobErr) {
    return jsonResponse({ success: false, error: 'Error creando blob: ' + blobErr.message });
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
      provider: 'gdrive',
      overwritten: false
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

function asegurarColumna(sheet, nombreColumna) {
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  const idx = headers.indexOf(nombreColumna);
  if (idx >= 0) return idx + 1;
  const newCol = lastCol + 1;
  sheet.getRange(1, newCol).setValue(nombreColumna);
  return newCol;
}

function getSheetHeaders(sheet) {
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0];
}

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
  
  // FIX_COLUMNAS_DINAMICAS: localizar la columna 'folio' por encabezado.
  const headers = getSheetHeaders(sheet);
  const idxFolio = headers.indexOf('folio');
  const colFolio = idxFolio >= 0 ? idxFolio + 1 : ((sheetName === SHEET_PAGOS) ? 2 : 3);
  
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

// ============================================================================
// PASE PRE-CERTIFICADO
// ============================================================================

function getSheetPases() {
  const sheetId = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!sheetId) throw new Error('SHEET_ID no configurado.');
  const ss = SpreadsheetApp.openById(sheetId);
  let sheet = ss.getSheetByName('PASES_PRE_CERTIFICADOS');
  if (!sheet) {
    sheet = ss.insertSheet('PASES_PRE_CERTIFICADOS');
    const columnas = [
      'folio_pase', 'fecha_emision', 'fecha_vencimiento', 'dias_vigencia',
      'solicitante_nombre', 'solicitante_telefono', 'solicitante_curp', 'solicitante_rfc',
      'solicitante_ejido', 'solicitante_municipio', 'solicitante_notas',
      'checksum_vector', 'vector_64d', 'fierro_image_url',
      'estado', 'folio_certificado_vinculado', 'emitido_por', 'emitido_en',
      'qr_code', 'notas_admin', 'url_documento_png'
    ];
    sheet.getRange(1, 1, 1, columnas.length).setValues([columnas]);
    sheet.getRange(1, 1, 1, columnas.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  } else {
    const lastCol = Math.max(sheet.getLastColumn(), 1);
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    if (headers.indexOf('url_documento_png') < 0) {
      sheet.getRange(1, lastCol + 1).setValue('url_documento_png');
      sheet.getRange(1, lastCol + 1).setFontWeight('bold');
    }
  }
  return sheet;
}

function actualizarUrlDocumentoPase(folio_pase, url_documento_png) {
  try {
    const sheet = getSheetPases();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: false, error: 'Sin datos' };
    const lastCol = Math.max(sheet.getLastColumn(), 1);
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const idxFolio = headers.indexOf('folio_pase');
    const idxUrl = headers.indexOf('url_documento_png');
    if (idxFolio < 0 || idxUrl < 0) return { success: false, error: 'Columnas no encontradas' };

    const values = sheet.getRange(2, idxFolio + 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < values.length; i++) {
      if (String(values[i][0]).trim() === String(folio_pase).trim()) {
        sheet.getRange(i + 2, idxUrl + 1).setValue(url_documento_png || '');
        return { success: true };
      }
    }
    return { success: false, error: 'Pase no encontrado: ' + folio_pase };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

function guardarPasePreCertificado(data) {
  try {
    const sheet = getSheetPases();
    const fila = [
      data.folio_pase || '',
      data.fecha_emision || '',
      data.fecha_vencimiento || '',
      data.dias_vigencia || 15,
      data.solicitante_nombre || '',
      data.solicitante_telefono || '',
      data.solicitante_curp || '',
      data.solicitante_rfc || '',
      data.solicitante_ejido || '',
      data.solicitante_municipio || 'Pánuco',
      data.solicitante_notas || '',
      data.checksum_vector || '',
      data.vector_64d ? JSON.stringify(data.vector_64d) : '',
      data.fierro_image_url || '',
      data.estado || 'RESERVADO',
      data.folio_certificado_vinculado || '',
      data.emitido_por || '',
      data.emitido_en || new Date().toISOString(),
      data.qr_code || '',
      data.notas_admin || ''
    ];
    sheet.appendRow(fila);
    return { success: true, folio_pase: data.folio_pase };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

function listarPasesPreCertificados() {
  try {
    const sheet = getSheetPases();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: true, pases: [] };
    const values = sheet.getRange(2, 1, lastRow - 1, 20).getValues();
    const pases = values.map(function(r) {
      return {
        folio_pase: r[0], fecha_emision: r[1], fecha_vencimiento: r[2],
        dias_vigencia: r[3], solicitante_nombre: r[4], solicitante_telefono: r[5],
        solicitante_curp: r[6], solicitante_rfc: r[7], solicitante_ejido: r[8],
        solicitante_municipio: r[9], solicitante_notas: r[10],
        checksum_vector: r[11], vector_64d: r[12] ? JSON.parse(r[12]) : [],
        fierro_image_url: r[13], estado: r[14], folio_certificado_vinculado: r[15],
        emitido_por: r[16], emitido_en: r[17], qr_code: r[18], notas_admin: r[19]
      };
    });
    return { success: true, pases: pases };
  } catch (err) {
    return { success: false, error: String(err), pases: [] };
  }
}

function actualizarEstadoPase(folio_pase, nuevoEstado, folio_certificado_vinculado) {
  try {
    const sheet = getSheetPases();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: false, error: 'Sin datos' };
    const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < values.length; i++) {
      if (String(values[i][0]).trim() === String(folio_pase).trim()) {
        sheet.getRange(i + 2, 15).setValue(nuevoEstado);
        if (folio_certificado_vinculado) {
          sheet.getRange(i + 2, 16).setValue(folio_certificado_vinculado);
        }
        return { success: true };
      }
    }
    return { success: false, error: 'Pase no encontrado: ' + folio_pase };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

// ============================================================================
// v4.3 · HISTORIAL DE REVALIDACIONES
// ============================================================================

function registrarRevalidacionHistorial(payload) {
  try {
    const data = payload.data || payload;
    const folioOriginal = data.folio_original;
    const vigenciaAnterior = data.vigencia_anterior || '';
    const vigenciaNueva = data.vigencia_nueva || '';
    const operador = data.operador || 'SISTEMA';
    const notas = data.notas || '';

    if (!folioOriginal) {
      return jsonResponse({ success: false, error: 'Falta folio_original' });
    }
    if (!vigenciaNueva) {
      return jsonResponse({ success: false, error: 'Falta vigencia_nueva' });
    }

    const sheetId = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
    const ss = SpreadsheetApp.openById(sheetId);
    let sheet = ss.getSheetByName('REVALIDACIONES');
    if (!sheet) {
      return jsonResponse({ success: false, error: 'Hoja REVALIDACIONES no existe. Ejecutar script de instalación.' });
    }

    const timestamp = Date.now();
    const year = new Date().getFullYear();
    const folioRevalidacion = 'REV-' + year + '-' + String(timestamp).slice(-6);
    const idRevalidacion = 'rev-' + timestamp;
    const now = new Date().toISOString();

    const fila = [
      idRevalidacion,
      folioOriginal,
      folioRevalidacion,
      now,
      vigenciaAnterior,
      vigenciaNueva,
      operador,
      notas,
    ];

    sheet.appendRow(fila);

    return jsonResponse({
      success: true,
      action: 'revalidacion_registrada',
      id_revalidacion: idRevalidacion,
      folio_revalidacion: folioRevalidacion,
      folio_original: folioOriginal,
      fecha_revalidacion: now,
      row: sheet.getLastRow(),
    });

  } catch (err) {
    return jsonResponse({
      success: false,
      error: 'Error registrando revalidación: ' + (err.message || String(err))
    });
  }
}

function obtenerHistorialRevalidaciones(params) {
  try {
    const folioOriginal = params.folio_original;
    if (!folioOriginal) {
      return jsonResponse({ success: false, error: 'Falta folio_original' });
    }

    const sheetId = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
    const ss = SpreadsheetApp.openById(sheetId);
    const sheet = ss.getSheetByName('REVALIDACIONES');
    if (!sheet) {
      return jsonResponse({ success: true, revalidaciones: [], total: 0 });
    }

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return jsonResponse({ success: true, revalidaciones: [], total: 0 });
    }

    const data = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
    const revalidaciones = data
      .filter(function(r) { return String(r[1]).trim() === String(folioOriginal).trim(); })
      .map(function(r) {
        return {
          id_revalidacion: r[0],
          folio_original: r[1],
          folio_revalidacion: r[2],
          fecha_revalidacion: r[3],
          vigencia_anterior: r[4],
          vigencia_nueva: r[5],
          operador: r[6],
          notas: r[7],
        };
      })
      .reverse();

    return jsonResponse({
      success: true,
      total: revalidaciones.length,
      revalidaciones: revalidaciones,
    });

  } catch (err) {
    return jsonResponse({
      success: false,
      error: 'Error obteniendo historial: ' + (err.message || String(err))
    });
  }
}

// ============================================================================
// v4.3 · CHECKLIST DE REQUISITOS
// ============================================================================

function guardarChecklistRequisitos(payload) {
  try {
    const data = payload.data || payload;
    const folio = data.folio;
    const tramite = data.tramite || 'REVALIDACION';
    const marcados = data.requisitos_marcados || [];
    const totalCriticos = data.total_criticos || 0;
    const operador = data.operador || 'SISTEMA';

    if (!folio) {
      return jsonResponse({ success: false, error: 'Falta folio' });
    }

    const sheet = getSheet(SHEET_NAME);
    const row = buscarFilaPorFolio(SHEET_NAME, folio);
    if (row <= 0) {
      return jsonResponse({ success: false, error: 'Registro no encontrado: ' + folio });
    }

    const colChecklist = asegurarColumna(sheet, 'checklist_revalidacion');
    const colFecha = asegurarColumna(sheet, 'checklist_revalidacion_fecha');
    const colOperador = asegurarColumna(sheet, 'checklist_revalidacion_operador');
    const colCriticos = asegurarColumna(sheet, 'checklist_revalidacion_total_criticos');
    const colTramite = asegurarColumna(sheet, 'checklist_revalidacion_tramite');

    const now = new Date().toISOString();
    sheet.getRange(row, colChecklist).setValue(JSON.stringify(marcados));
    sheet.getRange(row, colFecha).setValue(now);
    sheet.getRange(row, colOperador).setValue(operador);
    sheet.getRange(row, colCriticos).setValue(totalCriticos);
    sheet.getRange(row, colTramite).setValue(tramite);

    return jsonResponse({
      success: true,
      action: 'checklist_guardado',
      folio: folio,
      tramite: tramite,
      total_marcados: marcados.length,
      total_criticos: totalCriticos,
      fecha: now,
      row: row
    });

  } catch (err) {
    return jsonResponse({
      success: false,
      error: 'Error guardando checklist: ' + (err.message || String(err))
    });
  }
}