'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Badge, Card, Group, Loader, Pagination, Select, SimpleGrid, Stack, Table, Tabs, Text, TextInput, Title } from '@mantine/core';
import { IconAlertTriangle, IconBuildingStore, IconTicket, IconUsers } from '@tabler/icons-react';
import { fetchOrganizationWorkspace, type MoneySummary } from '@/lib/platformOrganizationApi';

type Overview = { period: { from: string; to: string }; lifetime: MoneySummary[]; period_financials: MoneySummary[]; events: { total: number; by_status: Record<string, number> }; tickets: { issued: number; checked_in: number }; health_alerts: AlertRow[]; recent_activity: ActivityRow[]; last_updated_at: string };
type AlertRow = { rule: string; severity: string; title: string; evidence: string; tab: string; detected_at: string };
type ActivityRow = { id: string; category: string; action: string; summary: string; occurred_at: string; source: string };
type Page<T> = { meta: { current_page: number; last_page: number; total: number }; events?: T[]; orders?: T[]; customers?: T[]; members?: T[]; activity?: T[] };
type EventRow = { id: number; title: string; status: string; start_date: string | null; orders_count: number; tickets_issued: number; checked_in: number; gross_sales: string; currency_code: string };

const money = (value: string, currency: string) => new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(Number(value));
const date = (value?: string | null) => value ? new Date(value).toLocaleString() : '—';

function Loading({ error }: { error?: Error | null }) { return error ? <Alert color="red">{error.message}</Alert> : <Group justify="center" py="xl"><Loader size="sm" /></Group>; }
function Empty({ label }: { label: string }) { return <Text c="dimmed" ta="center" py="xl">{label}</Text>; }
function Pager({ page, pages, onChange }: { page: number; pages: number; onChange: (page: number) => void }) { return pages > 1 ? <Pagination value={page} total={pages} onChange={onChange} /> : null; }

export function OrganizationWorkspaceTabs({ organizationId, permissions, notesPanel }: { organizationId: string; permissions: string[]; notesPanel: React.ReactNode }) {
  const has = (permission: string) => permissions.includes(permission);
  const [tab, setTab] = useState('overview');

  return <Tabs value={tab} onChange={(value) => setTab(value ?? 'overview')} keepMounted={false}>
    <Tabs.List>
      {has('organization.analytics.view') && <Tabs.Tab value="overview">Overview</Tabs.Tab>}
      {has('organization.events.view') && <Tabs.Tab value="events">Events</Tabs.Tab>}
      {has('organization.commerce.view') && <Tabs.Tab value="sales">Sales</Tabs.Tab>}
      {has('organization.customers.view') && <Tabs.Tab value="customers">Customers</Tabs.Tab>}
      {has('organization.team.view') && <Tabs.Tab value="team">Team</Tabs.Tab>}
      {has('organization.payments.view') && <Tabs.Tab value="payments">Payments</Tabs.Tab>}
      {has('organizations.notes.view') && <Tabs.Tab value="notes">Notes</Tabs.Tab>}
      {has('organization.activity.view') && <Tabs.Tab value="activity">Activity</Tabs.Tab>}
    </Tabs.List>
    <Tabs.Panel value="overview" pt="lg"><OverviewPanel organizationId={organizationId} onNavigate={setTab} /></Tabs.Panel>
    <Tabs.Panel value="events" pt="lg"><EventsPanel organizationId={organizationId} /></Tabs.Panel>
    <Tabs.Panel value="sales" pt="lg"><OrdersPanel organizationId={organizationId} /></Tabs.Panel>
    <Tabs.Panel value="customers" pt="lg"><CustomersPanel organizationId={organizationId} /></Tabs.Panel>
    <Tabs.Panel value="team" pt="lg"><TeamPanel organizationId={organizationId} /></Tabs.Panel>
    <Tabs.Panel value="payments" pt="lg"><PaymentsPanel organizationId={organizationId} /></Tabs.Panel>
    <Tabs.Panel value="notes" pt="lg">{notesPanel}</Tabs.Panel>
    <Tabs.Panel value="activity" pt="lg"><ActivityPanel organizationId={organizationId} /></Tabs.Panel>
  </Tabs>;
}

function OverviewPanel({ organizationId, onNavigate }: { organizationId: string; onNavigate: (tab: string) => void }) {
  const [days, setDays] = useState('30');
  const query = useQuery({ queryKey: ['org-workspace-overview', organizationId, days], queryFn: () => fetchOrganizationWorkspace<{ overview: Overview }>(organizationId, 'overview', { days }), refetchInterval: 30000 });
  if (!query.data) return <Loading error={query.error} />;
  const o = query.data.overview;
  return <Stack>
    <Group justify="space-between"><Title order={3}>Organization health</Title><Select w={150} value={days} onChange={(v) => setDays(v ?? '30')} data={[['7','Last 7 days'],['30','Last 30 days'],['90','Last 90 days']].map(([value,label]) => ({ value,label }))} /></Group>
    {o.health_alerts.map((alert) => <Alert key={alert.rule} icon={<IconAlertTriangle size={18} />} color={alert.severity === 'critical' ? 'red' : alert.severity === 'warning' ? 'orange' : 'blue'} title={alert.title} onClick={() => onNavigate(alert.tab)} style={{ cursor: 'pointer' }}>{alert.evidence}</Alert>)}
    <SimpleGrid cols={{ base: 1, sm: 3 }}><Metric icon={<IconBuildingStore />} label="Events" value={String(o.events.total)} /><Metric icon={<IconTicket />} label="Tickets issued" value={String(o.tickets.issued)} /><Metric icon={<IconUsers />} label="Checked in" value={String(o.tickets.checked_in)} /></SimpleGrid>
    <Title order={4}>Lifetime financials</Title><FinancialCards rows={o.lifetime} />
    <Title order={4}>Selected period</Title><FinancialCards rows={o.period_financials} />
    <Group justify="flex-end"><Text size="xs" c="dimmed">Last updated {date(o.last_updated_at)}</Text></Group>
  </Stack>;
}
function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <Card withBorder><Group>{icon}<Stack gap={0}><Text size="xs" c="dimmed">{label}</Text><Text fw={700} size="xl">{value}</Text></Stack></Group></Card>; }
function FinancialCards({ rows }: { rows: MoneySummary[] }) { return rows.length ? <SimpleGrid cols={{ base: 1, md: 2 }}>{rows.map((r) => <Card withBorder key={r.currency}><Group justify="space-between"><Text fw={700}>{r.currency}</Text><Badge>{r.orders} orders</Badge></Group><Text size="xl" fw={700} mt="sm">{money(r.gross_sales, r.currency)}</Text><Text size="sm" c="dimmed">Fees {money(r.platform_fees, r.currency)} · Refunds {money(r.refunded, r.currency)}</Text><Text size="sm">Entitlement {money(r.organizer_entitlement, r.currency)} · Released {money(r.released, r.currency)} · Outstanding {money(r.outstanding, r.currency)}</Text></Card>)}</SimpleGrid> : <Empty label="No completed sales yet." />; }

function EventsPanel({ organizationId }: { organizationId: string }) {
  const [page,setPage]=useState(1), [q,setQ]=useState(''), [status,setStatus]=useState('');
  const query=useQuery({queryKey:['org-events',organizationId,page,q,status],queryFn:()=>fetchOrganizationWorkspace<Page<Record<string, unknown>>>(organizationId,'events',{page,q,status})});
  const rows=(query.data?.events ?? []) as EventRow[];
  return <Stack><Group><TextInput placeholder="Search events" value={q} onChange={(e)=>{setQ(e.currentTarget.value);setPage(1)}}/><Select clearable placeholder="Status" value={status} onChange={(v)=>setStatus(v??'')} data={['DRAFT','LIVE','ARCHIVED']}/></Group>{!query.data?<Loading error={query.error}/>:rows.length?<><Table striped highlightOnHover><Table.Thead><Table.Tr><Table.Th>Event</Table.Th><Table.Th>Status</Table.Th><Table.Th>Dates</Table.Th><Table.Th>Orders</Table.Th><Table.Th>Tickets / check-ins</Table.Th><Table.Th>Gross</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{rows.map(r=><Table.Tr key={r.id}><Table.Td><Text fw={600}>{r.title}</Text></Table.Td><Table.Td><Badge>{r.status}</Badge></Table.Td><Table.Td>{date(r.start_date)}</Table.Td><Table.Td>{r.orders_count}</Table.Td><Table.Td>{r.tickets_issued} / {r.checked_in}</Table.Td><Table.Td>{money(r.gross_sales,r.currency_code)}</Table.Td></Table.Tr>)}</Table.Tbody></Table><Pager page={page} pages={query.data!.meta.last_page} onChange={setPage}/></>:<Empty label="No events match these filters."/>}</Stack>;
}
function OrdersPanel({ organizationId }: { organizationId:string }) { const [page,setPage]=useState(1),[q,setQ]=useState(''),[status,setStatus]=useState(''); const query=useQuery({queryKey:['org-orders',organizationId,page,q,status],queryFn:()=>fetchOrganizationWorkspace<Page<Record<string,unknown>>>(organizationId,'orders',{page,q,status})}); const rows=(query.data?.orders??[]) as Record<string,any>[]; return <Stack><Group><TextInput placeholder="Order or event" value={q} onChange={e=>{setQ(e.currentTarget.value);setPage(1)}}/><Select clearable placeholder="Status" value={status} onChange={v=>setStatus(v??'')} data={['RESERVED','COMPLETED','CANCELLED','AWAITING_OFFLINE_PAYMENT','ABANDONED']}/></Group>{!query.data?<Loading error={query.error}/>:rows.length?<><Table striped><Table.Thead><Table.Tr><Table.Th>Order</Table.Th><Table.Th>Event</Table.Th><Table.Th>Status</Table.Th><Table.Th>Source</Table.Th><Table.Th>Total</Table.Th><Table.Th>Created</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{rows.map(r=><Table.Tr key={r.id}><Table.Td>{r.short_id}</Table.Td><Table.Td>{r.event_title}</Table.Td><Table.Td><Badge>{r.status}</Badge></Table.Td><Table.Td>{r.source}</Table.Td><Table.Td>{money(r.total_amount,r.currency)}</Table.Td><Table.Td>{date(r.created_at)}</Table.Td></Table.Tr>)}</Table.Tbody></Table><Pager page={page} pages={query.data!.meta.last_page} onChange={setPage}/></>:<Empty label="No orders match these filters."/>}</Stack>; }
function CustomersPanel({organizationId}:{organizationId:string}) { const [page,setPage]=useState(1),[q,setQ]=useState(''); const query=useQuery({queryKey:['org-customers',organizationId,page,q],queryFn:()=>fetchOrganizationWorkspace<Page<Record<string,unknown>>>(organizationId,'customers',{page,q})}); const rows=(query.data?.customers??[]) as Record<string,any>[]; return <Stack><TextInput placeholder="Search customers" value={q} onChange={e=>{setQ(e.currentTarget.value);setPage(1)}}/>{!query.data?<Loading error={query.error}/>:rows.length?<><Table><Table.Thead><Table.Tr><Table.Th>Customer</Table.Th><Table.Th>Contact (masked)</Table.Th><Table.Th>Events</Table.Th><Table.Th>Tickets</Table.Th><Table.Th>Checked in</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{rows.map(r=><Table.Tr key={r.id}><Table.Td>{r.first_name} {r.last_name}</Table.Td><Table.Td>{r.email}<br/>{r.phone}</Table.Td><Table.Td>{r.events_count}</Table.Td><Table.Td>{r.tickets_count}</Table.Td><Table.Td>{r.checked_in_count}</Table.Td></Table.Tr>)}</Table.Tbody></Table><Pager page={page} pages={query.data!.meta.last_page} onChange={setPage}/></>:<Empty label="No customers yet."/>}</Stack>; }
function TeamPanel({organizationId}:{organizationId:string}) { const query=useQuery({queryKey:['org-team',organizationId],queryFn:()=>fetchOrganizationWorkspace<Page<Record<string,unknown>>>(organizationId,'team')}); const rows=(query.data?.members??[]) as Record<string,any>[]; return !query.data?<Loading error={query.error}/>:rows.length?<Table><Table.Thead><Table.Tr><Table.Th>Member</Table.Th><Table.Th>Role</Table.Th><Table.Th>Status</Table.Th><Table.Th>Joined</Table.Th></Table.Tr></Table.Thead><Table.Tbody>{rows.map(r=><Table.Tr key={r.id}><Table.Td>{r.first_name} {r.last_name}</Table.Td><Table.Td>{r.role}</Table.Td><Table.Td><Badge>{r.status}</Badge></Table.Td><Table.Td>{date(r.joined_at)}</Table.Td></Table.Tr>)}</Table.Tbody></Table>:<Empty label="No team members."/>; }
function PaymentsPanel({organizationId}:{organizationId:string}) { const query=useQuery({queryKey:['org-payments',organizationId],queryFn:()=>fetchOrganizationWorkspace<{payments:{financials:MoneySummary[];accounts:Record<string,any>[];payouts:Record<string,any>[];last_updated_at:string}}>(organizationId,'payments'),refetchInterval:30000}); if(!query.data)return <Loading error={query.error}/>; const p=query.data.payments; return <Stack><FinancialCards rows={p.financials}/><Title order={4}>Payment accounts</Title>{p.accounts.map(a=><Card withBorder key={a.id}><Group justify="space-between"><Text fw={600}>{a.provider} · {a.environment}</Text><Badge color={a.payments_enabled?'teal':'red'}>{a.account_status}</Badge></Group><Text size="sm" c="dimmed">Routing {a.routing_status} · Payments {a.payments_enabled?'enabled':'disabled'} · Transfers {a.transfers_enabled?'enabled':'disabled'}</Text></Card>)}<Title order={4}>Payout history</Title>{p.payouts.length?p.payouts.map(x=><Card withBorder key={x.id}><Group justify="space-between"><Text>{x.note||'Payout release'}</Text><Text fw={700}>{money(String(Number(x.amount_minor)/100),x.currency)}</Text></Group><Text size="xs" c="dimmed">{x.status} · {date(x.created_at)}</Text></Card>):<Empty label="No payout releases recorded."/>}</Stack>; }
function ActivityPanel({organizationId}:{organizationId:string}) { const [category,setCategory]=useState(''); const query=useQuery({queryKey:['org-activity',organizationId,category],queryFn:()=>fetchOrganizationWorkspace<Page<ActivityRow>>(organizationId,'activity',{category})}); const rows=(query.data?.activity??[]) as ActivityRow[]; return <Stack><Select clearable placeholder="Activity type" value={category} onChange={v=>setCategory(v??'')} data={[{value:'event',label:'Events'},{value:'commerce',label:'Commerce'},{value:'admin',label:'Platform admin'}]}/>{!query.data?<Loading error={query.error}/>:rows.length?rows.map(row=><Card withBorder key={row.id}><Group justify="space-between"><Stack gap={2}><Group><Badge variant="light">{row.category}</Badge><Text fw={600}>{row.action.replaceAll('_',' ')}</Text></Group><Text size="sm">{row.summary}</Text></Stack><Stack gap={2} align="flex-end"><Text size="xs" c="dimmed">{date(row.occurred_at)}</Text><Badge size="xs" color={row.source==='derived'?'gray':'blue'}>{row.source}</Badge></Stack></Group></Card>):<Empty label="No activity matches this filter."/>}</Stack>; }
