"use client";

import Image from "next/image";
import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { doc, getDoc, collection, query, where, getDocs, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { Training, Progress } from "@/lib/types";
import AppLayout from "@/components/AppLayout";
import FlashcardPlayer from "@/components/FlashcardPlayer";
import { LoadingSpinner, ErrorState } from "@/components/StateComponents";
import { getOrderedTrainingContent } from "@/lib/training-content";

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
    const [selectedImage, setSelectedImage] = useState<{
        url: string;
        alt: string;
        title: string;
    } | null>(null);

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

    useEffect(() => {
        if (!selectedImage) return;

        const previousOverflow = document.body.style.overflow;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                setSelectedImage(null);
            }
        };

        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [selectedImage]);

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

    const getYouTubeEmbed = (url: string) => {
        if (url.includes("embed")) {
            return url;
        }

        const videoId = url.split("v=")[1];
        if (videoId) {
            return `https://www.youtube.com/embed/${videoId.split("&")[0]}`;
        }

        if (url.includes("youtu.be")) {
            return `https://www.youtube.com/embed/${url.split("/").pop()}`;
        }

        return url;
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

    const orderedContent = getOrderedTrainingContent(training);

    return (
        <AppLayout>
            <>
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
                {orderedContent.length > 0 ? (
                    <div className="mb-8 space-y-6">
                        {orderedContent.map((content) => {
                            if (content.kind === "flashcards") {
                                return <FlashcardPlayer key={content.id} activity={content.item} />;
                            }

                            const file = content.item;
                            const fileTitle = file.title || file.fileName;

                            if (file.type === "video" || file.type === "youtube") {
                                return (
                                    <section key={file.id} className="overflow-hidden rounded-xl border border-taupe/20 bg-white shadow-sm">
                                        <div className="border-b border-taupe/10 px-5 py-4">
                                            <p className="text-sm font-medium text-charcoal">{fileTitle}</p>
                                        </div>
                                        <div className="aspect-video bg-black">
                                            {file.type === "youtube" ? (
                                                <iframe
                                                    src={getYouTubeEmbed(file.url)}
                                                    width="100%"
                                                    height="100%"
                                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                    allowFullScreen
                                                    className="border-0"
                                                />
                                            ) : (
                                                <video
                                                    src={file.url}
                                                    controls
                                                    className="h-full w-full object-contain"
                                                    poster={training.thumbnailUrl}
                                                >
                                                    O seu browser não suporta vídeo HTML5.
                                                </video>
                                            )}
                                        </div>
                                    </section>
                                );
                            }

                            if (file.type === "audio") {
                                return (
                                    <section key={file.id} className="rounded-xl border border-taupe/20 bg-white p-5 shadow-sm">
                                        <div className="mb-4 flex items-center gap-3">
                                            <div className="rounded-full bg-sage/10 p-2 text-sage">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
                                                    <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
                                                </svg>
                                            </div>
                                            <p className="font-medium text-charcoal">{fileTitle}</p>
                                        </div>
                                        <audio
                                            src={file.url}
                                            controls
                                            controlsList="nodownload"
                                            className="h-10 w-full rounded bg-cream/20"
                                            style={{ borderRadius: "8px" }}
                                        />
                                    </section>
                                );
                            }

                            if (file.type === "image") {
                                return (
                                    <button
                                        key={file.id}
                                        type="button"
                                        onClick={() => setSelectedImage({
                                            url: file.url,
                                            alt: fileTitle,
                                            title: fileTitle
                                        })}
                                        aria-label={`Abrir imagem ${fileTitle}`}
                                        className="group block w-full cursor-pointer overflow-hidden rounded-xl border border-taupe/20 bg-white text-left shadow-sm transition-all hover:border-sage/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2"
                                    >
                                        <div className="relative h-72 w-full">
                                            <Image
                                                src={file.url}
                                                alt={fileTitle}
                                                fill
                                                unoptimized
                                                sizes="100vw"
                                                className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                                            />
                                        </div>
                                        <div className="border-t border-taupe/10 px-5 py-4">
                                            <p className="font-medium text-charcoal group-hover:text-sage-dark transition-colors">
                                                {fileTitle}
                                            </p>
                                        </div>
                                    </button>
                                );
                            }

                            return (
                                <a
                                    key={file.id}
                                    href={file.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-between rounded-xl border border-taupe/20 bg-white p-5 shadow-sm transition-all hover:border-sage/50 hover:bg-cream/40"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="rounded-lg bg-cream p-2 text-sage">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path>
                                                <polyline points="14 2 14 8 20 8"></polyline>
                                            </svg>
                                        </div>
                                        <div>
                                            <p className="font-medium text-charcoal">{fileTitle}</p>
                                            <p className="text-xs uppercase tracking-wide text-charcoal/50">PDF</p>
                                        </div>
                                    </div>
                                    <div className="text-taupe transition-colors hover:text-sage">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                            <polyline points="7 10 12 15 17 10"></polyline>
                                            <line x1="12" y1="15" x2="12" y2="3"></line>
                                        </svg>
                                    </div>
                                </a>
                            );
                        })}
                    </div>
                ) : training.mediaDriveUrl ? (
                    <div className="relative mb-8 overflow-hidden rounded-xl bg-black shadow-lg">
                        <div className="aspect-video">
                            <iframe
                                src={getEmbedUrl(training.mediaDriveUrl)}
                                width="100%"
                                height="100%"
                                allow="autoplay"
                                allowFullScreen
                                className="border-0"
                            />
                        </div>
                    </div>
                ) : null}

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

                {selectedImage && (
                    <div
                        className="fixed inset-0 z-50 bg-black/70 p-4 sm:p-6"
                        onClick={() => setSelectedImage(null)}
                    >
                        <div className="flex min-h-full items-center justify-center">
                            <div
                                role="dialog"
                                aria-modal="true"
                                aria-labelledby="support-image-modal-title"
                                className="relative w-full max-w-5xl rounded-2xl bg-white shadow-2xl"
                                onClick={(event) => event.stopPropagation()}
                            >
                                <div className="flex items-start justify-between gap-4 border-b border-taupe/20 px-5 py-4 sm:px-6">
                                    <h2
                                        id="support-image-modal-title"
                                        className="font-display text-xl text-charcoal"
                                    >
                                        {selectedImage.title}
                                    </h2>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedImage(null)}
                                        className="inline-flex items-center gap-2 rounded-lg border border-taupe/30 px-3 py-2 text-sm font-medium text-charcoal transition-colors hover:bg-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                            <path d="M18 6 6 18"></path>
                                            <path d="m6 6 12 12"></path>
                                        </svg>
                                        Fechar
                                    </button>
                                </div>
                                <div className="flex items-center justify-center p-4 sm:p-6">
                                    <Image
                                        src={selectedImage.url}
                                        alt={selectedImage.alt}
                                        width={1600}
                                        height={1200}
                                        unoptimized
                                        sizes="100vw"
                                        className="h-auto max-h-[85vh] w-full rounded-lg object-contain"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </>
        </AppLayout>
    );
}
