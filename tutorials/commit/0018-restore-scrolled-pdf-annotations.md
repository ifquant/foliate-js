# 0018：恢复连续滚动 PDF 的标注

## 背景

Readest 提交 `6f67be703` 把 foliate-js 更新到 `9fde61a10`。PDF 缩放会异步重建 text layer；连续滚动路径原先立即重绘旧 overlayer，使其中保存的 Range 继续指向已经被替换的 DOM，最终导致高亮消失。

## 改动

- 保存 scroll page `onZoom()` 的返回值。
- 当异步 PDF 渲染完成后，复用现有 `#refreshOverlayerForFrame()`。
- 旧 SVG 从 DOM 移除，新 overlayer 针对新的 text layer 创建。
- 没有新增 annotation 状态；恢复仍由既有 `create-overlayer`/`create-overlay` 事件链完成。

## 验证

- `node --check fixed-layout.js`：PASS
- br1 真实 PDF scrolled highlight 回归：PASS（重复运行 10/10）
- br1 PDF B1-B7 联合回归：PASS（7/7）

## 未包含

- 改变 annotation 数据模型或持久化
- 改变 PDF.js text-layer 实现
- 新增异步渲染调度器
