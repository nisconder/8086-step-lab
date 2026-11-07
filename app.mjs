import { compile, createMachine, step, REGISTERS, FLAG_NAMES, hex, readWord } from './core.mjs';
import { EXAMPLES } from './examples.mjs';
const $ = id => document.getElementById(id);
let program, state = createMachine(), before = null, history = [], dirty = true, timer = null, runSteps = 0;
const flagText = { CF: '无符号进位或借位', PF: '结果低字节的 1 为偶数个', AF: '低四位进位或借位', ZF: '结果为零', SF: '结果的最高位', OF: '有符号运算溢出' };
function element(tag, text, className) { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (className) el.className = className; return el; }
function message(text, error = false) { $('status').textContent = text; $('status').classList.toggle('error', error); }
function stop() { clearInterval(timer); timer = null; $('play').textContent = '连续运行'; }
function reset() {
  stop(); before = null; history = []; state = createMachine();
  try { program = compile($('code').value); dirty = false; message('已就绪。点击单步，观察第一条指令。'); }
  catch (error) { program = null; dirty = true; message(error.message, true); }
  render();
}
function execute() {
  if (dirty) reset();
  if (!program || state.halted) { stop(); return; }
  try {
    const next = step(program, state);
    history.push(state); if (history.length > 256) history.shift();
    before = state; state = next;
    message(`第 ${state.steps} 步 · ${state.last?.text ?? ''}${state.halted ? ' · 执行结束' : ''}`);
    if (state.halted) stop(); render();
  } catch (error) { stop(); message(error.message, true); render(); }
}
function render() {
  $('registers').replaceChildren(...REGISTERS.map(name => {
    const cell = element('div', undefined, before && before.regs[name] !== state.regs[name] ? 'changed' : '');
    cell.append(element('dt', name), element('dd', hex(state.regs[name])));
    cell.title = `${state.regs[name]}（无符号） / ${state.regs[name] > 32767 ? state.regs[name] - 65536 : state.regs[name]}（有符号）`;
    return cell;
  }));
  $('flags').replaceChildren(...FLAG_NAMES.map(name => {
    const cell = element('div', undefined, 'flag');
    cell.classList.toggle('active', state.flags[name] === 1);
    cell.classList.toggle('changed', Boolean(before && before.flags[name] !== state.flags[name]));
    cell.title = flagText[name]; cell.append(element('span', name), element('strong', state.flags[name] ?? '—')); return cell;
  }));
  $('pc-value').textContent = hex(state.pc); $('pc-label').textContent = `${state.steps} 步 / PC ${state.pc}`;
  const rows = program?.instructions.map((ins, pc) => {
    const row = element('li'); row.classList.toggle('current', !state.halted && pc === state.pc);
    row.classList.toggle('previous', state.last?.line === ins.line);
    row.append(element('span', ins.line.toString().padStart(2, '0')), element('code', ins.text));
    if (!state.halted && pc === state.pc) { row.append(element('b', '下一条')); row.setAttribute('aria-current', 'step'); }
    return row;
  }) ?? [];
  $('listing').replaceChildren(...rows);
  const addresses = [...state.memory.keys()].sort((a, b) => a - b);
  if (!addresses.length) $('memory').replaceChildren(element('p', '执行一次内存写入或压栈后，字节会出现在这里。', 'empty'));
  else {
    const shown = addresses.slice(-128);
    const range = element('p', `显示已写入地址中最高的 ${shown.length} 个字节：${hex(shown[0], 5)}h–${hex(shown.at(-1), 5)}h；另有 ${addresses.length - shown.length} 个较低地址字节未显示。`, 'micro');
    const table = element('table'), head = element('thead'), header = element('tr');
    ['物理地址', '字节', '从此处读 word'].forEach(t => header.append(element('th', t))); head.append(header); table.append(head);
    const body = element('tbody');
    for (const addr of shown) {
      const row = element('tr'); row.classList.toggle('changed', Boolean(before && before.memory.get(addr) !== state.memory.get(addr)));
      row.append(element('td', hex(addr, 5)), element('td', hex(state.memory.get(addr), 2)), element('td', hex(readWord(state, addr)))); body.append(row);
    }
    table.append(body); $('memory').replaceChildren(range, table);
  }
  $('back').disabled = history.length === 0 || dirty;
  $('step').disabled = !dirty && state.halted;
  $('play').disabled = !dirty && state.halted;
}
$('example').replaceChildren(...EXAMPLES.map(e => { const o = element('option', e.title); o.value = e.id; return o; }));
function loadExample() { const example = EXAMPLES.find(e => e.id === $('example').value); $('code').value = example.code; $('lesson-hint').textContent = example.hint; reset(); }
$('example').addEventListener('change', loadExample);
$('step').addEventListener('click', execute); $('reset').addEventListener('click', reset);
$('back').addEventListener('click', () => { stop(); before = state; state = history.pop(); message(`已回退到第 ${state.steps} 步。`); render(); });
$('play').addEventListener('click', () => {
  if (timer) { stop(); return; }
  if (dirty) reset(); if (!program || state.halted) return;
  runSteps = 0; $('play').textContent = '暂停';
  timer = setInterval(() => { execute(); if (++runSteps >= 1000 && timer) { stop(); message('已暂停：本轮达到 1,000 步。检查循环，或点击继续运行。'); } }, 180);
});
$('code').addEventListener('input', () => { stop(); dirty = true; program = null; message('程序已修改。点击单步或重置，从初始状态重新开始。'); render(); });
document.addEventListener('keydown', event => {
  if (event.key === 'ArrowRight' && !['TEXTAREA', 'INPUT', 'SELECT'].includes(document.activeElement.tagName)) { event.preventDefault(); if (!$('step').disabled) execute(); }
  if (event.key === 'Escape') stop();
});
loadExample();
