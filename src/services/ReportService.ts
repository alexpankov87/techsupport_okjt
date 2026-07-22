import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import { ReportRepository, ReportFilter } from '../repositories/ReportRepository';
import { UserService } from './UserService';
import { ITicket } from '../models';
import { logger } from '../utils/logger';

const PERIOD_LABEL: Record<ReportFilter['period'], string> = {
  day: '1 день',
  week: '7 дней',
  '1month': '1 месяц',
  '2months': '2 месяца',
  '3months': '3 месяца',
  '6months': '6 месяцев',
};

const COLUMNS = [
  'Номер',
  'Название',
  'Описание',
  'Категория',
  'Статус',
  'Приоритет',
  'Создана',
  'Завершена',
] as const;

type ReportRow = {
  number: string;
  title: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  createdAt: string;
  resolvedAt: string;
};

function ticketRows(tickets: ITicket[]): ReportRow[] {
  return tickets.map((ticket) => ({
    number: ticket.number,
    title: ticket.title,
    description: ticket.description || '',
    category: String(ticket.category),
    status: String(ticket.status),
    priority: String(ticket.priority),
    createdAt: ticket.createdAt.toISOString(),
    resolvedAt: ticket.resolvedAt ? ticket.resolvedAt.toISOString() : '',
  }));
}

function resolveCyrillicFont(): string | undefined {
  const candidates = [
    path.join(__dirname, '../../assets/fonts/DejaVuSans.ttf'),
    path.join(process.cwd(), 'assets/fonts/DejaVuSans.ttf'),
    '/usr/share/fonts/ttf-dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/usr/share/fonts/TTF/DejaVuSans.ttf',
    'C:/Windows/Fonts/arial.ttf',
    'C:/Windows/Fonts/segoeui.ttf',
  ];
  return candidates.find((p) => fs.existsSync(p));
}

export class ReportService {
  constructor(
    private readonly reportRepository: ReportRepository,
    private readonly userService: UserService,
  ) {}

  async generateReport(workerId: string, period: ReportFilter['period']): Promise<string> {
    const worker = await this.userService.getUserById(workerId);

    const stats = await this.reportRepository.getWorkerStats({
      workerId,
      period,
    });

    const avgHours = Math.floor(stats.avgTimeMinutes / 60);
    const avgMinutes = stats.avgTimeMinutes % 60;

    let report = `📊 Отчет по сотруднику\n\n`;
    report += `👤 ${worker.firstName} ${worker.lastName || ''}\n`;
    report += `📅 Период: ${PERIOD_LABEL[period]}\n`;
    report += `──────────────────\n`;
    report += `📋 Всего заявок: ${stats.total}\n`;
    report += `✅ Завершено: ${stats.completed}\n`;
    report += `❌ Не решено: ${stats.unresolved}\n`;
    report += `🔧 В работе: ${stats.inProgress}\n`;
    report += `⏱ Среднее время: ${avgHours}ч ${avgMinutes}мин\n`;
    report += `──────────────────\n\n`;

    if (stats.tickets.length > 0) {
      report += `📋 Список заявок:\n\n`;
      stats.tickets.forEach((ticket, index) => {
        const statusEmoji: Record<string, string> = {
          new: '🆕',
          assigned: '📌',
          in_progress: '🔧',
          resolved: '✅',
          unresolved: '❌',
          completed: '🏁',
          cancelled: '🚫',
        };

        report += `${index + 1}. ${statusEmoji[ticket.status]} ${ticket.number} - ${ticket.title}\n`;
        report += `   📂 ${ticket.category} | 📅 ${ticket.createdAt.toLocaleDateString()}\n`;

        if (ticket.resolvedAt) {
          const time = Math.round(
            (ticket.resolvedAt.getTime() - ticket.createdAt.getTime()) / (1000 * 60),
          );
          const hours = Math.floor(time / 60);
          const minutes = time % 60;
          report += `   ⏱ Время выполнения: ${hours}ч ${minutes}мин\n`;
        }
        report += `\n`;
      });
    }

    return report;
  }

  async generateCSVReport(workerId: string, period: ReportFilter['period']): Promise<string> {
    await this.userService.getUserById(workerId);
    const stats = await this.reportRepository.getWorkerStats({ workerId, period });
    const rows = ticketRows(stats.tickets);

    let csv = `${COLUMNS.join(',')}\n`;
    for (const row of rows) {
      csv += `"${row.number}",`;
      csv += `"${row.title.replace(/"/g, '""')}",`;
      csv += `"${row.description.replace(/"/g, '""')}",`;
      csv += `"${row.category}",`;
      csv += `"${row.status}",`;
      csv += `"${row.priority}",`;
      csv += `"${row.createdAt}",`;
      csv += `"${row.resolvedAt}"\n`;
    }
    return csv;
  }

  async generateXlsxReport(workerId: string, period: ReportFilter['period']): Promise<Buffer> {
    const worker = await this.userService.getUserById(workerId);
    const stats = await this.reportRepository.getWorkerStats({ workerId, period });
    const rows = ticketRows(stats.tickets);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'techsupport_okjt';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Заявки');
    sheet.addRow([`Сотрудник: ${worker.firstName} ${worker.lastName || ''}`.trim()]);
    sheet.addRow([`Период: ${PERIOD_LABEL[period]}`]);
    sheet.addRow([]);
    sheet.addRow([...COLUMNS]);

    for (const row of rows) {
      sheet.addRow([
        row.number,
        row.title,
        row.description,
        row.category,
        row.status,
        row.priority,
        row.createdAt,
        row.resolvedAt,
      ]);
    }

    if (rows.length === 0) {
      sheet.addRow(['Нет заявок за период']);
    }

    sheet.getColumn(1).width = 12;
    sheet.getColumn(2).width = 28;
    sheet.getColumn(3).width = 40;
    sheet.getColumn(4).width = 14;
    sheet.getColumn(5).width = 14;
    sheet.getColumn(6).width = 12;
    sheet.getColumn(7).width = 22;
    sheet.getColumn(8).width = 22;

    const buf = await workbook.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  async generatePdfReport(workerId: string, period: ReportFilter['period']): Promise<Buffer> {
    const worker = await this.userService.getUserById(workerId);
    const stats = await this.reportRepository.getWorkerStats({ workerId, period });
    const rows = ticketRows(stats.tickets);
    const fontPath = resolveCyrillicFont();

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          margin: 36,
          size: 'A4',
          layout: 'landscape',
        });
        const chunks: Buffer[] = [];
        doc.on('data', (c) => chunks.push(c as Buffer));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        if (fontPath) {
          doc.font(fontPath);
        } else {
          logger.warn('Cyrillic font not found for PDF; text may render incorrectly');
          doc.font('Helvetica');
        }

        doc.fontSize(14).text(
          `Отчет по сотруднику: ${worker.firstName} ${worker.lastName || ''}`.trim(),
        );
        doc.fontSize(11).text(`Период: ${PERIOD_LABEL[period]}`);
        doc.moveDown(0.5);

        const colWidths = [70, 120, 180, 70, 70, 60, 100, 100];
        const startX = doc.x;
        let y = doc.y;

        const drawRow = (cells: string[], header = false) => {
          const fontSize = header ? 8 : 7;
          doc.fontSize(fontSize);
          let x = startX;
          const heights = cells.map((cell, i) =>
            doc.heightOfString(cell || '—', { width: colWidths[i] - 4 }),
          );
          const rowH = Math.max(14, ...heights) + 4;
          if (y + rowH > doc.page.height - 36) {
            doc.addPage();
            y = doc.y;
          }
          cells.forEach((cell, i) => {
            doc.text(cell || '—', x + 2, y + 2, {
              width: colWidths[i] - 4,
              height: rowH - 2,
              ellipsis: true,
            });
            x += colWidths[i];
          });
          y += rowH;
          doc.x = startX;
          doc.y = y;
        };

        drawRow([...COLUMNS], true);
        if (rows.length === 0) {
          drawRow(['Нет заявок за период', '', '', '', '', '', '', '']);
        } else {
          for (const row of rows) {
            drawRow([
              row.number,
              row.title,
              row.description,
              row.category,
              row.status,
              row.priority,
              row.createdAt,
              row.resolvedAt,
            ]);
          }
        }

        doc.end();
      } catch (e) {
        reject(e);
      }
    });
  }
}
