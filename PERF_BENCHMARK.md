# foliate-js Performance Benchmark

## 目的

这份文档定义 `foliate-js` 当前的 Phase 0 自动性能测试约定，目标不是只跑出一个数字，而是让性能结果同时满足：

- 可重复
- 可解释
- 可扩展
- 能覆盖更接近真实阅读的连续动作

当前 benchmark 重点服务两类工作：

- 为后续 EPUB / PDF / MOBI 的性能优化建立基线
- 避免把 runner 噪声、冷启动抖动、静默 fallback 或错误动作序列误判成真实性能变化

## 优化开关原则

性能优化默认不应该直接替换旧逻辑，尤其是阅读器层这种容易带来时序副作用的路径。当前 benchmark 已经把 `turn-settle` 做成显式开关：

- `legacy`
  - 默认值
  - 保留原来的 `turnPage` 固定 `100ms` 稳定窗口
- `frame`
  - 实验值
  - 把固定等待改成更短的帧级稳定窗口

这样做的目的不是永久维护两套行为，而是先把高风险优化纳入可控实验面：

- 可以用同一套样本和场景比较 `legacy` 与 `frame`
- 出现副作用时可以快速回退到旧逻辑
- 在副作用验证完成前，不必直接替换默认行为

## 适用范围

当前 Phase 0 benchmark 已覆盖：

- `makeBook()` 外层打开链路
- EPUB 的前 DOM 打开路径与阅读视图连续动作
- PDF 的 `pdf.js` 打开路径与固定布局阅读视图连续动作
- backend 状态流
  - `js`
  - `wasmFallback`

当前 Phase 0 benchmark 还未覆盖：

- 真正的 WASM 后端实现
- MOBI / KF8 阅读场景基线
- 跨机器、跨浏览器的标准化对比
- CI 中的长期趋势追踪

## 入口文件

- 运行脚本: [scripts/run-phase0-benchmark.mjs](/Users/dev/workspace2/hc_apps/foliate-js/scripts/run-phase0-benchmark.mjs)
- 浏览器执行页: [tests/phase0-auto-benchmark.html](/Users/dev/workspace2/hc_apps/foliate-js/tests/phase0-auto-benchmark.html)
- 本地样本配置: [perf/phase0-samples.local.json](/Users/dev/workspace2/hc_apps/foliate-js/perf/phase0-samples.local.json)
- 场景示例: [perf/phase0-scenarios.example.json](/Users/dev/workspace2/hc_apps/foliate-js/perf/phase0-scenarios.example.json)
- 结果目录: [perf/results](/Users/dev/workspace2/hc_apps/foliate-js/perf/results)

## 设计原则

### 1. 场景优先，不只测解析

不要把 `makeBook()` 当成“整本书打开性能”的全部。当前 benchmark 允许把阅读过程拆成连续动作，例如：

- 打开阅读视图
- 初始化到正文
- 连续翻页
- 目录跳转
- 主跳转
- 跳后回位

这样得出的时间更接近真实用户动作，而不是“只测元数据”。

### 2. 同一套高层语义，按格式映射

EPUB 和 PDF 可以共享同一套高层阅读动作，但不强求底层动作完全一致。

例如：

- `jumpPrimary`
  - EPUB 更像章节/主线性段落跳转
  - PDF 更像页或主导航单元跳转
- `jumpOutline`
  - 两者都表示目录跳转
- `returnContext`
  - 表示跳转后回到原上下文附近

这能避免把 benchmark DSL 写死在某个格式的内部实现上。

### 3. bench 本身也必须被验证

当前 harness 明确修过两类 runner 误差：

- EPUB 连续动作过快串发，导致布局尚未稳定就开始下一步
- PDF benchmark 环境缺 import map / polyfill，导致 `openView` 假失败

所以 benchmark 代码本身也是系统的一部分，不是“无论怎么写都可信”。

### 4. 时间和内存要一起看

当前 benchmark 不再只看总耗时，也开始记录近似 JS heap 指标。

第一阶段的内存数据分两层：

- `performance.memory`
- `performance.measureUserAgentSpecificMemory()`

其中：

- `performance.memory` 更偏 JS heap 快照
- `measureUserAgentSpecificMemory()` 更偏整个页面用户代理侧内存估计

但这两者都仍然是浏览器提供的近似观测，不是操作系统级完整内存画像。

因此它表示的是：

- 当前页面 JS heap 的近似占用
- 当前页面在浏览器侧的近似总内存估计

而不是：

- 整个浏览器进程内存
- 操作系统级 RSS
- GPU / worker / 原生库总占用

所以这些数字适合做：

- 同一台机器上的相对比较
- 同一路径改动前后的 heap 趋势判断
- 动作后 heap 是否明显抬升、销毁后是否回落

不适合做：

- 跨机器绝对比较
- 把它当成完整内存画像

### 5. 稳定性优先于单次快慢

当前默认不是只看单次耗时，而是看：

- `warmup`
- `runs`
- `trim`
- `coefficientOfVariation`
- `rangeRatio`

只有稳定度达标，结果才适合拿来做基线和回归比较。

## 默认命令

### 跑默认连续阅读基线

```bash
npm run bench:phase0:all
```

### 固化 continuous-reading baseline

```bash
npm run bench:phase0:baseline
```

这个命令默认只固化 `js` case，用来评估 Phase 1 的 EPUB 前 DOM 优化。

默认会把结果写到：

```text
perf/results/phase0-baseline-continuous.json
```

### 跑目录偏重场景

```bash
npm run bench:phase0:outline
```

### 跑跳转与回位场景

```bash
npm run bench:phase0:jumps
```

### 只跑单个文件

```bash
node scripts/run-phase0-benchmark.mjs /absolute/path/to/book.epub
```

### 指定多个样本

```bash
node scripts/run-phase0-benchmark.mjs \
  /absolute/path/to/book.epub \
  /absolute/path/to/book.pdf \
  --scenario continuous-reading
```

### 使用本地样本配置

```bash
node scripts/run-phase0-benchmark.mjs \
  --samples perf/phase0-samples.local.json \
  --cases js,wasmFallback \
  --scenario continuous-reading
```

### 指定 turn-settle 模式

默认是 `legacy`。如果要显式测新的翻页稳定窗口：

```bash
node scripts/run-phase0-benchmark.mjs \
  --samples perf/phase0-samples.local.json \
  --cases js \
  --scenario continuous-reading \
  --turn-settle frame
```

如果要明确回到旧逻辑，也可以显式写：

```bash
node scripts/run-phase0-benchmark.mjs \
  --samples perf/phase0-samples.local.json \
  --cases js \
  --scenario continuous-reading \
  --turn-settle legacy
```

### 指定阅读模式相关参数

如果要做副作用验证，不要靠手工改页面。当前 runner 已支持几组常用验证参数：

- `--animated`
  - 打开分页动画
- `--animation-duration 100`
  - 设置动画时长，默认 `100ms`
- `--flow scrolled`
  - 切到滚动模式
- `--eink`
  - 模拟关闭动画的墨水屏约束

例如对比动画模式下的 `legacy` 与 `frame`：

```bash
node scripts/run-phase0-benchmark.mjs \
  /absolute/path/to/book.epub \
  --cases js \
  --scenario continuous-reading \
  --animated \
  --animation-duration 300 \
  --turn-settle legacy

node scripts/run-phase0-benchmark.mjs \
  /absolute/path/to/book.epub \
  --cases js \
  --scenario continuous-reading \
  --animated \
  --animation-duration 100 \
  --turn-settle frame
```

例如看滚动模式是否也受影响：

```bash
node scripts/run-phase0-benchmark.mjs \
  /absolute/path/to/book.epub \
  --cases js \
  --scenario continuous-reading \
  --flow scrolled \
  --turn-settle frame
```

如果你只想验证动画时长本身，而不切换 `turn-settle`，也可以直接对比：

```bash
node scripts/run-phase0-benchmark.mjs \
  /absolute/path/to/book.epub \
  --cases js \
  --scenario continuous-reading \
  --animated \
  --animation-duration 300

node scripts/run-phase0-benchmark.mjs \
  /absolute/path/to/book.epub \
  --cases js \
  --scenario continuous-reading \
  --animated \
  --animation-duration 100
```

## 场景系统

### 命名场景

当前内置：

- `open-index`
- `continuous-reading`
- `outline-heavy`
- `jump-and-return`

命名场景适合：

- 日常回归
- 提交前 smoke benchmark
- 团队约定同一套行为基线

### 字母 DSL

如果要快速描述一个自定义连续动作序列，可以直接写：

```bash
node scripts/run-phase0-benchmark.mjs \
  /absolute/path/to/book.epub \
  --scenario a,b,c,d,e,g
```

当前字母含义：

- `a`: `openView`
- `b`: `initView`
- `c`: `next`
- `d`: `prev`
- `e`: `jumpPrimary`
- `f`: `jumpPrimary` 反向
- `g`: `jumpOutline`
- `h`: `jumpSecondary`
- `i`: `returnContext`
- `j`: `firstSectionDocument`

推荐用法：

- 日常固定回归用命名场景
- 临时探索用字母 DSL
- 一旦某个字母序列变成长期基线，就把它提炼成命名场景

### 自定义场景文件

如果场景开始变复杂，不要把大量动作硬塞到命令行里。优先写成 JSON，再通过：

```bash
node scripts/run-phase0-benchmark.mjs \
  --samples perf/phase0-samples.local.json \
  --scenario-file perf/phase0-scenarios.example.json \
  --scenario jump-and-return
```

## 稳定性规则

当前默认策略：

- `warmup=2`
- `runs=10`
- `trim=1`
- `maxCv=0.12`
- `maxRange=0.25`
- `turnSettle=legacy`

含义：

- 先做两轮预热，不计入正式统计
- 正式跑十轮
- 去掉最高和最低各一轮
- 用裁剪后的样本判断稳定性

如果结果显示：

- `stable: true`

则这组数据可作为 baseline 候选。

如果显示：

- `stable: false`
- `stabilityFailures`

优先排查顺序：

1. benchmark 动作是否串得过快
2. 是否存在未销毁对象或前一轮残留状态
3. 场景是否对当前格式不合理
4. 样本本身是否触发真实重路径
5. 最后才考虑放宽统计门槛

## 输出结果怎么读

结果 JSON 会包含两层：

- `summary`
  - 面向快速查看
  - 包含 median、stable、cv、rangeRatio、memory、monitoring
- `targets[*].cases[*]`
  - 面向分析
  - 包含每轮 actions、backendStates、summary、phases、memory、monitoring

通常先看：

- `median`
- `stable`
- `stabilityFailures`
- `turnSettle`
- `flow`
- `animated`
- `eink`
- `animationDuration`
- `memory.medianPeakUsedJSHeapSize`
- `memory.medianHeapDeltaUsedJSHeapSize`
- `memory.medianPostDestroyDeltaUsedJSHeapSize`
- `monitoring.cdp`
- `monitoring.processTree`
- `actions`
- `backendStates`

### memory 字段怎么理解

当前每轮会记录：

- `start`
- `end`
- `afterDestroy`
- `peakUsedJSHeapSize`
- `heapDeltaUsedJSHeapSize`
- `postDestroyDeltaUsedJSHeapSize`
- `userAgentSpecific.start`
- `userAgentSpecific.end`
- `userAgentSpecific.afterDestroy`
- `userAgentSpecific.bytesDelta`
- `userAgentSpecific.postDestroyBytesDelta`

含义：

- `peakUsedJSHeapSize`
  - 这一轮动作过程中观测到的最高 JS heap
- `heapDeltaUsedJSHeapSize`
  - 从本轮开始到本轮结束，heap 增减了多少
- `postDestroyDeltaUsedJSHeapSize`
  - 在 `view.close()` / `book.destroy()` 之后，相比本轮开始 heap 还高多少

如果 `postDestroyDeltaUsedJSHeapSize` 长期居高不下，通常值得继续查：

- 销毁路径是否不完整
- 是否有跨轮残留对象
- 是否有大 buffer / DOM / pdf.js 状态没有释放

如果 `userAgentSpecific.postDestroyBytesDelta` 长期偏高，而 JS heap 指标看起来不高，则更值得怀疑：

- 浏览器侧对象没有及时回收
- 固定布局或 PDF 路径的原生/渲染资源残留
- worker / 解码 / 渲染相关状态没有完全释放

如果某个 API 当前环境不可用，结果里会显示对应的 `supported: false`。

### monitoring 字段怎么理解

`monitoring` 是 runner 在浏览器外部补采的监控结果，当前分两类：

- `monitoring.cdp`
  - 通过 Chrome DevTools Protocol 采集
  - 主要看 `JSHeapUsedSize`、`JSHeapTotalSize`、`Nodes`、`Documents`、`JSEventListeners`
- `monitoring.processTree`
  - 通过宿主机进程树采样得到
  - 主要看当前 benchmark Chrome 进程树的 `RSS`
  - 现在会拆成：
    - `startup`
    - `steadyState`

这两类的定位不同：

- `memory.*`
  - 更贴近页面内 JS 观测
- `monitoring.cdp`
  - 更贴近浏览器调试协议视角
- `monitoring.processTree`
  - 更贴近真实进程占用

如果你在看 PDF 或固定布局路径，这三层放在一起看会更有意义。

其中 `processTree.steadyState` 比 `processTree` 整体值更值得看，因为它尽量剔除了 Chrome 冷启动阶段。

### turnSettle 字段怎么理解

结果里的 `turnSettle` 表示这组数据是用哪一种翻页稳定窗口跑出来的：

- `legacy`
  - 保留历史逻辑
  - 适合当前默认基线
- `frame`
  - 启用实验优化
  - 更适合对照实验，不应该在未验证副作用前直接替换基线

如果你在做 `paginator` 性能改动，对比结果时至少要同时看：

- `scenario`
- `turnSettle`
- `actions`
- `monitoring.processTree.steadyState`

### backendStates 的意义

当前 Phase 0 很重要的一点，是不能静默降级。

例如 `wasmFallback` 路径会显式记录：

- `selected`
- `loading`
- `failed`
- `fallback`
- `active`

如果没有这组状态，只看时间数字，你很容易把“根本没跑到目标后端”误读成性能结论。

## 本地样本建议

当前仓库更适合把样本分成两类：

- correctness fixture
  - 小
  - 可断言
  - 适合验证语义
- perf sample
  - 大
  - 真实
  - 能暴露慢路径

本地样本建议只放在 `*.local.json` 里，不要把个人机器路径硬编码进可共享默认配置。

## 推荐工作流

### 新改动前

先跑一次：

```bash
npm run bench:phase0:all
```

必要时补跑：

```bash
npm run bench:phase0:outline
npm run bench:phase0:jumps
```

### 准备保存基线

如果你要固定当前 `continuous-reading` 基线，优先直接跑：

```bash
npm run bench:phase0:baseline
```

这里默认只保存 `js` case，原因是 `wasmFallback` 目前仍是 Phase 0 的假后端与 fallback 验证路径，不应该充当 Phase 1 的正式 gate。

只有在你明确知道要保存哪一份 `latest` 时，才手工复制。

### 对比回归

```bash
node scripts/run-phase0-benchmark.mjs \
  --samples perf/phase0-samples.local.json \
  --cases js \
  --scenario continuous-reading \
  --warmup 2 \
  --runs 10 \
  --trim 1 \
  --max-cv 0.12 \
  --max-range 0.25 \
  --baseline perf/results/phase0-baseline-continuous.json \
  --threshold 0.15 \
  --output perf/results/phase0-latest.json
```

## 当前已知限制

- `wasmFallback` 现在只是 Phase 0 的显式 fallback 路径，不代表真实 WASM 性能
- 当前基线主要覆盖 EPUB 与 PDF，MOBI/KF8 还未加入阅读场景基线
- benchmark 仍依赖本地 Chrome 和本地样本
- 当前内存指标来自 `performance.memory` 和 `measureUserAgentSpecificMemory()`，都属于浏览器近似值，不是完整进程内存
- 不同机器之间的数据只能做参考，不能直接混成一套统一结论
- `turn-settle=frame` 目前仍是实验优化开关，是否值得提升为默认行为要看更多样本和副作用验证

## 修改 benchmark 前先看什么

如果你要改 benchmark，请先看：

- [AGENTS.md](/Users/dev/workspace2/hc_apps/foliate-js/AGENTS.md)
- [scripts/run-phase0-benchmark.mjs](/Users/dev/workspace2/hc_apps/foliate-js/scripts/run-phase0-benchmark.mjs)
- [tests/phase0-auto-benchmark.html](/Users/dev/workspace2/hc_apps/foliate-js/tests/phase0-auto-benchmark.html)
- [tutorials/commit/0002-phase0-auto-benchmark.md](/Users/dev/workspace2/hc_apps/foliate-js/tutorials/commit/0002-phase0-auto-benchmark.md)

优先遵守这三个约束：

- 不要把场景语义退化回格式私有动作
- 不要让 fallback 重新变成静默行为
- 不要只加新数字，不处理稳定性和解释性
