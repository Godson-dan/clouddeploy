export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function text(value: unknown, label: string, max = 120): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new HttpError(400, `${label} must be between 1 and ${max} characters`);
  return value.trim();
}
export function optionalText(value: unknown, label: string, max = 240): string {
  if (value === undefined || value === null || value === '') return '';
  return text(value, label, max);
}
