import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../api/apiClient';

const PLACEHOLDER_PRODUCTS = [
  { id: 'p1', name: 'Sony WH-1000XM5', brand: 'Sony', category: 'Audio', _count: { merchantListings: 3 }, createdAt: new Date().toISOString() },
  { id: 'p2', name: 'Apple AirPods Pro (2nd Gen)', brand: 'Apple', category: 'Audio', _count: { merchantListings: 5 }, createdAt: new Date().toISOString() },
  { id: 'p3', name: 'Dyson V15 Detect', brand: 'Dyson', category: 'Home', _count: { merchantListings: 2 }, createdAt: new Date().toISOString() },
];

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const { data } = await apiClient.get('/products');
      setProducts(data.data.products);
    } catch (err) {
      // If API isn't connected yet, show placeholder data for development
      if (err.code === 'ERR_NETWORK' || err.response?.status >= 500) {
        setProducts(PLACEHOLDER_PRODUCTS);
        setError('Using placeholder data — connect your backend to see live data.');
      } else {
        setError(err.response?.data?.error?.message || 'Failed to load products.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const filtered = products.filter((p) =>
    `${p.name} ${p.brand} ${p.category}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-slide-up">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Products</h1>
          <p className="text-gray-400 text-sm mt-1">
            {products.length} product{products.length !== 1 ? 's' : ''} tracked
          </p>
        </div>
        <button id="btn-new-product" className="btn-primary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Product
        </button>
      </div>

      {/* ── Error banner ─────────────────────────────────────────────────── */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-accent-yellow/10 border border-accent-yellow/20">
          <svg className="w-4 h-4 text-accent-yellow flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-sm text-accent-yellow">{error}</p>
        </div>
      )}

      {/* ── Search ───────────────────────────────────────────────────────── */}
      <div className="relative">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          id="product-search"
          type="search"
          placeholder="Search products by name, brand or category…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input pl-10"
        />
      </div>

      {/* ── Products table ───────────────────────────────────────────────── */}
      <div className="card overflow-hidden p-0">
        {isLoading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="skeleton w-10 h-10 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-1/3" />
                  <div className="skeleton h-3 w-1/4" />
                </div>
                <div className="skeleton h-6 w-16 rounded-full" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-surface-overlay flex items-center justify-center mb-4">
              <svg className="w-7 h-7 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <p className="text-gray-300 font-semibold">No products found</p>
            <p className="text-gray-500 text-sm mt-1">
              {search ? 'Try a different search term' : 'Add your first product to get started'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr className="border-b border-surface-border">
                  <th className="px-6 pb-3 pt-5">Product</th>
                  <th className="px-6 pb-3 pt-5">Brand</th>
                  <th className="px-6 pb-3 pt-5">Category</th>
                  <th className="px-6 pb-3 pt-5">Listings</th>
                  <th className="px-6 pb-3 pt-5">Added</th>
                  <th className="px-6 pb-3 pt-5"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((product) => (
                  <tr key={product.id} id={`product-row-${product.id}`}>
                    <td className="px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-brand flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {product.name?.[0] ?? 'P'}
                        </div>
                        <p className="font-medium text-white">{product.name}</p>
                      </div>
                    </td>
                    <td className="px-6 text-gray-400">{product.brand || '—'}</td>
                    <td className="px-6">
                      {product.category ? (
                        <span className="badge-brand">{product.category}</span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-6">
                      <span className="font-mono text-brand-400 font-semibold">
                        {product._count?.merchantListings ?? 0}
                      </span>
                    </td>
                    <td className="px-6 text-gray-500 text-xs">
                      {new Date(product.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6">
                      <button
                        id={`btn-view-${product.id}`}
                        className="btn-ghost py-1.5 px-3 text-xs"
                      >
                        View →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
