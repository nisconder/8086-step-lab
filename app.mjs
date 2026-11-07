import { compile, createMachine, step, REGISTERS, FLAG_NAMES, hex, readWord } from './core.mjs';
import { EXAMPLES } from './examples.mjs';
const $ = id => document.getElementById(id);
let program, state = createMachine(), before = null, history = [], dirty = true, timer = null, runSteps = 0, selectedRegister = 'AX';
const registerCells = new Map();
const flagText = { CF: '无符号进位或借位', PF: '结果低字节的 1 为偶数个', AF: '低四位进位或借位', ZF: '结果为零', SF: '结果的最高位', OF: '有符号运算溢出' };
const element = (tag, text, className) => {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
};
function message(text, error = false) { $('status').textContent = text; $('status').classList.toggle('error', error); }
function controlState() {
  $('play-label').textContent = timer ? '暂停' : '连续运行';
  $('session-label').textContent = timer ? 'RUNNING' : dirty ? 'EDITED' : state.halted ? 'HALTED' : state.steps ? 'PAUSED' : 'READY';
  $('session-led').classList.toggle('running', Boolean(timer));
}
function stop() { clearInterval(timer); timer = null; controlState(); }
function reset() {
  stop(); before = null; history = []; state = createMachine();
  try { program = compile($('code').value); dirty = false; message('程序已就绪。点击单步，观察第一次变化。'); }
  catch (error) { program = null; dirty = true; message(error.message, true); }
  render();
}
function pulseFlow() {
  const flow = $('signal-flow');
  flow.getAnimations().forEach(animation => animation.cancel());
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  flow.animate([{ strokeDashoffset: '22', opacity: 0 }, { opacity: 1, offset: 0.2 }, { strokeDashoffset: '-22', opacity: 0 }], { duration: 650, easing: 'linear' });
}
function execute() {
  if (dirty) reset();
  if (!program || state.halted) { stop(); return; }
  try {
    const next = step(program, state);
    history.push(state); if (history.length > 256) history.shift();
    before = state; state = next;
    message('第 ' + state.steps + ' 步 · ' + (state.last?.text ?? '') + (state.halted ? ' · 执行结束' : ''));
    if (state.halted) stop();
    render(); pulseFlow();
  } catch (error) { stop(); message(error.message, true); render(); }
}
function highlightCode() {
  const text = $('code').value;
  const pattern = /(;[^\n\r]*)|([a-z_]\w*:)|(\b(?:MOV|ADD|SUB|CMP|INC|DEC|AND|OR|XOR|JMP|JZ|JNZ|JC|JNC|JO|JNO|PUSH|POP|CALL|RET|NOP|HLT)\b)|(?<![\w])[+-]?(?:0x[0-9a-f]+|[0-9][0-9a-f]*h|[01]+b|\d+)/gim;
  const nodes = []; let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    nodes.push(document.createTextNode(text.slice(cursor, match.index)));
    nodes.push(element('span', match[0], match[1] ? 'token-comment' : match[2] ? 'token-label' : match[3] ? 'token-op' : 'token-number'));
    cursor = match.index + match[0].length;
  }
  nodes.push(document.createTextNode(text.slice(cursor) + '\n'));
  $('code-highlight').replaceChildren(...nodes);
  $('line-numbers').textContent = text.split('\n').map((_, i) => String(i + 1).padStart(2, '0')).join('\n');
  syncEditorScroll();
}
function syncEditorScroll() {
  $('code-highlight').scrollTop = $('code').scrollTop;
  $('code-highlight').scrollLeft = $('code').scrollLeft;
  $('line-numbers').style.transform = 'translateY(-' + $('code').scrollTop + 'px)';
}
function describeStep() {
  if (dirty) return '程序已修改。下一次执行将从初始状态开始。';
  if (!state.last) return '点击单步，沿着一条指令观察第一次状态变化。';
  if (before && before.steps > state.steps) return '已恢复第 ' + state.steps + ' 步的寄存器、标志与内存快照。';
  const changed = REGISTERS.filter(name => before && before.regs[name] !== state.regs[name]);
  const change = changed.map(name => name + ': ' + hex(before.regs[name]) + ' → ' + hex(state.regs[name])).join(' · ');
  const op = state.last.text.split(/\s/)[0].toUpperCase();
  const flags = ['ADD', 'SUB', 'CMP', 'INC', 'DEC'].includes(op) ? 'CF=' + state.flags.CF + ' · OF=' + state.flags.OF + ' · ZF=' + state.flags.ZF : '';
  if (op === 'CMP') return 'CMP 更新比较标志，保留原操作数。' + flags;
  if (op === 'MOV') {
    const destination = program.instructions.find(ins => ins.line === state.last.line)?.args[0];
    const unchanged = destination?.kind === 'reg' ? destination.name + ' ← ' + hex(state.regs[destination.name]) + '，数值保持不变' : '写入内存中的 word';
    return (change || unchanged) + ' · MOV 保留算术标志。';
  }
  if (op === 'CALL' || op === 'RET') return (op === 'CALL' ? '下一条指令索引压栈，然后跳转。' : '从栈中恢复返回指令索引。') + ' SP=' + hex(state.regs.SP);
  if (op === 'HLT') return '程序已停止。当前寄存器、标志与内存保持可见，也可以回退继续观察。';
  if (op === 'JMP') return '无条件跳转，下一条指令索引为 PC ' + state.pc + '。保留算术标志。';
  if (op.startsWith('J')) return '读取当前标志，下一条指令索引为 PC ' + state.pc + '。跳转保留算术标志。';
  return [change || state.last.text, flags].filter(Boolean).join(' · ');
}
function traceDestination() {
  const instruction = program?.instructions.find(ins => ins.line === state.last?.line);
  if (!instruction) return '等待状态变化';
  const { op, args } = instruction;
  if (op === 'CMP') return 'ZF ' + state.flags.ZF + ' · CF ' + state.flags.CF;
  if (['MOV', 'ADD', 'SUB', 'INC', 'DEC', 'AND', 'OR', 'XOR', 'POP'].includes(op)) {
    return args[0].kind === 'reg' ? args[0].name + ' · ' + hex(state.regs[args[0].name]) : 'MEMORY · WORD';
  }
  if (op === 'PUSH') return 'SS:SP · ' + hex(state.regs.SP);
  if (op === 'CALL' || op === 'RET' || op.startsWith('J')) return 'PC · ' + state.pc;
  return op === 'HLT' ? 'HALTED' : '状态保留';
}
function renderMemory() {
  const addresses = [...state.memory.keys()].sort((a, b) => a - b);
  if (!addresses.length) {
    const empty = element('div', undefined, 'memory-empty');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 84 54'); svg.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 8; i++) {
      const r = document.createElementNS(svg.namespaceURI, 'rect');
      Object.entries({ x: 2 + i % 4 * 21, y: 6 + Math.floor(i / 4) * 23, width: 15, height: 15, rx: 2, fill: 'none', stroke: 'currentColor' }).forEach(([k, v]) => r.setAttribute(k, v));
      svg.append(r);
    }
    const copy = element('div');
    copy.append(element('p', '还没有内存写入。向内存 MOV，或执行压栈后，字节会出现在这里。'));
    const button = element('button', '试试「地址与小端序」实验 ↗');
    button.addEventListener('click', () => loadExample('memory'));
    copy.append(button); empty.append(svg, copy); $('memory').replaceChildren(empty); return;
  }
  const shown = addresses.slice(-128);
  const range = element('p', hex(shown[0], 5) + 'h—' + hex(shown.at(-1), 5) + 'h · 已写入 ' + addresses.length + ' 字节' + (addresses.length > 128 ? '，展示最高 128 个地址，' + (addresses.length - 128) + ' 个较低地址未显示' : ''), 'micro');
  const table = element('table'), head = element('thead'), header = element('tr');
  ['物理地址', '字节', '从此处读 word'].forEach(t => header.append(element('th', t))); head.append(header); table.append(head);
  const body = element('tbody');
  for (const addr of shown) {
    const row = element('tr');
    row.classList.toggle('changed', Boolean(before && before.memory.get(addr) !== state.memory.get(addr)));
    row.append(element('td', hex(addr, 5)), element('td', hex(state.memory.get(addr), 2)), element('td', hex(readWord(state, addr))));
    body.append(row);
  }
  table.append(body); $('memory').replaceChildren(range, table);
}
function render() {
  for (const name of REGISTERS) {
    const cell = registerCells.get(name);
    const changed = Boolean(before && before.regs[name] !== state.regs[name]);
    cell.classList.toggle('changed', changed); cell.setAttribute('aria-pressed', name === selectedRegister);
    cell.lastElementChild.textContent = hex(state.regs[name]);
    cell.setAttribute('aria-label', name + ' ' + hex(state.regs[name]) + (changed ? '，本步变化' : '') + '，点击观察');
  }
  const value = state.regs[selectedRegister], oldValue = before?.regs[selectedRegister];
  const changed = oldValue !== undefined && oldValue !== value;
  $('selected-register').textContent = selectedRegister; $('selected-value').textContent = hex(value);
  $('unsigned-value').textContent = value; $('signed-value').textContent = value > 32767 ? value - 65536 : value;
  $('value-change').textContent = changed ? hex(oldValue) + ' → ' + hex(value) : state.steps ? '本步未变' : '初始状态';
  $('value-change').classList.toggle('changed-text', changed);
  const binary = value.toString(2).padStart(16, '0');
  $('bit-strip').setAttribute('aria-label', selectedRegister + ' 的二进制值 ' + binary);
  [...$('bit-strip').children].forEach((bit, i) => {
    bit.textContent = binary[i]; bit.classList.toggle('on', binary[i] === '1');
    bit.classList.toggle('bit-changed', changed && ((oldValue >>> (15 - i)) & 1) !== Number(binary[i]));
    bit.title = '位 ' + (15 - i) + ' = ' + binary[i];
  });
  $('flags').replaceChildren(...FLAG_NAMES.map(name => {
    const cell = element('div', undefined, 'flag');
    cell.classList.toggle('active', state.flags[name] === 1);
    cell.classList.toggle('changed', Boolean(before && before.flags[name] !== state.flags[name]));
    cell.title = name + ' · ' + flagText[name];
    cell.setAttribute('aria-label', name + ' ' + (state.flags[name] ?? '未定义') + '，' + flagText[name]);
    cell.append(element('span', name), element('strong', state.flags[name] ?? '—')); return cell;
  }));
  $('pc-value').textContent = hex(state.pc); $('sp-value').textContent = hex(state.regs.SP); $('pc-label').textContent = 'PC ' + state.pc;
  $('next-instruction').textContent = !program ? '等待有效程序' : state.halted ? '执行结束' : program.instructions[state.pc]?.text ?? '—';
  $('trace-op').textContent = state.last ? state.last.text.slice(0, 20) : '等待执行';
  $('trace-dest').textContent = traceDestination();
  $('operation-caption').textContent = describeStep();
  $('listing').replaceChildren(...(program?.instructions.map((ins, pc) => {
    const row = element('li'); row.classList.toggle('current', !state.halted && pc === state.pc);
    row.classList.toggle('previous', state.last?.line === ins.line);
    row.append(element('span', String(ins.line).padStart(2, '0')), element('code', ins.text));
    if (!state.halted && pc === state.pc) { row.append(element('b', '下一条')); row.setAttribute('aria-current', 'step'); } return row;
  }) ?? []));
  renderMemory();
  $('back').disabled = history.length === 0 || dirty;
  $('step').disabled = !dirty && state.halted; $('play').disabled = !dirty && state.halted;
  controlState();
}
function loadExample(id = $('example').value) {
  const example = EXAMPLES.find(e => e.id === id);
  $('example').value = example.id; $('code').value = example.code; $('lesson-hint').textContent = example.hint;
  $('lesson-number').textContent = String(EXAMPLES.indexOf(example) + 1).padStart(2, '0') + ' / 05';
  for (const button of $('lesson-tabs').children) button.setAttribute('aria-pressed', button.dataset.example === id);
  $('code').scrollTop = 0; $('code').scrollLeft = 0; highlightCode(); reset();
}
for (const name of REGISTERS) {
  const cell = element('button', undefined, 'register-cell'); cell.type = 'button';
  cell.append(element('span', name), element('strong', '0000'));
  cell.addEventListener('click', () => { selectedRegister = name; render(); });
  registerCells.set(name, cell); $('registers').append(cell);
}
for (let i = 0; i < 16; i++) $('bit-strip').append(element('span', '0'));
for (const [i, example] of EXAMPLES.entries()) {
  const option = element('option', example.title); option.value = example.id; $('example').append(option);
  const button = element('button', undefined, 'lesson-tab'); button.type = 'button'; button.dataset.example = example.id;
  button.append(element('small', String(i + 1).padStart(2, '0')), element('span', example.title));
  button.addEventListener('click', () => loadExample(example.id)); $('lesson-tabs').append(button);
}
$('example').addEventListener('change', () => loadExample());
$('step').addEventListener('click', execute); $('reset').addEventListener('click', reset);
$('back').addEventListener('click', () => { stop(); before = state; state = history.pop(); message('已回退到第 ' + state.steps + ' 步。'); render(); });
$('play').addEventListener('click', () => {
  if (timer) { stop(); return; }
  if (dirty) reset(); if (!program || state.halted) return;
  runSteps = 0;
  timer = setInterval(() => { execute(); if (++runSteps >= 1000 && timer) { stop(); message('已暂停：本轮达到 1,000 步。检查循环，或点击继续运行。'); } }, 180);
  controlState();
});
$('code').addEventListener('scroll', syncEditorScroll);
$('code').addEventListener('input', () => { stop(); dirty = true; program = null; highlightCode(); message('程序已修改。点击单步或重置，从初始状态重新开始。'); render(); });
document.addEventListener('keydown', event => {
  const active = document.activeElement;
  if (event.key === 'ArrowRight' && !['TEXTAREA', 'INPUT', 'SELECT'].includes(active.tagName) && (active.tagName !== 'BUTTON' || active.id === 'step')) { event.preventDefault(); if (!$('step').disabled) execute(); }
  if (event.key === 'Escape') stop();
});
loadExample(EXAMPLES[0].id);
