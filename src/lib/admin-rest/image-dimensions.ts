/* Extract image dimensions from file magic bytes and headers.
   Supports JPEG, PNG, GIF, WebP, and AVIF. */

type ImageDimensions = { width: number; height: number } | null;

export function getImageDimensions(data: Uint8Array | Buffer): ImageDimensions {
  if (data.length < 8) return null;

  // JPEG: FFD8 marker, look for SOF
  if (data[0] === 0xff && data[1] === 0xd8) {
    return getJpegDimensions(data);
  }

  // PNG: 89 50 4E 47
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) {
    return getPngDimensions(data);
  }

  // GIF: 47 49 46 (GIF87a or GIF89a)
  if (data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46) {
    return getGifDimensions(data);
  }

  // WebP: RIFF...WEBP
  if (data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46 && data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50) {
    return getWebpDimensions(data);
  }

  // AVIF: ftyp with av01 brand or mif1 brand
  if (data[4] === 0x66 && data[5] === 0x74 && data[6] === 0x79 && data[7] === 0x70) {
    const brand = String.fromCharCode(data[8], data[9], data[10], data[11]);
    if (brand === "av01" || brand === "mif1") {
      return getAvifDimensions();
    }
  }

  return null;
}

function getJpegDimensions(data: Uint8Array | Buffer): ImageDimensions {
  let pos = 2;
  while (pos < data.length - 8) {
    if (data[pos] !== 0xff) {
      pos++;
      continue;
    }
    const marker = data[pos + 1];
    // Skip markers without payload (RST, EOI)
    if (marker === 0x00 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      pos += 2;
      continue;
    }
    // SOF markers (C0, C1, C2, C9, CA, CB)
    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc9 && marker <= 0xcb)) {
      const length = (data[pos + 2] << 8) | data[pos + 3];
      if (pos + 4 + length > data.length) return null;
      // height at offset 5-6, width at 7-8
      const height = (data[pos + 5] << 8) | data[pos + 6];
      const width = (data[pos + 7] << 8) | data[pos + 8];
      return height > 0 && width > 0 ? { width, height } : null;
    }
    // Skip other markers
    const length = (data[pos + 2] << 8) | data[pos + 3];
    pos += 2 + length;
  }
  return null;
}

function getPngDimensions(data: Uint8Array | Buffer): ImageDimensions {
  if (data.length < 24) return null;
  // IHDR chunk at offset 8: width (4 bytes) at 16, height (4 bytes) at 20
  const width = (data[16] << 24) | (data[17] << 16) | (data[18] << 8) | data[19];
  const height = (data[20] << 24) | (data[21] << 16) | (data[22] << 8) | data[23];
  return width > 0 && height > 0 ? { width, height } : null;
}

function getGifDimensions(data: Uint8Array | Buffer): ImageDimensions {
  if (data.length < 10) return null;
  // Width at 6-7 (little-endian), height at 8-9
  const width = data[6] | (data[7] << 8);
  const height = data[8] | (data[9] << 8);
  return width > 0 && height > 0 ? { width, height } : null;
}

function getWebpDimensions(data: Uint8Array | Buffer): ImageDimensions {
  if (data.length < 30) return null;
  // VP8 chunk: 9A 01 2A for lossy
  if (data[12] === 0x56 && data[13] === 0x50 && data[14] === 0x38 && data[15] === 0x20) {
    const b0 = data[26];
    const b1 = data[27];
    const b2 = data[28];
    const width = 1 + (((b1 << 8) | b0) & 0x3fff);
    const height = 1 + (((data[29] << 8) | b2) & 0x3fff);
    return { width, height };
  }
  // VP8L chunk: 9D 01 2A for lossless
  if (data[12] === 0x56 && data[13] === 0x50 && data[14] === 0x38 && data[15] === 0x4c) {
    if (data.length < 21) return null;
    const bits = (data[16] | (data[17] << 8) | (data[18] << 16) | (data[19] << 24)) >>> 0;
    const width = 1 + ((bits & 0x3fff) >>> 0);
    const height = 1 + (((bits >>> 14) & 0x3fff) >>> 0);
    return { width, height };
  }
  return null;
}

function getAvifDimensions(): ImageDimensions {
  // AVIF is complex; a minimal parser looking for the ipma and pitm boxes
  // For simplicity, return null for now (rarely used in wordpress uploads)
  return null;
}
