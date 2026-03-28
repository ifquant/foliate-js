# 0007 将分页动画时长改成可配置，默认 100ms

## 背景

前面已经确认，`animated` 不是单纯的性能开关，而是阅读体验的一部分。  
问题在于它之前把动画时长硬编码成了 `300ms`，这会让分页动画天然带上一块固定地板。

如果这个时长既不能配置，又一直写死，后面就很难回答：

- 300ms 是不是太长
- 100ms 会不会更合适
- 是逻辑慢，还是只是动画故意慢

所以这次不去删除动画，而是先把时长参数化，再把默认值降到 `100ms`。

## 主要目标

- 让 `animated` 保留，但不再写死 `300ms`
- 把动画时长做成可配置参数
- 默认改成 `100ms`
- 让 benchmark 能显式对比 `100ms` 和 `300ms`

## 改动概览

- 在 [`paginator.js`](/Users/dev/workspace2/hc_apps/foliate-js/paginator.js) 中新增 `animationDuration` getter
- 分页动画从固定 `300ms` 改成读取 `animation-duration`
- 默认值设为 `100ms`
- 在 [`view.js`](/Users/dev/workspace2/hc_apps/foliate-js/view.js) 中把 `animation-duration` 透传给 paginator
- 在 [`phase0-auto-benchmark.html`](/Users/dev/workspace2/hc_apps/foliate-js/tests/phase0-auto-benchmark.html) 和 [`run-phase0-benchmark.mjs`](/Users/dev/workspace2/hc_apps/foliate-js/scripts/run-phase0-benchmark.mjs) 中增加 benchmark 参数
- 在 [PERF_BENCHMARK.md](/Users/dev/workspace2/hc_apps/foliate-js/PERF_BENCHMARK.md) 里补上 `--animation-duration`

## 关键知识

### 1. 动画时长本身就是产品参数

不是所有“慢”都是 bug。  
前端里有一类时间是产品故意加进去的：

- 动画时长
- 过渡时长
- 延迟显隐

这类值如果写死在代码里，后面既不利于产品调手感，也不利于性能判断。  
把它变成参数，才有机会分清：

- 代码执行慢
- 还是体验设计故意慢

### 2. 参数化比直接删更稳

如果你不确定一个体验值是不是应该完全删掉，先做两件事通常更稳：

1. 参数化
2. 先改默认值

这样你既能推进体验优化，又不会一下把整条交互语义砍掉。

## 补充知识

### 补充知识 1：默认值和显式值要能同时存在

这次默认是 `100ms`，但仍然允许：

- `animation-duration="300"`
- benchmark 里 `--animation-duration 300`

这很重要，因为它让“旧体验”和“新体验”都还能复现。  
如果默认一改，旧值就彻底无法重现，那后面的判断会很虚。

### 补充知识 2：前端 benchmark 最有价值的是“同动作、不同参数”的比较

比如这次同样是：

- `continuous-reading`
- `animated`
- `turn-settle=legacy`

只换 `animation-duration`：

- `100ms`
- `300ms`

这种对比比“随便跑两次感觉快了”更可信。

## 验证

- `node --check /Users/dev/workspace2/hc_apps/foliate-js/paginator.js` (PASS)
- `node --check /Users/dev/workspace2/hc_apps/foliate-js/view.js` (PASS)
- `node --check /Users/dev/workspace2/hc_apps/foliate-js/scripts/run-phase0-benchmark.mjs` (PASS)
- `node /Users/dev/workspace2/hc_apps/foliate-js/scripts/run-phase0-benchmark.mjs '/Users/dev/workspace2/hc_apps/股票魔法.epub' --cases js --scenario continuous-reading --runs 3 --warmup 1 --trim 0 --max-cv 0.2 --max-range 0.35 --animated --turn-settle legacy --output /tmp/anim-default100.json` (PASS)
- `node /Users/dev/workspace2/hc_apps/foliate-js/scripts/run-phase0-benchmark.mjs '/Users/dev/workspace2/hc_apps/股票魔法.epub' --cases js --scenario continuous-reading --runs 3 --warmup 1 --trim 0 --max-cv 0.2 --max-range 0.35 --animated --animation-duration 300 --turn-settle legacy --output /tmp/anim-300.json` (PASS)

## 结果

- `animated + 默认 100ms`
  - 中位数约 `3434ms`
- `animated + 300ms`
  - 中位数约 `4236.7ms`

说明把默认动画时长从 `300ms` 降到 `100ms` 后，连续阅读总耗时有明显下降，而且动画路径仍然保留。

## 未覆盖项

- 这次没有再做多书样本验证
- 这次没有重新跑 `turn-settle=frame + animated + 100ms` 的组合矩阵
- 这次只把动画时长参数化，还没有引入更复杂的按设备或模式自动调时长逻辑
