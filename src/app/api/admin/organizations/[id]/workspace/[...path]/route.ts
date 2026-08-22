import { backendRequest } from '@/lib/backend';
import { relayResponse } from '@/lib/relayResponse';

async function relay(request: Request, params: Promise<{ id: string; path: string[] }>, method: 'GET' | 'POST') {
  const { id, path } = await params;
  const url = new URL(request.url);
  const target = `/api/admin/organizations/${encodeURIComponent(id)}/${path.map(encodeURIComponent).join('/')}${url.search}`;
  const body = method === 'POST' ? await request.json().catch(() => ({})) : undefined;
  return relayResponse(await backendRequest(target, { method, body }));
}

export function GET(request: Request, { params }: { params: Promise<{ id: string; path: string[] }> }) { return relay(request, params, 'GET'); }
export function POST(request: Request, { params }: { params: Promise<{ id: string; path: string[] }> }) { return relay(request, params, 'POST'); }
