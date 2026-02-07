import React from "react";

interface StatsCardProps {
    title: string;
    value: string | number;
    icon: string;
    colorClass: string; // e.g., "bg-blue-100 text-blue-600"
    subtext?: string;
}

export default function StatsCard({ title, value, icon, colorClass, subtext }: StatsCardProps) {
    return (
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-start gap-4">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl ${colorClass}`}>
                {icon}
            </div>
            <div>
                <p className="text-gray-500 text-sm font-medium">{title}</p>
                <h3 className="text-2xl font-bold text-gray-800 mt-1">{value}</h3>
                {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
            </div>
        </div>
    );
}
