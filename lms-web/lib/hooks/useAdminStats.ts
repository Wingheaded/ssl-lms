import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Training, Progress, Brand } from "@/lib/types";

export interface TrainingStats {
    trainingId: string;
    trainingTitle: string;
    brandName: string;
    starts: number;
    completions: number;
    avgScore: number;
}

export interface AdminStats {
    totalUsers: number;
    activeTrainings: number;
    totalCompletions: number;
    globalSuccessRate: number;
    trainingStats: TrainingStats[];
    recentActivity: Progress[];
}

export function useAdminStats() {
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchStats() {
            try {
                // 1. Fetch Users (Count only for MVP, or full list if needed)
                // Note: Client-side counting of all users isn't scalable long-term, 
                // but okay for MVP < 1000 users.
                const usersSnap = await getDocs(collection(db, "users"));
                const totalUsers = usersSnap.size;

                // 2. Fetch Trainings & Brands
                const trainingsSnap = await getDocs(collection(db, "trainings"));
                const brandsSnap = await getDocs(collection(db, "brands"));

                const brandsMap = new Map<string, string>();
                brandsSnap.docs.forEach(doc => {
                    const data = doc.data() as Brand;
                    brandsMap.set(doc.id, data.name);
                });

                const trainings: Training[] = [];
                trainingsSnap.docs.forEach(doc => {
                    trainings.push({ id: doc.id, ...doc.data() } as Training);
                });

                const activeTrainings = trainings.filter(t => t.isActive).length;

                // 3. Fetch All Progress (The heavy part)
                // For MVP, we fetch all progress docs. optimize later with aggregation queries.
                const progressSnap = await getDocs(collection(db, "progress"));
                const allProgress: Progress[] = [];
                progressSnap.docs.forEach(doc => {
                    allProgress.push({ id: doc.id, ...doc.data() } as Progress);
                });

                // 4. Calculate Stats
                let totalCompletions = 0;
                let totalStarts = 0;

                const tStatsMap = new Map<string, { starts: number; completions: number; totalScore: number; scoreCount: number; }>();

                // Initialize map
                trainings.forEach(t => {
                    tStatsMap.set(t.id, { starts: 0, completions: 0, totalScore: 0, scoreCount: 0 });
                });

                allProgress.forEach(p => {
                    const tStat = tStatsMap.get(p.trainingId);
                    if (!tStat) return; // Progress for deleted training?

                    if (p.watched) {
                        tStat.starts++;
                        totalStarts++;
                    }

                    if (p.passed) {
                        tStat.completions++;
                        totalCompletions++;
                    }

                    if (p.score !== null && p.score !== undefined) {
                        tStat.totalScore += p.score;
                        tStat.scoreCount++;
                    }
                });

                // Global Success Rate
                const globalSuccessRate = totalStarts > 0 ? (totalCompletions / totalStarts) * 100 : 0;

                // Per-Training Stats
                const trainingStats: TrainingStats[] = trainings.map(t => {
                    const s = tStatsMap.get(t.id) || { starts: 0, completions: 0, totalScore: 0, scoreCount: 0 };
                    return {
                        trainingId: t.id,
                        trainingTitle: t.title,
                        brandName: brandsMap.get(t.brandId) || "Unknown",
                        starts: s.starts,
                        completions: s.completions,
                        avgScore: s.scoreCount > 0 ? s.totalScore / s.scoreCount : 0
                    };
                });

                // Recent Activity (Completed only)
                const recentActivity = allProgress
                    .filter(p => p.passed && p.completedAt)
                    // @ts-ignore - Firestore timestamp vs Date annoyance, handling loosely here or needing conversion
                    .sort((a, b) => (b.completedAt?.seconds || 0) - (a.completedAt?.seconds || 0))
                    .slice(0, 10);

                setStats({
                    totalUsers,
                    activeTrainings,
                    totalCompletions,
                    globalSuccessRate,
                    trainingStats,
                    recentActivity
                });

            } catch (err: any) {
                console.error("Error fetching stats:", err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }

        fetchStats();
    }, []);

    return { stats, loading, error };
}
