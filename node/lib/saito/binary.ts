import { Saito } from '../../apps/core';

class Binary {
  public app: Saito;

  constructor(app: Saito) {
    this.app = app;
  }

  hexToSizedArray(value: string | Buffer, size: number): Buffer {
    let value_buffer;
    if (value.toString() !== '0') {
      value_buffer = Buffer.from(value.toString(), 'hex');
    } else {
      value_buffer = Buffer.alloc(0);
    }
    const new_buffer = Buffer.alloc(size);
    console.assert(size >= value_buffer.length, 'unhandled value ranges found');
    value_buffer.copy(new_buffer, size - value_buffer.length);
    return new_buffer;
  }

  u64FromBytes(bytes): bigint {
    const top = BigInt(this.u32FromBytes(bytes.slice(0, 4)));
    const bottom = BigInt(this.u32FromBytes(bytes.slice(4, 8)));
    const max_u32 = BigInt(4294967296);
    return top * max_u32 + bottom;
  }

  u64AsBytes(bigValue) {
    bigValue = BigInt(bigValue); // force into Big
    const max_u32 = BigInt(4294967296);
    const top = bigValue / max_u32;
    const bottom = bigValue - BigInt(max_u32 * top);
    const top_bytes = this.u32AsBytes(Number(top));
    const bottom_bytes = this.u32AsBytes(Number(bottom));
    return Buffer.concat([
      Buffer.from(new Uint8Array(top_bytes)),
      Buffer.from(new Uint8Array(bottom_bytes))
    ]);
  }

  u128FromBytes(bytes): bigint {
    const top = BigInt(this.u64FromBytes(bytes.slice(0, 8)));
    const bottom = BigInt(this.u64FromBytes(bytes.slice(8, 16)));
    const max_u64 = BigInt(18446744073709551616);
    return top * max_u64 + bottom;
  }

  u128AsBytes(bigValue) {
    bigValue = BigInt(bigValue);
    const max_u64 = BigInt(18446744073709551616);
    const top = bigValue / max_u64;
    const bottom = bigValue - BigInt(max_u64 * top);
    const top_bytes = this.u64AsBytes(Number(top));
    const bottom_bytes = this.u64AsBytes(Number(bottom));
    return Buffer.concat([
      Buffer.from(new Uint8Array(top_bytes)),
      Buffer.from(new Uint8Array(bottom_bytes))
    ]);
  }

  u32FromBytes(bytes) {
    let val = BigInt(0);
    for (let i = 0; i < bytes.length; ++i) {
      val = BigInt(bytes[i]) + val * BigInt(256);
    }
    return Number(val);
  }

  u32AsBytes(val) {
    if (val == undefined) {
      val = 0;
    }
    val = BigInt(val);
    const bytes = [];
    let i = 4;
    do {
      bytes[--i] = Number(val & BigInt(255));
      val = (val - BigInt(bytes[i])) / BigInt(256);
    } while (i);
    return bytes;
  }

  u8FromByte(byte) {
    return 0 + byte;
  }

  u8AsByte(val) {
    return val & 255;
  }
}

export default Binary;