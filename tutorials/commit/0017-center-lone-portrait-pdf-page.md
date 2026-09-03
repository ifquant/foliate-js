# 0017：居中 portrait auto-spread 的单页 PDF

## 背景

Readest 提交 `3ce5a5c8e` 把 foliate-js 更新到 `f6dced2aa`。在 auto-spread 的 portrait 布局中，双页 spread 只显示其中一页；旧逻辑仍给该页保留朝书脊方向的单边 `auto` margin，因此缩小后的页面会停在视口一侧。

## 改动

- 新增 `computeSpreadInlineMargins(portrait)`，集中给左右 frame 计算 inline margin。
- portrait 模式为可见页设置两侧 `auto` margin，使左页和右页都能独立居中。
- landscape 模式显式设置两侧 margin：左页靠右、右页靠左，双页继续在书脊相接。
- 每次渲染都覆盖两个 margin 属性，避免旋转后残留 portrait 布局状态。

## 验证

- `node --check fixed-layout.js`：PASS
- br1 真实 PDF portrait spread 回归：PASS（重复运行 3/3）
- br1 PDF B1-B6 联合回归：PASS（6/6）

## 未包含

- 修改 auto-spread 的 portrait 判定阈值
- 修改 PDF page-turn 点击区域
- 引入上游后续 fixed-layout 改动
