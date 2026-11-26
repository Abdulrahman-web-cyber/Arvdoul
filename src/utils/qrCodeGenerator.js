/**
 * Standalone ISO/IEC 18004 QR Code encoder for Arvdoul profiles & digital passports.
 * Supports Byte Mode, Versions 1-14, ECC Level H (30%, default for center-badge tolerance)
 * with automatic fallback to ECC Level M (15%) for ultra-long payloads, BCH format &
 * version info encoding (v7-v14), and 8-mask penalty minimization.
 */

const EXP_TABLE = new Uint8Array(256);
const LOG_TABLE = new Uint8Array(256);

(function initGaloisField() {
  let val = 1;
  for (let i = 0; i < 255; i++) {
    EXP_TABLE[i] = val;
    LOG_TABLE[val] = i;
    val <<= 1;
    if (val & 0x100) {
      val ^= 0x11d; // Primitive polynomial x^8 + x^4 + x^3 + x^2 + 1
    }
  }
  EXP_TABLE[255] = EXP_TABLE[0];
})();

function gfMultiply(x, y) {
  if (x === 0 || y === 0) return 0;
  return EXP_TABLE[(LOG_TABLE[x] + LOG_TABLE[y]) % 255];
}

function rsGeneratorPoly(degree) {
  // Highest-degree-first representation: poly[0] is leading coefficient (x^degree), poly[degree] is constant term
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMultiply(poly[j], EXP_TABLE[i]);
    }
    poly = next;
  }
  return poly;
}

function rsComputeRemainder(data, ecCount) {
  const gen = rsGeneratorPoly(ecCount);
  const result = new Array(ecCount).fill(0);
  for (const byte of data) {
    const factor = byte ^ result.shift();
    result.push(0);
    for (let i = 0; i < ecCount; i++) {
      result[i] ^= gfMultiply(gen[i + 1], factor);
    }
  }
  return result;
}

// ISO/IEC 18004 EC specifications for Byte Mode (Versions 1-14)
// Format: { version, size, totalCodewords, ecPerBlock, b1, d1, b2, d2 }
const QR_SPECS = {
  H: [
    null,
    { version: 1, size: 21, totalCodewords: 26, ecPerBlock: 17, b1: 1, d1: 9, b2: 0, d2: 0 },
    { version: 2, size: 25, totalCodewords: 44, ecPerBlock: 28, b1: 1, d1: 16, b2: 0, d2: 0 },
    { version: 3, size: 29, totalCodewords: 70, ecPerBlock: 22, b1: 2, d1: 13, b2: 0, d2: 0 },
    { version: 4, size: 33, totalCodewords: 100, ecPerBlock: 16, b1: 4, d1: 9, b2: 0, d2: 0 },
    { version: 5, size: 37, totalCodewords: 134, ecPerBlock: 22, b1: 2, d1: 11, b2: 2, d2: 12 },
    { version: 6, size: 41, totalCodewords: 172, ecPerBlock: 28, b1: 4, d1: 15, b2: 0, d2: 0 },
    { version: 7, size: 45, totalCodewords: 196, ecPerBlock: 26, b1: 4, d1: 13, b2: 1, d2: 14 },
    { version: 8, size: 49, totalCodewords: 242, ecPerBlock: 26, b1: 4, d1: 14, b2: 2, d2: 15 },
    { version: 9, size: 53, totalCodewords: 292, ecPerBlock: 24, b1: 4, d1: 12, b2: 4, d2: 13 },
    { version: 10, size: 57, totalCodewords: 346, ecPerBlock: 28, b1: 6, d1: 15, b2: 2, d2: 16 },
    { version: 11, size: 61, totalCodewords: 404, ecPerBlock: 24, b1: 3, d1: 12, b2: 8, d2: 13 },
    { version: 12, size: 65, totalCodewords: 466, ecPerBlock: 28, b1: 7, d1: 14, b2: 4, d2: 15 },
    { version: 13, size: 69, totalCodewords: 532, ecPerBlock: 22, b1: 12, d1: 11, b2: 4, d2: 12 },
    { version: 14, size: 73, totalCodewords: 581, ecPerBlock: 24, b1: 11, d1: 12, b2: 5, d2: 13 },
  ],
  M: [
    null,
    { version: 1, size: 21, totalCodewords: 26, ecPerBlock: 10, b1: 1, d1: 16, b2: 0, d2: 0 },
    { version: 2, size: 25, totalCodewords: 44, ecPerBlock: 16, b1: 1, d1: 28, b2: 0, d2: 0 },
    { version: 3, size: 29, totalCodewords: 70, ecPerBlock: 26, b1: 1, d1: 44, b2: 0, d2: 0 },
    { version: 4, size: 33, totalCodewords: 100, ecPerBlock: 18, b1: 2, d1: 32, b2: 0, d2: 0 },
    { version: 5, size: 37, totalCodewords: 134, ecPerBlock: 24, b1: 2, d1: 43, b2: 0, d2: 0 },
    { version: 6, size: 41, totalCodewords: 172, ecPerBlock: 16, b1: 4, d1: 27, b2: 0, d2: 0 },
    { version: 7, size: 45, totalCodewords: 196, ecPerBlock: 18, b1: 4, d1: 31, b2: 0, d2: 0 },
    { version: 8, size: 49, totalCodewords: 242, ecPerBlock: 22, b1: 2, d1: 38, b2: 2, d2: 39 },
    { version: 9, size: 53, totalCodewords: 292, ecPerBlock: 22, b1: 3, d1: 36, b2: 2, d2: 37 },
    { version: 10, size: 57, totalCodewords: 346, ecPerBlock: 26, b1: 4, d1: 43, b2: 1, d2: 44 },
    { version: 11, size: 61, totalCodewords: 404, ecPerBlock: 30, b1: 1, d1: 50, b2: 4, d2: 51 },
    { version: 12, size: 65, totalCodewords: 466, ecPerBlock: 22, b1: 6, d1: 36, b2: 2, d2: 37 },
    { version: 13, size: 69, totalCodewords: 532, ecPerBlock: 22, b1: 8, d1: 37, b2: 1, d2: 38 },
    { version: 14, size: 73, totalCodewords: 581, ecPerBlock: 24, b1: 4, d1: 40, b2: 5, d2: 41 },
  ],
};

// Alignment pattern centers for versions 1 to 14
const ALIGNMENT_PATTERNS = [
  [],
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
  [6, 30, 54],
  [6, 32, 58],
  [6, 34, 62],
  [6, 26, 46, 66],
];

const EC_LEVEL_BITS = {
  L: 0b01,
  M: 0b00,
  Q: 0b11,
  H: 0b10,
};

function computeBch(value, poly, dataBitsLen, totalBitsLen) {
  const shift = totalBitsLen - dataBitsLen;
  let rem = value << shift;
  const polyMSB = 31 - Math.clz32(poly);
  while (rem !== 0) {
    const remMSB = 31 - Math.clz32(rem);
    if (remMSB < polyMSB) break;
    rem ^= poly << (remMSB - polyMSB);
  }
  return (value << shift) | rem;
}

function getFormatInfoBits(ecLevel, maskIndex) {
  const ecBits = EC_LEVEL_BITS[ecLevel] ?? EC_LEVEL_BITS.H;
  const data = (ecBits << 3) | (maskIndex & 7);
  // Generator G(x) = x^10 + x^8 + x^5 + x^4 + x^2 + x + 1 -> 0x537; XOR mask -> 0x5412
  return computeBch(data, 0x537, 5, 15) ^ 0x5412;
}

function getVersionInfoBits(version) {
  // Generator G(x) = x^12 + x^11 + x^10 + x^9 + x^8 + x^5 + x^2 + 1 -> 0x1f25
  return computeBch(version, 0x1f25, 6, 18);
}

function selectSpec(byteLength, preferredLevel = 'H') {
  const primary = preferredLevel === 'M' ? 'M' : 'H';
  const order = primary === 'H' ? ['H', 'M'] : ['M', 'H'];

  for (const level of order) {
    const table = QR_SPECS[level];
    for (let v = 1; v < table.length; v++) {
      const info = table[v];
      const capacity = info.b1 * info.d1 + info.b2 * info.d2;
      const headerBytes = v < 10 ? 2 : 3; // 4-bit mode + 8/16-bit count
      if (capacity >= byteLength + headerBytes) {
        return { info, ecLevel: level };
      }
    }
  }
  throw new Error(`QR payload (${byteLength} bytes) exceeds supported capacity`);
}

function encodeData(utf8Bytes, versionInfo) {
  const totalDataBytes = versionInfo.b1 * versionInfo.d1 + versionInfo.b2 * versionInfo.d2;

  const bits = [];
  function pushBits(val, len) {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >>> i) & 1);
    }
  }

  // 1. Mode indicator: Byte mode (0100)
  pushBits(0b0100, 4);

  // 2. Character count indicator: 8 bits for versions 1-9, 16 bits for version 10+
  const countBits = versionInfo.version < 10 ? 8 : 16;
  pushBits(utf8Bytes.length, countBits);

  // 3. Encode data bytes
  for (const b of utf8Bytes) {
    pushBits(b, 8);
  }

  // 4. Terminator (up to 4 zeroes)
  const maxBits = totalDataBytes * 8;
  const termLen = Math.min(4, maxBits - bits.length);
  pushBits(0, termLen);

  // 5. Pad to byte boundary
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  // 6. Pack into bytes and pad with 0xEC / 0x11
  const dataBytes = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byteVal = 0;
    for (let j = 0; j < 8; j++) {
      byteVal = (byteVal << 1) | bits[i + j];
    }
    dataBytes.push(byteVal);
  }

  const padPatterns = [0xec, 0x11];
  let padIdx = 0;
  while (dataBytes.length < totalDataBytes) {
    dataBytes.push(padPatterns[padIdx % 2]);
    padIdx++;
  }

  return dataBytes;
}

function generateCodewords(dataBytes, vInfo) {
  const blocks = [];
  let byteOffset = 0;

  for (let i = 0; i < vInfo.b1; i++) {
    const blockData = dataBytes.slice(byteOffset, byteOffset + vInfo.d1);
    byteOffset += vInfo.d1;
    blocks.push({ data: blockData, ec: rsComputeRemainder(blockData, vInfo.ecPerBlock) });
  }

  for (let i = 0; i < vInfo.b2; i++) {
    const blockData = dataBytes.slice(byteOffset, byteOffset + vInfo.d2);
    byteOffset += vInfo.d2;
    blocks.push({ data: blockData, ec: rsComputeRemainder(blockData, vInfo.ecPerBlock) });
  }

  const finalCodewords = [];
  const maxDataLen = Math.max(vInfo.d1, vInfo.d2);
  for (let i = 0; i < maxDataLen; i++) {
    for (const b of blocks) {
      if (i < b.data.length) finalCodewords.push(b.data[i]);
    }
  }

  for (let i = 0; i < vInfo.ecPerBlock; i++) {
    for (const b of blocks) {
      if (i < b.ec.length) finalCodewords.push(b.ec[i]);
    }
  }

  return finalCodewords;
}

const MASK_FNS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function writeFormatAndVersion(matrix, size, version, ecLevel, maskIndex) {
  const formatBits = getFormatInfoBits(ecLevel, maskIndex);
  for (let i = 0; i < 15; i++) {
    const bit = (formatBits >>> (14 - i)) & 1;
    // Top-left format strip
    if (i <= 5) matrix[8][i] = bit;
    else if (i === 6) matrix[8][7] = bit;
    else if (i === 7) matrix[8][8] = bit;
    else if (i === 8) matrix[7][8] = bit;
    else matrix[14 - i][8] = bit;

    // Bottom-left & top-right format strips
    if (i < 8) matrix[size - 1 - i][8] = bit;
    else matrix[8][size - 15 + i] = bit;
  }

  if (version >= 7) {
    const versionBits = getVersionInfoBits(version);
    for (let i = 0; i < 18; i++) {
      const bit = (versionBits >>> i) & 1;
      const a = Math.floor(i / 3);
      const b = size - 11 + (i % 3);
      matrix[b][a] = bit;
      matrix[a][b] = bit;
    }
  }
}

function evaluateMaskPenalty(matrix, size) {
  let penalty = 0;

  // N1: 5+ consecutive same-color modules in row/col
  for (let r = 0; r < size; r++) {
    let runColor = matrix[r][0];
    let runLen = 1;
    for (let c = 1; c < size; c++) {
      if (matrix[r][c] === runColor) {
        runLen++;
      } else {
        if (runLen >= 5) penalty += 3 + (runLen - 5);
        runColor = matrix[r][c];
        runLen = 1;
      }
    }
    if (runLen >= 5) penalty += 3 + (runLen - 5);
  }
  for (let c = 0; c < size; c++) {
    let runColor = matrix[0][c];
    let runLen = 1;
    for (let r = 1; r < size; r++) {
      if (matrix[r][c] === runColor) {
        runLen++;
      } else {
        if (runLen >= 5) penalty += 3 + (runLen - 5);
        runColor = matrix[r][c];
        runLen = 1;
      }
    }
    if (runLen >= 5) penalty += 3 + (runLen - 5);
  }

  // N2: 2x2 blocks of same color
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = matrix[r][c];
      if (v === matrix[r][c + 1] && v === matrix[r + 1][c] && v === matrix[r + 1][c + 1]) {
        penalty += 3;
      }
    }
  }

  // N3: 1:1:3:1:1 finder-like ratio preceded or followed by 4 light modules
  const isPatternA = (arr, i) =>
    arr[i] === 1 && arr[i + 1] === 0 && arr[i + 2] === 1 && arr[i + 3] === 1 &&
    arr[i + 4] === 1 && arr[i + 5] === 0 && arr[i + 6] === 1 &&
    arr[i + 7] === 0 && arr[i + 8] === 0 && arr[i + 9] === 0 && arr[i + 10] === 0;
  const isPatternB = (arr, i) =>
    arr[i] === 0 && arr[i + 1] === 0 && arr[i + 2] === 0 && arr[i + 3] === 0 &&
    arr[i + 4] === 1 && arr[i + 5] === 0 && arr[i + 6] === 1 && arr[i + 7] === 1 &&
    arr[i + 8] === 1 && arr[i + 9] === 0 && arr[i + 10] === 1;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c <= size - 11; c++) {
      if (isPatternA(matrix[r], c) || isPatternB(matrix[r], c)) penalty += 40;
    }
  }
  const col = new Array(size);
  for (let c = 0; c < size; c++) {
    for (let r = 0; r < size; r++) col[r] = matrix[r][c];
    for (let r = 0; r <= size - 11; r++) {
      if (isPatternA(col, r) || isPatternB(col, r)) penalty += 40;
    }
  }

  // N4: dark module ratio deviation from 50%
  let darkCount = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r][c] === 1) darkCount++;
    }
  }
  const percent = (darkCount * 100) / (size * size);
  const prev5 = Math.abs(Math.floor(percent / 5) * 5 - 50) / 5;
  const next5 = Math.abs(Math.ceil(percent / 5) * 5 - 50) / 5;
  penalty += Math.min(prev5, next5) * 10;

  return penalty;
}

export function buildMatrix(text, options = {}) {
  const utf8Bytes = new TextEncoder().encode(String(text || ''));
  const { info: vInfo, ecLevel } = selectSpec(utf8Bytes.length, options.errorCorrectionLevel || 'H');
  const size = vInfo.size;
  const baseMatrix = Array.from({ length: size }, () => new Array(size).fill(null));
  const isFunction = Array.from({ length: size }, () => new Array(size).fill(false));

  function setModule(r, c, val, func = false) {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      baseMatrix[r][c] = val;
      if (func) isFunction[r][c] = true;
    }
  }

  // 1. Finder patterns (top-left, top-right, bottom-left)
  function drawFinderPattern(row, col) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const nr = row + r;
        const nc = col + c;
        if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
        if (r === -1 || r === 7 || c === -1 || c === 7) {
          setModule(nr, nc, 0, true);
        } else if (r === 0 || r === 6 || c === 0 || c === 6) {
          setModule(nr, nc, 1, true);
        } else if (r >= 2 && r <= 4 && c >= 2 && c <= 4) {
          setModule(nr, nc, 1, true);
        } else {
          setModule(nr, nc, 0, true);
        }
      }
    }
  }

  drawFinderPattern(0, 0);
  drawFinderPattern(0, size - 7);
  drawFinderPattern(size - 7, 0);

  // 2. Alignment patterns (V2+)
  const alignCoords = ALIGNMENT_PATTERNS[vInfo.version] || [];
  for (const r of alignCoords) {
    for (const c of alignCoords) {
      if ((r < 9 && c < 9) || (r < 9 && c > size - 9) || (r > size - 9 && c < 9)) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const isBlack = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
          setModule(r + dr, c + dc, isBlack ? 1 : 0, true);
        }
      }
    }
  }

  // 3. Timing patterns (Row 6 and Column 6)
  for (let i = 8; i < size - 8; i++) {
    if (baseMatrix[6][i] === null) setModule(6, i, i % 2 === 0 ? 1 : 0, true);
    if (baseMatrix[i][6] === null) setModule(i, 6, i % 2 === 0 ? 1 : 0, true);
  }

  // 4. Dark Module
  setModule(4 * vInfo.version + 9, 8, 1, true);

  // 5. Reserve format information areas
  for (let i = 0; i < 9; i++) {
    if (baseMatrix[8][i] === null) setModule(8, i, 0, true);
    if (baseMatrix[i][8] === null) setModule(i, 8, 0, true);
  }
  for (let i = size - 8; i < size; i++) {
    if (baseMatrix[8][i] === null) setModule(8, i, 0, true);
    if (baseMatrix[i][8] === null) setModule(i, 8, 0, true);
  }

  // 6. Reserve version information areas (Versions 7+)
  if (vInfo.version >= 7) {
    for (let i = 0; i < 6; i++) {
      for (let j = size - 11; j < size - 8; j++) {
        setModule(j, i, 0, true);
        setModule(i, j, 0, true);
      }
    }
  }

  // 7. Encode and interleave codewords
  const dataBytes = encodeData(utf8Bytes, vInfo);
  const codewords = generateCodewords(dataBytes, vInfo);

  // 8. Place data bits in 2-column zig-zag
  const dataBits = [];
  for (const cw of codewords) {
    for (let i = 7; i >= 0; i--) {
      dataBits.push((cw >>> i) & 1);
    }
  }

  let bitIdx = 0;
  let up = true;
  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right--;
    const colList = [right, right - 1];
    const rowList = up
      ? Array.from({ length: size }, (_, i) => size - 1 - i)
      : Array.from({ length: size }, (_, i) => i);

    for (const r of rowList) {
      for (const c of colList) {
        if (!isFunction[r][c]) {
          baseMatrix[r][c] = bitIdx < dataBits.length ? dataBits[bitIdx] : 0;
          bitIdx++;
        }
      }
    }
    up = !up;
  }

  // 9. Select optimal mask across all 8 ISO patterns
  let bestMask = 0;
  let bestPenalty = Infinity;
  let bestMatrix = null;

  for (let maskIdx = 0; maskIdx < 8; maskIdx++) {
    const candidate = baseMatrix.map((row) => row.slice());
    const maskFn = MASK_FNS[maskIdx];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!isFunction[r][c] && maskFn(r, c)) {
          candidate[r][c] ^= 1;
        }
      }
    }
    writeFormatAndVersion(candidate, size, vInfo.version, ecLevel, maskIdx);
    const penalty = evaluateMaskPenalty(candidate, size);
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      bestMask = maskIdx;
      bestMatrix = candidate;
    }
  }

  return {
    matrix: bestMatrix,
    size,
    version: vInfo.version,
    ecLevel,
    mask: bestMask,
  };
}

/**
 * Generates a high-resolution, pixel-snapped PNG Data URL for a given string/URL.
 * Runs locally with zero network dependency.
 */
export async function generateQrDataUrl(text, options = {}) {
  const width = options.width || 440;
  const margin = options.margin !== undefined ? options.margin : 4;
  const darkColor = options.color?.dark || '#070b14';
  const lightColor = options.color?.light || '#ffffff';
  const errorCorrectionLevel = options.errorCorrectionLevel || 'H';

  const { matrix, size } = buildMatrix(text, { errorCorrectionLevel });
  const totalModules = size + margin * 2;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = width;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = lightColor;
  ctx.fillRect(0, 0, width, width);

  const moduleSize = width / totalModules;
  ctx.fillStyle = darkColor;

  for (let r = 0; r < size; r++) {
    const y0 = Math.floor((r + margin) * moduleSize);
    const y1 = Math.floor((r + margin + 1) * moduleSize);
    const h = Math.max(1, y1 - y0);
    for (let c = 0; c < size; c++) {
      if (matrix[r][c] === 1) {
        const x0 = Math.floor((c + margin) * moduleSize);
        const x1 = Math.floor((c + margin + 1) * moduleSize);
        const w = Math.max(1, x1 - x0);
        ctx.fillRect(x0, y0, w, h);
      }
    }
  }

  return canvas.toDataURL('image/png');
}

export default {
  buildMatrix,
  generateQrDataUrl,
};
