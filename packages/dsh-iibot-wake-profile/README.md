# @mosire/dsh-iibot-wake-profile

这是保留 `wakeProfile=iibot` 配置兼容性的**零语义 alias**。

通用适配器 `@mosire/dsh-inbox-mosire` 现在直接渲染通用 view-ack：

- `available` 留在 wake 头；
- item 只带 `source`、opaque `kind`、`summary`，必要时带 `truncated`；
- read/send/ack 工作流和 `digest_complete` 语义由 iiBot 自己 MCP 的
  tool description 负责；
- DSH 不再镜像 `qq_*` 工具名、业务 kind 或程序 MCP readiness 警告。

本 bundle 只注册一个空的 `iibot` profile，不提供工具、不调用工具、不读取正文。
新安装应直接使用 generic profile；等现有 `wakeProfile: iibot` 配置迁移完成后，
本包可以删除。

## 依赖

- `@mosire/dsh-inbox-mosire` **>= 0.7.0**
- DSH `>= 0.2.0-rc.2`

## 验证

```bash
node --test
```

覆盖：profile 为空、没有 `qq_*`/`inbox_claim`/业务 kind/readiness 字段，
并且只注册 `iibot` 名称。
