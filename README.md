# 8086 Step Lab

逐条执行 16 位汇编指令，观察寄存器、算术标志、内存字节序与调用栈。五个可编辑实验与 [ICS / 8086 复习笔记](https://nisconder.pages.dev/series/ics-8086/) 配套；代码只在浏览器内运行，无第三方依赖或网络请求。

## 使用

安装 Node.js 20 或更高版本，然后运行：

```sh
node server.mjs
```

打开 <http://localhost:8086>。无需 `npm install`。也可以将五个静态资源部署到任意静态托管服务；ES modules 需要 HTTP 服务，不能直接双击 HTML。

- **单步**：执行一条指令，黄色标记当前发生变化的值。非输入框焦点时可按右方向键。
- **连续运行 / 暂停**：每 180ms 执行一步；Esc 暂停；单轮上限 1,000 步。
- **回退**：恢复上一份完整寄存器、标志、内存与执行位置快照。最多保留 256 步。
- **重置**：重新编译当前代码，从初始状态执行。修改代码后下一次运行也会重新开始。
- **示例**：溢出、循环求和、地址与小端序、调用与栈、INC 保留进位。

## 模型范围

支持 `MOV ADD SUB CMP INC DEC AND OR XOR JMP JZ JNZ JC JNC JO JNO PUSH POP CALL RET NOP HLT`。

支持八个 16 位通用寄存器 AX/BX/CX/DX/SI/DI/BP/SP；十进制、`0x2A`、`2Ah`、`101b` 和负立即数；标签与分号注释。内存为 word 操作；有效地址支持 BX/BP、SI/DI 及 8086 合法组合与位移。含 BP 默认使用 SS，其余使用 DS。默认 DS=1000h、SS=2000h、SP=FFFEh，其他寄存器及标志初值为 0。未写入的字节按 0 读取。

CF/OF/AF/ZF/SF/PF 根据 16 位结果计算；PF 只检查低字节；INC/DEC 保留 CF；逻辑运算后 AF 未定义，界面显示 `—`。原始 8086 的 `PUSH SP` 保存递减后的 SP。内存用小端字节存储，物理地址按 20 位截断。

**这是指令级教学模型。** PC 与 CALL 压栈的返回位置使用解析后的指令索引，不能当作机器码字节地址或真实 IP。程序不编码机器指令、不模拟时钟、预取队列、DOS/BIOS、中断或 8 位操作，不接受完整 MASM 文件。所有内存操作均有 16 位宽度，省略真实汇编中可能需要的 `WORD PTR`。DS/SS 为模型配置，不作为可写操作数。

## 验证

```sh
node --test
```

测试执行全部示例，并以独立有符号/无符号边界计算核对 432 组 ADD/SUB/CMP 结果及六个标志，另检查段默认值、地址回绕、小端重叠读取、8086 PUSH SP、POP SP、条件跳转、不可变历史及输入错误。测试只针对本文声明的模型范围。

语义参考：Intel《[The 8086 Family User's Manual, October 1979](https://www.bitsavers.org/components/intel/8086/9800722-03_The_8086_Family_Users_Manual_Oct79.pdf)》的指令说明与状态标志章节。示例和界面为原创，不附带教材、固件或第三方模拟器。

## 结构

- `core.mjs`：纯函数解析器与执行模型，可被 Node 和浏览器共同使用。
- `examples.mjs`：示例与预期观察点。
- `app.mjs`、`index.html`、`style.css`：无框架交互界面。
- `test/core.test.mjs`：Node 内置测试，不下载依赖。
- `.github/workflows/pages.yml`：测试通过后发布静态页面。

MIT © 2026 Nisconder
