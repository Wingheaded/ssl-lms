"use client";

import React from "react";
import Link from "next/link";
import AppLayout from "@/components/AppLayout";
import { useAdminStats } from "@/lib/hooks/useAdminStats";
import StatsCard from "@/components/StatsCard";
import TrainingStatsTable from "@/components/TrainingStatsTable";

export default function AdminStatsPage() {
    const { stats, loading, error } = useAdminStats();

    return (
        <AppLayout>
            <div className="max-w-6xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Link
                        href="/admin"
                        className="w-10 h-10 flex items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                    >
                        ←
                    </Link>
                    <div>
                        <h1 className="text-3xl font-light text-gray-800">Estatísticas</h1>
                        <p className="text-gray-500">Visão geral do desempenho da plataforma</p>
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500"></div>
                    </div>
                ) : error ? (
                    <div className="bg-red-50 text-red-600 p-4 rounded-lg">
                        Erro ao carregar estatísticas: {error}
                    </div>
                ) : stats ? (
                    <>
                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <StatsCard
                                title="Utilizadores"
                                value={stats.totalUsers}
                                icon="👥"
                                colorClass="bg-blue-50 text-blue-600"
                            />
                            <StatsCard
                                title="Formações Ativas"
                                value={stats.activeTrainings}
                                icon="📚"
                                colorClass="bg-amber-50 text-amber-600"
                            />
                            <StatsCard
                                title="Conclusões"
                                value={stats.totalCompletions}
                                icon="🎓"
                                colorClass="bg-green-50 text-green-600"
                                subtext="Total de formações terminadas"
                            />
                            <StatsCard
                                title="Taxa de Sucesso"
                                value={`${stats.globalSuccessRate.toFixed(1)}%`}
                                icon="📈"
                                colorClass="bg-purple-50 text-purple-600"
                                subtext="Média global de conclusão"
                            />
                        </div>

                        {/* Detailed Table */}
                        <TrainingStatsTable data={stats.trainingStats} />

                        {/* Recent Activity (Optional / MVP) */}
                        {stats.recentActivity.length > 0 && (
                            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                                <h2 className="text-lg font-bold text-gray-800 mb-4">Atividade Recente</h2>
                                <div className="space-y-4">
                                    {stats.recentActivity.map((activity) => (
                                        <div key={activity.id} className="flex items-center justify-between text-sm py-2 border-b border-gray-50 last:border-0">
                                            <div className="flex items-center gap-3">
                                                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                                <span className="text-gray-600">Alguém completou uma formação</span>
                                            </div>
                                            {activity.score !== null && (
                                                <span className="font-medium text-gray-800">Score: {activity.score}%</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                ) : null}
            </div>
        </AppLayout>
    );
}
