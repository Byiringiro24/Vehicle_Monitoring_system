'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, total, limit, onPageChange }: PaginationProps) {
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="flex items-center justify-between py-3 px-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
      <p className="text-sm text-gray-500">
        Showing <span className="font-medium">{from}–{to}</span> of <span className="font-medium">{total}</span> results
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)} disabled={page <= 1}
          className="p-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition">
          <ChevronLeft size={16} />
        </button>
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          const p = Math.max(1, Math.min(page - 2 + i, totalPages - 4 + i));
          return (
            <button key={p} onClick={() => onPageChange(p)}
              className={cn('w-8 h-8 rounded-lg text-sm font-medium transition',
                p === page ? 'bg-brand-600 text-white' : 'hover:bg-gray-200 text-gray-600')}>
              {p}
            </button>
          );
        })}
        <button
          onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}
          className="p-1.5 rounded-lg hover:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed transition">
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}