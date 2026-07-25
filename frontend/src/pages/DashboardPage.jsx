import React from 'react';
import { useAuth } from '../context/AuthContext';

const STATS = [
  {
    id: 'stat-products',
    label: 'Tracked Products',
    value: '—',
    trend: null,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
    color: 'text-brand-400',
    bg: 'bg-brand-500/10',
  },
  {
    id: 'stat-stores',
    label: 'Active Stores',
    value: '—',
    trend: null,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    color: 'text-accent-green',
    bg: 'bg-accent-green/10',
  },
  {
    id: 'stat-prices',
    label: 'Price Records',
    value: '—',
    trend: null,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    color: 'text-accent-purple',
    bg: 'bg-accent-purple/10',
  },
  {
    id: 'stat-alerts',
    label: 'Price Drops Today',
    value: '—',
    trend: null,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
    color: 'text-accent-yellow',
    bg: 'bg-accent-yellow/10',
  },
];

const RECENT_ACTIVITY = [
  { id: 'act-1', action: 'Price scraped', target: 'Sony WH-1000XM5 · Amazon', time: '2 min ago', type: 'scrape' },
  { id: 'act-2', action: 'Price drop detected', target: 'Apple AirPods Pro · Best Buy', time: '15 min ago', type: 'drop' },
  { id: 'act-3', action: 'New listing added', target: 'Samsung 55" OLED · Walmart', time: '1 hr ago', type: 'new' },
  { id: 'act-4', action: 'Price scraped', target: 'Dyson V15 · Target', time: '2 hr ago', type: 'scrape' },
  { id: 'act-5', action: 'Price drop detected', target: 'iPad Air 5th Gen · Amazon', time: '3 hr ago', type: 'drop' },
];

const ACTIVITY_BADGES = {
  scrape: { label: 'Scraped', cls: 'badge-brand' },
  drop:   { label: 'Drop ↓',  cls: 'badge-green' },
  new:    { label: 'New',     cls: 'badge-yellow' },
};

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-8 animate-slide-up">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Good morning, <span className="text-gradient">{user?.email?.split('@')[0]}</span> 👋
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Here's what's happening across your tracked products today.
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <span className="badge-green mt-1">● Live</span>
        </div>
      </div>

      {/* ── Stat cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {STATS.map((stat) => (
          <div key={stat.id} id={stat.id} className="card-hover">
            <div className="flex items-start justify-between mb-4">
              <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center ${stat.color}`}>
                {stat.icon}
              </div>
            </div>
            <p className="text-2xl font-bold text-white">{stat.value}</p>
            <p className="text-xs text-gray-400 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* ── Main content grid ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="xl:col-span-2 card">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-semibold text-white">Recent Activity</h2>
            <span className="text-xs text-gray-500">Last 24 hours</span>
          </div>
          <div className="space-y-1">
            {RECENT_ACTIVITY.map((item) => {
              const badge = ACTIVITY_BADGES[item.type];
              return (
                <div key={item.id} id={item.id} className="flex items-center gap-4 py-3 border-b border-surface-border/50 last:border-0 hover:bg-surface-overlay/30 -mx-2 px-2 rounded-lg transition-colors">
                  <span className={badge.cls}>{badge.label}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-100 font-medium truncate">{item.action}</p>
                    <p className="text-xs text-gray-500 truncate">{item.target}</p>
                  </div>
                  <p className="text-xs text-gray-600 flex-shrink-0">{item.time}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick actions */}
        <div className="card">
          <h2 className="text-base font-semibold text-white mb-5">Quick Actions</h2>
          <div className="space-y-3">
            <button id="btn-add-product" className="btn-primary w-full justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Add Product
            </button>
            <button id="btn-run-scrape" className="btn-secondary w-full justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Run Scrape Now
            </button>
            <button id="btn-export" className="btn-ghost w-full justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export CSV
            </button>
          </div>

          <div className="mt-6 pt-5 border-t border-surface-border">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">System Status</h3>
            <div className="space-y-2.5">
              {[
                { label: 'Scraper Queue', status: 'Idle', ok: true },
                { label: 'Database', status: 'Connected', ok: true },
                { label: 'Last Scrape', status: '2 min ago', ok: true },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">{item.label}</span>
                  <span className={`text-xs font-medium ${item.ok ? 'text-accent-green' : 'text-accent-red'}`}>
                    {item.ok && '● '}{item.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
