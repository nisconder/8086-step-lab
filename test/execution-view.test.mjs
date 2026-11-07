import test from 'node:test';
import assert from 'node:assert/strict';
import { compile, createMachine, step, readWord } from '../core.mjs';
import { EXAMPLES } from '../examples.mjs';
import { executionTransition } from '../execution-view.mjs';

function snapshots(source, initial) {
  const program = compile(source), states = [createMachine(initial)];
  while (!states.at(-1).halted && states.length < 1000) states.push(step(program, states.at(-1)));
  assert.equal(states.at(-1).halted, true, 'test program terminates');
  return { program, states };
}

test('rewinding BX reports the undone BX instruction alongside its restored value', () => {
  const { program, states } = snapshots('; source lines are not PC indexes\nMOV AX, 1\nMOV BX, 2\nHLT');
  const forward = executionTransition(program, states[2], states[1]);
  assert.equal(forward.rewinding, false);
  assert.equal(forward.traceOp, 'MOV BX, 2');
  assert.equal(forward.traceDest, 'BX · 0002');

  const back = executionTransition(program, states[1], states[2]);
  assert.equal(back.rewinding, true);
  assert.equal(back.instruction, program.instructions[1]);
  assert.equal(back.traceOp, '撤销 · MOV BX, 2');
  assert.equal(back.traceDest, 'BX · 0000');
  assert.equal(back.nextLine, 3);
  assert.match(back.undoCaption, /MOV BX, 2/);
  assert.match(back.undoCaption, /第 1 步/);
  assert.match(back.undoCaption, /3/);
  assert.equal(states[1].regs.AX, 1);
  assert.equal(states[1].regs.BX, 0);
});

test('rewinding the first instruction preserves an explicit undo explanation at step zero', () => {
  const { program, states } = snapshots('; setup\nMOV AX, 1\nHLT');
  const view = executionTransition(program, states[0], states[1]);
  assert.equal(view.traceOp, '撤销 · MOV AX, 1');
  assert.equal(view.traceDest, 'AX · 0000');
  assert.equal(view.nextLine, 2);
  assert.match(view.undoCaption, /MOV AX, 1/);
  assert.match(view.undoCaption, /第 0 步/);
  assert.doesNotMatch(view.undoCaption, /点击单步|等待执行/);
});

test('undoing CALL, PUSH, POP and RET keeps source position consistent with restored stack state', () => {
  const { program, states } = snapshots('MOV SP, 0100h\nMOV AX, 1234h\nCALL work\nHLT\nwork:\nPUSH AX\nMOV AX, 0\nPOP BX\nRET');
  const call = executionTransition(program, states[2], states[3]);
  assert.equal(call.traceOp, '撤销 · CALL work');
  assert.equal(call.traceDest, 'PC · 2');
  assert.equal(call.nextLine, 3);
  assert.equal(states[2].regs.SP, 0x100);
  assert.equal(states[2].memory.size, 0);

  const push = executionTransition(program, states[3], states[4]);
  assert.equal(push.traceOp, '撤销 · PUSH AX');
  assert.equal(push.nextLine, 6);
  assert.equal(states[3].regs.SP, 0xfe);
  assert.equal(readWord(states[3], 0x200fe), 3);
  assert.equal(states[3].memory.has(0x200fc), false);

  const pop = executionTransition(program, states[5], states[6]);
  assert.equal(pop.traceOp, '撤销 · POP BX');
  assert.equal(pop.traceDest, 'BX · 0000');
  assert.equal(pop.nextLine, 8);
  assert.equal(states[5].regs.SP, 0xfc);
  assert.equal(readWord(states[5], 0x200fc), 0x1234);

  const ret = executionTransition(program, states[6], states[7]);
  assert.equal(ret.traceOp, '撤销 · RET');
  assert.equal(ret.traceDest, 'PC · 7');
  assert.equal(ret.nextLine, 9);
  assert.equal(states[6].regs.SP, 0xfe);
});

test('undoing a memory overwrite and CMP describes the restored memory and flags', () => {
  const memoryCase = snapshots('MOV [20h], 1234h\nMOV [20h], 5678h\nHLT');
  const memoryBack = executionTransition(memoryCase.program, memoryCase.states[1], memoryCase.states[2]);
  assert.equal(memoryBack.traceOp, '撤销 · MOV [20h], 5678h');
  assert.equal(memoryBack.traceDest, '内存已恢复');
  assert.equal(memoryBack.nextLine, 2);
  assert.equal(readWord(memoryCase.states[1], 0x10020), 0x1234);

  const flagsCase = snapshots('MOV AX, 1\nCMP AX, 0\nCMP AX, 1\nHLT');
  const flagsBack = executionTransition(flagsCase.program, flagsCase.states[2], flagsCase.states[3]);
  assert.equal(flagsBack.traceOp, '撤销 · CMP AX, 1');
  assert.equal(flagsBack.traceDest, 'ZF 0 · CF 0');
  assert.equal(flagsBack.nextLine, 3);
});

test('undoing a taken branch points to the branch source, and undoing HLT allows replay', () => {
  const { program, states } = snapshots('MOV AX, 1\nJMP taken\nMOV BX, 99\ntaken: DEC AX\nJNZ taken\nHLT');
  const jumpBack = executionTransition(program, states[1], states[2]);
  assert.equal(jumpBack.traceOp, '撤销 · JMP taken');
  assert.equal(jumpBack.traceDest, 'PC · 1');
  assert.equal(jumpBack.nextLine, 2);

  const halted = states.at(-1), restored = states.at(-2);
  const haltBack = executionTransition(program, restored, halted);
  assert.equal(haltBack.traceOp, '撤销 · HLT');
  assert.equal(haltBack.traceDest, '已恢复运行');
  assert.equal(haltBack.nextLine, 6);
  assert.equal(restored.halted, false);
  assert.deepEqual(step(program, restored), halted);
  assert.equal(executionTransition(program, halted, restored).nextLine, null);
});

test('all chapter demonstrations identify every undone instruction and restored next source line', () => {
  for (const example of EXAMPLES) {
    const { program, states } = snapshots(example.code, example.initial);
    const history = states.slice(0, -1);
    let current = states.at(-1);
    while (history.length) {
      const undone = current, restored = history.pop();
      const view = executionTransition(program, restored, undone);
      assert.equal(view.rewinding, true, example.id);
      assert.equal(view.instruction.line, undone.last.line, example.id);
      assert.equal(view.traceOp, '撤销 · ' + undone.last.text, example.id);
      assert.equal(view.nextLine, program.instructions[restored.pc].line, example.id);
      assert.match(view.undoCaption, new RegExp('第 ' + restored.steps + ' 步'), example.id);
      assert.deepEqual(step(program, restored), undone, example.id + ': replay returns to the same state');
      current = restored;
    }
    assert.deepEqual(current, states[0], example.id + ': final rewind restores initial state');
  }
});
