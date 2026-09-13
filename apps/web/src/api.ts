import type { ApiEnvelope, PublicPrayer, TaxonomyItem } from '@cloudsent/contracts';

const apiBase = '/api';
let csrfToken = '';

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (csrfToken && ['POST', 'PATCH', 'PUT', 'DELETE'].includes((init.method || 'GET').toUpperCase())) headers.set('X-CSRF-Token', csrfToken);
  const response = await fetch(`${apiBase}${path}`, { ...init, headers, credentials: 'include' });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(body?.error?.message || 'Request failed.'), { status: response.status, body });
  return body as T;
}

export async function getTaxonomy() { return request<ApiEnvelope<{ categories: TaxonomyItem[]; moods: TaxonomyItem[]; colors: { key: string; hex: string }[] }>>('/taxonomy'); }
export async function listPrayers(search: string) { return request<ApiEnvelope<PublicPrayer[]> & { meta: { hasMore: boolean; nextCursor: string | null } }>(`/prayers${search}`); }
export async function getPrayer(id: string) { return request<ApiEnvelope<PublicPrayer>>(`/prayers/${id}`); }
export async function submitPrayer(input: unknown) { return request<ApiEnvelope<{ message: string }>>('/prayers', { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify(input) }); }
export async function reportPrayer(id: string, reason: string) { return request<ApiEnvelope<{ message: string }>>(`/prayers/${id}/reports`, { method: 'POST', body: JSON.stringify({ reason }) }); }

export async function adminSession() { const result = await request<ApiEnvelope<{ csrfToken: string }>>('/admin/session'); csrfToken = result.data.csrfToken; return result; }
export async function adminLogin(pin: string) { const result = await request<ApiEnvelope<{ csrfToken: string }>>('/admin/session', { method: 'POST', body: JSON.stringify({ pin }) }); csrfToken = result.data.csrfToken; return result; }
export async function adminLogout() { const result = await request('/admin/session', { method: 'DELETE' }); csrfToken = ''; return result; }
export async function adminPrayers(search = '') { return request<ApiEnvelope<any[]>>('/admin/prayers' + search); }
export async function adminReports() { return request<ApiEnvelope<any[]>>('/admin/reports'); }
export async function adminStats() { return request<ApiEnvelope<any>>('/admin/stats'); }
export async function adminTaxonomy() { return request<ApiEnvelope<any>>('/admin/taxonomy'); }
export async function addTaxonomy(kind: 'categories' | 'moods', name: string) { return request(`/admin/taxonomy/${kind}`, { method: 'POST', body: JSON.stringify({ name }) }); }
export async function toggleTaxonomy(kind: 'categories' | 'moods', id: string, active: boolean) { return request(`/admin/taxonomy/${kind}/${id}`, { method: 'PATCH', body: JSON.stringify({ active }) }); }
export async function updateTaxonomy(kind: 'categories' | 'moods', id: string, patch: { name?: string; position?: number }) { return request(`/admin/taxonomy/${kind}/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }); }
export async function updatePrayerStatus(id: string, status: string, version: number) { return request(`/admin/prayers/${id}/status`, { method: 'POST', body: JSON.stringify({ status, expectedVersion: version }) }); }
export async function editPrayer(id: string, patch: Record<string, unknown>, expectedVersion: number) { return request(`/admin/prayers/${id}`, { method: 'PATCH', body: JSON.stringify({ ...patch, expectedVersion }) }); }
export async function deletePrayer(id: string) { return request(`/admin/prayers/${id}`, { method: 'DELETE' }); }
export async function restorePrayer(id: string) { return request(`/admin/prayers/${id}/restore`, { method: 'POST' }); }
export async function purgePrayer(id: string) { return request(`/admin/prayers/${id}/purge`, { method: 'DELETE' }); }
export async function exportPrayers() { const response = await fetch('/api/admin/export', { credentials: 'include', headers: csrfToken ? { 'X-CSRF-Token': csrfToken } : undefined }); if (!response.ok) throw new Error('Export failed.'); return response.blob(); }
export async function resolveReport(prayerId: string, action: string, note: string) { return request(`/admin/reports/${prayerId}/resolve`, { method: 'POST', body: JSON.stringify({ action, note }) }); }
export function subscribeToAdminEvents(onEvent: () => void) { const source = new EventSource(`${apiBase}/admin/events`, { withCredentials: true }); source.onmessage = onEvent; source.addEventListener('prayer-created', onEvent); source.addEventListener('report-created', onEvent); source.addEventListener('prayer-status-changed', onEvent); source.addEventListener('report-resolved', onEvent); return () => source.close(); }
