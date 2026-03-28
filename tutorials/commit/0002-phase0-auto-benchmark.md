# Phase 0 自动性能测试

这次提交把 `foliate-js` 的 Phase 0 性能基线，从“手工在浏览器里点一遍”升级成了“可以直接跑命令自动测”的形式。

## 这次解决了什么

之前虽然已经有 `phase tracker`、`backend controller` 和测试页，但还不算真正的自动性能测试：

- 只能靠手工点页面
- 真实样本不能批量跑
- PDF 路径在简易静态服务器下会因为 `pdf.js` 的模块路径和 worker 路径问题直接失败
- 没有现成的 baseline/回归比较入口

现在这些问题都被收敛到了一个统一入口：

```bash
npm run bench:phase0:all
```

它会读取本地样本配置，启动临时静态服务器，拉起 headless Chrome，分别跑：

- `js`
- `wasmFallback`

然后把结果写到：

```text
perf/results/phase0-latest.json
```

为了让 Phase 1 的 EPUB 前 DOM 优化有一把更干净的尺子，这次还额外把：

```bash
npm run bench:phase0:baseline
```

收口成默认只固化 `js` case。这样 baseline 不会被 Phase 0 里的假 `wasmFallback` 路径污染。

## 关键实现

### 1. 自动 runner 支持多样本和多轮统计

脚本文件：

```text
scripts/run-phase0-benchmark.mjs
```

现在支持：

- 直接传一个或多个文件路径
- 读取 `--samples` JSON 配置批量跑
- `--warmup N` 预热轮次，不计入正式统计
- `--runs N` 多轮执行，并交替 case 顺序，减轻顺序偏差
- `--trim N` 从正式样本里去掉最高和最低，再用裁剪后的样本算稳定性
- `--cases js,wasmFallback` 只跑指定 backend lane
- `--max-cv` / `--max-range` 定义稳定性门槛
- `--output` 落盘
- `--baseline` + `--threshold` 做回归判断

这让它不再只是“把页面自动打开一次”，而是开始接近一个真正可重复、可判定稳定性的 perf harness。

### 1.1 runner 还补了浏览器外部监控

现在结果除了动作耗时，还会补三层内存/运行时观测：

- 页面内 `performance.memory`
- CDP 的 `JSHeapUsedSize / Nodes / Documents`
- 进程树 RSS，并拆成 `startup / steadyState`

这让你不只能看“快不快”，还能看“有没有把 heap 或进程占用顶上去”。

### 2. PDF benchmark 页面补了 import map 和 polyfill 依赖

测试页现在显式声明：

```json
{
  "imports": {
    "@pdfjs/pdf.min.mjs": "/vendor/pdfjs/pdf.mjs",
    "construct-style-sheets-polyfill": "/__deps__/construct-style-sheets-polyfill.js"
  }
}
```

原因是 `tests/` 目录下的页面是直接被浏览器当 ES module 页面打开的，不经过应用侧 bundler。  
如果没有 import map，`pdf.js` 和 `fixed-layout.js` 里的 bare module specifier 在这个环境里根本解析不了。

这次 runner 还额外暴露了一个 benchmark 专用依赖入口：

```text
/__deps__/construct-style-sheets-polyfill.js
```

它只服务自动 benchmark，不改库本身的发布产物。

这里还顺手修了一类很容易被忽略的问题：benchmark runner 不应该硬编码别的仓库路径。  
现在 polyfill 会优先从当前仓库自己的 `node_modules` 取，只有找不到时才退回外层工作区里的镜像路径。

### 3. 修正了 PDF worker 路径

`pdf.js` 原来在找：

```text
pdf.worker.min.mjs
```

但当前仓库 `vendor/pdfjs/` 里实际存在的是：

```text
pdf.worker.mjs
```

这会导致 fake worker 初始化失败，自动测试直接挂掉。  
这次把路径改成和 `vendor/` 真实产物一致。

## 本地样本配置

为了避免把你的本地测试文件硬编码进可提交配置，这次把样本列表放到了：

```text
perf/phase0-samples.local.json
```

并在 `.gitignore` 里忽略了：

- `perf/*.local.json`
- `perf/results/`

当前本地样本是：

- `../股票魔法.epub`
- `../OpenGL.pdf`

如果以后要换样本，只改这个 JSON 就行。

## 怎么用

### 跑所有本地样本

```bash
npm run bench:phase0:all
```

默认等价于：

```bash
node scripts/run-phase0-benchmark.mjs \
  --samples perf/phase0-samples.local.json \
  --warmup 2 \
  --runs 10 \
  --trim 1 \
  --max-cv 0.12 \
  --max-range 0.25 \
  --output perf/results/phase0-latest.json
```

### 只跑一个文件

```bash
node scripts/run-phase0-benchmark.mjs ../股票魔法.epub
```

### 跑统一字母场景

现在也支持把连续阅读动作写成一串字母，适合后面慢慢扩充复杂阅读行为：

```bash
node scripts/run-phase0-benchmark.mjs \
  ../股票魔法.epub \
  ../OpenGL.pdf \
  --scenario a,b,c,d,e,g \
  --runs 10 \
  --warmup 2 \
  --output perf/results/phase0-unified-letters.json
```

当前字母含义是：

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

这里最关键的是，`e/g` 现在不再直接暴露成 `section/toc` 这种格式词：

- `jumpPrimary` 表示“做一次主要阅读跳转”
  - EPUB 里更像跳下一章
  - PDF 里更像跳下一页/下一主单元
- `jumpOutline` 表示“按目录做一次跳转”
- `jumpSecondary` 表示“做一次次级导航跳转”
  - 优先走 outline 的非首项
  - 如果没有可用 outline，就退回成更远一点的主跳转
- `returnContext` 表示“回到上一次大跳转前的附近位置”
  - 这个动作专门用来测“跳走之后再回来”的恢复成本

这样场景定义更接近阅读行为本身，不会把 benchmark 配置写死在某个格式内部实现上。

如果你不想每次记字母，现在 runner 也内建了几个高层场景名：

- `open-index`
- `continuous-reading`
- `outline-heavy`
- `jump-and-return`

例如：

```bash
node scripts/run-phase0-benchmark.mjs \
  ../股票魔法.epub \
  ../OpenGL.pdf \
  --scenario a,b,e,i,h,i
```

这表示：

- 打开阅读视图
- 初始化到正文
- 做一次主跳转
- 回到原位附近
- 做一次次级跳转
- 再回到原位附近

也可以直接跑场景名：

```bash
node scripts/run-phase0-benchmark.mjs \
  ../股票魔法.epub \
  ../OpenGL.pdf \
  --scenario jump-and-return
```

或者直接用脚本：

```bash
npm run bench:phase0:outline
npm run bench:phase0:jumps
```

### 生成 baseline 后做回归比较

先保存一份基线：

```bash
cp perf/results/phase0-latest.json perf/results/phase0-baseline.json
```

然后后续比较：

```bash
node scripts/run-phase0-benchmark.mjs \
  --samples perf/phase0-samples.local.json \
  --warmup 2 \
  --runs 10 \
  --trim 1 \
  --max-cv 0.12 \
  --max-range 0.25 \
  --baseline perf/results/phase0-baseline.json \
  --threshold 0.15 \
  --output perf/results/phase0-latest.json
```

如果某个 target/case 同时满足：

- 当前结果被判定为 `stable`
- `median totalDuration` 相比 baseline 回退超过阈值

脚本会以非零状态退出。

如果稳定性不过线，summary 里会直接标出：

- `stable: false`
- `stabilityFailures`

## 新人知识点

### 1. bare module specifier 不等于浏览器天然支持

像：

```js
import '@pdfjs/pdf.min.mjs'
```

这种写法在 Node、bundler、import map 环境下都可能成立，但“直接打开一个 HTML 文件”时不一定成立。  
浏览器只有在你提供 import map 或者改成相对路径时，才知道去哪里找模块。

### 2. 性能测试不是只看一轮数字

单次性能结果很容易被顺序、缓存、JIT 预热、文件系统缓存影响。  
所以比起“跑一次看到 30ms”，更重要的是：

- 多轮跑
- 先预热再正式跑
- 去掉最高和最低，再看裁剪后的统计
- 记录分阶段耗时
- 保留 baseline
- 比较中位数而不是只看某一轮

这才更接近能长期使用的性能基线。

### 2.1 baseline 最好只包含“当前真正在评估的 lane”

如果你正在评估 EPUB Phase 1 的 JS 路径优化，就不该把一个“故意失败再 fallback”的 lane 一起塞进正式 baseline。  
否则 baseline 里会混进根本不代表未来产线的时间数字。

### 3. 连续动作 benchmark 里，“动作完成”和“界面站稳”不是一回事

这次最坑的一点，其实不是 PDF，而是 EPUB 连续动作。

`view.next()`、`view.prev()`、`view.goTo()` 这类调用返回时，阅读器内部可能已经接受了动作，但 `relocate`、`stabilized`、预加载补齐这些后续步骤还没完全结束。  
如果 benchmark 立刻发下一条动作，就会测到“前一个动作尾巴 + 下一个动作开头”混在一起的怪数字。

所以自动页现在在连续阅读动作后会额外等一小步：

- renderer 的 `relocate` 或 `stabilized`
- 再过两帧 `requestAnimationFrame`

这会让动作时间变大一些，但语义更对。  
因为你现在测的不再是“promise 多快 resolve”，而是“用户感觉这次动作基本稳定下来要多久”。
