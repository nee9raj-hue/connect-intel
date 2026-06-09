/** BullMQ custom job ids must not contain ":" (queue key separator). */
export function bullJobId(...parts) {
  return parts
    .flat()
    .filter((p) => p != null && p !== '')
    .map((p) => String(p).replace(/:/g, '_'))
    .join('_')
}
