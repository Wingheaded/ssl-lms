"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import AppLayout from "@/components/AppLayout";
import { LoadingSpinner, EmptyState, ErrorState } from "@/components/StateComponents";
import { Progress, Training, Brand, getTrainingStatus, TrainingStatus } from "@/lib/types";

interface UserData {
    id: string;
    name: string;
    email: string;
}

interface UserWithProgress extends UserData {
    progress: ProgressWithDetails[];
    totalTrainings: number;
    completedTrainings: number;
    averageScore: number | null;
}

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
    failed: "Reprovado",
    passed: "Aprovado",
};

export default function AdminUsersPage() {
    const [users, setUsers] = useState<UserWithProgress[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedUserId, setExpandedUserId] = useState<string | null>(null);

    useEffect(() => {
        async function fetchData() {
            try {
                // Fetch all users
                const usersSnap = await getDocs(collection(db, "users"));
                const usersData: UserData[] = usersSnap.docs.map((doc) => ({
                    id: doc.id,
                    name: doc.data().name || "Sem nome",
                    email: doc.data().email || "Sem email",
                }));

                // Fetch all progress
                const progressSnap = await getDocs(collection(db, "progress"));
                const allProgress = progressSnap.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                })) as Progress[];

                // Fetch all trainings for names
                const trainingsSnap = await getDocs(collection(db, "trainings"));
                const trainingsMap: Record<string, Training> = {};
                trainingsSnap.docs.forEach((doc) => {
                    trainingsMap[doc.id] = { id: doc.id, ...doc.data() } as Training;
                });

                // Fetch all brands for names
                const brandsSnap = await getDocs(collection(db, "brands"));
                const brandsMap: Record<string, Brand> = {};
                brandsSnap.docs.forEach((doc) => {
                    brandsMap[doc.id] = { id: doc.id, ...doc.data() } as Brand;
                });

                // Group progress by user and calculate stats
                const usersWithProgress: UserWithProgress[] = usersData.map((user) => {
                    const userProgress = allProgress.filter((p) => p.userId === user.id);

                    // Enrich progress with training and brand info
                    const progressWithDetails: ProgressWithDetails[] = userProgress.map((p) => {
                        const training = trainingsMap[p.trainingId];
                        const brand = training ? brandsMap[training.brandId] : undefined;
                        return { ...p, training, brand };
                    });

                    // Calculate stats
                    const completedTrainings = userProgress.filter((p) => p.passed).length;
                    const scoresWithValues = userProgress
                        .filter((p) => p.score !== null && p.score !== undefined)
                        .map((p) => p.score as number);
                    const averageScore =
                        scoresWithValues.length > 0
                            ? Math.round(scoresWithValues.reduce((a, b) => a + b, 0) / scoresWithValues.length)
                            : null;

                    return {
                        ...user,
                        progress: progressWithDetails,
                        totalTrainings: userProgress.length,
                        completedTrainings,
                        averageScore,
                    };
                });

                // Sort by name
                usersWithProgress.sort((a, b) => a.name.localeCompare(b.name));

                setUsers(usersWithProgress);
            } catch (err) {
                console.error("Error fetching users:", err);
                setError("Não foi possível carregar os utilizadores.");
            } finally {
                setLoading(false);
            }
        }

        fetchData();
    }, []);

    const filteredUsers = users.filter(
        (user) =>
            user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            user.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const toggleExpand = (userId: string) => {
        setExpandedUserId(expandedUserId === userId ? null : userId);
    };

    return (
        <AppLayout>
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-light text-gray-800 mb-2">
                    Progresso dos Utilizadores
                </h1>
                <p className="text-gray-600 mb-6">
                    Ver o progresso de todos os utilizadores nas formações
                </p>

                {/* Search */}
                <div className="mb-6">
                    <input
                        type="text"
                        placeholder="Pesquisar por nome ou email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sage/50 focus:border-sage"
                    />
                </div>

                {loading && <LoadingSpinner message="A carregar utilizadores..." />}

                {error && <ErrorState message={error} onRetry={() => window.location.reload()} />}

                {!loading && !error && filteredUsers.length === 0 && (
                    <EmptyState
                        title="Sem utilizadores"
                        message={searchQuery ? "Nenhum utilizador encontrado com essa pesquisa." : "Ainda não existem utilizadores registados."}
                    />
                )}

                {!loading && !error && filteredUsers.length > 0 && (
                    <div className="space-y-3">
                        {filteredUsers.map((user) => (
                            <div key={user.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                                {/* User Row (clickable) */}
                                <button
                                    onClick={() => toggleExpand(user.id)}
                                    className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
                                >
                                    <div className="flex-1">
                                        <h3 className="font-medium text-gray-800">{user.name}</h3>
                                        <p className="text-sm text-gray-500">{user.email}</p>
                                    </div>
                                    <div className="flex items-center gap-4 text-sm">
                                        <div className="text-center">
                                            <p className="font-semibold text-gray-800">{user.completedTrainings}/{user.totalTrainings}</p>
                                            <p className="text-xs text-gray-500">Concluídas</p>
                                        </div>
                                        {user.averageScore !== null && (
                                            <div className="text-center">
                                                <p className={`font-semibold ${user.averageScore >= 90 ? 'text-green-600' : user.averageScore >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                                                    {user.averageScore}%
                                                </p>
                                                <p className="text-xs text-gray-500">Média</p>
                                            </div>
                                        )}
                                        <span className={`text-gray-400 transition-transform ${expandedUserId === user.id ? 'rotate-180' : ''}`}>
                                            ▼
                                        </span>
                                    </div>
                                </button>

                                {/* Expanded Progress Details */}
                                {expandedUserId === user.id && (
                                    <div className="border-t border-gray-100 bg-gray-50 p-4">
                                        {user.progress.length === 0 ? (
                                            <p className="text-sm text-gray-500 text-center py-2">
                                                Este utilizador ainda não iniciou nenhuma formação.
                                            </p>
                                        ) : (
                                            <div className="space-y-2">
                                                {user.progress.map((progress) => {
                                                    const status = getTrainingStatus(progress);
                                                    return (
                                                        <div
                                                            key={progress.id}
                                                            className="flex items-center justify-between bg-white rounded-lg p-3 border border-gray-100"
                                                        >
                                                            <div>
                                                                <p className="text-xs text-sage font-medium uppercase tracking-wide">
                                                                    {progress.brand?.name || "Marca"}
                                                                </p>
                                                                <p className="font-medium text-gray-800 text-sm">
                                                                    {progress.training?.title || "Formação"}
                                                                </p>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <span className={`badge ${statusBadgeClasses[status]}`}>
                                                                    {statusLabels[status]}
                                                                </span>
                                                                {progress.score !== null && progress.score !== undefined && (
                                                                    <span className="text-sm font-medium text-gray-600">
                                                                        {progress.score}%
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Back to Admin */}
                <div className="mt-8 pt-8 border-t border-gray-200">
                    <a href="/admin" className="btn-secondary inline-block">
                        ← Voltar ao Painel
                    </a>
                </div>
            </div>
        </AppLayout>
    );
}
