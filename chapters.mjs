// Titles, slugs and dates checked against the blog's article frontmatter.
const article = (id, title, slug, demoIds, scopeNote) => ({
  id, title, slug, url: `https://nisconder.pages.dev/2026/10/30/${slug}/`, demoIds, scopeNote
});

export const CHAPTERS = [
  article('00', '系列导读与阅读路线', 'ics-8086-00-overview', [], '阅读入口：查看系列路线，再选择具体章节演示。'),
  article('01', '计算机系统与程序执行', 'ics-8086-01-computer-systems-execution', ['instruction-trace'], '将原文的抽象 LOAD / STORE 跟踪题改写为本实验支持的 16 位指令。'),
  article('02', '进制转换 字符编码与字节序', 'ics-8086-02-numbers-characters-endianness', ['endian32', 'logic-mask', 'memory'], '演示小端字节布局与位掩码；不执行字符编码转换或 32 位运算。'),
  article('03', '补码 溢出与类型转换', 'ics-8086-03-twos-complement-overflow-conversions', ['overflow', 'signed-view'], '演示 16 位补码及标志；原文的 8 位算例与 C 类型转换另见正文。'),
  article('04', 'IEEE 754 浮点表示与舍入', 'ics-8086-04-ieee754-floating-point-rounding', [], '阅读入口：当前模型未实现浮点编码、运算与舍入。'),
  article('05', '8086 寄存器与分段寻址', 'ics-8086-05-registers-segmented-addressing', ['segmented-address'], '复现 DS=1234h 的地址题；段寄存器由演示初始配置提供。'),
  article('06', '8086 寻址与数据传送', 'ics-8086-06-addressing-data-transfer', ['bp-address', 'stack-order'], '复现 BP 默认取 SS 的寻址题和 PUSH / POP 操作顺序。'),
  article('07', '算术逻辑指令与标志位', 'ics-8086-07-arithmetic-logic-flags', ['carry'], '观察 INC / DEC 保留 CF 与 CMP 更新标志；未实现乘除法与 ADC / SBB。'),
  article('08', '控制转移 子程序与串操作', 'ics-8086-08-control-flow-calls-strings', ['near-call', 'stack'], '演示近调用的栈变化；返回值为指令索引，未实现远调用与串指令。'),
  article('09', 'MASM 程序结构与分支循环编程', 'ics-8086-09-masm-program-structure', ['array-sum', 'loop'], '复现数组求和；以 MOV 地址常量及 DEC / JNZ 改写 LEA / LOOP。'),
  article('10', 'DEBUG 调试与汇编实验', 'ics-8086-10-debug-assembly-labs', ['debug-sum'], '复现原文内存求和片段；数据由 MOV 准备，当前页面不解释 DEBUG 命令。'),
  article('11', 'IA-32 指令与 AT&T 汇编语法', 'ics-8086-11-ia32-att-assembly', [], '阅读入口：当前模型使用 16 位寄存器与 Intel 写法，未实现 IA-32 或 AT&T 语法。'),
  article('12', '条件判断与循环的机器表示', 'ics-8086-12-machine-control-flow', [], '阅读入口：原文的 IA-32 条件码与控制流题尚未移植为演示。'),
  article('13', '函数调用与栈帧', 'ics-8086-13-function-calls-stack-frames', [], '阅读入口：当前近调用示例不模拟原文的 IA-32 栈帧与调用约定。'),
  article('14', '数组 指针 结构体与数据对齐', 'ics-8086-14-arrays-pointers-layout-alignment', [], '阅读入口：当前模型不解释 C 对象布局、结构体或对齐规则。'),
  article('15', '编译链接 ELF 符号与重定位', 'ics-8086-15-elf-symbols-relocation', [], '阅读入口：当前模型不包含编译器、链接器或 ELF 加载功能。'),
  article('16', '装载运行与静态动态链接', 'ics-8086-16-loading-static-dynamic-linking', [], '阅读入口：当前模型不模拟操作系统装载器与动态链接。'),
  article('99', '考前速查与易错点', 'ics-8086-99-review-checklist', [], '阅读入口：用附录核对概念，再返回相关章节逐步验证。')
];
