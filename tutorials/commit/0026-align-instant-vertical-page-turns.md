# 0026 - 区分竖排阅读方向与分页坐标

## 背景

对应 br1 S2-R04C11A。精确上游提交为 cecaef95be787cfb135b3d9a68325d62676c8f58，
但其拖动和动画部分另列 C11B，不一次迁入不同的本地动画实现。

## 主要目标

让 vertical-rl 的默认即时翻页遵循向右划进入下一页的阅读顺序，
同时保持正向 scrollTop 和稳定的文字定位。

## 改动概览

- 有效 vertical-rl 参与 RTL 判断，保留 body 与首个直接子元素的优先级。
- 负向滚动坐标只属于横排 RTL；竖排矩形先映射 top/bottom。
- 即时/eink 竖排接受横向手势，保留旧纵向手势和本地边界空白页模型。
- 动画开启时仍使用旧纵向交互，不提前接入没有跟手表现的新松手算法。

## 关键知识

1. 同一个 RTL 标志可以决定物理按键的语义，却不能无条件决定坐标符号。
   坐标计算必须同时考虑书写模式和实际滚动轴。
2. 上游边界条件依赖布局结构。本地外层包含首尾空白页，直接移植另一套
   越界页判断会改变跨章行为；应保持现有 sentinel 与相邻章节加载的约定。

## 验证

- br1 `foliate-vertical-page-turn.spec.ts`：4/4 PASS；包含真实 EPUB、
  可见文字范围、预加载/无预加载、即时/eink 与旧交互边界。
- 七组既有浏览器回归 65/65，附加键盘/TXT/布局回归 4/4；合计 73 个
  独立浏览器用例，无跳过。br1 辅助测试 99/99 PASS。
- `node --check paginator.js` 和 `node --test tests/view-zip-loader.test.mjs`
  （6/6）PASS；br1 Svelte 检查 0 errors/0 warnings，严格 TypeScript、
  `pnpm exec vite build`、两仓 `git diff --check` PASS。
- Terra high 独立任务审查与 Astra high 最终跨仓库审查：PASS，无遗留阻塞项。

基线复现即时方向和未初始化 bounds 问题。测试原先把容器 dir 当作阅读
方向、把一次翻页当作跨章，均已纠正，不能用这些断言失败冒充产品缺陷。

## 未覆盖项

- C11B 动画、跟手与异步取消；本提交不是完整上游覆盖。
- 混合方向预加载、完整 vertical-lr 滚动布局及固定版式/PDF。
- 不新增公开 API、依赖、vendor 资产；未执行打包或原生平台验收。
