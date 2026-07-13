/** ponytail: 10–15 digits after stripping non-digits; rejects free-text like "можно сделать сегодня". */
export function isValidPhone(value?: string): boolean {
  if (!value?.trim()) return false;
  const digits = value.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

export function pickPhone(ticketPhone?: string, userPhone?: string): string {
  if (isValidPhone(ticketPhone)) return ticketPhone!.trim();
  if (isValidPhone(userPhone)) return userPhone!.trim();
  return 'Не указан';
}

export function formatDisplayPhone(phone?: string): string {
  return isValidPhone(phone) ? phone!.trim() : 'Не указан';
}
