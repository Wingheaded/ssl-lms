"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import AppLayout from "@/components/AppLayout";

export default function AdminPage() {
    const { user, loading, isAdmin } = useAuth();
    const router = useRouter();
    // Layout handles protection now


    return (
        <AppLayout>
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-light text-gray-800 mb-2">
                    Painel de Administração
                </h1>
                <p className="text-gray-600 mb-8">
                    Gerir conteúdos e formações da plataforma
                </p>

                <div className="grid gap-6 md:grid-cols-2">
                    {/* Manage Trainings */}
                    <Link
                        href="/admin/trainings"
                        className="block p-6 bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:border-amber-200 transition-all"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                                <span className="text-2xl">📚</span>
                            </div>
                            <div>
                                <h2 className="text-lg font-medium text-gray-800">
                                    Gerir Formações
                                </h2>
                                <p className="text-sm text-gray-500">
                                    Upload de vídeos, áudios e PDFs
                                </p>
                            </div>
                        </div>
                    </Link>

                    {/* Manage Brands */}
                    <Link
                        href="/admin/brands"
                        className="block p-6 bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:border-amber-200 transition-all"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                                <span className="text-2xl">🏷️</span>
                            </div>
                            <div>
                                <h2 className="text-lg font-medium text-gray-800">
                                    Gerir Marcas
                                </h2>
                                <p className="text-sm text-gray-500">
                                    Adicionar e editar marcas
                                </p>
                            </div>
                        </div>
                    </Link>

                    {/* View Users */}
                    <Link
                        href="/admin/users"
                        className="block p-6 bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:border-amber-200 transition-all"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                                <span className="text-2xl">👥</span>
                            </div>
                            <div>
                                <h2 className="text-lg font-medium text-gray-800">
                                    Utilizadores
                                </h2>
                                <p className="text-sm text-gray-500">
                                    Ver progresso dos utilizadores
                                </p>
                            </div>
                        </div>
                    </Link>

                    {/* Analytics (future) */}
                    {/* Analytics */}
                    <Link
                        href="/admin/stats"
                        className="block p-6 bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:border-amber-200 transition-all"
                    >
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                                <span className="text-2xl">📊</span>
                            </div>
                            <div>
                                <h2 className="text-lg font-medium text-gray-800">
                                    Estatísticas
                                </h2>
                                <p className="text-sm text-gray-500">
                                    Ver métricas e relatórios
                                </p>
                            </div>
                        </div>
                    </Link>
                </div>
            </div>
        </AppLayout>
    );
}
