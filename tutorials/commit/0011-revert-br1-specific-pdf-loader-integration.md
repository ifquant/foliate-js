# 0011：撤回为 br1 接入加到 foliate-js 里的 PDF loader 补丁

## 背景

前面为了让 `br1` 在 `Tauri + Vite` 宿主里跑通 PDF，我把两层适配逻辑加进了 [`pdf.js`](/Users/dev/workspace2/hc_apps/foliate-js/pdf.js)：

- 一层是“自包含加载”
- 一层是“Vite 顶层 URL 改写兼容”

这些改动短期确实帮 `br1` 跑通了，但它们也把宿主集成问题推进了 `foliate-js` 本体。你后来明确提出：**如果要更像 `Readest`，应该尽量让宿主应用负责 vendor 契约，而不是持续改库本身。**

所以这次做的不是“再修一版 PDF”，而是把那两条 `br1` 特定的 `foliate-js` 补丁撤回。

## 主要目标

- 把 `foliate-js` 从 `br1` 特定的 PDF 集成补丁里抽出来
- 恢复到更接近 `Readest` 的“宿主负责 vendor 契约，库尽量保持稳定”的方向
- 为后续只在 `br1` 宿主侧解决 PDF 集成问题腾出干净边界

## 改动概览

- 回滚提交：
  - `05ca7d4`
  - `a411272`
- 结果是：
  - [`pdf.js`](/Users/dev/workspace2/hc_apps/foliate-js/pdf.js) 不再保留那两层 `br1` 定制兼容
  - 删除对应的两篇旧教程：
    - `0009-make-pdfjs-loading-self-contained.md`
    - `0010-avoid-vite-top-level-url-rewrites-in-pdf-loader.md`
- 新增本篇教程，说明为什么这次选择回滚

## 关键知识

### 1. 库和宿主的职责边界要尽量清楚

一个库在多个宿主里使用时，最容易出现的问题就是：

- 宿主缺一个运行时前提
- 库为了兼容这个宿主，又开始加一层特判

短期看这很有效，但长期会让库越来越像“为了某个 app 定制的内部模块”。  
如果你希望它更像公共库，通常要优先把宿主问题放回宿主里解决。

### 2. `git revert --no-commit` 适合做“成组撤回”

这次不是删除分支，也不是 `reset --hard`，而是：

- 先把目标提交的改动反向应用到工作区
- 检查回滚结果
- 再用自己的提交信息提交

这种方式适合：

- 需要撤回多个历史提交
- 但又想保留清晰的提交说明和教程

## 补充知识

“撤回提交”不一定代表之前的改动是错的。  
这次更准确的原因是：**这些改动放错层了。**

也就是说，它们可能在当时是有效止血，但不适合继续长期放在 `foliate-js` 里。

## 验证

我实际运行了：

```bash
git -C /Users/dev/workspace2/hc_apps/foliate-js revert --no-commit a411272 05ca7d4
npm --prefix /Users/dev/workspace2/hc_apps/foliate-js run build
git -C /Users/dev/workspace2/hc_apps/foliate-js diff --check
```

结果：

- `git revert --no-commit ...`：`PASS`
- `npm run build`：`FAIL`
  - 原因：当前本地环境缺 `@rollup/plugin-node-resolve` 等 dev 依赖，无法完成构建验证
- `git diff --check`：将在提交前再次确认

## 未覆盖项

- 这次没有顺手修 `br1` 宿主侧的 PDF 集成问题
- 这次只是把库侧改动撤回，后续还需要在 `br1` 里继续按 `Readest` 方式收拢宿主契约
