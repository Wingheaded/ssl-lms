"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import AppLayout from "@/components/AppLayout";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const { user, loading, isAdmin } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (!loading) {
            if (!user) {
                router.push("/");
            } else if (!isAdmin) {
                router.push("/brands"); // Redirect non-admins to main area
            }
        }
    }, [user, loading, isAdmin, router]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-cream">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-700"></div>
            </div>
        );
    }

    if (!user || !isAdmin) {
        return null; // Don't render anything while redirecting
    }

    return <>{children}</>;
}
