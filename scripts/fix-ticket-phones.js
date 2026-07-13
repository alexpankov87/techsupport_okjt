/**
 * ponytail: one-shot — fix tickets where phone field has text instead of a number.
 * Run: node scripts/fix-ticket-phones.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { TicketRepository } = require('../dist/repositories/TicketRepository');
const { TicketService } = require('../dist/services/TicketService');

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const svc = new TicketService(new TicketRepository());
  const n = await svc.fixInvalidTicketPhones();
  console.log(`fixed ${n} ticket(s)`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
