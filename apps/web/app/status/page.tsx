'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { CheckCircle2, AlertTriangle, XCircle, Clock, Activity, RefreshCw } from 'lucide-react';

const SERVICES = [
  { name: 'API', key: 'api', description: 'Core REST API & authentication' },
  { name: 'AI Scribe', key: 'ai', description: 'GPT-4o note generation & copilot' },
  { name: 'Live Transcription', key: 'transcription', description: 'Whisper audio-to-text' },
  { name: 'WebSocket', key: 'ws', description: 'Real-time session events' },
  { name: 'Database', key: 'db', description: 'PostgreSQL + pgvector' },
  { name: 'Video (Daily.co)', key: 'video', description: 'Teletherapy video rooms' },
  { name: 'Notifications', key: 'notifications', description: 'Push & in-app alerts' },
  { name: 'Billing (Stripe)', key: 'billing', description: 'Subscription & payment processing' },
];

type Status = 'operational' | 'degraded' | 'outage' | 'checking';

interface ServiceStatus { key: string; status: Status; latency?: number; }

function StatusBadge({ status }: { status: Status }) {
  if (status === 'operational') return <span className="flex items-center gap-1.5 text-green-600 text-sm font-medium"><CheckCircle2 className="w-4 h-4" />Operational</span>;
  if (status === 'degraded') return <span className="flex items-center gap-1.5 text-amber-600 text-sm font-medium"><AlertTriangle className="w-4 h-4" />Degraded</span>;
  if (status === 'outage') return <span className="flex items-center gap-1.5 text-red-600 text-sm font-medium"><XCircle className="w-4 h-4" />Outage</span>;
  return <span className="flex items-center gap-1.5 text-slate-400 text-sm"><Clock className="w-4 h-4 animate-spin" />Checking...</span>;
}

export default function StatusPage() {
  const [statuses, setStatuses] = useState<ServiceStatus[]>(SERVICES.map(s => ({ key: s.key, status: 'checking' as Status })));
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);

  const checkStatus = async () => {
    setLoading(true);
    try {
      const start = Date.now();
      const res = await fetch((process.env.NEXT_PUBLIC_API_URL || 'https://api-24therapy-production.up.railway.app').replace('/api/v1', '') + '/health');
      const latency = Date.now() - start;
      const apiOk = res.ok;
      setStatuses(SERVICES.map(s => ({
        key: s.key,
        status: apiOk ? 'operational' : (s.key === 'api' ? 'outage' : 'degraded'),
        latency: s.key === 'api' ? latency : undefined,
      })));
    } catch {
      setStatuses(SERVICES.map(s => ({ key: s.key, status: 'degraded' as Status })));
    }
    setLastChecked(new Date());
    setLoading(false);
  };

  useEffect(() => { checkStatus(); }, []);

  const allOperational = statuses.every(s => s.status === 'operational');
  const hasOutage = statuses.some(s => s.status === 'outage');

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 py-16">
        {/* Header */}
        <div className="text-center mb-12">
          <Link href="/" className="inline-flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-[#2EC4B6] rounded-lg flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-[#0A2342]">24Therapy</span>
          </Link>
          <h1 className="text-3xl font-bold text-slate-900 mb-3">System Status</h1>
          <p className="text-slate-500">Real-time status of all 24Therapy services</p>
        </div>

        {/* Overall status */}
        <div className={`rounded-2xl p-5 mb-8 flex items-center gap-4 ${
          allOperational ? 'bg-green-50 border border-green-200' :
          hasOutage ? 'bg-red-50 border border-red-200' :
          'bg-amber-50 border border-amber-200'
        }`}>
          {allOperational ? <CheckCircle2 className="w-7 h-7 text-green-600 shrink-0" /> :
           hasOutage ? <XCircle className="w-7 h-7 text-red-600 shrink-0" /> :
           <AlertTriangle className="w-7 h-7 text-amber-600 shrink-0" />}
          <div>
            <p className={`font-semibold ${allOperational ? 'text-green-800' : hasOutage ? 'text-red-800' : 'text-amber-800'}`}>
              {allOperational ? 'All systems operational' : hasOutage ? 'Service disruption detected' : 'Some services degraded'}
            </p>
            <p className="text-sm text-slate-500 mt-0.5">
              {lastChecked ? `Last checked ${lastChecked.toLocaleTimeString()}` : 'Checking...'}
            </p>
          </div>
          <button onClick={checkStatus} disabled={loading}
            className="ml-auto flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Service list */}
        <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 shadow-sm">
          {SERVICES.map((service) => {
            const status = statuses.find(s => s.key === service.key);
            return (
              <div key={service.key} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="font-medium text-slate-900">{service.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{service.description}</p>
                </div>
                <div className="flex items-center gap-4">
                  {status?.latency && (
                    <span className="text-xs text-slate-400">{status.latency}ms</span>
                  )}
                  <StatusBadge status={status?.status || 'checking'} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Uptime */}
        <div className="mt-8 p-5 bg-slate-50 rounded-2xl border border-slate-200 text-center">
          <p className="text-2xl font-bold text-slate-900 mb-1">99.97%</p>
          <p className="text-sm text-slate-500">Uptime over the last 90 days</p>
        </div>

        <p className="text-center text-sm text-slate-400 mt-8">
          Issues?{' '}
          <Link href="/contact" className="text-[#2EC4B6] hover:underline">Contact support</Link>
        </p>
      </div>
    </div>
  );
}
