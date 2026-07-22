# Design: Excel (.xlsx) and PDF worker reports

Date: 2026-07-22  
Status: approved in chat (content A, libs exceljs + pdfkit)

## Goal

In admin flow **📊 Отчеты** / `/reports`, after worker + period selection, add two export buttons alongside existing Text and CSV:

- Excel (`.xlsx`)
- PDF (`.pdf`)

Both exports use the **same tabular content as CSV** (option A).

## Content (both formats)

Header:

- Worker full name
- Period label (1 day / week / 1–6 months)

Table columns (same as CSV):

1. Номер  
2. Название  
3. Описание  
4. Категория  
5. Статус  
6. Приоритет  
7. Создана  
8. Завершена  

Empty ticket list: still produce a valid file with header + “нет заявок” note (or empty table with headers only).

## UX

`reportFormatKeyboard` buttons (2 rows):

1. Текстовый отчет | CSV файл  
2. Excel (.xlsx) | PDF  
3. Отмена  

Callbacks:

- `report_xlsx_<workerId>_<period>`
- `report_pdf_<workerId>_<period>`

Send via `replyWithDocument` with caption (same pattern as CSV).

## Implementation

| Piece | Change |
|--------|--------|
| Dependencies | `exceljs`, `pdfkit`, `@types/pdfkit` (dev) |
| `ReportService` | `generateXlsxReport()`, `generatePdfReport()` → `Buffer` |
| `report.handler.ts` | two `bot.action` handlers mirroring CSV |
| `report.keyboard.ts` | add Excel/PDF buttons |
| Invariants | assert keyboard has `report_xlsx_` / `report_pdf_` |

Shared data path: reuse `getWorkerStats` / ticket list already used by CSV (no new DB queries beyond existing report repo).

## Out of scope

- Charts, styling beyond basic header/table  
- Excel/PDF for non-admin roles  
- Changing Text/CSV behavior  

## Verification

1. Admin → Отчеты → worker → period → Excel downloads and opens in Excel.  
2. Same path → PDF opens and shows table.  
3. Period with zero tickets still returns a file.  
4. Existing Text + CSV still work.  
5. `npm run build` + `check-bot-invariants.js` pass.
