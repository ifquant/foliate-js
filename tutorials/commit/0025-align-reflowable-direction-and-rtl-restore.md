# 0025 - 对齐重排书籍方向识别与 RTL 恢复

## 背景

本轮对应 br1 的 S2-R04C10，以及 Readest `caa0d719c`、`23d5f3363`、
`676e14234` 中的三个独立 foliate-js 提交。只迁移阅读行为，不同步无关依赖。

## 主要目标

识别作者放在正文包装元素上的竖排样式；避免 RTL 容器反转两次；让相邻
章节预加载后，恢复锚点仍落在原来的文字位置。

## 改动概览

- body 没有竖排模式时，按上游边界检查首个非 `cfi-inert` 直接子元素。
  已有竖排 body 优先；不扫描任意深度或后续正文片段。
- 删除 RTL 容器的 `row-reverse`，保留原生方向与语义翻页方法。
- 镜像 RTL 矩形时测量目标 iframe 的实际尺寸；未显式传入时使用主视图。
  本地章节外层还含空白页 padding，不能照搬上游外层宽度后再重复加偏移。
  保留既有视图偏移相加、滚动和非 RTL 分支。

## 关键知识

1. iframe 内的文字矩形属于该文档的局部坐标。镜像它时使用所有预加载
   章节的总宽度，会让同一个锚点随着预加载发生位移。即使改用单个视图，
   也必须区分“带空白页的外层”和“只有正文的 iframe”。
2. CSS 的书写模式与文本方向不是同一件事。`vertical-rl` 不能直接视为
   `direction: rtl`；检测到竖排也不意味着支持全部竖排手势与跨章节混排。

## 补充知识

隔离测试应把 `no-preload` 设置在打开后的公开 renderer 上。当前
`foliate-view` 不转发该属性；仅设置在外层元素会让混合章节继续预加载，
从而污染方向检测结果。测试中的无效设置不能充当产品缺陷证据。

## 验证

- `BR1_PLAYWRIGHT_CHANNEL=chrome pnpm exec playwright test tests/e2e/foliate-directional-flow.spec.ts --project=chromium --workers=1`：5/5 PASS。
  包含直接子节点检测、语义翻页、不同宽度邻章预加载后的 CFI 恢复，以及
  仅加载目标章时带前后空白页的恢复。检查文字的真实可见区域。
- 实际 br1 书库文件路径经过两次 `/library` 卸载重建：保存锚点与 CFI
  文字保持可见，首屏标记不可见，新产生的保存调用不覆盖原位置。
  桌面文件及保存调用使用 IPC mock，不声称验证了磁盘数据库。
- 本地适配前复现了精确一页偏移；采用实际 iframe 尺寸后转绿。
- 既有六组回归 60/60、附加键盘/TXT/布局回归 4/4；合计 69 个独立
  浏览器用例，无跳过。br1 辅助测试 99/99，独立 TTS 测试 15/15 PASS。
- `node --check paginator.js`、`node --test tests/view-zip-loader.test.mjs`
  （6/6）、br1 类型检查（0 errors/0 warnings）、严格 TypeScript、
  `pnpm exec vite build`、两仓库 `git diff --check`：PASS。
- Terra high 独立任务审查、Astra high 最终跨仓库审查：PASS，无遗留阻塞项。

## 未覆盖项

- 混合章节方向的主视图/预加载归属单独记录在 `TODOS.md`。
- 不新增公开导出、host 补偿布局、依赖或 vendor 产物。
- C11 竖排手势、固定版式/PDF 方向、完整 `vertical-lr` 布局另行处理。
- 未执行打包 Tauri、Safari、原生移动端与手工 demo 验收。
