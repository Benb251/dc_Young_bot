# Advanced Assistant Brain

`bot_gateway.js` now routes owner DMs and bot mentions through an agent-style assistant brain.

## Environment

Required for Discord:

- `DISCORD_TOKEN`
- `GUILD_ID`
- `ADMIN_DISCORD_ID`

AI provider, compatible with 9router/OpenAI-style chat completions:

- `AI_ENDPOINT`, default `http://localhost:20128/v1`
- `AI_API_KEY`, optional bearer token
- `AI_MODEL`, default `xai/grok-4`
- `AI_SYSTEM_PROMPT`, optional base system prompt used by `ai_helper.js`

Assistant memory:

- `ASSISTANT_MEMORY_FILE`, default `Discord_bot/data/assistant_memory.json`
- `ASSISTANT_MAX_FACTS`, default `500`
- `ASSISTANT_CONVERSATION_TURNS`, default `16`
- `ASSISTANT_AUTO_MEMORY`, default `true`; set `false` to disable model-assisted memory extraction
- `ASSISTANT_AUTO_MEMORY_LIMIT`, default `3`

Assistant safety:

- `ASSISTANT_CONFIRM_TTL_MS`, default `60000`
- `ASSISTANT_AUDIT_CHANNEL_ID`, optional channel ID where assistant action audits are sent

`Discord_bot/data/` is ignored by git because it may contain private server memory.

## How It Works

- Normal members can mention the bot to ask questions naturally.
- The owner can DM the bot with natural language commands.
- Admins can mention the bot in-server and ask it to perform supported admin actions.
- The assistant asks the model for a JSON decision, executes allowed low-risk tools, then reports the result.
- Server-changing actions are staged first. Reply with `xác nhận` within the TTL to run them, or `hủy` to cancel.
- After useful turns, the assistant can extract durable facts into memory while filtering secrets and low-confidence guesses.
- Every assistant tool decision is written to console audit logs, and optionally to `ASSISTANT_AUDIT_CHANNEL_ID`.

## Supported Tools

- `send_message`: send a message to a named channel or channel ID.
- `summarize_channel`: summarize recent messages from a channel.
- `delete_messages`: delete recent messages in the current channel.
- `list_channels`: list visible text/forum channels.
- `diagnose_permissions`: report missing server/channel permissions, role hierarchy limits, and an invite URL with recommended permissions.
- `create_text_channel`: create a text channel, optionally under a category.
- `rename_channel`: rename a channel.
- `set_channel_topic`: update a text channel topic.
- `assign_role` / `remove_role`: manage member roles by mention, ID, or name.
- `create_role`: create a new role.
- `timeout_member`: timeout a member for a bounded number of minutes.
- `kick_member` / `ban_member`: remove abusive members when clearly requested by an admin.
- `remember`: store a scoped memory fact.
- `recall_memory`: search stored memory.

Admin tools are guarded by `ADMIN_DISCORD_ID` or Discord Administrator permission. Non-admin users can chat and use memory-style interactions, but cannot execute server actions.

## Verification

```bash
npm test
```

The smoke test validates assistant JSON parsing and local memory without connecting to Discord or the AI provider.
