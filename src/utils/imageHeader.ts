/**
 * Fast binary header parser to retrieve image dimensions in < 1ms
 * without decoding the full bitmap.
 */
export async function fastGetImageDimensions(file: File): Promise<{ width: number; height: number }> {
  try {
    // Read first 128KB which contains the headers of 99.9% of images
    const slice = file.slice(0, 131072);
    const buffer = await slice.arrayBuffer();
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    // 1. PNG: \x89PNG\r\n\x1a\n
    if (
      bytes.length >= 24 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
      bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
    ) {
      const width = view.getUint32(16, false);
      const height = view.getUint32(20, false);
      if (width > 0 && height > 0) return { width, height };
    }

    // 2. GIF: GIF87a or GIF89a
    if (
      bytes.length >= 10 &&
      bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 &&
      bytes[3] === 0x38 && (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61
    ) {
      const width = view.getUint16(6, true);
      const height = view.getUint16(8, true);
      if (width > 0 && height > 0) return { width, height };
    }

    // 3. WebP: RIFF....WEBP
    if (
      bytes.length >= 30 &&
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && // RIFF
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50 // WEBP
    ) {
      const chunkType = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
      if (chunkType === 'VP8 ') {
        // Lossy
        if (bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
          const width = view.getUint16(26, true) & 0x3fff;
          const height = view.getUint16(28, true) & 0x3fff;
          if (width > 0 && height > 0) return { width, height };
        }
      } else if (chunkType === 'VP8L') {
        // Lossless
        if (bytes[20] === 0x2f) {
          const b1 = bytes[21];
          const b2 = bytes[22];
          const b3 = bytes[23];
          const b4 = bytes[24];
          const width = 1 + (((b2 & 0x3f) << 8) | b1);
          const height = 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6));
          if (width > 0 && height > 0) return { width, height };
        }
      } else if (chunkType === 'VP8X') {
        // Extended
        const width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
        const height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
        if (width > 0 && height > 0) return { width, height };
      }
    }

    // 4. JPEG: 0xFF, 0xD8
    if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
      let offset = 2;
      while (offset < bytes.length - 8) {
        if (bytes[offset] !== 0xff) {
          offset++;
          continue;
        }
        const marker = bytes[offset + 1];
        // SOF markers that contain dimensions
        if (
          (marker >= 0xc0 && marker <= 0xc3) ||
          (marker >= 0xc5 && marker <= 0xc7) ||
          (marker >= 0xc9 && marker <= 0xcb) ||
          (marker >= 0xcd && marker <= 0xcf)
        ) {
          const height = view.getUint16(offset + 5, false);
          const width = view.getUint16(offset + 7, false);
          if (width > 0 && height > 0) return { width, height };
          break;
        } else if (marker === 0xd8 || marker === 0xd9 || marker === 0x00) {
          offset += 2;
        } else if (marker >= 0xd0 && marker <= 0xd7) {
          offset += 2;
        } else {
          const length = view.getUint16(offset + 2, false);
          offset += 2 + length;
        }
      }
    }
  } catch (err) {
    console.warn('Fast header parse failed, falling back:', err);
  }

  // 5. Fallback using createImageBitmap (instant if browser supports it)
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file);
      const { width, height } = bmp;
      bmp.close();
      if (width > 0 && height > 0) return { width, height };
    } catch {
      // Fall through to Image tag
    }
  }

  // 6. Final fallback: new Image()
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth || 480, height: img.naturalHeight || 480 });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ width: 480, height: 480 });
    };
    img.src = url;
  });
}
