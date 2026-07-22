# Excel/PDF Worker Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or implement task-by-task in-session.

**Goal:** Add Excel (.xlsx) and PDF export buttons to admin worker reports with the same tabular fields as CSV.

**Architecture:** Extend `ReportService` with `generateXlsxReport` / `generatePdfReport` returning Buffers; wire two new callback actions mirroring CSV; add buttons to `reportFormatKeyboard`.

**Tech Stack:** exceljs, pdfkit, Telegraf `replyWithDocument`, existing ReportRepository stats.

## Global Constraints

- Content = CSV columns + header (worker name, period) — option A from spec.
- Keep Text + CSV unchanged.
- Admin/super-admin only (existing report flow).

---

### Task 1: Dependencies + ReportService generators

**Files:**
- Modify: `package.json` (via npm install)
- Modify: `src/services/ReportService.ts`

- [ ] Install `exceljs`, `pdfkit`, `@types/pdfkit`
- [ ] Add shared row mapper from tickets (same fields as CSV)
- [ ] Implement `generateXlsxReport` → Buffer via ExcelJS
- [ ] Implement `generatePdfReport` → Buffer via PDFKit
- [ ] `npm run build`

### Task 2: Keyboard + handlers + invariant

**Files:**
- Modify: `src/bot/keyboards/report.keyboard.ts`
- Modify: `src/bot/handlers/report.handler.ts`
- Modify: `scripts/check-bot-invariants.js`

- [ ] Add Excel/PDF buttons (`report_xlsx_`, `report_pdf_`)
- [ ] Add handlers sending documents like CSV
- [ ] Assert callbacks exist in invariants
- [ ] Build + run checks
- [ ] Commit (when user asks to push)
