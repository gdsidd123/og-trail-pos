export function formatTableLabel(tableId?: string | number | null, tableName?: string | null) {
  const source = tableName || (tableId == null ? '' : String(tableId));
  if (!source) return 'N/A';

  const trailingNumber = source.match(/(?:table|t|#)?\s*(\d+)$/i)?.[1];
  return trailingNumber ? `Table ${trailingNumber}` : source;
}
