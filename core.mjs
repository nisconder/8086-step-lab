// An instruction-level teaching model. PC indexes parsed instructions, not bytes.
export const REGISTERS = ['AX', 'BX', 'CX', 'DX', 'SI', 'DI', 'BP', 'SP'];
export const FLAG_NAMES = ['CF', 'PF', 'AF', 'ZF', 'SF', 'OF'];
const BINARY = new Set(['MOV', 'ADD', 'SUB', 'CMP', 'AND', 'OR', 'XOR']);
const UNARY = new Set(['INC', 'DEC', 'PUSH', 'POP']);
const JUMPS = new Set(['JMP', 'JZ', 'JNZ', 'JC', 'JNC', 'JO', 'JNO', 'CALL']);
const ZERO = new Set(['RET', 'NOP', 'HLT']);
const word = n => n & 0xffff;
export const hex = (n, width = 4) => n.toString(16).toUpperCase().padStart(width, '0');
const fail = (line, message) => { throw new Error(`第 ${line} 行：${message}`); };

function literal(text) {
  const value = text.trim();
  let sign = 1, rest = value;
  if (rest[0] === '-' || rest[0] === '+') {
    sign = rest[0] === '-' ? -1 : 1; rest = rest.slice(1);
  }
  let n;
  if (/^0x[0-9a-f]+$/i.test(rest)) n = parseInt(rest.slice(2), 16);
  else if (/^[0-9][0-9a-f]*h$/i.test(rest)) n = parseInt(rest.slice(0, -1), 16);
  else if (/^[01]+b$/i.test(rest)) n = parseInt(rest.slice(0, -1), 2);
  else if (/^\d+$/.test(rest)) n = Number(rest);
  else return null;
  n *= sign;
  return Number.isSafeInteger(n) ? n : null;
}

function operand(text, line) {
  const value = text.trim().toUpperCase();
  if (REGISTERS.includes(value)) return { kind: 'reg', name: value };
  if (value.startsWith('[') && value.endsWith(']')) {
    const expression = value.slice(1, -1).replace(/\s+/g, '');
    const terms = expression.match(/[+-]?[^+-]+/g) ?? [];
    if (!terms.length || terms.join('') !== expression) fail(line, '无效的内存地址');
    let displacement = 0;
    const regs = [];
    for (const term of terms) {
      const sign = term[0] === '-' ? -1 : 1;
      const raw = /^[+-]/.test(term) ? term.slice(1) : term;
      if (['BX', 'BP', 'SI', 'DI'].includes(raw)) {
        if (sign < 0 || regs.includes(raw)) fail(line, '地址寄存器不能重复或相减');
        regs.push(raw);
      } else {
        const n = literal(raw);
        if (n === null || n > 65535) fail(line, '地址只支持 BX/BP/SI/DI 和 16 位位移');
        displacement += sign * n;
      }
    }
    const legal = ['', 'BX', 'BP', 'SI', 'DI', 'BX+SI', 'BX+DI', 'BP+SI', 'BP+DI'];
    const ordered = ['BX', 'BP', 'SI', 'DI'].filter(r => regs.includes(r)).join('+');
    if (!legal.includes(ordered) || displacement < -32768 || displacement > 65535) fail(line, '不支持的 8086 有效地址组合');
    return { kind: 'mem', regs, displacement };
  }
  const n = literal(value);
  if (n !== null && n >= -32768 && n <= 65535) return { kind: 'imm', value: word(n) };
  fail(line, `无法识别操作数“${text}”；支持 16 位寄存器、立即数与 [BX+SI+位移]`);
}

export function compile(source) {
  if (source.length > 100_000) throw new Error('程序最多 100,000 个字符');
  const labels = new Map(), instructions = [];
  source.split(/\r?\n/).forEach((raw, i) => {
    const line = i + 1;
    let text = raw.split(';')[0].trim();
    const label = text.match(/^([A-Za-z_][\w]*):\s*/);
    if (label) {
      const name = label[1].toUpperCase();
      if (labels.has(name)) fail(line, `标签 ${name} 重复`);
      labels.set(name, instructions.length); text = text.slice(label[0].length).trim();
    }
    if (!text) return;
    const match = text.match(/^([a-z]+)(?:\s+(.*))?$/i);
    if (!match) fail(line, '指令格式无效');
    const op = match[1].toUpperCase(), parts = match[2] ? match[2].split(',').map(s => s.trim()) : [];
    const expected = BINARY.has(op) ? 2 : UNARY.has(op) || JUMPS.has(op) ? 1 : ZERO.has(op) ? 0 : -1;
    if (expected < 0) fail(line, `暂不支持 ${op}，请查看指令范围`);
    if (parts.length !== expected || parts.some(p => !p)) fail(line, `${op} 需要 ${expected} 个操作数`);
    let args;
    if (JUMPS.has(op)) {
      if (!/^[a-z_][\w]*$/i.test(parts[0])) fail(line, '跳转目标必须是标签');
      args = [{ kind: 'label', name: parts[0].toUpperCase() }];
    } else args = parts.map(p => operand(p, line));
    if ((BINARY.has(op) || ['INC', 'DEC', 'POP'].includes(op)) && args[0].kind === 'imm') fail(line, '目标不能是立即数');
    if (BINARY.has(op) && args.every(a => a.kind === 'mem')) fail(line, '不支持内存到内存操作');
    if (op === 'PUSH' && args[0].kind === 'imm') fail(line, '8086 PUSH 不支持立即数，请先 MOV 到寄存器');
    instructions.push({ op, args, line, text });
  });
  if (!instructions.length) throw new Error('请输入至少一条指令');
  if (instructions.length > 2000) throw new Error('程序最多 2,000 条指令');
  for (const instruction of instructions) {
    if (JUMPS.has(instruction.op)) {
      const target = labels.get(instruction.args[0].name);
      if (target === undefined) fail(instruction.line, `标签 ${instruction.args[0].name} 未定义`);
      instruction.args[0].target = target;
    }
  }
  return { instructions, source };
}

export function createMachine({ ds = 0x1000, ss = 0x2000 } = {}) {
  if (![ds, ss].every(n => Number.isInteger(n) && n >= 0 && n <= 65535)) throw new Error('段值必须是 16 位整数');
  return { regs: Object.fromEntries(REGISTERS.map(r => [r, r === 'SP' ? 0xfffe : 0])),
    flags: Object.fromEntries(FLAG_NAMES.map(f => [f, 0])), ds, ss,
    memory: new Map(), pc: 0, halted: false, steps: 0, last: null };
}

export function physical(segment, offset) { return ((segment << 4) + word(offset)) & 0xfffff; }
function address(state, arg) {
  const offset = word(arg.displacement + arg.regs.reduce((n, r) => n + state.regs[r], 0));
  return physical(arg.regs.includes('BP') ? state.ss : state.ds, offset);
}
export function readWord(state, addr) {
  return (state.memory.get(addr & 0xfffff) ?? 0) | ((state.memory.get((addr + 1) & 0xfffff) ?? 0) << 8);
}
function writeWord(state, addr, value) {
  state.memory.set(addr & 0xfffff, value & 255);
  state.memory.set((addr + 1) & 0xfffff, (value >>> 8) & 255);
}
function read(state, arg) {
  return arg.kind === 'reg' ? state.regs[arg.name] : arg.kind === 'imm' ? arg.value : readWord(state, address(state, arg));
}
function write(state, arg, value) {
  if (arg.kind === 'reg') state.regs[arg.name] = word(value);
  else writeWord(state, address(state, arg), word(value));
}
function push(state, value) {
  state.regs.SP = word(state.regs.SP - 2);
  writeWord(state, physical(state.ss, state.regs.SP), value);
}
function pop(state) {
  const value = readWord(state, physical(state.ss, state.regs.SP));
  state.regs.SP = word(state.regs.SP + 2); return value;
}
function resultFlags(state, result) {
  state.flags.ZF = Number(result === 0); state.flags.SF = (result >>> 15) & 1;
  let ones = 0; for (let v = result & 255; v; v >>>= 1) ones += v & 1;
  state.flags.PF = Number(ones % 2 === 0);
}
function arithmetic(state, a, b, subtract) {
  const full = subtract ? a - b : a + b, result = word(full);
  resultFlags(state, result);
  state.flags.CF = Number(subtract ? a < b : full > 65535);
  state.flags.OF = Number(Boolean((subtract ? (a ^ b) : ~(a ^ b)) & (a ^ result) & 0x8000));
  state.flags.AF = Number(Boolean((a ^ b ^ result) & 0x10));
  return result;
}

export function step(program, previous) {
  if (previous.halted) return previous;
  const state = { ...previous, regs: { ...previous.regs }, flags: { ...previous.flags }, memory: new Map(previous.memory) };
  const ins = program.instructions[state.pc];
  if (!ins) { state.halted = true; return state; }
  const { op, args } = ins;
  state.pc++; state.steps++;
  const a = args[0] && args[0].kind !== 'label' ? read(state, args[0]) : 0;
  const b = args[1] ? read(state, args[1]) : 0;
  if (op === 'MOV') write(state, args[0], b);
  else if (['ADD', 'SUB', 'CMP'].includes(op)) {
    const result = arithmetic(state, a, b, op !== 'ADD');
    if (op !== 'CMP') write(state, args[0], result);
  } else if (op === 'INC' || op === 'DEC') {
    const carry = state.flags.CF;
    write(state, args[0], arithmetic(state, a, 1, op === 'DEC'));
    state.flags.CF = carry;
  } else if (['AND', 'OR', 'XOR'].includes(op)) {
    const result = op === 'AND' ? a & b : op === 'OR' ? a | b : a ^ b;
    write(state, args[0], result); resultFlags(state, result);
    state.flags.CF = 0; state.flags.OF = 0; state.flags.AF = null; // Undefined on 8086.
  } else if (op === 'PUSH') {
    // Original 8086 PUSH SP stores the decremented SP (unlike 286+).
    push(state, args[0].kind === 'reg' && args[0].name === 'SP' ? word(a - 2) : a);
  } else if (op === 'POP') {
    const value = pop(state); write(state, args[0], value);
  } else if (op === 'CALL') { push(state, state.pc); state.pc = args[0].target; }
  else if (op === 'RET') {
    const target = pop(state);
    if (target > program.instructions.length) throw new Error(`第 ${ins.line} 行：栈中的返回位置不在程序内`);
    state.pc = target;
  } else if (JUMPS.has(op)) {
    const take = op === 'JMP' || ({ JZ: state.flags.ZF === 1, JNZ: state.flags.ZF === 0,
      JC: state.flags.CF === 1, JNC: state.flags.CF === 0, JO: state.flags.OF === 1, JNO: state.flags.OF === 0 })[op];
    if (take) state.pc = args[0].target;
  } else if (op === 'HLT') state.halted = true;
  if (state.pc >= program.instructions.length) state.halted = true;
  state.last = { line: ins.line, text: ins.text };
  return state;
}

export function run(program, initial = createMachine(), limit = 10_000) {
  let state = initial;
  for (let i = 0; i < limit && !state.halted; i++) state = step(program, state);
  if (!state.halted) throw new Error(`超过 ${limit} 步：可能存在无限循环`);
  return state;
}
