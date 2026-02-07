"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { usePathname } from "next/navigation";

interface LayoutProps {
    children: ReactNode;
}

export default function AppLayout({ children }: LayoutProps) {
    const { user, logout, isAdmin } = useAuth();
    const pathname = usePathname();

    if (!user) {
        return <>{children}</>;
    }

    return (
        <div className="min-h-screen bg-cream">
            {/* Header */}
            <header className="bg-white border-b border-sage/20 sticky top-0 z-10">
                <div className="px-4 sm:px-6 py-3 flex items-center justify-between">
                    <Link href="/brands" className="font-display text-xl text-charcoal mr-2 sm:mr-4 flex-shrink-0">
                        Skin Self Love
                    </Link>
                    <nav className="flex items-center gap-2 sm:gap-4">
                        {isAdmin && (
                            <Link
                                href="/admin"
                                className={`text-sm ${pathname?.startsWith('/admin') ? 'text-sage font-medium' : 'text-charcoal/70 hover:text-charcoal'}`}
                            >
                                Admin
                            </Link>
                        )}
                        <Link
                            href="/dashboard"
                            className={`text-sm ${pathname === '/dashboard' ? 'text-sage font-medium' : 'text-charcoal/70 hover:text-charcoal'}`}
                        >
                            O Meu Progresso
                        </Link>
                        <button
                            onClick={logout}
                            className="text-sm text-charcoal/70 hover:text-charcoal"
                        >
                            Sair
                        </button>
                    </nav>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-4xl mx-auto px-4 py-6">
                {children}
            </main>
        </div>
    );
}
