# 0016：稳定连续滚动 PDF 的 pinch 与横向平移

## 背景

Readest 提交 `f8916e128` 把 `packages/foliate-js` 从 `6f1a19018` 更新到 `0fa407c4c`。其中两个嵌套提交 `8bcb61e` 与 `0fa407c` 增加了连续滚动 PDF 的实时 pinch 预览、无跳变提交和横向平移能力。

## 改动

- pinch 过程中对整个 scroll container 做实时缩放，原点固定在当前视口中心。
- 释放前记录中心页的屏幕 rect；正式重排后恢复同一页的 X/Y 位置。
- 让滚动容器按最宽页面扩展并允许横向 overflow，使放大页面两侧都可到达。
- 页间距随缩放比例变化，避免 live preview 与正式布局使用不同几何。
- pinch 期间暂停现有 IntersectionObserver，结束后重新观察，避免手势中途触发新的页面加载或回收。
- 页面空闲加载完成后立即恢复 iframe 交互；滚动期间仍暂时关闭，兼顾选择与原生滚动。
- `pinchEnd(false)` 只移除取消手势的实时 transform，不留下等待后续重排消费的锚点。

本地分支没有上游 `6f1a190` 的 bounded scheduler，因此这里只复用现有 observer 生命周期，没有引入调度器、缓存或并发控制。

## 验证

- `node --check fixed-layout.js`
- br1 真实 PDF 双指 pinch 端到端回归
- br1 PDF B1-B5 联合回归

## 未包含

- 后续双指 scroll 与 pinch 的阈值仲裁
- pinch 缩放持久化
- foliate-js 既有 lockfile/Rollup vendor 路径维护
