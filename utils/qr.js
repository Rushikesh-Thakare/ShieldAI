import jsQR from 'jsqr'
import { Jimp } from 'jimp'

const MAX_IMAGE_PIXELS = 12_000_000

function getDimensions(buffer) {
  if (buffer.length >= 24 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
  }

  if (buffer.length >= 10 && (buffer.toString('ascii', 0, 6) === 'GIF87a' || buffer.toString('ascii', 0, 6) === 'GIF89a')) {
    return { width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) }
  }

  if (buffer.length >= 30 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = buffer.toString('ascii', 12, 16)
    if (chunk === 'VP8X') {
      return {
        width: 1 + buffer.readUIntLE(24, 3),
        height: 1 + buffer.readUIntLE(27, 3),
      }
    }
    if (chunk === 'VP8L' && buffer[20] === 0x2f) {
      return {
        width: 1 + (((buffer[22] & 0x3f) << 8) | buffer[21]),
        height: 1 + (((buffer[24] & 0x0f) << 10) | (buffer[23] << 2) | ((buffer[22] & 0xc0) >> 6)),
      }
    }
    if (chunk === 'VP8 ' && buffer[23] === 0x9d && buffer[24] === 0x01 && buffer[25] === 0x2a) {
      return {
        width: buffer.readUInt16LE(26) & 0x3fff,
        height: buffer.readUInt16LE(28) & 0x3fff,
      }
    }
  }

  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2
    while (offset + 4 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1
        continue
      }
      const marker = buffer[offset + 1]
      offset += 2
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) continue
      const length = buffer.readUInt16BE(offset)
      if (length < 2 || offset + length > buffer.length) return null
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return {
          height: buffer.readUInt16BE(offset + 3),
          width: buffer.readUInt16BE(offset + 5),
        }
      }
      offset += length
    }
  }

  return null
}

export async function decodeQRCode(image) {
  const buffer = Buffer.from(image.data, 'base64')
  const dimensions = getDimensions(buffer)
  if (!dimensions || !dimensions.width || !dimensions.height) {
    throw new Error('Unsupported or invalid image data.')
  }
  if (dimensions.width * dimensions.height > MAX_IMAGE_PIXELS) {
    throw new Error('Image dimensions exceed the supported limit.')
  }
  const bitmap = await Jimp.read(buffer)
  const result = jsQR(bitmap.bitmap.data, bitmap.bitmap.width, bitmap.bitmap.height)
  return result?.data?.slice(0, 4_096) || null
}
