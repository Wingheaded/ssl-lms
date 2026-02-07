"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { Training } from "@/lib/types";
import AppLayout from "@/components/AppLayout";
import { LoadingSpinner } from "@/components/StateComponents";

export default function ResultPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const trainingId = params.trainingId as string;

    const score = parseInt(searchParams.get("score") || "0");
    const passed = searchParams.get("passed") === "true";

    const [training, setTraining] = useState<Training | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push("/");
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        async function fetchTraining() {
            if (!user) return;

            try {
                const trainingDoc = await getDoc(doc(db, "trainings", trainingId));
                if (trainingDoc.exists()) {
                    setTraining({ id: trainingDoc.id, ...trainingDoc.data() } as Training);
                }
            } catch (err) {
                console.error("Error fetching training:", err);
            } finally {
                setLoading(false);
            }
        }

        if (user && trainingId) {
            fetchTraining();
        }
    }, [user, trainingId]);

    if (authLoading || !user || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-cream">
                <LoadingSpinner />
            </div>
        );
    }

    return (
        <AppLayout>
            <div className="text-center py-12">
                {/* Result Icon */}
                <div className={`text-6xl mb-6 ${passed ? 'text-green-500' : 'text-red-500'}`}>
                    {passed ? "🎉" : "📚"}
                </div>

                {/* Score */}
                <h1 className="font-display text-4xl text-charcoal mb-2">
                    {score}%
                </h1>

                <p className={`text-xl font-medium ${passed ? 'text-green-600' : 'text-red-600'}`}>
                    {passed ? "Parabéns! Passou!" : "Ainda não chegou lá"}
                </p>

                <p className="text-charcoal/60 mt-2 mb-8">
                    {passed
                        ? "Completou esta formação com sucesso."
                        : "Precisa de 90% para passar. Reveja o conteúdo e tente novamente."}
                </p>

                {/* Training Info */}
                {training && (
                    <p className="text-sm text-charcoal/50 mb-8">
                        Formação: {training.title}
                    </p>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-md mx-auto">
                    {!passed && (
                        <button
                            onClick={() => router.push(`/trainings/${trainingId}/quiz`)}
                            className="btn-primary flex-1"
                        >
                            Repetir Quiz
                        </button>
                    )}

                    <Link
                        href={training?.brandId ? `/brands/${training.brandId}/trainings` : "/brands"}
                        className="btn-secondary flex-1 text-center"
                    >
                        Voltar às Formações
                    </Link>

                    <Link
                        href="/dashboard"
                        className="btn-secondary flex-1 text-center"
                    >
                        Ver Progresso
                    </Link>
                </div>
            </div>
        </AppLayout>
    );
}
