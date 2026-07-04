/**
 * Formats a number as Indonesian Rupiah currency string.
 * Example: 15000 -> "Rp 15.000"
 */
export function formatRupiah(value: number | string): string {
  const numericValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numericValue)) return 'Rp 0';
  
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numericValue);
}

/**
 * Generates a unique transaction number using date and random digits.
 * Example: TX-20260705-123456
 */
export function generateNoTransaksi(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  // Format: Date-Time-Random (4 digits)
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `TX-${year}${month}${day}-${hours}${minutes}${seconds}-${randomSuffix}`;
}
