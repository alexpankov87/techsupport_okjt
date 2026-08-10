# Super-admin assign admin as executor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Super-admin sees active admins and other super-admins in the ticket assignee picker (plus workers); regular admin picker unchanged.

**Architecture:** Extend pure `mergeAssignable` with optional `extras`, load admin/super-admin extras in `UserService.getAssignableUsers` only for `SUPER_ADMIN`. Call sites already use `getAssignableUsers`.

**Tech Stack:** TypeScript, Telegraf bot, MongoDB/Mongoose, Node assert script `scripts/check-assignees.js`

## Global Constraints

- Only `SUPER_ADMIN` gets admin/super-admin in the picker; `ADMIN` stays workers + self.
- Do not change assignee role — only `ticket.assignedTo`.
- Labels unchanged (`👤` / `🙋 На себя`).
- No new service method; extend existing merge + getAssignableUsers.
- Spec: `docs/superpowers/specs/2026-08-10-superadmin-assign-admin-design.md`

## File map

| File | Responsibility |
|---|---|
| `src/bot/utils/assignees.ts` | Pure merge rules (+ extras for super-admin) |
| `src/services/UserService.ts` | Load extras and call merge |
| `scripts/check-assignees.js` | Runtime + source checks for merge rules |

---

### Task 1: Failing tests for super-admin extras

**Files:**
- Modify: `scripts/check-assignees.js`
- Modify (later task): `src/bot/utils/assignees.ts`

**Interfaces:**
- Produces: tests expecting `mergeAssignable(workers, superAdmin, extras)` to include other admins; admin actor must ignore extras

- [ ] **Step 1: Extend the mirrored `mergeAssignable` stub and add failing assertions**

In `scripts/check-assignees.js`, update the IIFE mirror to accept `extras = []` and (for now) **not** merge them — so new assertions fail until Task 2. Or write assertions against expected API and implement mirror + source together after red.

Add fixtures and tests after existing admin self-assign checks:

```javascript
const superAdmin = { _id: { toString: () => 's1' }, firstName: 'Супер', lastName: '', role: 'super_admin' };
const otherAdmin = { _id: { toString: () => 'a2' }, firstName: 'Другой', lastName: '', role: 'admin' };

const saList = mergeAssignable([worker], superAdmin, [superAdmin, otherAdmin]);
if (!saList.some((u) => u._id.toString() === 'a2')) fail('super-admin must see other admin');
else ok('super-admin sees other admin');
if (!saList.some((u) => u._id.toString() === 's1')) fail('super-admin must appear for self');
else ok('super-admin in list for self');
if (saList.filter((u) => u._id.toString() === 's1').length !== 1) fail('super-admin must not duplicate');
else ok('super-admin no duplicate');

const adminIgnoresExtras = mergeAssignable([worker], admin, [otherAdmin]);
if (adminIgnoresExtras.some((u) => u._id.toString() === 'a2')) fail('admin must not see extras');
else ok('admin ignores extras');
```

Also assert `assignees.ts` source mentions `extras` (string check) after implementation.

- [ ] **Step 2: Run tests — expect FAIL on super-admin sees other admin**

Run: `node scripts/check-assignees.js`  
Expected: `FAIL: super-admin must see other admin` (until Task 2)

- [ ] **Step 3: Commit test additions only if you keep them red; otherwise proceed to Task 2 in same commit**

Prefer one commit after green (Task 2) for this small change.

---

### Task 2: Implement merge + UserService

**Files:**
- Modify: `src/bot/utils/assignees.ts`
- Modify: `src/services/UserService.ts`
- Modify: `scripts/check-assignees.js` (mirror must match)

**Interfaces:**
- Consumes: `UserRepository.findActiveWorkers`, `findByRole`
- Produces: `mergeAssignable(workers: IUser[], actor?: IUser, extras?: IUser[]): IUser[]`

- [ ] **Step 1: Implement `mergeAssignable`**

```typescript
export function mergeAssignable(workers: IUser[], actor?: IUser, extras: IUser[] = []): IUser[] {
  if (!actor) return workers;
  if (actor.role !== UserRole.ADMIN && actor.role !== UserRole.SUPER_ADMIN) return workers;

  const pool =
    actor.role === UserRole.SUPER_ADMIN
      ? dedupeById([...extras, ...workers])
      : workers;

  const id = actor._id.toString();
  if (pool.some((u) => u._id.toString() === id)) return pool;
  return [actor, ...pool];
}

function dedupeById(users: IUser[]): IUser[] {
  const seen = new Set<string>();
  const out: IUser[] = [];
  for (const u of users) {
    const id = u._id.toString();
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(u);
  }
  return out;
}
```

Keep `dedupeById` file-local (not exported) unless tests need it.

- [ ] **Step 2: Update `UserService.getAssignableUsers`**

Import `mergeAssignable` from `../bot/utils/assignees` (or relative path used in project — prefer importing the util to avoid duplicated rules):

```typescript
async getAssignableUsers(actor?: IUser): Promise<IUser[]> {
  const workers = await this.userRepository.findActiveWorkers();
  if (!actor) return workers;
  if (actor.role === UserRole.SUPER_ADMIN) {
    const [admins, supers] = await Promise.all([
      this.userRepository.findByRole(UserRole.ADMIN),
      this.userRepository.findByRole(UserRole.SUPER_ADMIN),
    ]);
    return mergeAssignable(workers, actor, [...admins, ...supers]);
  }
  return mergeAssignable(workers, actor);
}
```

If importing bot util into service is undesired layering, inline the same merge call path by duplicating only the service wrapper but **must** keep logic identical to `mergeAssignable` — prefer import; this repo already documents assignees as the pure rules mirror.

- [ ] **Step 3: Sync mirror in `scripts/check-assignees.js` with the same merge/dedupe logic**

- [ ] **Step 4: Run `node scripts/check-assignees.js`**

Expected: all `OK:` lines, exit 0

- [ ] **Step 5: Run `node scripts/check-bot-invariants.js` if present**

Expected: pass

- [ ] **Step 6: Commit**

```bash
git add src/bot/utils/assignees.ts src/services/UserService.ts scripts/check-assignees.js
git commit -m "feat: let super-admin assign admins as ticket executors"
```

- [ ] **Step 7: `graphify update .`** after code changes

---

## Spec coverage self-review

| Spec requirement | Task |
|---|---|
| SUPER_ADMIN sees ADMIN + SUPER_ADMIN + workers | Task 2 |
| ADMIN picker unchanged | Task 1 test + Task 2 merge ignores extras for ADMIN |
| No role change on assign | N/A (no assignTicket change) |
| Labels unchanged | N/A |
| Call sites untouched | N/A |
| check-assignees coverage | Task 1–2 |
