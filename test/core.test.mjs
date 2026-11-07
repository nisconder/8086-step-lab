import test from 'node:test';
import assert from 'node:assert/strict';
import { compile, createMachine, step, run, readWord, physical } from '../core.mjs';
import { EXAMPLES } from '../examples.mjs';
const exec = source => run(compile(source));

test('all lessons reach their documented results', () => {
  const states = Object.fromEntries(EXAMPLES.map(e => [e.id, exec(e.code)]));
  assert.equal(states.overflow.regs.AX, 0x8000); assert.equal(states.overflow.regs.BX, 0);
  assert.equal(states.loop.regs.AX, 15); assert.equal(states.loop.regs.CX, 0);
  assert.equal(states.memory.regs.DX, 0x1234); assert.equal(states.memory.memory.get(0x10024), 0x34);
  assert.equal(states.stack.regs.AX, 14); assert.equal(states.stack.regs.BX, 0); assert.equal(states.stack.regs.SP, 0xfffe);
  assert.equal(states.carry.regs.BX, 0);
});
test('arithmetic matches signed and unsigned boundary oracles', () => {
  const values = [0, 1, 15, 16, 127, 128, 255, 256, 32767, 32768, 65534, 65535];
  const signed = n => n > 32767 ? n - 65536 : n;
  for (const a of values) for (const b of values) for (const op of ['ADD', 'SUB', 'CMP']) {
    const s = exec(`MOV AX, ${a}\n${op} AX, ${b}`), subtract = op !== 'ADD';
    const full = subtract ? a - b : a + b, result = (full + 65536) % 65536;
    const signedFull = subtract ? signed(a) - signed(b) : signed(a) + signed(b);
    assert.equal(s.regs.AX, op === 'CMP' ? a : result, `${op} ${a} ${b}`);
    assert.equal(s.flags.CF, Number(subtract ? a < b : full > 65535));
    assert.equal(s.flags.OF, Number(signedFull < -32768 || signedFull > 32767));
    assert.equal(s.flags.ZF, Number(result === 0)); assert.equal(s.flags.SF, Number(result >= 32768));
    assert.equal(s.flags.AF, Number(subtract ? (a % 16) < (b % 16) : (a % 16) + (b % 16) >= 16));
    assert.equal(s.flags.PF, Number([...((result & 255).toString(2))].filter(c => c === '1').length % 2 === 0));
  }
});
test('INC and DEC preserve CF, MOV and jumps preserve all flags', () => {
  const p = compile('MOV AX, 65535\nADD AX, 1\nINC AX\nDEC AX\nMOV BX, 9\nJMP end\nend: HLT');
  let s = createMachine(); s = step(p, step(p, s)); assert.equal(s.flags.CF, 1);
  s = step(p, s); assert.equal(s.flags.CF, 1); s = step(p, s); assert.equal(s.flags.CF, 1);
  const flags = { ...s.flags }; s = run(p, s); assert.deepEqual(s.flags, flags);
});
test('logic clears CF/OF and leaves AF undefined', () => {
  for (const op of ['AND', 'OR', 'XOR']) {
    const s = exec(`MOV AX, 32767\nADD AX, 1\n${op} AX, AX`);
    assert.equal(s.flags.CF, 0); assert.equal(s.flags.OF, 0); assert.equal(s.flags.AF, null);
  }
});
test('memory is little endian and overlapping word reads share bytes', () => {
  const s = exec('MOV BX, 65535\nMOV [BX], 1234h\nMOV DX, [65535]\nMOV [20h], 5678h\nMOV AX, [21h]');
  assert.equal(s.regs.DX, 0x1234); assert.equal(s.memory.get(0x1ffff), 0x34); assert.equal(s.memory.get(0x20000), 0x12);
  assert.equal(s.regs.AX, 0x56); assert.equal(readWord(s, 0x10020), 0x5678);
});
test('BP defaults to SS, other effective addresses to DS, offset wraps', () => {
  const s = exec('MOV BP, 20h\nMOV BX, 20h\nMOV SI, 4\nMOV [BP+SI-2], 1234h\nMOV [BX+SI-2], 5678h\nMOV AX, [BP+SI-2]\nMOV DX, [22h]');
  assert.equal(s.regs.AX, 0x1234); assert.equal(s.regs.DX, 0x5678);
  assert.equal(physical(0xffff, 0xffff), 0x0ffef);
  assert.equal(exec('MOV BX, 65535\nMOV [BX+1], 42\nMOV AX, [0]').regs.AX, 42);
});
test('original 8086 PUSH SP stores decremented SP and POP SP writes popped value', () => {
  assert.equal(exec('PUSH SP\nPOP AX').regs.AX, 0xfffc);
  assert.equal(exec('MOV AX, 100\nPUSH AX\nPOP SP').regs.SP, 100);
});
test('all conditional jumps use their flags', () => {
  for (const [jump, setup] of [['JZ','CMP AX, 0'],['JNZ','INC AX'],['JC','SUB AX, 1'],['JNC','ADD AX, 1'],['JO','MOV AX, 32767\nADD AX, 1'],['JNO','ADD AX, 1']]) {
    assert.equal(exec(`${setup}\n${jump} yes\nMOV BX, 99\nyes: HLT`).regs.BX, 0, jump);
  }
});
test('state history remains immutable across memory and register changes', () => {
  const p = compile('MOV AX, 7\nPUSH AX'), start = createMachine(), one = step(p, start), two = step(p, one);
  assert.equal(start.regs.AX, 0); assert.equal(one.regs.SP, 0xfffe); assert.equal(one.memory.size, 0); assert.equal(two.memory.size, 2);
});
test('rejects unsupported or malformed programs without evaluating input', () => {
  for (const source of ['','MOV AX','MOV [BX], [SI]','MOV 5, AX','MOV AX, 65536','MOV AL, 1','PUSH 1','POP 1','MOV AX, [BX+BP]','MOV AX, [SP]','MOV AX, [BX+BX]','MOV AX, [BX--1]','JMP unknown','a: NOP\na: HLT','INT 21h','MOV AX, alert(1)']) assert.throws(() => compile(source), undefined, source);
  assert.throws(() => run(compile('again: JMP again'), createMachine(), 10), /超过 10 步/);
});
test('CRLF, comments, binary and signed literals parse consistently', () => {
  assert.equal(exec(';comment\r\nstart: MOV AX, -1\r\nAND AX, 101b ; five\r\nHLT').regs.AX, 5);
  assert.equal(exec('MOV AX, +0x2A').regs.AX, 42);
});
