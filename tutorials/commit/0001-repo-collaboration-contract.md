# 0001 Repo collaboration contract

## 背景

这个提交不是在改 `foliate-js` 的运行逻辑，而是在给仓库补协作契约。这个库是原生 ES modules 的浏览器电子书渲染库，入口、格式适配、vendor 构建、demo、测试壳都混在同一个仓库里。没有清晰规则时，AI 很容易一边改公共接口，一边手改 `vendor/`，最后人很难判断哪些是正式架构，哪些只是临时实验。

## 主要目标

- 为仓库创建一份真实可执行的 `AGENTS.md`
- 把高信息提交格式、自动提交边界、提交教程规则写死
- 给后续 AI 和人类协作者一个最小但具体的工作协议

## 改动概览

- 新增 [`AGENTS.md`](/Users/dev/workspace2/hc_apps/foliate-js/AGENTS.md)，写明仓库入口、目录职责、常用命令、兼容面、禁止事项和提交规则
- 新增 [`tutorials/commit/0001-repo-collaboration-contract.md`](/Users/dev/workspace2/hc_apps/foliate-js/tutorials/commit/0001-repo-collaboration-contract.md) 作为后续提交教程样例
- 把 `tutorials/commit/NNNN-*.md` 规则、中文教程默认规则、自动提交规则落到仓库级文档里

## 关键知识

### 1. 为什么这个仓库特别需要 `AGENTS.md`

`foliate-js` 不是普通应用仓库。它同时有：

- 公共库入口，例如 `view.js`
- 多种格式适配器，例如 `epub.js`、`mobi.js`、`pdf.js`
- 第三方 vendor 产物，例如 `vendor/pdfjs/`、`vendor/zip.js`
- demo 和测试壳，例如 `reader.html`、`tests/tests.html`

这意味着一次改动很容易同时碰到“公共接口”“生成产物”“实验代码”“手工验证路径”。如果没有规则，AI 很容易做出看似省事、实际上把仓库搞乱的选择。

### 2. 为什么提交教程要单独建目录

提交信息适合解释“这次做了什么”，但不适合给新人补上下文。`tutorials/commit/` 的作用是把每次非平凡提交讲清楚，尤其是：

- 为什么这样设计
- 哪些约束来自仓库本身
- 哪些问题这次故意没做

以后回看历史时，教程比 diff 更适合帮助新人理解项目。

## 补充知识

### 补充知识 1：生成文件和源码要分开看

像 `vendor/zip.js`、`vendor/fflate.js` 这种文件通常不是最佳修改点。它们更像“编译后的成品”。如果直接手改，下一次构建很可能把你的改动覆盖掉。更稳的做法是优先找它们的入口，例如 `rollup/zip.js`、`rollup/fflate.js` 或 `rollup.config.js`。

### 补充知识 2：好的仓库规则应该帮人减少猜测

差的规则只会说“写好提交”“记得测试”。好的规则会直接写出真实命令、真实路径和高风险边界。这样下一个协作者不需要猜“这个 repo 到底把什么当 public API”“vendor 能不能直接改”“性能实验应该放哪层”。

## 验证

- `test -f /Users/dev/workspace2/hc_apps/foliate-js/AGENTS.md` (PASS)
- `test -f /Users/dev/workspace2/hc_apps/foliate-js/tutorials/commit/0001-repo-collaboration-contract.md` (PASS)
- `npm run build` (未运行，本次仅新增协作文档；当前环境此前存在 `rollup` 可选依赖缺失问题)

## 未覆盖项

- 没有补仓库级自动化测试框架，本次只定义了协作契约
- 没有改写 README 或发布流程文档
- 没有处理当前工作树里的业务代码改动，例如 `dict.js` 和 `TODOS.md`
