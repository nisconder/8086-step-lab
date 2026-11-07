// Preserve the original five programs, including their instruction indexes.
const LEGACY_EXAMPLES = [
  { id: 'overflow', title: '有符号溢出', hint: '7FFFh + 1 = 8000h：OF=1，CF=0。无符号进位与有符号溢出是两件事。', code: `; 观察 ADD 后的 OF 与 CF
MOV AX, 7FFFh
ADD AX, 1
MOV BX, 0FFFFh
ADD BX, 1
HLT` },
  { id: 'loop', title: '循环求和', hint: '每轮累加 CX，再递减。JNZ 读取 DEC 留下的 ZF；最终 AX = 000Fh。', code: `; 计算 5 + 4 + 3 + 2 + 1
MOV AX, 0
MOV CX, 5
again:
ADD AX, CX
DEC CX
JNZ again
HLT` },
  { id: 'memory', title: '地址与小端序', hint: '默认 DS=1000h。[BX+SI] 的物理地址为 10024h，1234h 存为 34 12 两个字节。', code: `; 有效地址 = BX + SI
MOV BX, 20h
MOV SI, 4
MOV AX, 1234h
MOV [BX+SI], AX
MOV DX, [24h]
HLT` },
  { id: 'stack', title: '调用与栈', hint: 'CALL 把下一条指令的索引压入 SS:SP。观察 SP 递减、RET 恢复，以及 PUSH/POP 保存 BX。', code: `; 本实验的返回位置是指令索引，不是机器码字节地址
MOV AX, 7
CALL twice
HLT
twice:
PUSH BX
MOV BX, AX
ADD AX, BX
POP BX
RET` },
  { id: 'carry', title: 'INC 保留进位', hint: 'FFFFh + 1 令 CF=1。随后 INC/DEC 保留 CF；CMP 更新标志但不写回 AX。', code: `MOV AX, 0FFFFh
ADD AX, 1
INC AX
DEC AX
CMP AX, 0
JZ equal
MOV BX, 1
equal:
HLT` }
];

const LEGACY_LESSONS = {
  overflow: {
    chapterId: '03', observeRegister: 'AX', sourceSection: '加法器只处理位 标志位帮助解释结果',
    scopeNote: '原文表格是 8 位运算；这里改用 16 位边界 7FFFh / FFFFh 作类比。机器回绕不代表 C 语言有符号溢出具有相同语义。',
    steps: ['执行第 2 步，比较 AX 的有符号值与 OF。', '记下 OF=1、CF=0，再继续。', '执行第 4 步，比较 BX 回绕时的 CF 与 OF。'],
    checkpoints: [
      { step: 2, text: 'AX = 8000h，即 -32768；OF = 1、CF = 0。' },
      { step: 4, text: 'BX = 0000h；CF = 1、OF = 0。标志来自最近一次 ADD。' }
    ],
    expected: { steps: 5, regs: { AX: 0x8000, BX: 0 }, flags: { CF: 1, OF: 0, ZF: 1 } }
  },
  loop: {
    chapterId: '09', observeRegister: 'AX', sourceSection: '循环写成初始化、循环体和控制条件',
    scopeNote: '这是循环计数概念的补充算例，计算 5+4+3+2+1，不是原文数组题。DEC/JNZ 会改变标志，不与原文 LOOP 在标志行为上等价。',
    steps: ['前两步设置 AX=0、CX=5。', '观察 ADD 累加当前 CX，DEC 后由 JNZ 决定是否继续。', '执行到结束，检查 AX=000Fh、CX=0000h。'],
    checkpoints: [
      { step: 3, text: '第 1 次累加：AX = 0005h，CX = 0005h。' },
      { step: 9, text: '第 3 次累加：AX = 000Ch，CX = 0003h。' },
      { step: 18, text: '结束：AX = 000Fh，即 15；CX = 0000h。' }
    ],
    expected: { steps: 18, regs: { AX: 15, CX: 0 }, flags: { ZF: 1 } }
  },
  memory: {
    chapterId: '02', observeRegister: 'DX', sourceSection: '端序决定多字节对象的排列',
    scopeNote: '这是原文字节序概念的补充 16 位算例；1234h 与 BX+SI 地址并非原文的 32 位对象题。',
    steps: ['前三步准备 BX、SI 和 AX。', '第 4 步查看 10024h 的两个字节 34 12。', '第 5 步观察 DX 读取同一地址，得到 1234h。'],
    checkpoints: [
      { step: 4, text: 'EA = 0024h，物理地址 10024h，字节为 34 12。' },
      { step: 5, text: 'DX = 1234h，与写入的 AX 相同。' }
    ],
    expected: { steps: 6, regs: { AX: 0x1234, DX: 0x1234 }, memory: [{ address: 0x10024, bytes: [0x34, 0x12] }] }
  },
  stack: {
    chapterId: '08', observeRegister: 'SP', sourceSection: 'CALL 与 RET 按近远配对',
    scopeNote: '补充演示子程序保存 BX；SP 沿用模型默认 FFFEh，不是原题的 0100h。CALL / RET 使用指令索引，不是真实 IP 或完整调用约定。',
    steps: ['第 2 步观察 CALL 将 SP 从 FFFEh 减到 FFFCh。', '第 3 步 PUSH BX 后，SP 再减到 FFFAh。', '第 7 步 RET 后，核对 AX=14、BX=0、SP=FFFEh。'],
    checkpoints: [
      { step: 2, text: 'SP = FFFCh，栈中返回索引为 0002h。' },
      { step: 3, text: 'PUSH BX 后 SP = FFFAh，保存的 BX = 0000h。' },
      { step: 7, text: 'RET 恢复 SP = FFFEh，AX = 000Eh、BX = 0000h。' }
    ],
    expected: { steps: 8, regs: { AX: 14, BX: 0, SP: 0xfffe }, memory: [{ address: 0x2fffc, bytes: [2, 0] }] }
  },
  carry: {
    chapterId: '07', observeRegister: 'AX', sourceSection: '自测与答案',
    scopeNote: '对应原题“初始 CF=1，MOV AX,0 后 INC AX”的标志观察。前两条用 FFFFh+1 构造 CF=1、AX=0，再补充 DEC 与 CMP 对照；这些辅助指令不是原题代码。',
    steps: ['第 2 步得到 AX=0000h、CF=1。', '第 3、4 步观察 INC / DEC 改变 AX，但保留 CF。', '第 5 步观察 CMP 更新标志，随后 JZ 跳过 MOV BX,1。'],
    checkpoints: [
      { step: 2, text: 'AX = 0000h，CF = 1。' },
      { step: 3, text: 'INC 后 AX = 0001h，CF 仍为 1。' },
      { step: 4, text: 'DEC 后 AX = 0000h，CF 仍为 1。' },
      { step: 5, text: 'CMP AX,0 后 CF = 0、ZF = 1；AX 仍为 0000h。' }
    ],
    expected: { steps: 7, regs: { AX: 0, BX: 0 }, flags: { CF: 0, ZF: 1 } }
  }
};

const CHAPTER_EXAMPLES = [
  {
    id: 'instruction-trace', chapterId: '01', title: '7 + 5 的指令跟踪',
    hint: '先准备两个字，再依次读取、相加和写回。AX 与结果单元最终都是 12。',
    initial: { ds: 0 }, observeRegister: 'AX', sourceSection: '一道完整的指令跟踪题',
    scopeNote: '原文使用自定义 LOAD / STORE 模型，并非 8086。这里把 R0 改为 AX；原单元 100 / 101 / 102 映射到字节偏移 0100h / 0102h / 0104h，避免 16 位字重叠。',
    steps: ['执行前两步，准备数值 7 和 5。', '执行到第 4 步，观察 AX 从 7 变成 12。', '执行第 5 步，检查 00104h 处写入 0C 00。'],
    checkpoints: [
      { step: 3, text: '读取第一个字：AX = 0007h。' },
      { step: 4, text: '加上第二个字：AX = 000Ch，即十进制 12。' },
      { step: 5, text: '结果写入 00104h：两个字节为 0C 00。' }
    ],
    code: `; 前两条准备原题数据，随后跟踪读、算、写
MOV [0100h], 7
MOV [0102h], 5
MOV AX, [0100h]
ADD AX, [0102h]
MOV [0104h], AX
HLT`,
    expected: { steps: 6, regs: { AX: 12 }, memory: [{ address: 0x100, bytes: [7, 0, 5, 0, 12, 0] }] }
  },
  {
    id: 'endian32', chapterId: '02', title: '从 1001h 读一个字',
    hint: '12345678h 的小端布局为 78 56 34 12。从第二个字节开始读 16 位，AX 得到 3456h。',
    initial: { ds: 0 }, observeRegister: 'AX', sourceSection: '端序决定多字节对象的排列',
    scopeNote: '前两条 MOV 用两个 16 位字准备原文的 32 位位模式；随后只执行原文的 16 位读取，不执行 32 位算术。DS=0000h 使物理地址与原文一致。',
    steps: ['执行前两步，检查 01000h 起的 78 56 34 12。', '预测从 1001h 开始读取会组合哪两个字节。', '执行第 3 步，核对 AX = 3456h。'],
    checkpoints: [
      { step: 2, text: '01000h 至 01003h：78 56 34 12。' },
      { step: 3, text: '低字节 56h、高字节 34h，组合为 AX = 3456h。' }
    ],
    code: `; 用两个字准备原文中的 32 位对象
MOV [1000h], 5678h
MOV [1002h], 1234h
MOV AX, [1001h]
HLT`,
    expected: { steps: 4, regs: { AX: 0x3456 }, memory: [{ address: 0x1000, bytes: [0x78, 0x56, 0x34, 0x12] }] }
  },
  {
    id: 'logic-mask', chapterId: '02', title: '用掩码保留高低字节',
    hint: '对 2C0Bh 分别应用 FF00h 与 00FFh，得到 2C00h 和 000Bh。',
    observeRegister: 'AX', sourceSection: '位运算如何提取信息',
    scopeNote: '复现原文的按位与思路。高字节仍位于 AX 的高 8 位；当前模型没有移位指令，不执行原文的右移表达式。',
    steps: ['前两步把 2C0Bh 放入 AX 和 BX。', '第 3 步观察 FF00h 保留 AX 的高字节。', '第 4 步观察 00FFh 保留 BX 的低字节。'],
    checkpoints: [
      { step: 3, text: 'AX = 2C00h：高字节保留，低字节清零。' },
      { step: 4, text: 'BX = 000Bh：低字节保留，高字节清零。' }
    ],
    code: `MOV AX, 2C0Bh
MOV BX, AX
AND AX, 0FF00h
AND BX, 00FFh
HLT`,
    expected: { steps: 5, regs: { AX: 0x2c00, BX: 11 }, flags: { CF: 0, OF: 0, AF: null } }
  },
  {
    id: 'signed-view', chapterId: '03', title: '0085h 与 FF85h',
    hint: '在 16 位视图中，0085h 表示 133；FF85h 的有符号解释为 -123。',
    observeRegister: 'BX', sourceSection: '扩展 截断与混合类型比较',
    scopeNote: '原文把 8 位 85h 零扩展为 0085h、符号扩展为 FF85h。这里直接载入两个扩展结果进行比较，不模拟 CBW 指令或 C 的类型转换规则。',
    steps: ['第 1 步载入零扩展结果 0085h。', '第 2 步载入符号扩展结果 FF85h。', '切换 AX / BX，比较相同低字节下的有符号十进制值。'],
    checkpoints: [
      { step: 1, text: 'AX = 0085h：16 位无符号与有符号解释均为 133。' },
      { step: 2, text: 'BX = FF85h：无符号 65413，有符号 -123。' }
    ],
    code: `; 直接载入原文中的两种扩展结果
MOV AX, 0085h
MOV BX, 0FF85h
HLT`,
    expected: { steps: 3, regs: { AX: 0x85, BX: 0xff85 } }
  },
  {
    id: 'segmented-address', chapterId: '05', title: 'DS:001Ah 对应哪里',
    hint: 'DS=1234h，BX=0010h、SI=0004h。加上位移 6，EA=001Ah，物理地址为 1235Ah。',
    initial: { ds: 0x1234, ss: 0x2000 }, observeRegister: 'AX', sourceSection: '一道地址题，分四步计算',
    scopeNote: '前三条准备原文给定的寄存器与 78 56 两个内存字节，再执行题目中的 MOV。段值由演示配置提供，不执行段寄存器写入。',
    steps: ['前两步准备 BX=0010h、SI=0004h。', '第 3 步把原题的 78 56 放到物理 1235Ah。', '第 4 步核对 AX=5678h，以及 DS×10h+001Ah。'],
    checkpoints: [
      { step: 3, text: '1234h × 10h + 001Ah = 1235Ah，此处字节为 78 56。' },
      { step: 4, text: 'AX = 5678h；BX = 0010h、SI = 0004h 保持不变。' }
    ],
    code: `; DS=1234h 由演示初始配置提供
MOV BX, 0010h
MOV SI, 0004h
MOV [BX+SI+6], 5678h
MOV AX, [BX+SI+6]
HLT`,
    expected: { steps: 5, regs: { AX: 0x5678, BX: 0x10, SI: 4 }, memory: [{ address: 0x1235a, bytes: [0x78, 0x56] }] }
  },
  {
    id: 'bp-address', chapterId: '06', title: '含 BP 的地址默认用 SS',
    hint: 'BP=0100h、SI=0020h，加位移 10h 得到 0130h。含 BP，因此访问 SS:0130h。',
    initial: { ds: 0x2000, ss: 0x3000 }, observeRegister: 'AX', sourceSection: '一道寻址题的完整解法',
    scopeNote: '前三条准备原题初值；随后复现 MOV AX,[BP+SI+10h]。默认段为 SS=3000h，不是 DS=2000h；不演示段超越或 LEA。',
    steps: ['前两步准备 BP 和 SI。', '第 3 步在物理 30130h 写入原题的 34 12。', '第 4 步核对 AX=1234h，BP 和 SI 均未改变。'],
    checkpoints: [
      { step: 3, text: 'EA = 0130h，SS=3000h，物理 30130h 的字节为 34 12。' },
      { step: 4, text: 'AX = 1234h；BP = 0100h、SI = 0020h 保持不变。' }
    ],
    code: `; DS=2000h、SS=3000h 由演示初始配置提供
MOV BP, 0100h
MOV SI, 0020h
MOV [BP+SI+10h], 1234h
MOV AX, [BP+SI+10h]
HLT`,
    expected: { steps: 5, regs: { AX: 0x1234, BP: 0x100, SI: 0x20 }, memory: [{ address: 0x30130, bytes: [0x34, 0x12] }] }
  },
  {
    id: 'stack-order', chapterId: '06', title: '两次入栈，两次出栈',
    hint: '从 SP=0100h 开始，依次压入 1234h、ABCDh；弹出顺序相反，最后 SP 回到 0100h。',
    observeRegister: 'SP', sourceSection: '栈题抓住操作顺序',
    scopeNote: '前三条准备原题的 SP、AX、BX；栈使用 SS=2000h。PUSH 先将 SP 减 2 再写入一个 16 位字，POP 先读取再将 SP 加 2。',
    steps: ['前三步准备 SP=0100h、AX=1234h、BX=ABCDh。', '第 4、5 步观察 SP 变为 00FEh、00FCh。', '第 6、7 步检查 CX=ABCDh、DX=1234h 与 SP 恢复。'],
    checkpoints: [
      { step: 4, text: 'SP = 00FEh，物理 200FEh 的字节为 34 12。' },
      { step: 5, text: 'SP = 00FCh，物理 200FCh 的字节为 CD AB。' },
      { step: 6, text: 'CX = ABCDh，SP 回到 00FEh。' },
      { step: 7, text: 'DX = 1234h，SP 回到初始 0100h。' }
    ],
    code: `MOV SP, 0100h
MOV AX, 1234h
MOV BX, 0ABCDh
PUSH AX
PUSH BX
POP CX
POP DX
HLT`,
    expected: { steps: 8, regs: { CX: 0xabcd, DX: 0x1234, SP: 0x100 }, memory: [{ address: 0x200fc, bytes: [0xcd, 0xab, 0x34, 0x12] }] }
  },
  {
    id: 'near-call', chapterId: '08', title: '近调用如何保存返回位置',
    hint: 'SP 从 0100h 变为 00FEh，再由 RET 恢复。观察栈中保存的返回指令索引。',
    observeRegister: 'SP', sourceSection: 'CALL 与 RET 按近远配对',
    scopeNote: '沿用原文 SP=0100h 的近调用过程。模型 CALL 压入下一条指令索引 0003h；它不是真实机器的返回 IP=0123h，也不模拟 CS、远调用或机器码长度。',
    steps: ['前两步设置 SP=0100h、AX=7。', '第 3 步 CALL 后查看 SS:00FEh 中的 03 00。', '第 5 步 RET 后核对 SP=0100h，并回到 HLT。'],
    checkpoints: [
      { step: 3, text: 'CALL 后 SP = 00FEh，200FEh 存有返回索引 0003h。' },
      { step: 4, text: '子程序把 AX 从 0007h 加倍为 000Eh。' },
      { step: 5, text: 'RET 后 SP = 0100h，PC = 3，下一条为 HLT。' }
    ],
    code: `; 返回位置使用指令索引，并非真实 IP
MOV SP, 0100h
MOV AX, 7
CALL twice
HLT
twice:
ADD AX, AX
RET`,
    expected: { steps: 6, regs: { AX: 14, SP: 0x100 }, memory: [{ address: 0x200fe, bytes: [3, 0] }] }
  },
  {
    id: 'array-sum', chapterId: '09', title: '数组 1、2、3、4 求和',
    hint: '每轮读取一个 16 位数组元素，SI 加 2、CX 减 1。AX 逐轮得到 1、3、6、10。',
    observeRegister: 'AX', sourceSection: '循环写成初始化、循环体和控制条件',
    scopeNote: '前四条准备原文数组，指定 ARRAY 位于 DS:0200h。MOV SI,0200h 替代 LEA；DEC/JNZ 替代 LOOP。DEC 更新标志，因此这里末尾 ZF=1，原 LOOP 保留最后 ADD SI,2 的 ZF=0。不是完整 MASM / DOS 环境。',
    steps: ['前 7 步准备数组、SI 和循环计数。', '逐轮查看 AX=1、3、6、10，SI 每次增加 2。', '完成后核对 AX=000Ah、CX=0000h、SI=0208h。'],
    checkpoints: [
      { step: 8, text: '第 1 次累加后 AX = 0001h。' },
      { step: 12, text: '第 2 次累加后 AX = 0003h。' },
      { step: 16, text: '第 3 次累加后 AX = 0006h。' },
      { step: 20, text: '第 4 次累加后 AX = 000Ah，即十进制 10。' },
      { step: 24, text: '结束：AX = 000Ah、CX = 0000h、SI = 0208h；ZF = 1。' }
    ],
    code: `; 前四条准备 ARRAY 的四个字
MOV [0200h], 1
MOV [0202h], 2
MOV [0204h], 3
MOV [0206h], 4
XOR AX, AX
MOV SI, 0200h
MOV CX, 4
again:
ADD AX, [SI]
ADD SI, 2
DEC CX
JNZ again
HLT`,
    expected: { steps: 24, regs: { AX: 10, CX: 0, SI: 0x208 }, flags: { ZF: 1 }, memory: [{ address: 0x10200, bytes: [1, 0, 2, 0, 3, 0, 4, 0] }] }
  },
  {
    id: 'debug-sum', chapterId: '10', title: '复现 DEBUG 文中的内存求和',
    hint: '0200h 处是 0123h，0202h 处是 0025h。相加后把 0148h 写到 0204h。',
    observeRegister: 'AX', sourceSection: '按字节准备数据，再验证一个求和片段',
    scopeNote: '前三条 MOV 替代原文 DEBUG 的 E 命令准备六个字节；随后执行相同的三条求和指令。显式写 h 后缀表示十六进制。当前模型不解释 DEBUG 命令，也不提供真实 CS:IP。',
    steps: ['前三步准备 23 01 25 00 00 00 六个字节。', '第 4、5 步观察 AX 从 0123h 变为 0148h。', '第 6 步检查结果位置 10204h 的字节变为 48 01。'],
    checkpoints: [
      { step: 3, text: '10200h 起的六字节：23 01 25 00 00 00。' },
      { step: 4, text: 'AX = 0123h。' },
      { step: 5, text: 'AX = 0148h，即 0123h + 0025h。' },
      { step: 6, text: '10200h 起变为 23 01 25 00 48 01。' }
    ],
    code: `; 用 MOV 准备 DEBUG 原文中的数据
MOV [0200h], 0123h
MOV [0202h], 0025h
MOV [0204h], 0
MOV AX, [0200h]
ADD AX, [0202h]
MOV [0204h], AX
HLT`,
    expected: { steps: 7, regs: { AX: 0x148 }, memory: [{ address: 0x10200, bytes: [0x23, 1, 0x25, 0, 0x48, 1] }] }
  }
];

// Chapter order is owned by CHAPTERS; demo ids remain stable for old links.
export const EXAMPLES = [
  ...LEGACY_EXAMPLES.map(example => ({ ...example, ...LEGACY_LESSONS[example.id] })),
  ...CHAPTER_EXAMPLES
];
