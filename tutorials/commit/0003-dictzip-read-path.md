# 0003 DictZip 读取路径优化

## 背景

`foliate-js` 的词典路径里有一条 `DictZip.read()` 热路径。原实现每解压一个 chunk 就做一次 `concat`，数据越多，累计拷贝越多。对连续查词或跨 chunk 读取来说，这种写法会把时间浪费在重复分配和重复复制上。

## 主要目标

- 降低 `DictZip.read()` 的重复拷贝成本
- 避免重复 inflate 同一块已解压 chunk
- 修正跨 chunk 读取时的结束边界

## 改动概览

- 删除逐块 `concatTypedArray()` 的 O(n^2) 拼接方式，改成“先收集、后一次性分配目标缓冲区”
- 给 `DictZip` 增加一个 8 项 LRU chunk cache，重复读取时直接复用已解压结果
- 把 `endIndex` 的计算改成 `offset + size - 1`，避免刚好落在 chunk 边界时多读一块

## 关键知识

### 1. TypedArray 连续 `concat` 很容易退化成平方级拷贝

像这样每来一块就新建更大的 `Uint8Array`：

```js
arr = concatTypedArray(arr, nextChunk)
```

看起来简单，但前面的数据会一遍遍被重新复制。  
如果有很多块，累计成本会越来越高。

更稳的做法是：

1. 先把每块结果存进数组
2. 先算总长度
3. 只分配一次最终缓冲区
4. 再把各块 `set()` 进去

这能把“不断重拷”改成“一次写完”。

### 2. LRU cache 适合这种“小热点、重复读”的路径

字典读取常常不是完全随机的。一次查词、前后邻近词、同一块里的索引和正文，都会让相邻 chunk 被反复访问。

这次选了一个很小的 LRU：

- 命中时把条目刷新到最新位置
- 超过上限就淘汰最旧的一项

这里不追求大缓存，而是用很低复杂度换掉最常见的重复 inflate。

## 补充知识

### 补充知识 1：边界计算要用“最后一个字节”

如果你要读取 `[offset, offset + size)` 这个半开区间，最后一个实际访问的字节是：

```js
offset + size - 1
```

直接拿 `offset + size` 去算 chunk 下标，遇到“刚好压线”的情况就会多算一块。这类 off-by-one 在分块读取里特别常见。

### 补充知识 2：私有字段适合把缓存细节锁在类内部

这次用了 `#cache`、`#cacheChunk()`、`#inflateChunk()`。  
这类缓存细节不该让外部调用者知道，也不该让别的模块直接操作。用类私有字段能把“缓存上限、淘汰策略、inflate 复用”都留在 `DictZip` 自己内部。

## 验证

- `node -e "import('/Users/dev/workspace2/hc_apps/foliate-js/dict.js')"` (PASS)

## 未覆盖项

- 没有补新的词典基准脚本，本次只修正实现路径
- 没有改动 `dict.js` 之外的词典调用方
