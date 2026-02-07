"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import AppLayout from "@/components/AppLayout";
import { Training, Brand } from "@/lib/types";

export default function AdminTrainingsPage() {
    const { user, loading, isAdmin } = useAuth();
    const router = useRouter();
    const [trainings, setTrainings] = useState<(Training & { brandName: string })[]>([]);
    const [brands, setBrands] = useState<Brand[]>([]);
    const [loadingData, setLoadingData] = useState(true);



    useEffect(() => {
        async function fetchData() {
            if (!user || !isAdmin) return;

            try {
                // Fetch brands
                const brandsSnap = await getDocs(collection(db, "brands"));
                const brandsData = brandsSnap.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as Brand[];
                setBrands(brandsData);

                // Fetch all trainings
                const trainingsSnap = await getDocs(
                    query(collection(db, "trainings"), orderBy("title"))
                );
                const trainingsData = trainingsSnap.docs.map(doc => {
                    const data = doc.data();
                    const brand = brandsData.find(b => b.id === data.brandId);
                    return {
                        id: doc.id,
                        ...data,
                        brandName: brand?.name || "Sem marca"
                    };
                }) as (Training & { brandName: string })[];

                setTrainings(trainingsData);
            } catch (err) {
                console.error("Error fetching data:", err);
            } finally {
                setLoadingData(false);
            }
        }

        fetchData();
    }, [user, isAdmin]);

    if (loading || loadingData) {
        return (
            <AppLayout>
                <div className="flex items-center justify-center min-h-[50vh]">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-700"></div>
                </div>
            </AppLayout>
        );
    }

    const getMediaIcons = (training: Training) => {
        const types = new Set<string>();

        // Check new media files
        if (training.mediaFiles) {
            training.mediaFiles.forEach(file => types.add(file.type));
        }

        // Check legacy media type
        if (training.mediaType) {
            types.add(training.mediaType);
        }

        // Return mixed icons
        if (types.size === 0) return <span title="Sem conteúdo">📁</span>;

        return (
            <div className="flex gap-1">
                {types.has("video") && <span title="Vídeo">🎬</span>}
                {types.has("youtube") && <span title="YouTube">▶️</span>}
                {types.has("audio") && <span title="Áudio">🎧</span>}
                {types.has("pdf") && <span title="PDF">📄</span>}
            </div>
        );
    };

    return (
        <AppLayout>
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <Link
                            href="/admin"
                            className="text-amber-700 hover:text-amber-800 text-sm mb-2 inline-block"
                        >
                            ← Voltar ao Painel
                        </Link>
                        <h1 className="text-3xl font-light text-gray-800">
                            Gerir Formações
                        </h1>
                    </div>
                    <Link
                        href="/admin/trainings/new"
                        className="px-4 py-2 bg-amber-700 text-white rounded-lg hover:bg-amber-800 transition-colors"
                    >
                        + Nova Formação
                    </Link>
                </div>

                {trainings.length === 0 ? (
                    <div className="text-center py-12 bg-gray-50 rounded-xl">
                        <p className="text-gray-500">Nenhuma formação encontrada.</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="text-left px-6 py-4 text-sm font-medium text-gray-600">
                                        Formação
                                    </th>
                                    <th className="text-left px-6 py-4 text-sm font-medium text-gray-600">
                                        Marca
                                    </th>
                                    <th className="text-left px-6 py-4 text-sm font-medium text-gray-600">
                                        Tipo
                                    </th>
                                    <th className="text-left px-6 py-4 text-sm font-medium text-gray-600">
                                        Media
                                    </th>
                                    <th className="text-right px-6 py-4 text-sm font-medium text-gray-600">
                                        Ações
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {trainings.map((training) => (
                                    <tr key={training.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4">
                                            <div>
                                                <p className="font-medium text-gray-800">
                                                    {training.title}
                                                </p>
                                                <p className="text-sm text-gray-500 truncate max-w-xs">
                                                    {training.description}
                                                </p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">
                                            {training.brandName}
                                        </td>
                                        <td className="px-6 py-4">
                                            {getMediaIcons(training)}
                                        </td>
                                        <td className="px-6 py-4">
                                            {(training.mediaFiles?.length || 0) > 0 ? (
                                                <span className="text-green-600 text-sm">
                                                    ✓ {training.mediaFiles?.length} ficheiro{(training.mediaFiles?.length || 0) > 1 ? 's' : ''}
                                                </span>
                                            ) : training.mediaUrl ? (
                                                <span className="text-green-600 text-sm">✓ 1 ficheiro</span>
                                            ) : (
                                                <span className="text-amber-600 text-sm">Sem media</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <Link
                                                href={`/admin/trainings/${training.id}`}
                                                className="text-amber-700 hover:text-amber-800 text-sm font-medium"
                                            >
                                                Editar
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
