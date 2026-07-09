# Checklist tool còn thiếu — AI Assistant Brain

Đối chiếu: **tool agent hiện có** (`assistant_tools.js`) vs **script tay** (`Discord_bot/*.js`) + **cf-bot** + quyền Discord thường dùng.

Cập nhật: 2026-07-09 (full-stack Wave A/B shipped)

---

## Chú thích trạng thái

| Ký hiệu | Ý nghĩa |
|--------|---------|
| ✅ Có | Tool agent đã có |
| 🟡 Một phần | Có tool gần, chưa đủ |
| ❌ Thiếu | Chưa có tool; vẫn phải chạy script / làm tay / cf-bot |

## Ưu tiên đề xuất

- **P0** — Vận hành hằng ngày, hay cần
- **P1** — Setup / bảo trì server
- **P2** — Nice-to-have / ít dùng

---

## Layer 0 — Risk & Discord permissions

| Hạng mục | TT | Ghi chú |
|----------|----|---------|
| Risk tiers safe/write/critical | ✅ | `ACTION_RISK`, `ASSISTANT_AUTO_WRITE`, `ASSISTANT_MAX_ACTIONS` |
| Critical always confirm | ✅ | Batch staging nếu có critical |
| Expanded invite permissions | ✅ | Threads, nicknames, reactions, … |
| Hierarchy check on roles | ✅ | `assertBotCanManageRole` |

---

## 0. Baseline (đã có từ trước)

| Tool | TT |
|------|-----|
| Chat agent + memory | ✅ |
| inspect_server, inspect_member, list_channels, diagnose_permissions, assistant_status | ✅ |
| analyze_server, learn_server | ✅ |
| send_message, send_embed, summarize_channel, search_messages, pin/unpin | ✅ |
| create_text_channel, rename, topic, slowmode, lock/unlock | ✅ |
| create_thread, rename_thread, archive_thread | ✅ |
| warn, timeout, kick, ban, assign/remove role, create_role | ✅ |
| task + reminder | ✅ |
| fetch_url, summarize_url, publish_url_to_forum | ✅ |

---

## 1. Kênh & category

| Tool | TT | P | Ghi chú |
|------|----|---|---------|
| `delete_channel` | ✅ | P0 | critical |
| `create_category` | ✅ | P0 | write |
| `delete_category` | 🟡 | P1 | dùng `delete_channel` trên category |
| `move_channel` | ✅ | P0 | |
| `reorder_channel` / `set_position` | ❌ | P1 | Wave C |
| `create_forum_channel` | ✅ | P0 | |
| `create_announcement_channel` | ❌ | P1 | Wave C |
| `create_voice_channel` | ❌ | P1 | Wave C |
| `edit_channel` (NSFW, bitrate, …) | ❌ | P1 | Wave C |
| `clone_channel` | ❌ | P2 | |
| `convert_to_forum` | ❌ | P1 | Wave C |
| `list_channel_permissions` | 🟡 | P1 | diagnose + set overwrites |
| `set_channel_permissions` | ✅ | P0 | critical; allow/deny/clear |
| `clear_channel_overwrites` | 🟡 | P1 | `clear=true` trên set_channel_permissions |
| `lock_server` / `unlock_server` | ❌ | P1 | Wave C |
| `bulk_lock_channels` | ✅ | P1 | critical |

---

## 2. Role & hierarchy

| Tool | TT | P | Ghi chú |
|------|----|---|---------|
| `create_role` | ✅ | — | |
| `edit_role` | ✅ | P0 | critical |
| `delete_role` | ❌ | P1 | Wave C |
| `set_role_permissions` | 🟡 | P0 | qua `edit_role` permissions[] |
| `set_role_position` | ❌ | P1 | Wave C |
| `list_roles` | 🟡 | P1 | inspect_server |
| Button / reaction role panel | ✅ | P0 | `send_roles_panel` + gateway interaction |

---

## 3. Message & panel

| Tool | TT | P | Ghi chú |
|------|----|---|---------|
| `edit_message` | ✅ | P0 | bot-authored only |
| `delete_message` | ✅ | P1 | single message |
| `add_reaction` | ❌ | P1 | Wave C |
| `send_roles_panel` / `send_visa_panel` / `send_rules_panel` | ✅ | P0 | |
| `send_components` generic | ❌ | P2 | fixed panels only |
| `crosspost_message` | ❌ | P2 | |

---

## 4. Thread & forum

| Tool | TT | P | Ghi chú |
|------|----|---|---------|
| `unarchive_thread` | ✅ | P1 | |
| `lock_thread` / `unlock_thread` | ✅ | P1 | |
| `set_thread_tags` | ✅ | P0 | |
| `list_forum_tags` / `edit_forum_tags` | ❌ | P1 | Wave C |
| `list_threads` | ✅ | P1 | |
| `mark_thread_solved` | ✅ | P1 | shared `assistant_qa_tags.js` |
| `bulk_retag_threads` | ❌ | P2 | |

---

## 5. Member moderation

| Tool | TT | P | Ghi chú |
|------|----|---|---------|
| `unban_member` | ✅ | P0 | critical |
| `remove_timeout` | ✅ | P0 | |
| `list_bans` | ✅ | P1 | |
| `set_nickname` | ✅ | P1 | |
| `prune_members` | ❌ | P2 | out of scope |
| `dm_member` | ✅ | P1 | |
| voice move/disconnect | ❌ | P2 | |

---

## 6–8. Server-wide / onboarding / meta

| Tool | TT | Ghi chú |
|------|----|---------|
| Risk tiers | ✅ | |
| Multi-step plan / run_plan | ❌ | Wave C |
| setup_screening | ❌ | Wave C |
| Emoji CRUD | ❌ | Wave C |
| configure_welcome via chat | ❌ | env-based still |

---

## Roadmap còn lại (Wave C)

1. `reorder_channel`, announcement/voice create, `convert_to_forum`
2. `delete_role`, `set_role_position`
3. `preview_plan` / `run_plan` (thay restructure.js)
4. Screening / emoji / lock_server full
5. Generic `send_components`

---

## Coverage ước lượng (sau Wave A/B)

| Nhóm | Coverage |
|------|----------|
| Chat + memory + web | ~90% |
| Kênh / category / forum structure | ~75–80% |
| Role / permission | ~70–80% |
| Mod member | ~90% |
| Panel roles/visa/rules | ~80% |
| Bulk restructure / setup | ~40% |
| **Admin bằng chat tổng thể** | **~85–90%** |

---

## Ghi chú theo dõi

- [x] Wave A started
- [x] Wave A done
- [x] Wave B started
- [x] Wave B done
- [ ] Wave C (optional)
- [x] Cập nhật `ASSISTANT.md` khi ship tool mới
- [x] Smoke test risk + panels + qa tags
