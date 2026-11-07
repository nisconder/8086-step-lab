import test from 'node:test';
import assert from 'node:assert/strict';
import { compile, createMachine, step, run, REGISTERS } from '../core.mjs';
import { CHAPTERS } from '../chapters.mjs';
import { EXAMPLES } from '../examples.mjs';

const byId = new Map(EXAMPLES.map(example => [example.id, example]));
const memory = (address, bytes) => [{ address, bytes }];

function checkState(state, expected, label) {
  for (const key of ['steps', 'pc', 'ds', 'ss']) {
    if (Object.hasOwn(expected, key)) assert.equal(state[key], expected[key], `${label}: ${key}`);
  }
  for (const key of ['regs', 'flags']) {
    for (const [name, value] of Object.entries(expected[key] ?? {})) {
      assert.equal(state[key][name], value, `${label}: ${name}`);
    }
  }
  for (const { address, bytes } of expected.memory ?? []) {
    const actual = bytes.map((_, offset) => state.memory.get(address + offset));
    assert.deepEqual(actual, bytes, `${label}: bytes at ${address.toString(16)}h`);
  }
}

test('the complete chapter catalog has unique article and demo links', () => {
  assert.deepEqual(CHAPTERS.map(chapter => chapter.id), ['00', ...Array.from({ length: 16 }, (_, i) => String(i + 1).padStart(2, '0')), '99']);
  assert.equal(new Set(CHAPTERS.map(chapter => chapter.url)).size, CHAPTERS.length);
  assert.equal(new Set(CHAPTERS.map(chapter => chapter.slug)).size, CHAPTERS.length);
  assert.equal(byId.size, EXAMPLES.length);
  const owned = [];
  const deepLinks = [];
  for (const chapter of CHAPTERS) {
    assert.ok(chapter.title && chapter.scopeNote);
    assert.equal(chapter.url, `https://nisconder.pages.dev/2026/10/30/${chapter.slug}/`);
    assert.match(chapter.slug, new RegExp(`^ics-8086-${chapter.id}-`));
    for (const id of chapter.demoIds) {
      assert.equal(byId.get(id)?.chapterId, chapter.id, `${id} belongs to its declared chapter`);
      owned.push(id);
      deepLinks.push(`?chapter=${chapter.id}&demo=${id}`);
    }
  }
  assert.deepEqual([...owned].sort(), [...byId.keys()].sort());
  assert.equal(new Set(deepLinks).size, EXAMPLES.length);
  assert.deepEqual(CHAPTERS.filter(chapter => chapter.demoIds.length).map(chapter => chapter.id), ['01', '02', '03', '05', '06', '07', '08', '09', '10']);
});

test('each demo has source context, visible setup, and three actionable instructions', () => {
  for (const example of EXAMPLES) {
    assert.match(example.chapterId, /^\d{2}$/);
    for (const key of ['id', 'title', 'hint', 'code', 'sourceSection', 'scopeNote']) assert.ok(example[key]?.trim(), `${example.id}: ${key}`);
    assert.ok(REGISTERS.includes(example.observeRegister));
    assert.equal(example.steps.length, 3);
    assert.ok(example.steps.every(text => typeof text === 'string' && text.trim()));
    assert.ok(example.checkpoints.length > 0);
    assert.ok(example.expected);
    assert.ok(Object.keys(example.initial ?? {}).every(key => key === 'ds' || key === 'ss'));
  }
  for (const id of ['overflow', 'loop', 'memory', 'stack', 'carry']) assert.ok(byId.has(id), `legacy demo ${id}`);
  assert.match(byId.get('instruction-trace').scopeNote, /并非 8086/);
  assert.match(byId.get('endian32').scopeNote, /不执行 32 位算术/);
  assert.match(byId.get('overflow').scopeNote, /8 位.*16 位/);
  assert.match(byId.get('array-sum').scopeNote, /DEC.*标志.*ZF=1.*ZF=0/);
  assert.match(byId.get('near-call').scopeNote, /指令索引.*不是真实/);
  assert.match(byId.get('debug-sum').scopeNote, /不解释 DEBUG/);
});

test('all chapter demos finish with their documented registers, flags and physical bytes', () => {
  for (const example of EXAMPLES) {
    const state = run(compile(example.code), createMachine(example.initial));
    assert.equal(state.halted, true, example.id);
    checkState(state, example.expected, example.id);
  }
});

// Numeric observations independently transcribed from the article exercises.
// Setup instructions are included so a clickable checkpoint lands on this exact state.
const CHECKPOINT_ORACLES = {
  'instruction-trace': [
    [3, { regs: { AX: 7 } }],
    [4, { regs: { AX: 12 } }],
    [5, { memory: memory(0x104, [12, 0]) }]
  ],
  endian32: [
    [2, { ds: 0, memory: memory(0x1000, [0x78, 0x56, 0x34, 0x12]) }],
    [3, { regs: { AX: 0x3456 } }]
  ],
  'logic-mask': [
    [3, { regs: { AX: 0x2c00, BX: 0x2c0b } }],
    [4, { regs: { AX: 0x2c00, BX: 11 } }]
  ],
  memory: [
    [4, { regs: { BX: 0x20, SI: 4 }, memory: memory(0x10024, [0x34, 0x12]) }],
    [5, { regs: { DX: 0x1234 } }]
  ],
  overflow: [
    [2, { regs: { AX: 0x8000 }, flags: { OF: 1, CF: 0, SF: 1, ZF: 0 } }],
    [4, { regs: { BX: 0 }, flags: { OF: 0, CF: 1, ZF: 1 } }]
  ],
  'signed-view': [
    [1, { regs: { AX: 133 } }],
    [2, { regs: { BX: 65413 } }]
  ],
  'segmented-address': [
    [3, { ds: 0x1234, regs: { BX: 0x10, SI: 4 }, memory: memory(0x1235a, [0x78, 0x56]) }],
    [4, { regs: { AX: 0x5678, BX: 0x10, SI: 4 } }]
  ],
  'bp-address': [
    [3, { ds: 0x2000, ss: 0x3000, regs: { BP: 0x100, SI: 0x20 }, memory: memory(0x30130, [0x34, 0x12]) }],
    [4, { regs: { AX: 0x1234, BP: 0x100, SI: 0x20 } }]
  ],
  'stack-order': [
    [4, { regs: { SP: 0xfe }, memory: memory(0x200fe, [0x34, 0x12]) }],
    [5, { regs: { SP: 0xfc }, memory: memory(0x200fc, [0xcd, 0xab]) }],
    [6, { regs: { CX: 0xabcd, SP: 0xfe } }],
    [7, { regs: { DX: 0x1234, SP: 0x100 } }]
  ],
  carry: [
    [2, { regs: { AX: 0 }, flags: { CF: 1 } }],
    [3, { regs: { AX: 1 }, flags: { CF: 1 } }],
    [4, { regs: { AX: 0 }, flags: { CF: 1 } }],
    [5, { regs: { AX: 0 }, flags: { CF: 0, ZF: 1 } }]
  ],
  'near-call': [
    [3, { regs: { SP: 0xfe }, pc: 4, memory: memory(0x200fe, [3, 0]) }],
    [4, { regs: { AX: 14 } }],
    [5, { regs: { SP: 0x100 }, pc: 3 }]
  ],
  stack: [
    [2, { regs: { SP: 0xfffc }, memory: memory(0x2fffc, [2, 0]) }],
    [3, { regs: { SP: 0xfffa }, memory: memory(0x2fffa, [0, 0]) }],
    [7, { regs: { SP: 0xfffe, AX: 14, BX: 0 } }]
  ],
  'array-sum': [
    [8, { regs: { AX: 1, CX: 4, SI: 0x200 } }],
    [12, { regs: { AX: 3, CX: 3, SI: 0x202 } }],
    [16, { regs: { AX: 6, CX: 2, SI: 0x204 } }],
    [20, { regs: { AX: 10, CX: 1, SI: 0x206 } }],
    [24, { regs: { AX: 10, CX: 0, SI: 0x208 }, flags: { ZF: 1 } }]
  ],
  loop: [
    [3, { regs: { AX: 5, CX: 5 } }],
    [9, { regs: { AX: 12, CX: 3 } }],
    [18, { regs: { AX: 15, CX: 0 } }]
  ],
  'debug-sum': [
    [3, { memory: memory(0x10200, [0x23, 1, 0x25, 0, 0, 0]) }],
    [4, { regs: { AX: 0x123 } }],
    [5, { regs: { AX: 0x148 } }],
    [6, { memory: memory(0x10200, [0x23, 1, 0x25, 0, 0x48, 1]) }]
  ]
};

test('all 43 clickable checkpoints land on the stated numeric observations', () => {
  assert.equal(Object.values(CHECKPOINT_ORACLES).flat().length, 43);
  assert.deepEqual(Object.keys(CHECKPOINT_ORACLES).sort(), [...byId.keys()].sort());
  for (const example of EXAMPLES) {
    const observations = CHECKPOINT_ORACLES[example.id];
    assert.deepEqual(example.checkpoints.map(point => point.step), observations.map(([stepCount]) => stepCount), `${example.id}: every checkpoint has an oracle`);
    const program = compile(example.code);
    let state = createMachine(example.initial);
    for (let i = 0; i < observations.length; i++) {
      const [target, expected] = observations[i];
      assert.ok(Number.isInteger(target) && target > state.steps && target <= example.expected.steps);
      assert.ok(example.checkpoints[i].text.trim());
      while (state.steps < target) {
        assert.equal(state.halted, false, `${example.id}: checkpoint ${target} remains reachable`);
        state = step(program, state);
      }
      checkState(state, expected, `${example.id} step ${target}`);
    }
  }
});
