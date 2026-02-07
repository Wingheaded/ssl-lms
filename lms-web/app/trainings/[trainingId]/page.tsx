"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { doc, getDoc, collection, query, where, getDocs, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { Training, Progress } from "@/lib/types";
import AppLayout from "@/components/AppLayout";
import { LoadingSpinner, ErrorState } from "@/components/StateComponents";

// Minimum watch time in seconds before "Mark as Watched" appears
const MIN_WATCH_TIME_SECONDS = 30;

export default function TrainingDetailPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const params = useParams();
    const trainingId = params.trainingId as string;

    const [training, setTraining] = useState<Training | null>(null);
    const [progress, setProgress] = useState<Progress | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Watch tracking
    const [watchTime, setWatchTime] = useState(0);
    const [canMarkWatched, setCanMarkWatched] = useState(false);
    const [markingWatched, setMarkingWatched] = useState(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push("/");
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        async function fetchData() {
            if (!user) return;

            try {
                // Fetch training
                const trainingDoc = await getDoc(doc(db, "trainings", trainingId));
                if (!trainingDoc.exists()) {
                    setError("Formação não encontrada");
                    return;
                }
                setTraining({ id: trainingDoc.id, ...trainingDoc.data() } as Training);

                // Fetch user progress for this training
                const progressQuery = query(
                    collection(db, "progress"),
                    where("userId", "==", user.uid),
                    where("trainingId", "==", trainingId)
                );
                const progressSnap = await getDocs(progressQuery);
                if (!progressSnap.empty) {
                    const progressData = progressSnap.docs[0];
                    setProgress({ id: progressData.id, ...progressData.data() } as Progress);
                }
            } catch (err) {
                console.error("Error fetching training:", err);
                setError("Não foi possível carregar a formação. Por favor, tente novamente.");
            } finally {
                setLoading(false);
            }
        }

        if (user && trainingId) {
            fetchData();
        }
    }, [user, trainingId]);

    // Watch time tracking
    useEffect(() => {
        if (progress?.watched) {
            setCanMarkWatched(false);
            return;
        }

        timerRef.current = setInterval(() => {
            setWatchTime(prev => {
                const newTime = prev + 1;
                if (newTime >= MIN_WATCH_TIME_SECONDS && !progress?.watched) {
                    setCanMarkWatched(true);
                }
                return newTime;
            });
        }, 1000);

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, [progress?.watched]);

    const handleMarkWatched = async () => {
        if (!user || !training) return;

        setMarkingWatched(true);
        try {
            const progressDocId = `${user.uid}_${trainingId}`;
            await setDoc(
                doc(db, "progress", progressDocId),
                {
                    userId: user.uid,
                    trainingId: trainingId,
                    watched: true,
                    score: null,
                    passed: false,
                    completedAt: null,
                    updatedAt: serverTimestamp()
                },
                { merge: true }
            );
            setProgress({
                id: progressDocId,
                userId: user.uid,
                trainingId: trainingId,
                watched: true,
                score: null,
                passed: false,
                completedAt: null
            });
            setCanMarkWatched(false);
        } catch (err) {
            console.error("Error marking as watched:", err);
            alert("Não foi possível guardar o progresso. Por favor, tente novamente.");
        } finally {
            setMarkingWatched(false);
        }
    };

    // Convert Google Drive URL to embed URL
    const getEmbedUrl = (driveUrl: string | undefined) => {
        if (!driveUrl) return "";

        // Handle YouTube embed URLs
        if (driveUrl.includes("youtube.com") || driveUrl.includes("youtu.be")) {
            return driveUrl;
        }

        // Handle various Google Drive URL formats
        const fileIdMatch = driveUrl.match(/\/d\/([a-zA-Z0-9_-]+)/);
        if (fileIdMatch) {
            return `https://drive.google.com/file/d/${fileIdMatch[1]}/preview`;
        }
        // If already an embed URL, return as is
        if (driveUrl.includes("/preview")) {
            return driveUrl;
        }
        return driveUrl;
    };

    if (authLoading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-cream">
                <LoadingSpinner />
            </div>
        );
    }

    if (loading) {
        return (
            <AppLayout>
                <LoadingSpinner message="A carregar formação..." />
            </AppLayout>
        );
    }

    if (error || !training) {
        return (
            <AppLayout>
                <ErrorState message={error || "Formação não encontrada"} />
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <div>
                {/* Breadcrumb */}
                <div className="mb-4">
                    <Link
                        href={`/brands/${training.brandId}/trainings`}
                        className="text-sm text-sage hover:underline"
                    >
                        ← Voltar às Formações
                    </Link>
                </div>

                {/* Header */}
                <h1 className="font-display text-2xl text-charcoal mb-2">
                    {training.title}
                </h1>
                <p className="text-charcoal/70 mb-6">
                    {training.description}
                </p>

                {/* Media Display */}
                {/* Media Display - Featured Content */}
                {(() => {
                    const mediaFiles = training.mediaFiles || [];

                    const featuredVideo = mediaFiles.find(f => f.type === "video" || f.type === "youtube");
                    const featuredAudio = !featuredVideo ? mediaFiles.find(f => f.type === "audio") : null;

                    // Filter out the featured item
                    const remainingFiles = mediaFiles.filter(f =>
                        f.id !== featuredVideo?.id && f.id !== featuredAudio?.id
                    );

                    // Split remaining files by type
                    const extraAudios = remainingFiles.filter(f => f.type === "audio");
                    const supportPdfs = remainingFiles.filter(f => f.type === "pdf");

                    // Helper to get embed URL from regular YouTube URL if needed
                    // (But ideally we stored the watch URL, so we can convert it or just rely on getEmbedUrl helper if it handles it)
                    const getYouTubeEmbed = (url: string) => {
                        if (url.includes('embed')) return url;
                        const v = url.split('v=')[1];
                        if (v) {
                            const id = v.split('&')[0];
                            return `https://www.youtube.com/embed/${id}`;
                        }
                        if (url.includes('youtu.be')) {
                            const id = url.split('/').pop();
                            return `https://www.youtube.com/embed/${id}`;
                        }
                        return url;
                    };

                    // Extra videos could technically exist (both uploads and youtube)
                    const extraVideos = remainingFiles.filter(f => f.type === "video" || f.type === "youtube");

                    // Determine what to show in Hero
                    const showMainVideo = !!featuredVideo;
                    const showMainAudio = !!featuredAudio;

                    // determine legacy video
                    const showLegacyVideo = !showMainVideo && !showMainAudio && !!training.mediaDriveUrl;

                    return (
                        <>
                            {/* HERO SECTION: Main Video or Audio */}
                            {(showMainVideo || showMainAudio || showLegacyVideo) && (
                                <div className="relative bg-black rounded-xl overflow-hidden mb-8 shadow-lg">
                                    <div className="aspect-video">
                                        {showMainVideo ? (
                                            featuredVideo!.type === 'youtube' ? (
                                                <iframe
                                                    src={getYouTubeEmbed(featuredVideo!.url)}
                                                    width="100%"
                                                    height="100%"
                                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                    allowFullScreen
                                                    className="border-0"
                                                />
                                            ) : (
                                                <video
                                                    src={featuredVideo!.url}
                                                    controls
                                                    className="w-full h-full object-contain"
                                                    poster={training.thumbnailUrl}
                                                // Optional: Add title track or caption if needed
                                                >
                                                    O seu browser não suporta vídeo HTML5.
                                                </video>
                                            )
                                        ) : showMainAudio ? (
                                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-100 to-amber-200">
                                                <div className="text-center p-8">
                                                    <span className="text-6xl mb-4 block">🎧</span>
                                                    <h3 className="text-xl font-medium text-amber-900 mb-2">
                                                        {featuredAudio!.title || featuredAudio!.fileName}
                                                    </h3>
                                                    <audio src={featuredAudio!.url} controls className="mt-4 w-64 md:w-96">
                                                        O seu browser não suporta áudio HTML5.
                                                    </audio>
                                                </div>
                                            </div>
                                        ) : (
                                            <iframe
                                                src={getEmbedUrl(training.mediaDriveUrl!)}
                                                width="100%"
                                                height="100%"
                                                allow="autoplay"
                                                allowFullScreen
                                                className="border-0"
                                            />
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* EXTRA MEDIA SECTION (Audios / Extra Videos) */}
                            {(extraAudios.length > 0 || extraVideos.length > 0) && (
                                <div className="space-y-4 mb-8">
                                    {extraAudios.map((file) => (
                                        <div key={file.id} className="bg-white rounded-lg border border-taupe/20 p-4 shadow-sm">
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="p-2 bg-sage/10 rounded-full text-sage">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
                                                        <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
                                                    </svg>
                                                </div>
                                                <span className="font-medium text-charcoal">
                                                    {file.title || file.fileName}
                                                </span>
                                            </div>
                                            <audio
                                                src={file.url}
                                                controls
                                                controlsList="nodownload"
                                                className="w-full h-10 bg-cream/20 rounded"
                                                style={{ borderRadius: '8px' }}
                                            />
                                        </div>
                                    ))}
                                    {extraVideos.map((file) => (
                                        <div key={file.id} className="bg-white rounded-lg border border-taupe/20 p-4 shadow-sm">
                                            <p className="font-medium text-charcoal mb-2">{file.title || file.fileName}</p>
                                            <div className="aspect-video bg-black rounded-lg overflow-hidden">
                                                {file.type === 'youtube' ? (
                                                    <iframe
                                                        src={getYouTubeEmbed(file.url)}
                                                        width="100%"
                                                        height="100%"
                                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                        allowFullScreen
                                                        className="border-0"
                                                    />
                                                ) : (
                                                    <video src={file.url} controls className="w-full h-full" />
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* MATERIAL DE APOIO SECTION (PDFs ONLY) */}
                            {supportPdfs.length > 0 && (
                                <div className="bg-white rounded-xl border border-taupe/30 p-6 mb-8 shadow-sm">
                                    <h3 className="text-lg font-display text-charcoal mb-4 flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-sage">
                                            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                                            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                                        </svg>
                                        Material de Apoio
                                    </h3>
                                    <div className="grid gap-3">
                                        {supportPdfs.map((file) => (
                                            <a
                                                key={file.id}
                                                href={file.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center justify-between p-4 bg-white hover:bg-cream/50 rounded-lg border border-taupe/20 hover:border-sage/50 transition-all group"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="p-2 bg-cream rounded-lg text-sage group-hover:bg-sage/10 transition-colors">
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                                                            <polyline points="14 2 14 8 20 8"></polyline>
                                                        </svg>
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-charcoal group-hover:text-sage-dark transition-colors">
                                                            {file.title || file.fileName}
                                                        </p>
                                                        <p className="text-xs text-charcoal/50 uppercase tracking-wide">
                                                            PDF
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-taupe group-hover:text-sage transition-colors">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                        <polyline points="7 10 12 15 17 10"></polyline>
                                                        <line x1="12" y1="15" x2="12" y2="3"></line>
                                                    </svg>
                                                </div>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    );
                })()}

                {/* Watch Progress / Mark as Watched */}
                {!progress?.watched && (
                    <div className="bg-white rounded-lg border border-taupe/30 p-4 mb-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-charcoal/60">
                                    {canMarkWatched
                                        ? "Pronto para continuar?"
                                        : `Tempo de visualização: ${watchTime}s / ${MIN_WATCH_TIME_SECONDS}s`}
                                </p>
                                {!canMarkWatched && (
                                    <p className="text-xs text-charcoal/40 mt-1">
                                        Assista pelo menos {MIN_WATCH_TIME_SECONDS} segundos para desbloquear o quiz
                                    </p>
                                )}
                            </div>
                            {canMarkWatched && (
                                <button
                                    onClick={handleMarkWatched}
                                    disabled={markingWatched}
                                    className="btn-primary"
                                >
                                    {markingWatched ? "A guardar..." : "Marcar como Visto"}
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Quiz Button */}
                <div className="flex gap-4">
                    <button
                        onClick={() => router.push(`/trainings/${trainingId}/quiz`)}
                        disabled={!progress?.watched}
                        className="btn-primary flex-1"
                    >
                        {progress?.watched
                            ? (progress?.passed ? "Repetir Quiz" : "Iniciar Quiz")
                            : "Complete o vídeo para desbloquear o quiz"}
                    </button>
                </div>

                {/* Previous Score */}
                {progress?.score !== null && progress?.score !== undefined && (
                    <div className={`mt-4 p-4 rounded-lg ${progress.passed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} border`}>
                        <p className={`text-sm ${progress.passed ? 'text-green-700' : 'text-red-700'}`}>
                            Tentativa anterior: <strong>{progress.score}%</strong>
                            {progress.passed ? " - Aprovado ✓" : " - Tente outra vez (mínimo 90%)"}
                        </p>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
