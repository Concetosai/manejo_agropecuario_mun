const fs = require('fs');
const path = './server.ts';
let content = fs.readFileSync(path, 'utf8');
const original = content;

// 1. Corregir el DOMICILIO para que no capture el encabezado "DIRECCION GENERAL"
const oldDomRegex = "const domMatch = upper.match(/(?:DOMICILIO\\s+DEL\\s+PRODUCTOR|DOMICILIO|DIRECCI[OÓ]N)[:\\s]+([^\\n\\r]{4,70})/i);";
const newDomRegex = "const domMatch = upper.match(/(?:DOMICILIO\\s+DEL\\s+PRODUCTOR|DOMICILIO|DIRECCI[OÓ]N\\s+DEL\\s+PRODUCTOR)[:\\s]+([^\\n\\r]{4,70})/i);";

if (content.includes(oldDomRegex)) {
  content = content.replace(oldDomRegex, newDomRegex);
  console.log('OK: Domicilio regex corregido');
} else {
  console.log('WARN: Domicilio regex no encontrado');
}

// 2. Corregir el FOLIO para que ignore el teléfono (agregando \b para no capturar "TELEFONO")
const oldFolioRegex = "const folioMatch = upper.match(/(?:FOLIO|EXPEDIENTE|REGISTRO|NO\\.?)[:\\s]+([A-Z0-9\\-\\/]{4,25})/i);";
const newFolioRegex = "const folioMatch = upper.match(/\\b(?:FOLIO|EXPEDIENTE|REGISTRO|NO\\.?)[:\\s]+([A-Z0-9\\-\\/]{4,25})/i);";

if (content.includes(oldFolioRegex)) {
  content = content.replace(oldFolioRegex, newFolioRegex);
  console.log('OK: Folio regex corregido (ignora telefono)');
} else {
  console.log('WARN: Folio regex no encontrado');
}

// 3. Agregar extracción específica para el Número de Registro (285) y Fojas (25)
const oldRegistroBlock = "let folio = '';";
const newRegistroBlock = `let folio = '';
    // Buscar específicamente el número de registro oficial (ej. "BAJO EL NUMERO 285" o "REGISTRO: 285")
    const numRegistroMatch = upper.match(/(?:BAJO\\s+EL\\s+NUMERO|NUMERO\\s+DE\\s+REGISTRO|REGISTRO)[:\\s]+(\\d{1,5})/i);
    if (numRegistroMatch && numRegistroMatch[1]) {
      folio = numRegistroMatch[1].trim();
    }`;

if (content.includes(oldRegistroBlock)) {
  content = content.replace(oldRegistroBlock, newRegistroBlock);
  console.log('OK: Extracción de Número de Registro agregada');
} else {
  console.log('WARN: Bloque de Folio no encontrado');
}

// 4. Corrección para Fojas (ej. "A FOJAS 25")
const oldFojasRegex = "const fojaMatch = upper.match(/(?:A\\s+FOJAS|FOJA|PÁGINA|PAG\\.)[:\\s]+(\\d+)/i);";
const newFojasRegex = "const fojaMatch = upper.match(/(?:A\\s+FOJAS|FOJA|PÁGINA|PAG\\.)[:\\s]+(\\d+)/i);";

if (content.includes(oldFojasRegex)) {
  console.log('OK: Fojas regex ya está correcto');
} else {
  console.log('INFO: Fojas regex no modificado');
}

if (content !== original) {
  fs.writeFileSync(path, content, 'utf8');
  console.log('SAVED: server.ts actualizado exitosamente');
} else {
  console.log('NO CHANGES: No se realizaron cambios');
}
