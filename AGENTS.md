# foliate-js AGENTS

## 项目概览

- 这是一个浏览器端电子书渲染库，主入口是 [`view.js`](/Users/dev/workspace2/hc_apps/foliate-js/view.js)。
- 主要格式适配分布在 [`epub.js`](/Users/dev/workspace2/hc_apps/foliate-js/epub.js)、[`mobi.js`](/Users/dev/workspace2/hc_apps/foliate-js/mobi.js)、[`pdf.js`](/Users/dev/workspace2/hc_apps/foliate-js/pdf.js)、[`fb2.js`](/Users/dev/workspace2/hc_apps/foliate-js/fb2.js)、[`comic-book.js`](/Users/dev/workspace2/hc_apps/foliate-js/comic-book.js)、[`dict.js`](/Users/dev/workspace2/hc_apps/foliate-js/dict.js)。
- 这是原生 ES modules 仓库，不是框架应用。改动经常直接影响公共接口、格式兼容性和浏览器运行时行为。
- 当前仓库包含性能探索工作。性能实验必须保持“可回退、可测量、可解释”，不要把临时实验代码伪装成稳定架构。

## 适用范围

- 本文件适用于仓库根目录及其所有子目录。
- 若子目录未来新增更具体的 `AGENTS.md`，子目录规则优先；本文件仍然提供默认约束。

## 目录导航

- [`view.js`](/Users/dev/workspace2/hc_apps/foliate-js/view.js): 高层入口，负责文件识别、loader 组装、book 打开流程。
- [`epub.js`](/Users/dev/workspace2/hc_apps/foliate-js/epub.js), [`mobi.js`](/Users/dev/workspace2/hc_apps/foliate-js/mobi.js), [`pdf.js`](/Users/dev/workspace2/hc_apps/foliate-js/pdf.js): 各格式核心解析路径。
- [`fixed-layout.js`](/Users/dev/workspace2/hc_apps/foliate-js/fixed-layout.js), [`paginator.js`](/Users/dev/workspace2/hc_apps/foliate-js/paginator.js): 渲染器。
- [`reader.html`](/Users/dev/workspace2/hc_apps/foliate-js/reader.html), [`reader.js`](/Users/dev/workspace2/hc_apps/foliate-js/reader.js), [`ui/`](/Users/dev/workspace2/hc_apps/foliate-js/ui): demo / 辅助 UI，不是库 API 本体。
- [`rollup/`](/Users/dev/workspace2/hc_apps/foliate-js/rollup): vendor 构建入口。
- [`vendor/`](/Users/dev/workspace2/hc_apps/foliate-js/vendor): 构建产物和第三方分发文件，通常应由构建流程更新，不要手改压缩后的 vendor 文件。
- [`tests/`](/Users/dev/workspace2/hc_apps/foliate-js/tests): 轻量测试壳和浏览器端测试文件。
- [`tutorials/commit/`](/Users/dev/workspace2/hc_apps/foliate-js/tutorials/commit): 每个非平凡 commit 的中文教程。

## 常用命令

- 安装依赖: `npm install`
- 构建 vendor 产物: `npm run build`
- 查看当前改动: `git status --short`
- 浏览器测试壳: 打开 [`tests/tests.html`](/Users/dev/workspace2/hc_apps/foliate-js/tests/tests.html)
- 本地 demo: 启动任意静态文件服务器后访问 [`reader.html`](/Users/dev/workspace2/hc_apps/foliate-js/reader.html)

## 开发原则

- 最小 diff 优先。先改最靠近真实瓶颈或兼容面的位置，不要为了“优雅”重画整个库。
- 显式优于聪明。尤其是格式识别、fallback、性能计时、缓存、错误处理。
- DRY 很重要，但只在证据充分时抽共性。这个仓库的格式路径差异很大，过早统一通常会制造假抽象。
- 优先保持书籍接口、渲染器接口、demo 可用性和浏览器兼容性。
- 性能工作必须同时关心时间、内存、复制成本和可解释性，不能只贴一张“更快了”的图。
- 先复用已有能力。比如现有 `rollup.config.js` 的 vendor 复制模式、现有 loader 入口、现有 `tests/` 壳子，除非它们明确挡路。

## 代码约定

- 默认使用 ASCII；只有文件原本已有 Unicode 或确有必要时再引入。
- 新抽象要小。除非证据充分，否则不要先做“通用后端框架”“统一格式总线”之类的大层。
- 改动公共接口时，优先在代码附近加短注释，解释兼容约束或状态机，而不是只靠 PR 说明。
- 若实现包含多阶段管线、状态机或非直观数据流，优先在计划文档和代码注释中补 ASCII 图。
- 不要手改压缩后的 [`vendor/zip.js`](/Users/dev/workspace2/hc_apps/foliate-js/vendor/zip.js) 或 [`vendor/fflate.js`](/Users/dev/workspace2/hc_apps/foliate-js/vendor/fflate.js)，应优先改 [`rollup/zip.js`](/Users/dev/workspace2/hc_apps/foliate-js/rollup/zip.js)、[`rollup/fflate.js`](/Users/dev/workspace2/hc_apps/foliate-js/rollup/fflate.js) 或构建配置。
- 性能实验代码和正式运行时代码要分层，避免把 benchmark 探针、临时后端或实验开关直接散落在稳定入口里。

## 应用领域硬约束

- EPUB 相关改动要尊重 README 里写明的安全边界，不能放松脚本/CSP 假设。
- `view.js` 的 `makeBook()`、各格式返回的 book 接口、以及渲染器自定义元素行为，都是高风险兼容面。
- PDF 相关改动通常同时涉及 `vendor/pdfjs/` 资产、worker 路径和固定布局渲染，不要只改其中一层。
- 性能优化不能把责任甩给调用方流程，除非需求明确要求改 API 语义。
- 若做 WASM / worker / fallback 相关工作，必须保证后端选择、失败、回退是显式可观测的，不能静默降级。

## 测试与验收

- 非平凡改动至少要做一项真实验证；优先使用与改动最相关的最低成本命令。
- 构建相关改动优先跑: `npm run build`
- 打开流程、格式解析、fallback、性能探针等改动，除了命令验证外，还应通过 [`tests/tests.html`](/Users/dev/workspace2/hc_apps/foliate-js/tests/tests.html) 或 demo 做手工验证。
- 若当前环境无法完整运行文档中的命令，要在提交信息和教程里如实写明原因与失败现象，不能假装通过。
- 回归测试优先级高于“以后补”。如果改动影响现有打开路径、格式识别、解析分支或 fallback，优先补测试或至少补可重复的验证步骤。

## 禁止事项

- 不要用 `fix`, `update`, `cleanup`, `misc`, `wip` 这类低信息提交主题，除非改动真的极小。
- 不要把多个无关功能塞进同一个提交。
- 不要未经确认就批量改 public interface、构建分发方式、生成产物布局或安全边界。
- 不要默认编辑 `vendor/` 下的压缩/生成文件来“快速修复”。
- 不要把性能实验结论写死在接口里，除非 benchmark、fallback 和兼容验证都已完成。

## 需要先确认的情况

- 改动 book interface、renderer interface、自定义元素名称、公开导出、README 中声明的用法。
- 改动 `package.json` 的 `exports`、构建脚本、产物目录结构、发布方式。
- 引入新的二进制产物类型，例如 `.wasm`、新的 worker 文件或新的 vendor 分发规则。
- 需要删除文件、重命名公共入口、重写 large module、或替换第三方依赖（例如 `zip.js`、`fflate`、`pdfjs-dist`）。
- 任何可能影响安全模型、CSP 假设、外部加载路径的改动。

## 提交 / PR 要求

### 提交信息

- 每个非平凡 commit 必须使用多行提交信息，并明确写出：
  - 为什么要做这次改动
  - 具体改了什么
  - 实际如何验证
  - 哪些内容是明确未覆盖的

- 使用这个格式：

```text
<type>(<scope>): <imperative summary>

<one short paragraph stating the purpose of the change and the practical outcome>

Changes:
- <key implementation change>
- <key implementation change>
- <key implementation change>

Verification:
- <command or check> (<result>)
- <command or check> (<result>)

Not included:
- <known limitation, deferred path, or intentionally untouched area>
- <known limitation, deferred path, or intentionally untouched area>
```

- `type` 优先使用: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`
- `scope` 应尽量贴近真实模块，例如: `epub`, `mobi`, `pdf`, `view`, `build`, `perf`, `dict`

### 自动提交规则

- 默认启用自动提交：每完成一个清晰功能切片，且验证已完成、教程已写好、提交信息已整理完毕后，AI 应直接提交，不必等待用户再次提醒。
- “清晰功能切片”指单一目标、可描述、可验证、可回滚的改动，例如“为 EPUB 前 DOM 路径加入阶段计时”“补一个 fallback 状态机”“修复 dict inflate 重复拷贝”。
- 不要把架构准备、功能改动、无关清理、文档补丁混进同一个自动提交。

### 提交教程规则

- 每个非平凡 commit 都要新增一个教程文件，路径为 `tutorials/commit/NNNN-short-topic.md`
- 编号使用四位零填充，自增，不跳号；当前仓库从 `0001` 开始。
- 教程默认使用中文，命令、路径、API 名称、代码符号保持原文。
- 教程默认结构：
  - `背景`
  - `主要目标`
  - `改动概览`
  - `关键知识`
  - `补充知识`
  - `验证`
  - `未覆盖项`
- 每篇教程默认补充 1 到 2 条真正来自本次实现的初学者友好知识点，例如：
  - JavaScript / 浏览器运行时概念
  - 设计或架构技巧
  - 调试习惯
  - agent 协作或 prompt 技巧

## 参考资料

- [`README.md`](/Users/dev/workspace2/hc_apps/foliate-js/README.md)
- [`rollup.config.js`](/Users/dev/workspace2/hc_apps/foliate-js/rollup.config.js)
- [`tests/tests.html`](/Users/dev/workspace2/hc_apps/foliate-js/tests/tests.html)

## 子目录约定

- `vendor/`: 视为构建产物或第三方分发目录，默认只通过构建更新。
- `rollup/`: vendor 适配入口，修改第三方打包策略优先从这里入手。
- `tests/`: 放测试壳、基准入口、fixture 与验证脚本；如果未来引入 perf harness，优先在这里或其子目录落地。
- `tutorials/commit/`: 只放按编号排序的提交教程，不放随手笔记。
