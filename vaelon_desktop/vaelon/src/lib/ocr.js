const MAX_IMAGE_SIZE = 20 * 1024 * 1024;

export const extractTextFromImage = async (file) => {
  if (!file) {
    throw new Error('Please choose an image file.');
  }

  const allowedTypes = [
    'image/png', 'image/jpeg', 'image/webp', 'image/bmp',
    'image/heic', 'image/heif',
  ];

  if (!allowedTypes.includes(file.type) && !file.name?.match(/\.(heic|heif)$/i)) {
    throw new Error('Only PNG, JPG, WEBP, BMP, and HEIC images are supported.');
  }

  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error('Image is too large. Please upload a file under 20 MB.');
  }

  // OCR requires a server-side service (Tesseract, etc.)
  // For local Tauri mode, this feature is not yet available.
  throw new Error('OCR is not available in local mode. Paste text directly or use PDF extraction.');
};

export const getImageConfidence = async (file) => {
  return 'low';
};
