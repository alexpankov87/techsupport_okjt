#!/usr/bin/env node
/** Self-check: xlsx/pdf generators produce non-empty buffers. */
const assert = require('assert');
const path = require('path');

async function main() {
  const { ReportService } = require(path.join(__dirname, '..', 'dist', 'services', 'ReportService.js'));

  const fakeTickets = [
    {
      number: 'OKZ-0001',
      title: 'Принтер',
      description: 'Не печатает',
      category: 'printer',
      status: 'completed',
      priority: 'medium',
      createdAt: new Date('2026-07-01T10:00:00Z'),
      resolvedAt: new Date('2026-07-01T12:00:00Z'),
    },
  ];

  const reportRepo = {
    async getWorkerStats() {
      return {
        total: 1,
        completed: 1,
        unresolved: 0,
        inProgress: 0,
        avgTimeMinutes: 120,
        tickets: fakeTickets,
      };
    },
  };
  const userService = {
    async getUserById() {
      return { firstName: 'Иван', lastName: 'Тестов' };
    },
  };

  const svc = new ReportService(reportRepo, userService);
  const xlsx = await svc.generateXlsxReport('507f1f77bcf86cd799439011', '1month');
  assert.ok(Buffer.isBuffer(xlsx) && xlsx.length > 100, 'xlsx buffer');
  // zip/xlsx magic
  assert.strictEqual(xlsx[0], 0x50);
  assert.strictEqual(xlsx[1], 0x4b);
  console.log('OK: xlsx buffer');

  const pdf = await svc.generatePdfReport('507f1f77bcf86cd799439011', '1month');
  assert.ok(Buffer.isBuffer(pdf) && pdf.length > 100, 'pdf buffer');
  assert.strictEqual(pdf.slice(0, 4).toString(), '%PDF');
  console.log('OK: pdf buffer');

  const kb = require('fs').readFileSync(
    path.join(__dirname, '..', 'src', 'bot', 'keyboards', 'report.keyboard.ts'),
    'utf8',
  );
  assert.ok(kb.includes('report_xlsx_'), 'keyboard xlsx');
  assert.ok(kb.includes('report_pdf_'), 'keyboard pdf');
  console.log('OK: keyboard has excel/pdf buttons');

  console.log('All excel/pdf report checks passed');
}

main().catch((e) => {
  console.error('FAIL:', e);
  process.exit(1);
});
