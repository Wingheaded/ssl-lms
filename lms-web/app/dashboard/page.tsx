"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { collection, getDocs, query, where, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { Progress, Training, Brand, getTrainingStatus, TrainingStatus } from "@/lib/types";
import AppLayout from "@/components/AppLayout";
import { LoadingSpinner, EmptyState, ErrorState } from "@/components/StateComponents";

interface ProgressWithDetails extends Progress {
    training?: Training;
    brand?: Brand;
}

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

export default function DashboardPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();

    const [progressList, setProgressList] = useState<ProgressWithDetails[]>([]);
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
                // Fetch all progress for current user
                const progressQuery = query(
                    collection(db, "progress"),
                    where("userId", "==", user.uid)
                );
                const progressSnap = await getDocs(progressQuery);

                // Fetch training and brand details for each progress
                const progressWithDetails: ProgressWithDetails[] = await Promise.all(
                    progressSnap.docs.map(async (progressDoc) => {
                        const progressData = { id: progressDoc.id, ...progressDoc.data() } as Progress;

                        // Fetch training
                        let training: Training | undefined;
                        let brand: Brand | undefined;

                        try {
                            const trainingDoc = await getDoc(doc(db, "trainings", progressData.trainingId));
                            if (trainingDoc.exists()) {
                                training = { id: trainingDoc.id, ...trainingDoc.data() } as Training;

                                // Fetch brand
                                const brandDoc = await getDoc(doc(db, "brands", training.brandId));
                                if (brandDoc.exists()) {
                                    brand = { id: brandDoc.id, ...brandDoc.data() } as Brand;
                                }
                            }
                        } catch (err) {
                            console.error("Error fetching training/brand:", err);
                        }

                        return { ...progressData, training, brand };
                    })
                );

                setProgressList(progressWithDetails);
            } catch (err) {
                console.error("Error fetching progress:", err);
                setError("Não foi possível carregar o seu progresso. Por favor, tente novamente.");
            } finally {
                setLoading(false);
            }
        }

        if (user) {
            fetchData();
        }
    }, [user]);

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
                <h1 className="font-display text-2xl text-charcoal mb-2">
                    O Meu Progresso
                </h1>
                <p className="text-charcoal/60 mb-6">
                    Acompanhe as suas formações e pontuações
                </p>

                {loading && <LoadingSpinner message="A carregar o seu progresso..." />}

                {error && <ErrorState message={error} onRetry={() => window.location.reload()} />}

                {!loading && !error && progressList.length === 0 && (
                    <EmptyState
                        title="Sem progresso ainda"
                        message="Inicie uma formação para ver o seu progresso aqui."
                    />
                )}

                {!loading && !error && progressList.length > 0 && (
                    <div className="space-y-4">
                        {progressList.map((progress) => {
                            const status = getTrainingStatus(progress);

                            return (
                                <Link
                                    key={progress.id}
                                    href={`/trainings/${progress.trainingId}`}
                                    className="card block"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                            <p className="text-xs text-sage font-medium uppercase tracking-wide mb-1">
                                                {progress.brand?.name || "Marca Desconhecida"}
                                            </p>
                                            <h2 className="font-medium text-charcoal">
                                                {progress.training?.title || "Formação Desconhecida"}
                                            </h2>
                                            <div className="mt-3 flex items-center gap-3">
                                                <span className={`badge ${statusBadgeClasses[status]}`}>
                                                    {statusLabels[status]}
                                                </span>
                                                {progress.score !== null && progress.score !== undefined && (
                                                    <span className="text-sm text-charcoal/60">
                                                        Pontuação: {progress.score}%
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-charcoal/40">
                                            →
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}

                {/* Quick Actions */}
                <div className="mt-8 pt-8 border-t border-taupe/30">
                    <Link href="/brands" className="btn-secondary inline-block">
                        Ver Todas as Formações
                    </Link>
                </div>
            </div>
        </AppLayout>
    );
}
