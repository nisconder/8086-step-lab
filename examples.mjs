export const EXAMPLES = [
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
