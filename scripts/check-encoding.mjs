import { readFileSync } from 'node:fs';

const b = readFileSync('src-tauri/windows/installer.nsi');
let invalid = [];
for (let i = 0; i < b.length; i++) {
  if (b[i] >= 0x80) {
    if (b[i] >= 0xC0 && b[i] <= 0xDF) {
      if (i + 1 >= b.length || b[i + 1] < 0x80 || b[i + 1] > 0xBF) invalid.push(i);
      i++;
    } else if (b[i] >= 0xE0 && b[i] <= 0xEF) {
      if (i + 2 >= b.length || b[i + 1] < 0x80 || b[i + 1] > 0xBF || b[i + 2] < 0x80 || b[i + 2] > 0xBF) invalid.push(i);
      i += 2;
    } else if (b[i] >= 0xF0 && b[i] <= 0xF7) {
      if (i + 3 >= b.length || b[i + 1] < 0x80 || b[i + 1] > 0xBF || b[i + 2] < 0x80 || b[i + 2] > 0xBF || b[i + 3] < 0x80 || b[i + 3] > 0xBF) invalid.push(i);
      i += 3;
    } else {
      invalid.push(i);
    }
  }
}
console.log('Invalid UTF-8 bytes:', invalid.length);
if (invalid.length > 0) {
  invalid.forEach(x => console.log('  Pos', x, 'byte 0x' + b[x].toString(16)));
}
console.log('File size:', b.length, 'bytes');