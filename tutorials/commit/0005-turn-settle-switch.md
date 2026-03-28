# 0005 将 turnPage 优化改成可配置开关

## 背景

前一提交已经证明，把 `turnPage()` 末尾的固定 `100ms` 等待换成更短的帧级稳定窗口，确实能让 EPUB 的连续阅读场景更快。  
但这类改动有明显时序风险：

- 连续快速翻页时可能过早解锁
- 跨章节边界时可能不如旧逻辑稳
- 不同阅读模式和设备上的副作用还没测完

所以更合理的做法不是直接替换旧逻辑，而是先把优化做成可显式开启的实验开关。

## 主要目标

- 保留历史 `turnPage` 稳定窗口作为默认行为
- 让新的帧级稳定窗口可以按需开启
- 让 benchmark 能明确比较 `legacy` 和 `frame`

## 改动概览

- 在 [`paginator.js`](/Users/dev/workspace2/hc_apps/foliate-js/paginator.js) 里新增 `turn-settle` 属性解析
- 默认模式回到 `legacy`，继续使用原来的 `wait(100)`
- 只有 `turn-settle="frame"` 时才启用帧级稳定窗口
- 在 [`view.js`](/Users/dev/workspace2/hc_apps/foliate-js/view.js) 里把 `foliate-view` 上的 `turn-settle` 透传给 `foliate-paginator`
- 在 benchmark 页和 runner 里增加 `turnSettle` 参数，让自动测试能显式测两种模式
- 在 [PERF_BENCHMARK.md](/Users/dev/workspace2/hc_apps/foliate-js/PERF_BENCHMARK.md) 里补充“优化默认不要直接替换旧逻辑”的约定

## 关键知识

### 1. 高风险性能优化最好先变成实验开关

不是所有性能优化都适合“一改完就顶替旧逻辑”。  
像翻页解锁时机这种路径，同时影响：

- 性能
- 连续操作稳定性
- 用户体感

这类改动更适合先做成：

- 默认保守
- 显式开启
- 可测量
- 可回退

### 2. 配置开关不是为了永久保留分叉

开关的价值在探索期，不在永久复杂化系统。  
正确用法是：

1. 先让新旧路径都能被同一套 benchmark 测到
2. 再收集更多样本和副作用验证
3. 最后才决定是否提升成默认行为

所以开关是一个实验隔离层，不是最终架构。

## 补充知识

### 补充知识 1：前端的“更快”常常会碰到时序副作用

后端很多优化只影响吞吐和 CPU。  
前端很多优化还会碰：

- 动画是否完成
- 布局是否稳定
- 用户下一次输入是否会过早进来

所以前端性能优化经常要同时看“时间更短了没有”和“交互顺序乱了没有”。

### 补充知识 2：把实验参数打进 benchmark，比写在代码注释里更有用

如果一个优化只能靠改源码来开关，那它很快就会失去可比较性。  
把参数做成 CLI / URL / JSON 输入的一部分，后面才能稳定复现：

- 这次测的是哪条逻辑
- 和上次比的是不是同一套开关
- regression 到底来自代码变化还是来自配置变化

## 验证

- `node --check /Users/dev/workspace2/hc_apps/foliate-js/paginator.js` (PASS)
- `node --check /Users/dev/workspace2/hc_apps/foliate-js/view.js` (PASS)
- `node --check /Users/dev/workspace2/hc_apps/foliate-js/scripts/run-phase0-benchmark.mjs` (PASS)
- `node /Users/dev/workspace2/hc_apps/foliate-js/scripts/run-phase0-benchmark.mjs '/Users/dev/workspace2/hc_apps/股票魔法.epub' --cases js --scenario continuous-reading --runs 5 --warmup 1 --trim 1 --max-cv 0.12 --max-range 0.25 --turn-settle legacy --output /tmp/epub-turn-settle-legacy.json` (PASS)
- `node /Users/dev/workspace2/hc_apps/foliate-js/scripts/run-phase0-benchmark.mjs '/Users/dev/workspace2/hc_apps/股票魔法.epub' --cases js --scenario continuous-reading --runs 5 --warmup 1 --trim 1 --max-cv 0.12 --max-range 0.25 --turn-settle frame --output /tmp/epub-turn-settle-frame.json` (PASS)

## 未覆盖项

- 这次没有把 `turn-settle=frame` 提升成默认行为
- 这次没有扩大到更多 EPUB 样本或阅读模式，副作用验证还要继续做
