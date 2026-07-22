# Design: live ticket card after status change (worker)

Date: 2026-07-22

## Problem

Worker flow for one ticket requires reopening «Мои заявки» after each status step:

assigned → in_progress → resolved (→ completed)

## Solution

On `status_*` callback (same cards as «Мои заявки»), after a successful status update:

1. Rebuild card text (number, title, description, phone, status).
2. `editMessageText` on the callback message with `ticketStatusKeyboard` for the new status.
3. If no transitions left, edit text and clear inline keyboard.
4. If edit fails (message gone/too old), fallback: `reply` with the same card.
5. Drop the separate «Статус заявки #N: …» reply — the card itself shows the new status.

Creator/admin notifications stay unchanged.

## Out of scope

- Journal claim flow (admin)
- Rewriting «Мои заявки» list as one message
