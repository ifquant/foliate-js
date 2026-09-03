# 0014：让分数 DPR 下的 PDF 画布填满页框

## 背景

Readest 提交 `a9c0f3d46` 把 `packages/foliate-js` 从 `981298cf4` 更新到 `24d9a0c0e`。嵌套提交修复了双页 PDF 在 Windows 150% 缩放等分数 DPR 环境下，书脊位置偶发一像素白缝的问题。

## 根因

PDF viewport 的宽高包含 `devicePixelRatio`，可能是小数。赋给 `canvas.width` 和 `canvas.height` 后，浏览器必须把位图尺寸转换为整数；如果布局也依赖这个取整后的尺寸，画布经 `scale(1 / devicePixelRatio)` 显示时就可能比页框窄不到一个逻辑像素。

## 改动

- 位图宽高继续使用 canvas 原生整数属性。
- CSS 宽高显式保留未取整的 viewport 尺寸。
- 现有根文档缩放负责把 device-pixel CSS 尺寸还原成逻辑页框尺寸。

这两行位于统一 PDF `render()` 路径，因此双页、单页和连续滚动模式都会使用同一尺寸规则。

## 验证

- `node --check pdf.js`
- br1 分数 DPR 双页 PDF 浏览器回归
- br1 PDF B1-B3 联合回归

## 未包含

- `S2-R03B4` 的滚轮输入稳定性
- PDF pinch、单页居中和连续滚动高亮修复
- foliate-js 既有 lockfile/Rollup vendor 路径维护
