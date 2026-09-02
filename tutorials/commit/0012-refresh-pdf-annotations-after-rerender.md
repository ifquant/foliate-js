# 0012：在 PDF 文本层重建后刷新批注层

## 背景

PDF 缩放或重新排版时，PDF.js 会清空并重建 `.textLayer`。批注层保存的 `Range` 仍指向旧文本节点，因此双页 PDF 看似还有批注数据，画面上的高亮却会消失。

## 改动

- 等待异步 `onZoom` 完成后，检查当前可见 frame 是否已有 overlayer。
- 删除引用旧 DOM 的 overlayer，并重新发出 `create-overlayer`。
- 继续沿用现有 attach 契约，让宿主重新把批注锚定到新文本节点。
- 不处理连续滚动页；该路径由后续独立任务验证和接入。

## 两个知识点

1. DOM `Range` 不是文本内容的永久标识。目标节点被替换后，即使文字相同，旧 `Range` 也不能继续用于绘制。
2. renderer 只负责重建 overlayer 容器，批注数据仍由宿主持有。这样不会在引擎里复制一套笔记状态。

## 验证

```bash
node --check fixed-layout.js
```

- `node --check fixed-layout.js`：PASS
- br1 双页 PDF 高亮重渲染回归：PASS（1/1）
- `npm run build`：FAIL，当前 checkout 未安装 `@rollup/plugin-node-resolve` 等 devDependencies；br1 的生产构建和真实浏览器加载路径均已通过

## 未包含

- 连续滚动 PDF 的 overlayer 刷新
- PDF 滚动锚点、滚轮、缩放手势、页缝与单页居中修复
