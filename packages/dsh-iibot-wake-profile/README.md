# @mosire/dsh-iibot-wake-profile

把 iiBot 的唤醒语义从通用 Inbox 适配器里拆出来：

- 通用适配器 `@mosire/dsh-inbox-mosire` 只负责 SSE / binding / cursor / wake 状态；
- 本 bundle 注册命名 profile `iibot`，提供 `qq_conversation_read` / `qq_conversation_ack` 工具名、中文 view-ack 正文和缺工具警告；
- 本 bundle 的 patch 把 `inbox-mosire-adapter` 行的 `wakeProfile` 指到 `iibot`。

profile 只是数据，不会调用任何业务工具。

## 依赖

- `@mosire/dsh-inbox-mosire` **>= 0.5.0**（提供 `inboxWakeProfiles` 服务）。
- DSH `>= 0.2.0-rc.2`。

## 安装

先装/更新通用适配器，再装本 bundle：

```text
plugin_manager install_bundle  target = /home/cna/DevMosire-iiBot/InboxMosire-DSH
plugin_manager install_bundle  target = /home/cna/DevMosire-iiBot/iiBotMosire-DSH/packages/dsh-iibot-wake-profile
```

bundle 顺序很重要：本 bundle 的 patch 要覆盖已经存在的 `inbox-mosire-adapter` 行，所以它必须排在 `@mosire/dsh-inbox-mosire` 之后。

装完重启 DSH。`wakeProfile` 在适配器启动时解析；新增 JS 模块不能热加载。

## 配置

本 bundle 只设置：

```yaml
- id: inbox-mosire-adapter
  name: '@mosire/dsh-inbox-mosire'
  config:
    wakeProfile: iibot
```

`config` 是整行替换，所以这里不写 `apiUrl` / `tokenFile` / `channels`；它们继续来自：

1. 插件行 config；
2. `INBOX_*` 环境变量（例如 `INBOX_API_URL`、`INBOX_API_TOKEN_FILE`）；
3. `$DSH_HOME/inbox-mosire/config.json`；
4. 默认值。

如果 `wakeProfile: iibot` 但 profile 没注册（bundle 未装/未加载），适配器会记录 `唤醒 profile 未注册` 并跳过该轮 wake，不会退回 generic 发出错误指令。

## 验证

```bash
node --test
```

已覆盖：profile 字段、`apply` 注册名、正文不含 `inbox_claim`。

真实联调：装两个 bundle、重启、绑 inbox、发一条真实 QQ 消息，确认 wake 正文出现 `qq_conversation_read(source)` / `qq_conversation_ack(source)`，且 `inbox_adapter_status` 的 `programMcp` 为 `available`。
