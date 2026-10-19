import { describe, expect, it } from 'vitest';
import { sniffFileType } from './file-sniff.js';

const bytes = (...values: number[]) => Buffer.from(values);
const text = (value: string) => Buffer.from(value, 'latin1');

describe('sniffFileType', () => {
  it('recognises the accepted formats from their first bytes', () => {
    expect(sniffFileType(bytes(0xff, 0xd8, 0xff, 0xe0, 0x00))).toBe('jpg');
    expect(sniffFileType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00))).toBe('png');
    expect(sniffFileType(text('RIFF\x24\x00\x00\x00WEBPVP8 '))).toBe('webp');
    expect(sniffFileType(text('%PDF-1.7\n'))).toBe('pdf');
    expect(sniffFileType(text('PK\x03\x04....[Content_Types].xml....xl/workbook.xml'))).toBe('xlsx');
  });

  it('ignores names and claims: other content is not accepted', () => {
    expect(sniffFileType(text('<html><script>alert(1)</script>'))).toBeNull();
    expect(sniffFileType(text('RIFF\x24\x00\x00\x00WAVEfmt '))).toBeNull();
    expect(sniffFileType(text('PK\x03\x04....[Content_Types].xml....word/document.xml'))).toBeNull();
    expect(sniffFileType(bytes(0xff, 0xd8))).toBeNull();
    expect(sniffFileType(Buffer.alloc(0))).toBeNull();
  });
});
