// src/services/cloudinaryService.ts
// FIX_CLOUDINARY: Subida de imagenes a Cloudinary (unsigned preset)
// Reemplaza a Google Drive para evitar limites de localStorage.

const CLOUD_NAME = 'up9bfdww';
const UPLOAD_PRESET = 'panuco_fierros'; // Debe existir como UNSIGNED en Cloudinary
const FOLDER_ROOT = 'panuco_fierros';

export interface CloudinaryUploadResult {
  success: boolean;
  url?: string;
  publicId?: string;
  error?: string;
}

export async function subirImagenACloudinary(
  base64: string,
  filename: string,
  folder: string
): Promise<CloudinaryUploadResult> {
  if (!base64 || base64.length < 100) {
    return { success: false, error: 'Imagen vacia o invalida' };
  }

  try {
    const endpoint = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
    const publicId = filename.replace(/\.[^.]+$/, '');

    const formData = new FormData();
    formData.append('file', base64);
    formData.append('upload_preset', UPLOAD_PRESET);
    formData.append('folder', `${FOLDER_ROOT}/${folder}`);
    formData.append('public_id', publicId);

    console.log(`[Cloudinary] Subiendo ${filename} -> ${FOLDER_ROOT}/${folder}...`);

    const res = await fetch(endpoint, { method: 'POST', body: formData });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[Cloudinary] Error HTTP', res.status, errText);
      return { success: false, error: `HTTP ${res.status}` };
    }

    const data = await res.json();
    console.log('%c[Cloudinary] Subida OK', 'color:#22c55e', data.secure_url);
    return {
      success: true,
      url: data.secure_url,
      publicId: data.public_id,
    };
  } catch (err: any) {
    console.error('[Cloudinary] Excepcion:', err);
    return { success: false, error: err?.message || 'Error desconocido' };
  }
}

/**
 * Elimina una imagen de Cloudinary (requiere backend firmado - no-op por ahora).
 */
export async function eliminarImagenDeCloudinary(_publicId: string): Promise<boolean> {
  console.warn('[Cloudinary] eliminarImagenDeCloudinary no implementado');
  return false;
}
