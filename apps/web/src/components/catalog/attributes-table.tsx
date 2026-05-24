/**
 * Renders product.attributes (unknown shape from API) as a formatted table.
 * Handles: null, string, flat object, and nested object.
 */

interface AttributesTableProps {
  attributes: unknown;
  title?: string;
}

export function AttributesTable({
  attributes,
  title = 'Technical Specifications',
}: AttributesTableProps) {
  const rows = flattenAttributes(attributes);
  if (rows.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-white/10">
      <div className="border-b border-white/10 bg-white/5 px-4 py-3">
        <p className="font-technical text-xs font-semibold uppercase tracking-widest text-brand-orange">
          {title}
        </p>
      </div>
      <table className="w-full text-sm">
        <tbody>
          {rows.map(({ key, value }, i) => (
            <tr
              key={key}
              className={i % 2 === 0 ? 'bg-white/[0.02]' : 'bg-transparent'}
            >
              <td className="w-2/5 border-b border-white/5 px-4 py-2.5 font-medium text-brand-muted">
                {formatKey(key)}
              </td>
              <td className="border-b border-white/5 px-4 py-2.5 text-brand-text">
                {String(value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Flatten helpers ──────────────────────────────────────────────────────────

interface Row { key: string; value: string | number | boolean }

function flattenAttributes(value: unknown, prefix = ''): Row[] {
  if (value === null || value === undefined) return [];
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return prefix ? [{ key: prefix, value }] : [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, i) =>
      flattenAttributes(item, prefix ? `${prefix}[${i}]` : String(i)),
    );
  }
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
      flattenAttributes(v, prefix ? `${prefix}.${k}` : k),
    );
  }
  return [];
}

/** "connectionType" → "Connection Type" */
function formatKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}
