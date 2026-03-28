# 0006 给 turn-settle 增加副作用验证参数

## 背景

`turn-settle=frame` 已经证明能让 EPUB 的连续阅读更快，但这还不够。  
像翻页解锁时机这种优化，最大风险不是“数字不变”，而是：

- 开了动画后会不会提早解锁
- 换到滚动模式后会不会逻辑不一致
- 以后有人复测时，能不能用命令重现同一组条件

如果这些条件只能靠手工点页面，验证结论很快就会失真。

## 主要目标

- 把副作用验证条件也做成 benchmark 参数
- 让 `legacy` / `frame` 能在相同阅读模式下直接对比
- 避免把“模式差异”误判成“优化差异”

## 改动概览

- 在 [`view.js`](/Users/dev/workspace2/hc_apps/foliate-js/view.js) 里统一透传：
  - `turn-settle`
  - `flow`
  - `animated`
  - `eink`
- 在 [`phase0-auto-benchmark.html`](/Users/dev/workspace2/hc_apps/foliate-js/tests/phase0-auto-benchmark.html) 里增加阅读模式参数解析和应用
- 在 [`run-phase0-benchmark.mjs`](/Users/dev/workspace2/hc_apps/foliate-js/scripts/run-phase0-benchmark.mjs) 里增加：
  - `--flow scrolled`
  - `--animated`
  - `--eink`
- 在 [PERF_BENCHMARK.md](/Users/dev/workspace2/hc_apps/foliate-js/PERF_BENCHMARK.md) 里补充副作用验证命令

## 关键知识

### 1. 性能验证条件也要参数化

如果 benchmark 只能切“书”和“场景”，不能切“模式”，就很难回答下面这些问题：

- 这个优化只在无动画模式下有效吗
- 开了动画后收益是不是消失了
- 滚动模式里它是不是根本不该有影响

把模式做成参数后，才可以做真正的对照实验。

### 2. 副作用验证不是只看更快还是更慢

很多副作用不会直接表现成 total duration 变差，而会表现成：

- `next/prev` 模式和预期不一致
- 章节边界跳转时 currentIndex 异常
- 动画模式下锁释放时机不再匹配动画时长

所以副作用验证至少要同时看：

- 总时长
- 关键 action duration
- 当前模式标记
- 当前索引或跳转结果

## 补充知识

### 补充知识 1：前端验证里，“同条件对比”比“更高精度”更重要

很多时候不是采样频率不够，而是对比条件变了。  
例如一个结果更快，可能只是因为这次：

- 没开动画
- 换成了滚动模式
- 场景里少了某次跳转

所以先把条件锁死，再谈精度。

### 补充知识 2：滚动模式和分页模式经常不是同一条性能路径

分页模式更容易受：

- 翻页锁
- 动画
- snap

滚动模式更容易受：

- 连续滚动填充
- 预加载
- 可见区稳定化

一个优化如果只影响分页翻页，理论上在滚动模式里的收益应该接近于零。  
这反而是个好信号，说明影响面被控制住了。

## 验证

- `node --check /Users/dev/workspace2/hc_apps/foliate-js/view.js` (PASS)
- `node --check /Users/dev/workspace2/hc_apps/foliate-js/scripts/run-phase0-benchmark.mjs` (PASS)
- `node /Users/dev/workspace2/hc_apps/foliate-js/scripts/run-phase0-benchmark.mjs '/Users/dev/workspace2/hc_apps/股票魔法.epub' --cases js --scenario continuous-reading --runs 3 --warmup 1 --trim 0 --max-cv 0.2 --max-range 0.35 --turn-settle legacy --output /tmp/sidefx-default-legacy.json` (PASS)
- `node /Users/dev/workspace2/hc_apps/foliate-js/scripts/run-phase0-benchmark.mjs '/Users/dev/workspace2/hc_apps/股票魔法.epub' --cases js --scenario continuous-reading --runs 3 --warmup 1 --trim 0 --max-cv 0.2 --max-range 0.35 --turn-settle frame --output /tmp/sidefx-default-frame.json` (PASS)
- `node /Users/dev/workspace2/hc_apps/foliate-js/scripts/run-phase0-benchmark.mjs '/Users/dev/workspace2/hc_apps/股票魔法.epub' --cases js --scenario continuous-reading --runs 3 --warmup 1 --trim 0 --max-cv 0.2 --max-range 0.35 --animated --turn-settle legacy --output /tmp/sidefx-animated-legacy.json` (PASS)
- `node /Users/dev/workspace2/hc_apps/foliate-js/scripts/run-phase0-benchmark.mjs '/Users/dev/workspace2/hc_apps/股票魔法.epub' --cases js --scenario continuous-reading --runs 3 --warmup 1 --trim 0 --max-cv 0.2 --max-range 0.35 --animated --turn-settle frame --output /tmp/sidefx-animated-frame.json` (PASS)
- `node /Users/dev/workspace2/hc_apps/foliate-js/scripts/run-phase0-benchmark.mjs '/Users/dev/workspace2/hc_apps/股票魔法.epub' --cases js --scenario continuous-reading --runs 3 --warmup 1 --trim 0 --max-cv 0.2 --max-range 0.35 --flow scrolled --turn-settle legacy --output /tmp/sidefx-scrolled-legacy.json` (PASS)
- `node /Users/dev/workspace2/hc_apps/foliate-js/scripts/run-phase0-benchmark.mjs '/Users/dev/workspace2/hc_apps/股票魔法.epub' --cases js --scenario continuous-reading --runs 3 --warmup 1 --trim 0 --max-cv 0.2 --max-range 0.35 --flow scrolled --turn-settle frame --output /tmp/sidefx-scrolled-frame.json` (PASS)

## 当前观察

- 默认分页模式下，`frame` 仍明显快于 `legacy`
- 开了 `animated` 后，`frame` 仍更快，但收益缩小
- `flow=scrolled` 下，`frame` 也更快，但收益比默认分页模式小，说明影响面没有无限扩大
- 目前这组样本里没有出现直接的失败或不稳定结果，但这还不等于副作用完全排除

## 未覆盖项

- 这次还没有补更多 EPUB 样本
- 这次还没有验证 `eink` 模式和 RTL / 边界书籍
- 这次主要验证 benchmark 和阅读模式参数，不代表产品侧交互 QA 已经完成
