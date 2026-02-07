import React from "react";
import { TrainingStats } from "@/lib/hooks/useAdminStats";

interface TrainingStatsTableProps {
    data: TrainingStats[];
}

export default function TrainingStatsTable({ data }: TrainingStatsTableProps) {
    return (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100">
                <h2 className="text-lg font-bold text-gray-800">Detalhes por Formação</h2>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-500 uppercase font-medium">
                        <tr>
                            <th className="px-6 py-4">Formação</th>
                            <th className="px-6 py-4">Marca</th>
                            <th className="px-6 py-4 text-center">Iniciados</th>
                            <th className="px-6 py-4 text-center">Concluídos</th>
                            <th className="px-6 py-4 text-right">Média Quiz</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {data.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-8 text-center text-gray-400">
                                    Nenhum dado disponível
                                </td>
                            </tr>
                        ) : (
                            data.map((stat) => (
                                <tr key={stat.trainingId} className="hover:bg-gray-50/50">
                                    <td className="px-6 py-4 font-medium text-gray-800">
                                        {stat.trainingTitle}
                                    </td>
                                    <td className="px-6 py-4 text-gray-600">
                                        {stat.brandName}
                                    </td>
                                    <td className="px-6 py-4 text-center text-gray-600">
                                        {stat.starts}
                                    </td>
                                    <td className="px-6 py-4 text-center text-gray-600">
                                        {stat.completions}
                                    </td>
                                    <td className="px-6 py-4 text-right font-medium text-green-600">
                                        {stat.avgScore > 0 ? `${stat.avgScore.toFixed(1)}%` : "-"}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
