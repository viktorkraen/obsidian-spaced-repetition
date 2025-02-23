# 算法

## SM-2

!!! 警告

    该条目长时间未更新,
    请注意阅读 [源代码](https://github.com/st3v3nmw/obsidian-spaced-repetition/blob/master/src/algorithms/osr/srs-algorithm-osr.ts).

(除 PageRanks 之外，卡片复习采用相同规划算法)

- 该算法为 [Anki](https://faqs.ankiweb.net/what-spaced-repetition-algorithm.html) 所采用的基于 [SM-2 算法](https://www.supermemo.com/en/archives1990-2015/english/ol/sm2) 的变种。
- 使用三级打分制，即在复习阶段自评对某个概念的掌握程度为`困难`，`记得`或`简单`。
- 初始熟练度会根据链接笔记的平均熟练度、当前笔记的重要性和基本熟练度进行加权（使用 最大外链因子）。
    - `当存在外链时: 初始熟练度 = (1 - 链接加权) * 基础熟练度 + 链接加权 * 外链平均熟练度`
        - `链接加权 = 最大外链因子 * min(1.0, log(外链数目 + 0.5) / log(64))` (以自适应不同情况)
    - 不同概念/笔记的优先级由 PageRank 算法设定（笔记之间存在轻重缓急）
        - 大多数情况下基础概念/笔记具有更高优先级
- 当用户对某个概念/笔记的自评为：
    - 简单, 熟练度增加 `20` 复习间隔更新为 `原复习间隔 * 更新后熟练度 / 100 * 1.3` (1.3 是简单奖励)
    - 记得, 熟练度不变，复习间隔更新为 `原复习间隔 * old_ease / 100`
    - 困难, 熟练度降低 `20`，复习间隔更新为 `原复习间隔 * 0.5`
        - `0.5` 可在设置中更改
        - `最小熟练度 = 130`
    - 当复习间隔不小于 `8` 天时
        - `间隔 += 随机取值({-扰动, 0, +扰动})`
            - 设定 `扰动 = 向上取整(0.05 * 间隔)`
            - [Anki 文档](https://faqs.ankiweb.net/what-spaced-repetition-algorithm.html):
                > "[...] Anki 还会加入少量的随机扰动，以防止同时出现且评级相同的卡片获得相同的复习周期，导致其它们是在同一天被复习。"
- 复习规划信息将被存储于笔记的yaml front matter部分
