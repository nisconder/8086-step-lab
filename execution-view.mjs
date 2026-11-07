import { REGISTERS, hex } from './core.mjs';

// A backward transition undoes the instruction in the state we are leaving.
// The restored state's `last` belongs to an earlier forward transition.
export function executionTransition(program, state, before) {
  const rewinding = Boolean(before && before.steps > state.steps);
  const last = rewinding ? before.last : state.last;
  const instruction = program?.instructions.find(ins => ins.line === last?.line) || null;
  let traceDest = '等待状态变化';
  if (instruction) {
    const { op, args } = instruction;
    if (op === 'CMP') traceDest = 'ZF ' + state.flags.ZF + ' · CF ' + state.flags.CF;
    else if (['MOV', 'ADD', 'SUB', 'INC', 'DEC', 'AND', 'OR', 'XOR', 'POP'].includes(op)) {
      traceDest = args[0].kind === 'reg' ? args[0].name + ' · ' + hex(state.regs[args[0].name]) : rewinding ? '内存已恢复' : 'MEMORY · WORD';
    } else if (op === 'PUSH') traceDest = 'SS:SP · ' + hex(state.regs.SP);
    else if (op === 'CALL' || op === 'RET' || op.startsWith('J')) traceDest = 'PC · ' + state.pc;
    else if (op === 'HLT') traceDest = rewinding ? '已恢复运行' : 'HALTED';
    else traceDest = '状态保留';
  }
  let undoCaption = null;
  if (rewinding) {
    const changes = REGISTERS.filter(name => before.regs[name] !== state.regs[name])
      .map(name => name + ': ' + hex(before.regs[name]) + ' → ' + hex(state.regs[name]));
    undoCaption = (instruction ? '已撤销源码第 ' + instruction.line + ' 行：' + instruction.text + '。' : '')
      + '已恢复第 ' + state.steps + ' 步的寄存器、标志与内存快照。'
      + (changes.length ? ' ' + changes.join(' · ') : '');
  }
  return {
    rewinding, instruction,
    traceOp: instruction ? (rewinding ? '撤销 · ' : '') + instruction.text : '等待执行',
    traceDest, undoCaption,
    nextLine: !state.halted ? program?.instructions[state.pc]?.line ?? null : null
  };
}
