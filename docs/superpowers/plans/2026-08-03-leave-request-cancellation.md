# Leave Request Cancellation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an employee cancel their own PENDING or APPROVED leave request, with the backend restoring any deducted balance via a single reversal ledger entry, and the frontend (My Info → Leave Requests) exposing this through a confirmed, non-double-submittable action that refreshes every dependent view.

**Architecture:** The backend already has a `LeaveRequestsService.cancel()` method and a `:id/cancel` route wired end-to-end (transaction, pessimistic lock, approval-instance skipping, conditional ledger reversal, audit log) — it just has two contract bugs (ownership violations return 404 instead of 403; an already-terminal request silently no-ops/400s instead of returning 409) and zero test coverage. The frontend cancel button is currently 100% fake (local `setState` only, no API call). This plan fixes the two backend bugs, adds backend tests, wires the frontend button to the real endpoint behind a confirm step, and — since the spec requires "Balance History" to refresh after cancellation and that tab is currently 100% static mock data — wires it to the already-existing, already-unused `GET /leave-balances/ledger` endpoint.

**Tech Stack:** NestJS 11 + TypeORM + Jest (backend), React 19 + Vite + Vitest + React Testing Library (frontend, newly configured).

## Global Constraints

- Do not change unrelated business behavior (e.g. leave `handleRecall` in `MyInfo.tsx` untouched — it's pre-existing dead UI, out of scope).
- Reuse existing patterns: the `dataSource.transaction(...)` + pessimistic-lock pattern already used by `approveStep`/`rejectStep`; the shared `ConfirmModal` component (`src/admin/components/ui/ConfirmModal.tsx`); the existing `window.dispatchEvent(new Event('leave-request-submitted'))` refresh mechanism already listened to by `WhosOut.tsx`, `StatsBar.tsx`, `WelcomeBanner.tsx`, `LatestRequestCard.tsx`, `ApprovalProgressSection.tsx`, `LeaveTracking.tsx`, and `MyInfo.tsx` itself.
- No `EXPIRED` status exists in `LeaveRequestStatus` (`backend/src/common/enums/index.ts`) — expiry currently means auto-approval, not a distinct terminal state. The "EXPIRED cannot be cancelled" requirement is vacuously satisfied (no such status can ever be present) — do not invent a new enum value for it.
- Backend route verb: switch `:id/cancel` from `@Put` to `@Patch` to match the spec's explicit `PATCH /api/leave-requests/:id/cancel` contract. `:id/approve` and `:id/reject` stay on `@Put` (out of scope, unmentioned in the spec).

---

## Task 1: Fix ownership/status handling in `LeaveRequestsService.cancel()`

**Files:**
- Modify: `backend/src/modules/leave-requests/leave-requests.service.ts:519-588` (the `cancel` method)
- Modify: `backend/src/modules/leave-requests/leave-requests.controller.ts:1-12,144-152` (route decorator + import)

**Interfaces:**
- Consumes: existing `LeaveRequestStatus`, `ApprovalInstanceStatus`, `LedgerTransactionType`, `AuditActionType` enums from `backend/src/common/enums`; existing `this.applyLedger(em, request, type, performerId)` private method (unchanged signature).
- Produces: `cancel(employeeId: string, requestId: string): Promise<LeaveRequest>` — now throws `NotFoundException` (request truly doesn't exist), `ForbiddenException` (exists but belongs to someone else), or `ConflictException` (exists, owned, but already `CANCELLED`/`REJECTED`).

- [ ] **Step 1: Replace the `cancel` method body**

Current bug: the query filters `where: { id: requestId, employeeId }`, so a request owned by someone else is indistinguishable from a nonexistent one (always 404, never 403). Also: cancelling an already-`CANCELLED` request silently returns 200 with no error (violates the required 409 contract and is *only* an accidental duplicate-refund guard, not an intentional one).

Replace `backend/src/modules/leave-requests/leave-requests.service.ts:519-588` with:

```ts
  async cancel(employeeId: string, requestId: string) {
    return this.dataSource.transaction(async (em) => {
      // Pessimistic lock (no relations to avoid FOR UPDATE on outer joins)
      const requestLock = await em.findOne(LeaveRequest, {
        where: { id: requestId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!requestLock) throw new NotFoundException('Leave request not found');
      if (requestLock.employeeId !== employeeId) {
        throw new ForbiddenException('You do not own this leave request.');
      }

      // Reload with relations after acquiring the lock
      const request = await em.findOne(LeaveRequest, {
        where: { id: requestId },
        relations: { approvalInstances: true },
      })!

      if (!request) throw new NotFoundException('Leave request not found');
      if (
        request.status === LeaveRequestStatus.CANCELLED ||
        request.status === LeaveRequestStatus.REJECTED
      ) {
        throw new ConflictException('This leave request cannot be cancelled in its current status.');
      }

      const wasApproved = request.status === LeaveRequestStatus.APPROVED;

      // Skip all remaining steps
      const steps = request.approvalInstances || [];
      for (const s of steps) {
        if (s.status === ApprovalInstanceStatus.WAITING || s.status === ApprovalInstanceStatus.PENDING) {
          s.status = ApprovalInstanceStatus.SKIPPED;
          s.actionDate = new Date();
          await em.save(s);

          await this.auditService.log(
            employeeId,
            AuditActionType.APPROVAL_STEP_SKIPPED,
            'ApprovalInstance',
            s.id,
            { newValues: s },
            em,
          );
        }
      }

      // Set request to CANCELLED
      request.status = LeaveRequestStatus.CANCELLED;
      const saved = await em.save(request);

      // Load relations for description clarity
      const logRequest = await em.findOne(LeaveRequest, {
        where: { id: request.id },
        relations: { leaveType: true, employee: true },
      });

      // Audit request cancellation
      await this.auditService.log(
        employeeId,
        AuditActionType.LEAVE_REQUEST_CANCELLED,
        'LeaveRequest',
        request.id,
        { newValues: logRequest || request },
        em,
      );

      if (wasApproved) {
        // Reverse usage in ledger exactly once — unreachable on a second call
        // because the status check above now throws before we get here.
        await this.applyLedger(em, request, LedgerTransactionType.REVERSAL, employeeId);
      }

      return saved;
    });
  }
```

- [ ] **Step 2: Make the REVERSAL ledger description explicit, per spec example**

The spec requires a description like *"Cancellation of Annual Leave from 16/07/2026 to 20/07/2026"*. Update `applyLedger` at `backend/src/modules/leave-requests/leave-requests.service.ts:755-799` — only the `reason` line changes (this branch is exclusively reached from `cancel()`, so it's safe to make it descriptive without affecting the `USAGE` path used by `approveStep`/`processExpiredRequests`):

Replace:
```ts
      reason: type === LedgerTransactionType.USAGE ? 'Approved Leave Request' : 'Cancelled approved leave request',
```
with:
```ts
      reason:
        type === LedgerTransactionType.USAGE
          ? 'Approved Leave Request'
          : `Cancellation of ${leaveType.label} from ${formatDateDMY(request.startDate)} to ${formatDateDMY(request.endDate)}`,
```

Add this small helper near the top of the file (after the imports, before the `@Injectable()` class):
```ts
function formatDateDMY(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
```

- [ ] **Step 3: Switch the controller route from PUT to PATCH**

In `backend/src/modules/leave-requests/leave-requests.controller.ts:1-12`, add `Patch` to the existing `@nestjs/common` import:
```ts
import {
  Controller,
  Post,
  Body,
  Headers,
  UnauthorizedException,
  Param,
  Put,
  Patch,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
```

Then at `backend/src/modules/leave-requests/leave-requests.controller.ts:144-152`, change the decorator only:
```ts
  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel a pending or approved leave request' })
  cancel(
    @Headers('x-employee-id') employeeId: string,
    @Param('id') id: string,
  ) {
    if (!employeeId) throw new UnauthorizedException('Missing x-employee-id header');
    return this.service.cancel(employeeId, id);
  }
```

- [ ] **Step 4: Typecheck and build the backend**

Run: `cd backend && npx tsc -p . --noEmit`
Expected: no new errors introduced by this change (any pre-existing unrelated errors are out of scope).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/leave-requests/leave-requests.service.ts backend/src/modules/leave-requests/leave-requests.controller.ts
git commit -m "fix: distinguish 403/404/409 in leave request cancellation, use PATCH verb"
```

---

## Task 2: Backend unit tests for cancellation

**Files:**
- Modify: `backend/src/modules/leave-requests/leave-requests.service.spec.ts`

**Interfaces:**
- Consumes: `service.cancel(employeeId, requestId)` from Task 1; the existing shared `mockEm`/`mockLeaveRequest`/`mockDataSource` fixture already in this file's `beforeEach` (lines 32-101); `(service as any).applyLedger` which is globally spied to `mockResolvedValue({})` in that same `beforeEach` (line 100).
- Produces: nothing consumed by later tasks — this is leaf test coverage.

- [ ] **Step 1: Add imports needed for the new tests**

At the top of `backend/src/modules/leave-requests/leave-requests.service.spec.ts`, extend the existing enum import and add three entity imports (needed only by the dedicated `applyLedger` arithmetic test in Step 3):

```ts
import { LeaveBalance } from '../leave-balances/entities/leave-balance.entity';
import { LeaveType } from '../leave-types/entities/leave-type.entity';
import { LeaveLedgerEntry } from '../leave-balances/entities/leave-ledger-entry.entity';
```

- [ ] **Step 2: Add the "8. Cancellation" describe block**

Insert this new `describe` block right before the closing `});` that ends the outer `describe('LeaveRequestsService - ...')` block (i.e., after the existing `describe('7. Overlapping & Duplicate Leave Request Validation', ...)` block, which currently ends the file at line 436-437):

```ts
  describe('8. Cancellation', () => {
    it('owner can cancel a PENDING request and does not touch the ledger', async () => {
      mockLeaveRequest.status = LeaveRequestStatus.PENDING;
      mockLeaveRequest.approvalInstances = [
        { id: 'step-1', status: ApprovalInstanceStatus.PENDING, actionDate: null },
      ];

      const result = await service.cancel(mockEmpId, mockRequestId);

      expect(result.status).toBe(LeaveRequestStatus.CANCELLED);
      expect(mockLeaveRequest.approvalInstances[0].status).toBe(ApprovalInstanceStatus.SKIPPED);
      expect((service as any).applyLedger).not.toHaveBeenCalled();
    });

    it('owner can cancel an APPROVED request and it restores the balance via exactly one REVERSAL', async () => {
      mockLeaveRequest.status = LeaveRequestStatus.APPROVED;
      mockLeaveRequest.approvalInstances = [
        { id: 'step-1', status: ApprovalInstanceStatus.APPROVED, actionDate: new Date() },
      ];

      const result = await service.cancel(mockEmpId, mockRequestId);

      expect(result.status).toBe(LeaveRequestStatus.CANCELLED);
      expect((service as any).applyLedger).toHaveBeenCalledTimes(1);
      expect((service as any).applyLedger).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ id: mockRequestId, leaveTypeId: mockLeaveRequest.leaveTypeId }),
        LedgerTransactionType.REVERSAL,
        mockEmpId,
      );
    });

    it('a repeated cancellation cannot refund the balance twice', async () => {
      mockLeaveRequest.status = LeaveRequestStatus.APPROVED;
      mockLeaveRequest.approvalInstances = [];

      await service.cancel(mockEmpId, mockRequestId);
      expect((service as any).applyLedger).toHaveBeenCalledTimes(1);

      await expect(service.cancel(mockEmpId, mockRequestId)).rejects.toThrow(ConflictException);
      expect((service as any).applyLedger).toHaveBeenCalledTimes(1); // still only once
    });

    it('an employee cannot cancel another employee\'s request', async () => {
      mockLeaveRequest.status = LeaveRequestStatus.PENDING;
      mockLeaveRequest.approvalInstances = [];

      await expect(service.cancel('someone-else-id', mockRequestId)).rejects.toThrow(ForbiddenException);
      expect((service as any).applyLedger).not.toHaveBeenCalled();
    });

    it('a REJECTED request cannot be cancelled', async () => {
      mockLeaveRequest.status = LeaveRequestStatus.REJECTED;
      await expect(service.cancel(mockEmpId, mockRequestId)).rejects.toThrow(ConflictException);
    });

    it('an already-CANCELLED request cannot be cancelled again', async () => {
      mockLeaveRequest.status = LeaveRequestStatus.CANCELLED;
      await expect(service.cancel(mockEmpId, mockRequestId)).rejects.toThrow(ConflictException);
    });

    it('cancelling a non-existent request throws NotFoundException', async () => {
      mockEm.findOne = jest.fn().mockResolvedValue(null);
      await expect(service.cancel(mockEmpId, 'missing-id')).rejects.toThrow(NotFoundException);
    });
  });
```

- [ ] **Step 3: Add the "9. applyLedger REVERSAL arithmetic" describe block, exercising the real (unmocked) implementation**

The tests above rely on the global `applyLedger` spy from `beforeEach` (line 100), so they never exercise its real math. Add this block right after the one from Step 2, in the same file:

```ts
  describe('9. applyLedger REVERSAL arithmetic (real implementation, not the spy)', () => {
    it('restores the exact number of cancelled days, creates exactly one REVERSAL entry, and writes a clear description', async () => {
      (service as any).applyLedger.mockRestore();

      const request: any = {
        id: mockRequestId,
        employeeId: mockEmpId,
        leaveTypeId: 'lt-uuid-8888',
        startDate: '2026-07-16',
        endDate: '2026-07-20',
        durationDays: 5,
      };
      const balance: any = {
        id: 'bal-1',
        employeeId: mockEmpId,
        leaveTypeId: 'lt-uuid-8888',
        year: 2026,
        availableBalance: 10,
        usedYtd: 0,
      };
      const leaveType: any = { id: 'lt-uuid-8888', label: 'Annual Leave', trackingMode: 'AVAILABLE_BALANCE' };
      const ledgerCreateSpy = jest.fn().mockImplementation((_entity, dto) => ({ id: 'ledger-1', ...dto }));

      const localEm: any = {
        findOne: jest.fn().mockImplementation((entity) => {
          if (entity === LeaveBalance) return Promise.resolve(balance);
          if (entity === LeaveType) return Promise.resolve(leaveType);
          return Promise.resolve(null);
        }),
        create: jest.fn().mockImplementation((entity, dto) =>
          entity === LeaveLedgerEntry ? ledgerCreateSpy(entity, dto) : { ...dto },
        ),
        save: jest.fn().mockImplementation((item) => Promise.resolve(item)),
      };

      await (service as any).applyLedger(localEm, request, LedgerTransactionType.REVERSAL, mockEmpId);

      expect(balance.availableBalance).toBe(15); // 10 restored + 5 reversed
      expect(ledgerCreateSpy).toHaveBeenCalledTimes(1);
      const ledgerDto = ledgerCreateSpy.mock.calls[0][1];
      expect(ledgerDto.transactionType).toBe(LedgerTransactionType.REVERSAL);
      expect(ledgerDto.signedAmount).toBe(5);
      expect(ledgerDto.leaveTypeId).toBe('lt-uuid-8888');
      expect(ledgerDto.referenceId).toBe(mockRequestId);
      expect(ledgerDto.reason).toBe('Cancellation of Annual Leave from 16/07/2026 to 20/07/2026');
    });
  });
```

- [ ] **Step 4: Run the backend test file and verify it's green**

Run: `cd backend && npx jest src/modules/leave-requests/leave-requests.service.spec.ts`
Expected: all tests pass (the pre-existing 1-7 blocks plus new 8-9).

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/leave-requests/leave-requests.service.spec.ts
git commit -m "test: cover leave request cancellation ownership, status, and ledger reversal rules"
```

---

## Task 3: Verify full backend suite

- [ ] **Step 1:** Run `cd backend && npm run test` — record pass/fail counts.
- [ ] **Step 2:** Run `cd backend && npm run test:e2e` — record pass/fail counts (note if it requires a live Postgres connection per `backend/.env`).
- [ ] **Step 3:** Run `cd backend && npm run build` — record output.
- [ ] **Step 4:** Run `cd backend && npm run lint` — record output.

No commit for this task — it's verification only, feeding into the Task 8 walkthrough.

---

## Task 4: Configure Vitest + React Testing Library

**Files:**
- Modify: `package.json` (root)
- Modify: `vite.config.ts`
- Create: `src/test/setup.ts`

**Interfaces:**
- Produces: a working `npm run test` (root) command that runs `vitest run`; a `src/test/setup.ts` imported by every future `*.test.tsx` file implicitly via the Vitest config (no per-file import needed).

- [ ] **Step 1: Install devDependencies**

```bash
npm install --save-dev vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

- [ ] **Step 2: Add the setup file**

Create `src/test/setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 3: Wire Vitest into `vite.config.ts`**

Replace `vite.config.ts` in full:
```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
```

- [ ] **Step 4: Add the `test` script**

In `package.json`, add to `"scripts"`:
```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 5: Verify the harness itself works with a throwaway smoke test**

Create a temporary file `src/test/smoke.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('vitest + RTL harness', () => {
  it('renders a basic element', () => {
    render(<div>hello</div>);
    expect(screen.getByText('hello')).toBeInTheDocument();
  });
});
```
Run: `npm run test`
Expected: 1 passed test.
Then delete `src/test/smoke.test.tsx` — it was only to prove the harness works; Task 6 adds the real test file.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vite.config.ts src/test/setup.ts
git commit -m "chore: configure Vitest and React Testing Library for the frontend"
```

---

## Task 5: Wire the real cancel flow into `MyInfo.tsx`

**Files:**
- Modify: `src/pages/MyInfo.tsx`

**Interfaces:**
- Consumes: `apiFetch` from `src/services/apiClient.ts` (existing); `ConfirmModal` from `src/admin/components/ui/ConfirmModal.tsx` (existing, props: `isOpen, onClose, onConfirm, title, message, confirmLabel?, danger?, confirming?`); the existing `'leave-request-submitted'` window event.
- Produces: no new exports — this is a leaf page component. The row-level trigger button gets `disabled={cancellingId === req.id}` so Task 6's tests can assert on it directly.

- [ ] **Step 1: Add new imports and state**

At the top of `src/pages/MyInfo.tsx`, add the `ConfirmModal` import next to the existing `SlideDrawer` import:
```ts
import ConfirmModal from '../admin/components/ui/ConfirmModal';
```

Replace the static ledger state (`const [ledger] = useState(leaveLedgerList);`) with a settable one, and add cancellation/toast state, right after the existing `useState` calls (around line 10-18):
```ts
  const [ledger, setLedger] = useState<any[]>(leaveLedgerList);
  const [cancelTarget, setCancelTarget] = useState<any | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
```
(Remove the old `const [ledger] = useState(leaveLedgerList);` line entirely — it's being replaced by the line above.)

- [ ] **Step 2: Auto-dismiss the toast**

Add this `useEffect` right after the existing data-loading `useEffect` (after its closing `}, []);` around line 66):
```ts
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);
```

- [ ] **Step 3: Fetch the real ledger and resolve leave-type codes for filtering**

Inside the existing `loadData` function (`src/pages/MyInfo.tsx:20-66`), the current `Promise.all` only fetches three endpoints. Replace the whole `loadData` function body with:

```ts
    async function loadData() {
      try {
        let currentUserId: string | undefined;
        try {
          const stored = localStorage.getItem('currentUser');
          if (stored) currentUserId = JSON.parse(stored)?.id;
        } catch {
          // ignore malformed localStorage
        }

        const [realRequests, realBalancesData, meData, realLedgerData] = await Promise.all([
          apiFetch<any[]>('/leave-requests/my-requests').catch(() => null),
          apiFetch<any>('/employees/me/leave-balances').catch(() => null),
          apiFetch<any>('/employees/me').catch(() => null),
          currentUserId
            ? apiFetch<{ data: any[] }>(`/leave-balances/ledger?employeeId=${currentUserId}&limit=50`).catch(() => null)
            : Promise.resolve(null),
        ]);

        if (meData) {
          setProfile(meData);
        }

        if (realRequests && realRequests.length > 0) {
          const mapped = realRequests.map((r) => ({
            id: r.id,
            leaveType: r.leaveType?.key || r.leaveType?.label || 'annual',
            leaveTypeId: r.leaveTypeId,
            leaveTypeName: r.leaveType?.label || r.leaveType?.key || 'Annual Leave',
            startDate: r.startDate,
            endDate: r.endDate,
            note: r.reason || '',
            submittedDate: r.createdAt || new Date().toISOString(),
            approverComments: r.approvalInstances?.map((ai: any) => ai.decisionNote).filter(Boolean).join('; ') || '',
            status: r.status ? r.status.toLowerCase() : 'pending',
            totalDays: r.durationDays,
            approvalInstances: r.approvalInstances || [],
            rejectionReason: r.rejectionReason,
            currentStepOrder: r.currentStepOrder,
            totalRequiredSteps: r.totalRequiredSteps,
            currentApproverLabel: r.currentApproverLabel,
            updatedAt: r.updatedAt,
          }));
          setRequests(mapped);
        }

        let resolvedBalances = balances;
        if (realBalancesData && realBalancesData.balances && realBalancesData.balances.length > 0) {
          resolvedBalances = realBalancesData.balances;
          setBalances(resolvedBalances);
        }

        if (realLedgerData?.data) {
          const typeIdToCode: Record<string, string> = {};
          resolvedBalances.forEach((b: any) => {
            if (b.leaveTypeId) typeIdToCode[b.leaveTypeId] = b.code || b.leaveType || b.leaveTypeId;
          });

          const mappedLedger = realLedgerData.data.map((l: any) => ({
            date: new Date(l.createdAt).toLocaleDateString('en-GB'),
            description: l.description,
            leaveType: typeIdToCode[l.leaveTypeId] || l.leaveTypeId,
            used: l.usedDays || 0,
            earned: l.earnedDays || 0,
            runningBalance: l.balanceAfter,
          }));
          setLedger(mappedLedger);
        }
      } catch (err) {
        console.error('Failed to load real MyInfo data:', err);
      }
    }
```

(This is the same function, just with the ledger fetch/mapping added and `updatedAt` carried through on requests — every other line is unchanged from the current file.)

- [ ] **Step 4: Replace `handleCancel` with the real confirm-and-call flow**

Replace the existing `handleCancel` function (`src/pages/MyInfo.tsx:85-89`) — leave `handleRecall` untouched — with:

```ts
  async function handleConfirmCancel() {
    if (!cancelTarget || cancellingId) return;
    const target = cancelTarget;
    setCancellingId(target.id);
    try {
      await apiFetch(`/leave-requests/${target.id}/cancel`, { method: 'PATCH' });
      setToast({ message: 'Leave request cancelled successfully.', type: 'success' });
      window.dispatchEvent(new Event('leave-request-submitted'));
    } catch (err: any) {
      setToast({ message: err?.message || 'Failed to cancel leave request.', type: 'error' });
    } finally {
      setCancellingId(null);
      setCancelTarget(null);
    }
  }
```

- [ ] **Step 5: Gate the Cancel button by status, disable it while in flight, and open the confirm dialog**

In the Actions cell (`src/pages/MyInfo.tsx:339-363`), replace the Cancel `<button>` (lines 355-361) with a status-gated, disable-aware version:

```tsx
                            {(req.status === 'pending' || req.status === 'approved') && (
                              <button
                                onClick={() => setCancelTarget(req)}
                                disabled={cancellingId === req.id}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                title="Cancel request"
                              >
                                <XCircle size={14} />
                              </button>
                            )}
```

- [ ] **Step 6: Show CANCELLED distinctly in the status badge, plus the cancellation date**

Replace the status badge cell (`src/pages/MyInfo.tsx:327-335`):
```tsx
                        <td className="py-3 px-4 text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            req.status === 'approved'  ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                            req.status === 'pending'   ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                            req.status === 'cancelled' ? 'bg-slate-100 text-slate-500 border border-slate-200' :
                            'bg-red-50 text-red-700 border border-red-100'
                          }`}>
                            {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                          </span>
                          {req.status === 'cancelled' && req.updatedAt && (
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              Cancelled {new Date(req.updatedAt).toLocaleDateString('en-GB')}
                            </p>
                          )}
                        </td>
```

- [ ] **Step 7: Update the ledger table's data source variable**

The ledger table render (`src/pages/MyInfo.tsx:371-372` area) currently reads `const filteredLedger = ledger.filter((l) => l.leaveType === selectedLeaveType);` — this already works unchanged since `ledger` is now state instead of a plain const (same variable name, no other edits needed here).

- [ ] **Step 8: Render the toast and the confirm dialog**

Add the toast banner and `ConfirmModal` right before the final closing `</div>` of the component (after the closing `</div>` of the History & Ledger card, i.e. right before `src/pages/MyInfo.tsx:448`'s final `</div>`):

```tsx
      {/* Toast Alert Banner */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-lg transition-all duration-300 ${toast.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-red-50 border-red-100 text-red-800'}`}>
          <span className="text-xs font-semibold">{toast.message}</span>
        </div>
      )}

      {/* Cancel Confirmation */}
      <ConfirmModal
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleConfirmCancel}
        title="Cancel Leave Request"
        message={
          cancelTarget?.status === 'approved'
            ? 'Are you sure you want to cancel this leave request? The deducted leave days will be restored to your balance.'
            : 'Are you sure you want to cancel this leave request?'
        }
        confirmLabel="Cancel Request"
        danger
        confirming={!!cancelTarget && cancellingId === cancelTarget.id}
      />
```

- [ ] **Step 9: Typecheck**

Run: `npx tsc -b`
Expected: no new errors introduced in `src/pages/MyInfo.tsx` (pre-existing unrelated errors elsewhere are out of scope).

- [ ] **Step 10: Commit**

```bash
git add src/pages/MyInfo.tsx
git commit -m "feat: wire real leave request cancellation into My Info, with confirm dialog and live Balance History"
```

---

## Task 6: Frontend unit tests for the cancel flow

**Files:**
- Create: `src/pages/MyInfo.test.tsx`

**Interfaces:**
- Consumes: `MyInfo` default export from `src/pages/MyInfo.tsx` (Task 5); mocks `apiFetch` from `src/services/apiClient.ts`.

- [ ] **Step 1: Write the test file**

Create `src/pages/MyInfo.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MyInfo from './MyInfo';
import { apiFetch } from '../services/apiClient';

vi.mock('../services/apiClient', () => ({
  apiFetch: vi.fn(),
}));

const mockedApiFetch = vi.mocked(apiFetch);

const baseRequest = {
  id: 'req-1',
  leaveType: { key: 'annual', label: 'Annual Leave' },
  leaveTypeId: 'lt-1',
  startDate: '2026-07-16',
  endDate: '2026-07-20',
  reason: 'Family trip',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
  approvalInstances: [],
  durationDays: 5,
  status: 'PENDING',
};

function mockApi(requests: any[]) {
  mockedApiFetch.mockImplementation((endpoint: string) => {
    if (endpoint.startsWith('/leave-requests/my-requests')) return Promise.resolve(requests);
    if (endpoint.startsWith('/employees/me/leave-balances')) return Promise.resolve({ balances: [] });
    if (endpoint.startsWith('/employees/me')) return Promise.resolve({ id: 'emp-1', fullName: 'Test User' });
    if (endpoint.startsWith('/leave-balances/ledger')) return Promise.resolve({ data: [] });
    if (endpoint.includes('/cancel')) return Promise.resolve({ ...requests[0], status: 'CANCELLED' });
    return Promise.resolve(null);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.setItem('currentUser', JSON.stringify({ id: 'emp-1' }));
});

describe('MyInfo — leave request cancellation', () => {
  it('shows the Cancel action for a PENDING request', async () => {
    mockApi([{ ...baseRequest, status: 'PENDING' }]);
    render(<MyInfo />);

    expect(await screen.findByTitle('Cancel request')).toBeInTheDocument();
  });

  it('shows the Cancel action for an APPROVED request', async () => {
    mockApi([{ ...baseRequest, status: 'APPROVED' }]);
    render(<MyInfo />);

    expect(await screen.findByTitle('Cancel request')).toBeInTheDocument();
  });

  it('hides the Cancel action for a REJECTED request', async () => {
    mockApi([{ ...baseRequest, status: 'REJECTED' }]);
    render(<MyInfo />);

    await screen.findByText('Rejected');
    expect(screen.queryByTitle('Cancel request')).not.toBeInTheDocument();
  });

  it('hides the Cancel action for an already-CANCELLED request', async () => {
    mockApi([{ ...baseRequest, status: 'CANCELLED' }]);
    render(<MyInfo />);

    await screen.findByText('Cancelled');
    expect(screen.queryByTitle('Cancel request')).not.toBeInTheDocument();
  });

  it('opens a confirmation dialog and only calls the cancel API after confirming', async () => {
    const user = userEvent.setup();
    mockApi([{ ...baseRequest, status: 'PENDING' }]);
    render(<MyInfo />);

    await user.click(await screen.findByTitle('Cancel request'));

    const dialog = await screen.findByText('Cancel Leave Request');
    expect(dialog).toBeInTheDocument();
    expect(mockedApiFetch).not.toHaveBeenCalledWith(
      expect.stringContaining('/cancel'),
      expect.anything(),
    );

    await user.click(screen.getByRole('button', { name: 'Cancel Request' }));

    await waitFor(() => {
      expect(mockedApiFetch).toHaveBeenCalledWith('/leave-requests/req-1/cancel', { method: 'PATCH' });
    });
  });

  it('disables the row action while a cancellation is in flight and prevents a second submission', async () => {
    const user = userEvent.setup();
    mockApi([{ ...baseRequest, status: 'PENDING' }]);

    let resolveCancel: (v: any) => void;
    mockedApiFetch.mockImplementation((endpoint: string) => {
      if (endpoint.includes('/cancel')) {
        return new Promise((resolve) => { resolveCancel = resolve; });
      }
      if (endpoint.startsWith('/leave-requests/my-requests')) return Promise.resolve([{ ...baseRequest, status: 'PENDING' }]);
      if (endpoint.startsWith('/employees/me/leave-balances')) return Promise.resolve({ balances: [] });
      if (endpoint.startsWith('/employees/me')) return Promise.resolve({ id: 'emp-1', fullName: 'Test User' });
      if (endpoint.startsWith('/leave-balances/ledger')) return Promise.resolve({ data: [] });
      return Promise.resolve(null);
    });

    render(<MyInfo />);
    await user.click(await screen.findByTitle('Cancel request'));
    await user.click(screen.getByRole('button', { name: 'Cancel Request' }));

    await waitFor(() => {
      expect(screen.getByTitle('Cancel request')).toBeDisabled();
    });
    expect(mockedApiFetch).toHaveBeenCalledTimes(5); // 4 initial loads + 1 cancel call, not 2

    resolveCancel!({ status: 'CANCELLED' });
  });

  it('refreshes request data after a successful cancellation', async () => {
    const user = userEvent.setup();
    mockApi([{ ...baseRequest, status: 'PENDING' }]);
    render(<MyInfo />);

    const callsBefore = mockedApiFetch.mock.calls.filter((c) => String(c[0]).startsWith('/leave-requests/my-requests')).length;

    await user.click(await screen.findByTitle('Cancel request'));
    await user.click(screen.getByRole('button', { name: 'Cancel Request' }));

    await waitFor(() => {
      const callsAfter = mockedApiFetch.mock.calls.filter((c) => String(c[0]).startsWith('/leave-requests/my-requests')).length;
      expect(callsAfter).toBeGreaterThan(callsBefore);
    });
  });
});
```

- [ ] **Step 2: Run it**

Run: `npm run test -- src/pages/MyInfo.test.tsx`
Expected: all 7 tests pass. If the "disables the row action" test's exact call count (5) doesn't match due to timing, adjust the assertion to check the four fixed endpoints were each called once plus one `/cancel` call, rather than a hardcoded total.

- [ ] **Step 3: Commit**

```bash
git add src/pages/MyInfo.test.tsx
git commit -m "test: cover My Info leave request cancellation UI flow"
```

---

## Task 7: Verify full frontend suite

- [ ] **Step 1:** Run `npm run test` (root) — record pass/fail counts.
- [ ] **Step 2:** Run `npm run build` — record output.
- [ ] **Step 3:** Run `npm run lint` — record output.
- [ ] **Step 4:** Run `npx tsc --noEmit` — record output.

No commit for this task — verification only, feeding into Task 8.

---

## Task 8: Write `walkthrough.md`

**Files:**
- Create: `walkthrough.md` (repo root)

- [ ] **Step 1:** Write a walkthrough covering: files modified/created (Tasks 1, 2, 4, 5, 6), the business rules covered (ownership, PENDING/APPROVED cancellable, REJECTED/CANCELLED rejected with 409, ledger reversal math, idempotency), and the **actual** command outputs captured in Tasks 3 and 7 (paste real pass/fail counts, not estimates). Explicitly call out the known limitation: the ledger→Balance-History mapping in `MyInfo.tsx` resolves leave-type codes client-side from the balances list; if an employee has a ledger entry for a leave type no longer in their active policy, it will display the raw UUID as a fallback instead of a label — pre-existing risk, not introduced by this change but newly exposed since the tab is now live.

- [ ] **Step 2: Commit**

```bash
git add walkthrough.md
git commit -m "docs: add walkthrough for leave request cancellation feature"
```

---

## Self-Review Notes

- **Spec coverage:** Ownership (Task 1) — 403 vs 404 vs 409 (Task 1) — PENDING cancel doesn't touch balance (Task 1, tested in Task 2) — APPROVED cancel restores exact days via one REVERSAL (Task 1, tested in Task 2/9) — never restores to the wrong leave type (Task 2 test asserts `leaveTypeId` passed through unchanged) — clear ledger description (Task 1 Step 2, tested in Task 2) — linked to original request via `referenceId` (already existing, tested in Task 2) — duplicate-refund prevention (Task 1, tested in Task 2) — PATCH endpoint with 200/403/404/409 (Task 1) — transaction wrapping (already existing `dataSource.transaction`, unchanged) — frontend cancel action + gating (Task 5) — confirmation dialog with approved-specific copy (Task 5 Step 8) — disable while processing + no double submit (Task 5 Steps 4-5, tested in Task 6) — toast (Task 5 Step 8) — refresh everywhere via the existing `leave-request-submitted` event, including now-live Balance History (Task 5 Steps 1-3) — CANCELLED display + cancellation date, removed from Who's Out/calendar for free since the backend already excludes `CANCELLED` from `getWhosOut()` (Task 5 Step 6) — unit tests both sides (Tasks 2, 6) — real command output in `walkthrough.md` (Task 8).
- **Placeholder scan:** none found — every step has literal code, not descriptions.
- **Type consistency:** `cancel(employeeId: string, requestId: string)` signature unchanged from the existing method throughout; `handleConfirmCancel`/`cancelTarget`/`cancellingId` names used consistently between Task 5's steps and Task 6's tests.
