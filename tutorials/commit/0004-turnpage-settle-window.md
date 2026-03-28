# 0004 turnPage 稳定窗口优化

## 背景

`Phase 0` 的 `continuous-reading` 基线已经说明，EPUB 总耗时的大头不在 `epub.js` 的前 DOM，而在阅读器层的连续动作。继续分解后会发现，`next()` 和 `prev()` 几乎总是落在 `100ms` 左右，这非常可疑。

继续看 [`paginator.js`](/Users/dev/workspace2/hc_apps/foliate-js/paginator.js) 后，问题收敛到了 `#turnPage()` 末尾的固定：

```js
await wait(100)
```

这意味着无论翻页真实工作量是多少，锁都会被额外压住一段固定时间。

## 主要目标

- 去掉 `turnPage` 路径里的固定 `100ms` 地板
- 保留“等一小段稳定窗口再解锁”的原始意图
- 让翻页耗时更接近真实布局和动画完成时间

## 改动概览

- 删除 `setTimeout(100)` 式的固定等待
- 新增 `nextFrame()` 和 `#waitForTurnSettle()`，用两帧 `requestAnimationFrame` 作为更明确的稳定窗口
- 对“已经等过动画”的同 section 翻页直接跳过额外等待，只在无动画或 section 跳转时保留最小延迟

## 关键知识

### 1. 固定睡眠和真实完成条件不是一回事

如果代码里已经有动画 promise、`transitionend`、`relocate`、`stabilized` 这种完成信号，再追加一个固定 `100ms`，通常只是在“再等等看”。  
这类等待短期能止血，但长期会把性能地板抬高，还会掩盖真正应该等的事件。

### 2. `requestAnimationFrame` 更适合做“等浏览器站稳”

`setTimeout(100)` 的问题是它跟布局、绘制、动画完成没有直接关系。  
而连续两帧 `requestAnimationFrame` 更接近下面这个语义：

1. 让浏览器把这次 DOM / scroll / layout 改动提交出去
2. 再给后续观察者和重绘一个稳定窗口

它不是完美的完成信号，但比固定睡 `100ms` 更接近“页面已经站稳一小步”。

## 补充知识

### 补充知识 1：性能优化要先找“固定地板”

如果某个动作无论快书慢书、热缓存冷缓存，都总是接近一个固定数字，先怀疑：

- 固定 sleep
- 固定动画时长
- 固定 debounce / throttle
- 固定队列刷新窗口

这种地方往往比抠小算法更容易直接拉低端到端时间。

### 补充知识 2：锁释放时机本身就是交互设计

`#locked` 不只是并发控制，也会直接影响用户体感。  
锁放得太早，连续操作可能把阅读器搞乱。  
锁放得太晚，动作会显得“明明已经翻过去了，但还不能继续”。  
所以锁的释放条件既是正确性问题，也是交互流畅度问题。

## 验证

- `node --check /Users/dev/workspace2/hc_apps/foliate-js/paginator.js` (PASS)
- `node /Users/dev/workspace2/hc_apps/foliate-js/scripts/run-phase0-benchmark.mjs '/Users/dev/workspace2/hc_apps/股票魔法.epub' --cases js --scenario continuous-reading --runs 5 --warmup 1 --trim 1 --max-cv 0.12 --max-range 0.25 --output /tmp/epub-turnpage-after.json` (PASS)

## 结果

- EPUB `continuous-reading` 中位数：
  - 优化前约 `3292.7ms`
  - 优化后约 `2981.6ms`
  - 下降约 `311.1ms`，约 `9.4%`
- `scenario:next`
  - 从约 `101.6ms` 降到约 `20ms`
- `scenario:prev`
  - 从约 `103.4ms` 降到约 `20.1ms`

## 未覆盖项

- 这次没有更新正式 baseline 文件，仍需在确认无回归后再决定是否重固化
- 这次没有处理 `initView` 的约 `100ms` 级成本，它仍然是阅读器层下一刀候选
