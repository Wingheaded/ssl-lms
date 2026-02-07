"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, orderBy, where, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { Brand } from "@/lib/types";
import AppLayout from "@/components/AppLayout";
import { LoadingSpinner, EmptyState, ErrorState } from "@/components/StateComponents";

export default function BrandsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const [brands, setBrands] = useState<Brand[]>([]);
    const [newContentBrandIds, setNewContentBrandIds] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push("/");
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        async function fetchData() {
            if (!user) return;

            try {
                // 1. Fetch Brands
                const brandsQ = query(collection(db, "brands"), orderBy("order"));
                const brandsSnap = await getDocs(brandsQ);
                const brandsData = brandsSnap.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as Brand[];

                // 2. Fetch User's Last Visits
                const visitsSnap = await getDocs(collection(db, `users/${user.uid}/brandVisits`));
                const visitsMap = new Map<string, Date>(); // brandId -> lastVisited
                visitsSnap.docs.forEach(doc => {
                    const data = doc.data();
                    if (data.lastVisited) {
                        visitsMap.set(doc.id, data.lastVisited.toDate());
                    }
                });

                // 3. Fetch All Active Trainings (to find the newest per brand)
                // We need this to check if there is *any* content newer than the visit,
                // or newer than 30 days if never visited.
                const trainingsQ = query(collection(db, "trainings"), where("isActive", "==", true));
                const trainingsSnap = await getDocs(trainingsQ);

                const brandNewestTrainingMap = new Map<string, Date>(); // brandId -> newestCreatedAt

                trainingsSnap.docs.forEach(doc => {
                    const data = doc.data();
                    if (data.brandId && data.createdAt) {
                        const createdAt = data.createdAt.toDate();
                        const currentMax = brandNewestTrainingMap.get(data.brandId);
                        if (!currentMax || createdAt > currentMax) {
                            brandNewestTrainingMap.set(data.brandId, createdAt);
                        }
                    }
                });

                // 4. Determine "Novidades"
                const brandsWithNewContent = new Set<string>();
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

                for (const brand of brandsData) {
                    const newestDate = brandNewestTrainingMap.get(brand.id);
                    const lastVisited = visitsMap.get(brand.id);

                    if (newestDate) {
                        if (lastVisited) {
                            // Smart Logic: Is there something newer than my last visit?
                            // Add a small buffer (e.g. 1 min) to avoid showing "New" immediately after clicking
                            // if clocks are slightly off, though setDoc happens on click.
                            if (newestDate > lastVisited) {
                                brandsWithNewContent.add(brand.id);
                            }
                        } else {
                            // Fallback: Never visited. Is is recent (last 30 days)?
                            if (newestDate > thirtyDaysAgo) {
                                brandsWithNewContent.add(brand.id);
                            }
                        }
                    }
                }

                setBrands(brandsData);
                setNewContentBrandIds(brandsWithNewContent);

            } catch (err) {
                console.error("Error fetching data:", err);
                setError("Não foi possível carregar as marcas. Por favor, tente novamente.");
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, [user]);

    const handleBrandClick = async (brandId: string) => {
        // 1. Navigate immediately (optimistic UI)
        router.push(`/brands/${brandId}/trainings`);

        // 2. Fire-and-forget update to Firestore
        if (user) {
            try {
                // Using setDoc with merge: true to safe-guard
                const visitRef = doc(db, `users/${user.uid}/brandVisits`, brandId);
                await setDoc(visitRef, {
                    lastVisited: serverTimestamp()
                }, { merge: true });
            } catch (err) {
                console.error("Failed to update visit time:", err);
                // Non-blocking error
            }
        }
    };

    if (authLoading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-cream">
                <LoadingSpinner />
            </div>
        );
    }

    return (
        <AppLayout>
            <div>
                <h1 className="font-display text-2xl text-charcoal mb-6">
                    Selecionar Marca
                </h1>

                {loading && <LoadingSpinner message="A carregar marcas..." />}

                {error && <ErrorState message={error} onRetry={() => window.location.reload()} />}

                {!loading && !error && brands.length === 0 && (
                    <EmptyState
                        title="Sem marcas disponíveis"
                        message="Ainda não existem marcas de formação configuradas."
                    />
                )}

                {!loading && !error && brands.length > 0 && (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {brands.map((brand) => (
                            <button
                                key={brand.id}
                                onClick={() => handleBrandClick(brand.id)}
                                className="card text-left transition-all hover:border-sage relative overflow-hidden"
                            >
                                <div className="flex justify-between items-start">
                                    <h2 className="font-display text-xl text-charcoal">
                                        {brand.name}
                                    </h2>
                                    {newContentBrandIds.has(brand.id) && (
                                        <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide animate-pulse">
                                            Novidades
                                        </span>
                                    )}
                                </div>
                                <p className="mt-2 text-sm text-charcoal/60">
                                    Ver formações →
                                </p>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
