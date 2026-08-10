# Design: super-admin can assign admin as ticket executor

Date: 2026-08-10

## Problem

In the ticket assignee picker, candidates are active workers plus the current admin/super-admin for self-assign. A super-admin cannot assign another admin (or another super-admin) as исполнитель.

## Goal

Only `SUPER_ADMIN` sees active `ADMIN` and `SUPER_ADMIN` users in the assignee picker, in addition to workers and self. Regular `ADMIN` picker stays: workers + self. Assigned user's role is unchanged — only `ticket.assignedTo` is set.

## Approach

Extend existing `getAssignableUsers` / `mergeAssignable` (single rule place). No new service method, no UI filter layer.

## Behavior

| Actor | Assignable list |
|---|---|
| `ADMIN` | active workers + self («На себя») |
| `SUPER_ADMIN` | active workers + all active `ADMIN`/`SUPER_ADMIN` (dedupe by `_id`); self labeled «На себя» if present |
| other | workers only (unchanged) |

Labels stay `👤 Name` / `🙋 На себя (Name)` — no extra role badges.

## Implementation

1. `mergeAssignable(workers, actor, extras?)` — when actor is `SUPER_ADMIN`, merge `extras` with workers; dedupe by `_id`; prepend actor only if missing (same self-assign rule as today for `ADMIN`).
2. `UserService.getAssignableUsers` — if actor is `SUPER_ADMIN`, load active users with role in `[ADMIN, SUPER_ADMIN]` and pass as `extras`; otherwise keep current behavior.
3. Call sites (`bot.ts`, `createTicket.scene.ts`) already use `getAssignableUsers` — no picker wiring changes.
4. `do_assign` / `assignTicket` — no extra assignee-role gate; status changes already key off `assignedTo`, not `WORKER` role.

## Tests

Update `scripts/check-assignees.js`:

- super-admin merge includes an admin from extras
- regular admin merge does **not** include other admins
- no duplicate when actor already in workers/extras

## Out of scope

- Role changes / user-management «назначить работника»
- Expanding picker for regular admin
- Keyboard / menu changes
- New assignee label icons by role
