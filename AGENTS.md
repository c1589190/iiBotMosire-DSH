# AGENTS.md — iiBotMosire-DSH

> 本仓只放 **iiBot 专属**的 DSH 插件；通用 Inbox 适配器在 `InboxMosire-DSH`，
> QQ 数据面在 `iiBotMosire`。

## 阅读顺序

1. 用户当次指令。
2. 本文件。
3. `packages/*/README.md`。
4. 跨仓关系看 `/home/cna/DevMosire-iiBot/AGENTS.md`。

## 边界

- 不改 `InboxMosire`、`InboxMosire-DSH`、`iiBotMosire` 的源码；只通过
  generic view-ack、MCP 工具和 `PERSONA.md` 消费它们。
- `InboxMosire-DSH` 的 `inboxWakeProfiles` 服务只用于可选通用文案；iibot
  wake-profile 已收敛为零语义兼容 alias，不承载工具名、业务 kind 或流程文案。
- `qq_conversation_send` / `qq_conversation_ack` 只由顶层会话调用；子 Agent 的
  `qq_*`/`inbox_*` 必须被 guard 拒绝。
- 人设文件 `PERSONA.md` 归操作者所有；Bot 不写回自己的 system prompt。
- 不把 raw token、Bearer、完整 QQ 正文写进仓库、日志、测试或对话。

## 开发

- 每个包独立 `node --test`；改 preset / profile 后必须新开会话验证。
- 提交信息用英文；不 `git add -A`，不跨包混提交。
- 装 bundle 会改 profile 并可能要求重启；报告 `application` 和 `NOT_RUN`。
