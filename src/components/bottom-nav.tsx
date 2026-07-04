'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Store, Package, ClipboardList, Settings } from 'lucide-react';

/**
 * Mobile-first Bottom Navigation Bar component.
 * Attaches fixed to the bottom of the screen with glassmorphic backing and touch-optimized buttons.
 */
export default function BottomNav() {
  const pathname = usePathname();

  const navItems = [
    { name: 'Kasir', href: '/kasir', icon: Store },
    { name: 'Produk', href: '/produk', icon: Package },
    { name: 'Riwayat', href: '/riwayat', icon: ClipboardList },
    { name: 'Menu', href: '/menu', icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/80 border-t border-zinc-850 backdrop-blur-lg pb-safe shadow-2xl">
      <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 py-1.5 text-center active:scale-95 transition-all duration-200 ${
                isActive
                  ? 'text-teal-400 font-semibold'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <div className={`p-1.5 rounded-xl transition-all duration-300 ${
                isActive ? 'bg-teal-500/10 text-teal-400' : 'text-zinc-500'
              }`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[10px] mt-0.5 tracking-wider uppercase font-bold">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
