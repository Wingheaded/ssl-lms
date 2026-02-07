"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { collection, getDocs, query, where, doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { Training, Progress, Brand, getTrainingStatus, TrainingStatus } from "@/lib/types";
import AppLayout from "@/components/AppLayout";
import { LoadingSpinner, EmptyState, ErrorState } from "@/components/StateComponents";

const statusBadgeClasses: Record<TrainingStatus, string> = {
    not_started: "badge-not-started",
    in_progress: "badge-in-progress",
    failed: "badge-failed",
    passed: "badge-passed",
};

const statusLabels: Record<TrainingStatus, string> = {
    not_started: "Por Iniciar",
    in_progress: "Em Progresso",
    failed: "Tente outra vez",
    passed: "Aprovado",
};

export default function TrainingsPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const params = useParams();
    const brandId = params.brandId as string;

    const [brand, setBrand] = useState<Brand | null>(null);
    const [trainings, setTrainings] = useState<Training[]>([]);
    const [progressMap, setProgressMap] = useState<Record<string, Progress>>({});
    const [trainingVisits, setTrainingVisits] = useState<Map<string, Date>>(new Map());
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
                // Fetch brand info
                const brandDoc = await getDoc(doc(db, "brands", brandId));
                if (brandDoc.exists()) {
                    setBrand({ id: brandDoc.id, ...brandDoc.data() } as Brand);
                }

                // Fetch trainings for this brand
                const trainingsQuery = query(
                    collection(db, "trainings"),
                    where("brandId", "==", brandId),
                    where("isActive", "==", true)
                );
                const trainingsSnap = await getDocs(trainingsQuery);
                const trainingsData = trainingsSnap.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as Training[];
                setTrainings(trainingsData);

                // Fetch progress for current user
                const progressQuery = query(
                    collection(db, "progress"),
                    where("userId", "==", user.uid)
                );
                const progressSnap = await getDocs(progressQuery);
                const progressData: Record<string, Progress> = {};
                progressSnap.docs.forEach(progressDoc => {
                    const data = progressDoc.data() as Omit<Progress, 'id'>;
                    progressData[data.trainingId] = { ...data, id: progressDoc.id } as Progress;
                });
                setProgressMap(progressData);

                // Fetch training visits for current user
                const visitsSnap = await getDocs(collection(db, `users/${user.uid}/trainingVisits`));
                const visitsMap = new Map<string, Date>();
                visitsSnap.docs.forEach(visitDoc => {
                    const data = visitDoc.data();
                    if (data.lastVisited) {
                        visitsMap.set(visitDoc.id, data.lastVisited.toDate());
                    }
                });
                setTrainingVisits(visitsMap);

            } catch (err) {
                console.error("Error fetching trainings:", err);
                setError("Não foi possível carregar as formações. Por favor, tente novamente.");
            } finally {
                setLoading(false);
            }
        }

        if (user && brandId) {
            fetchData();
        }
    }, [user, brandId]);

    // Handle training click - record visit
    const handleTrainingClick = async (trainingId: string) => {
        if (user) {
            try {
                const visitRef = doc(db, `users/${user.uid}/trainingVisits`, trainingId);
                await setDoc(visitRef, {
                    lastVisited: serverTimestamp()
                }, { merge: true });
            } catch (err) {
                console.error("Failed to update training visit time:", err);
            }
        }
    };

    // Check if training should show "NOVO" badge
    const isTrainingNew = (training: Training): boolean => {
        if (!training.createdAt) return false;

        const created = training.createdAt instanceof Date
            ? training.createdAt
            : (training.createdAt as any).toDate();

        const lastVisited = trainingVisits.get(training.id);

        if (lastVisited) {
            // Smart logic: show NOVO if training is newer than last visit
            return created > lastVisited;
        } else {
            // Fallback: never visited, show if created within 30 days
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            return created > thirtyDaysAgo;
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
                {/* Breadcrumb */}
                <div className="mb-4">
                    <Link href="/brands" className="text-sm text-sage hover:underline">
                        ← Voltar às Marcas
                    </Link>
                </div>

                <h1 className="font-display text-2xl text-charcoal mb-6">
                    Formações {brand?.name || ""}
                </h1>

                {loading && <LoadingSpinner message="A carregar formações..." />}

                {error && <ErrorState message={error} onRetry={() => window.location.reload()} />}

                {!loading && !error && trainings.length === 0 && (
                    <EmptyState
                        title="Sem formações disponíveis"
                        message="Ainda não existem formações ativas para esta marca."
                    />
                )}

                {!loading && !error && trainings.length > 0 && (
                    <div className="space-y-4">
                        {trainings.map((training) => {
                            const progress = progressMap[training.id];
                            const status = getTrainingStatus(progress);

                            return (
                                <div
                                    key={training.id}
                                    onClick={() => {
                                        handleTrainingClick(training.id);
                                        router.push(`/trainings/${training.id}`);
                                    }}
                                    className="card block cursor-pointer"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                            <h2 className="font-medium text-charcoal flex items-center gap-2">
                                                {training.title}
                                                {isTrainingNew(training) && (
                                                    <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide animate-pulse">
                                                        NOVO
                                                    </span>
                                                )}
                                            </h2>
                                            <p className="mt-1 text-sm text-charcoal/60 line-clamp-2">
                                                {training.description}
                                            </p>
                                            <div className="mt-3 flex items-center gap-3">
                                                <span className={`badge ${statusBadgeClasses[status]}`}>
                                                    {statusLabels[status]}
                                                </span>
                                                {progress?.score !== null && progress?.score !== undefined && (
                                                    <span className="text-sm text-charcoal/60">
                                                        Pontuação: {progress.score}%
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-sm text-charcoal/40 mt-1 flex gap-1">
                                            {(() => {
                                                const files = training.mediaFiles || [];
                                                const types = new Set(files.map(f => f.type));
                                                // Fallback for legacy
                                                if (files.length === 0 && training.mediaType) {
                                                    types.add(training.mediaType);
                                                }
                                                return (
                                                    <>
                                                        {(types.has("video") || types.has("youtube")) && <span title="Vídeo">🎬</span>}
                                                        {types.has("audio") && <span title="Áudio">🎧</span>}
                                                        {types.has("pdf") && <span title="PDF">📄</span>}
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
