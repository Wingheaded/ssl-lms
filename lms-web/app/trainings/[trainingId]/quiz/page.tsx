"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { Training } from "@/lib/types";
import AppLayout from "@/components/AppLayout";
import { LoadingSpinner, ErrorState } from "@/components/StateComponents";

// AI Quiz Question Interface
interface AIQuestion {
    id: number;
    question: string;
    type: "single" | "boolean" | "multiple";
    options: string[];
}

export default function QuizPage() {
    const { user, loading: authLoading } = useAuth();
    const router = useRouter();
    const params = useParams();
    const trainingId = params.trainingId as string;
    const isGenerated = useRef(false);

    const [training, setTraining] = useState<Training | null>(null);
    const [questions, setQuestions] = useState<AIQuestion[]>([]);
    const [sessionId, setSessionId] = useState<string | null>(null);

    // Store selected indices as strings matching the option index
    // e.g. "0", "1" etc.
    const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number[]>>({});
    const [lockedQuestions, setLockedQuestions] = useState<Record<number, boolean>>({});
    const [feedbackByQuestion, setFeedbackByQuestion] = useState<
        Record<number, { isCorrect: boolean; correctIndices: number[] }>
    >({});
    const [activePopup, setActivePopup] = useState<{ questionId: number; isCorrect: boolean } | null>(null);
    const popupTimerRef = useRef<NodeJS.Timeout | null>(null);
    const [lockingQuestionId, setLockingQuestionId] = useState<number | null>(null);

    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!authLoading && !user) {
            router.push("/");
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        return () => {
            if (popupTimerRef.current) {
                clearTimeout(popupTimerRef.current);
            }
        };
    }, []);

    useEffect(() => {
        async function initQuiz() {
            if (!user || isGenerated.current) return;

            try {
                // 1. Check if watched
                const progressQuery = query(
                    collection(db, "progress"),
                    where("userId", "==", user.uid),
                    where("trainingId", "==", trainingId)
                );
                const progressSnap = await getDocs(progressQuery);
                if (progressSnap.empty || !progressSnap.docs[0].data().watched) {
                    // router.push(`/trainings/${trainingId}`);
                    // return;
                    // Allow for dev testing without watching, but ideally uncomment above
                }

                // 2. Fetch Training Info
                const trainingDoc = await getDoc(doc(db, "trainings", trainingId));
                if (!trainingDoc.exists()) {
                    setError("Formação não encontrada");
                    setLoading(false);
                    return;
                }
                setTraining({ id: trainingDoc.id, ...trainingDoc.data() } as Training);

                // 3. Generate Quiz (only once)
                setGenerating(true);
                isGenerated.current = true; // Prevent double firing

                const generateQuizFn = httpsCallable(functions, "generateQuiz");
                const result = await generateQuizFn({ trainingId });
                const data = result.data as { sessionId: string; questions: AIQuestion[] };

                setSessionId(data.sessionId);
                setQuestions(data.questions);

                // Initialize answers
                const initial: Record<number, number[]> = {};
                const initialLocks: Record<number, boolean> = {};
                data.questions.forEach(q => initial[q.id] = []);
                data.questions.forEach(q => initialLocks[q.id] = false);
                setSelectedAnswers(initial);
                setLockedQuestions(initialLocks);

            } catch (err: any) {
                console.error("Error generating quiz:", err);
                setError(err.message || "Erro ao gerar quiz. Tente novamente.");
            } finally {
                setLoading(false);
                setGenerating(false);
            }
        }

        if (user && trainingId) {
            initQuiz();
        }
    }, [user, trainingId]);

    const handleAnswerSelect = (questionId: number, optionIndex: number, type: string) => {
        if (lockedQuestions[questionId]) return;
        setSelectedAnswers(prev => {
            const current = prev[questionId] || [];

            if (type === "multiple") {
                // Toggle
                if (current.includes(optionIndex)) {
                    return { ...prev, [questionId]: current.filter(i => i !== optionIndex) };
                } else {
                    return { ...prev, [questionId]: [...current, optionIndex] };
                }
            } else {
                // Single/Boolean - replace
                return { ...prev, [questionId]: [optionIndex] };
            }
        });
    };

    const isAllAnswered = () => {
        return questions.length > 0 && questions.every(q => (selectedAnswers[q.id] || []).length > 0);
    };

    const isAllLocked = () => {
        return questions.length > 0 && questions.every(q => lockedQuestions[q.id]);
    };

    const handleLockAnswer = async (questionId: number) => {
        if (!sessionId) {
            alert("Erro de sessão. Por favor recarregue a página.");
            return;
        }

        const selectedIndices = selectedAnswers[questionId] || [];
        if (selectedIndices.length === 0) return;

        setLockingQuestionId(questionId);
        try {
            const checkAnswerFn = httpsCallable(functions, "checkAnswer");
            const result = await checkAnswerFn({
                trainingId,
                sessionId,
                questionIndex: questionId,
                selectedIndices
            });

            const data = result.data as { isCorrect: boolean; correctIndices: number[] };

            setFeedbackByQuestion(prev => ({
                ...prev,
                [questionId]: {
                    isCorrect: data.isCorrect,
                    correctIndices: data.correctIndices || []
                }
            }));

            setLockedQuestions(prev => ({
                ...prev,
                [questionId]: true
            }));

            setActivePopup({ questionId, isCorrect: data.isCorrect });
            if (popupTimerRef.current) {
                clearTimeout(popupTimerRef.current);
            }
            popupTimerRef.current = setTimeout(() => {
                setActivePopup(prev => (prev?.questionId === questionId ? null : prev));
            }, 2000);
        } catch (err: any) {
            console.error("Error checking answer:", err);
            const message = err?.details || err?.message || "Erro interno";
            alert("Erro ao validar resposta: " + message);
        } finally {
            setLockingQuestionId(null);
        }
    };

    const handleSubmit = async () => {
        if (!isAllLocked()) return;
        if (!sessionId) {
            alert("Erro de sessão. Por favor recarregue a página.");
            return;
        }

        setSubmitting(true);
        try {
            const submitQuizFn = httpsCallable(functions, "submitQuiz");
            const result = await submitQuizFn({
                trainingId,
                sessionId,
                answers: selectedAnswers
            });

            const data = result.data as { score: number; passed: boolean };
            router.push(`/trainings/${trainingId}/result?score=${data.score}&passed=${data.passed}`);

        } catch (err: any) {
            console.error("Error submitting:", err);
            alert("Erro ao submeter: " + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    if (authLoading || !user) return <div className="min-h-screen bg-cream"><LoadingSpinner /></div>;

    if (error) {
        return (
            <AppLayout>
                <ErrorState message={error} onRetry={() => window.location.reload()} />
            </AppLayout>
        );
    }

    if (generating || loading) {
        return (
            <AppLayout>
                <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
                    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-sage"></div>
                    <p className="text-charcoal font-medium animate-pulse">
                        A criar um quiz personalizado para si...
                    </p>
                    <p className="text-sm text-gray-500">
                        A Inteligência Artificial está a ler o conteúdo e a preparar perguntas únicas.
                    </p>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <div className="max-w-2xl mx-auto pb-12">
                {/* Header */}
                <div className="mb-8">
                    <Link href={`/trainings/${trainingId}`} className="text-sm text-sage hover:underline">
                        ← Voltar à Formação
                    </Link>
                    <h1 className="font-display text-2xl text-charcoal mt-4">
                        Quiz IA: {training?.title}
                    </h1>
                    <div className="flex gap-2 mt-2">
                        <span className="bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-full font-medium">
                            Gerado por IA
                        </span>
                        <span className="bg-sage/10 text-sage text-xs px-2 py-1 rounded-full font-medium">
                            Pontuação Mínima: 90%
                        </span>
                    </div>
                </div>

                {/* Questions List */}
                <div className="space-y-8">
                    {questions.map((q, index) => (
                        <div key={q.id} className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm relative">
                            <h3 className="text-lg font-medium text-charcoal mb-4">
                                <span className="text-sage font-display mr-2">{index + 1}.</span>
                                {q.question}
                            </h3>

                            {activePopup?.questionId === q.id && (
                                <div className={`absolute top-4 right-4 px-3 py-2 rounded-lg text-xs font-medium shadow-md ${activePopup.isCorrect ? "bg-green-100 text-green-700 border border-green-200" : "bg-red-100 text-red-700 border border-red-200"}`}>
                                    {activePopup.isCorrect ? "Correto ✅" : "Incorreto ❌"}
                                </div>
                            )}

                            {/* Options */}
                            <div className="space-y-2">
                                {q.options.map((opt, optIndex) => {
                                    const isSelected = (selectedAnswers[q.id] || []).includes(optIndex);
                                    const feedback = feedbackByQuestion[q.id];
                                    const isLocked = lockedQuestions[q.id];
                                    const isCorrectOption = !!feedback?.correctIndices?.includes(optIndex);
                                    const isWrongSelected = isLocked && isSelected && !isCorrectOption;

                                    return (
                                        <label
                                            key={optIndex}
                                            className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${isLocked ? "cursor-not-allowed" : "cursor-pointer"} ${isCorrectOption
                                                ? "border-green-500 bg-green-50"
                                                : isWrongSelected
                                                    ? "border-red-500 bg-red-50"
                                                    : isSelected
                                                        ? "border-sage bg-sage/5 ring-1 ring-sage"
                                                        : "border-gray-200 hover:border-sage/50 hover:bg-gray-50"
                                                }`}
                                        >
                                            <div className="mt-0.5">
                                                {q.type === 'multiple' ? (
                                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isCorrectOption
                                                        ? "bg-green-500 border-green-500 text-white"
                                                        : isWrongSelected
                                                            ? "bg-red-500 border-red-500 text-white"
                                                            : isSelected
                                                                ? "bg-sage border-sage text-white"
                                                                : "border-gray-300 bg-white"
                                                        }`}>
                                                        {isSelected && <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                                    </div>
                                                ) : (
                                                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${isCorrectOption
                                                        ? "border-green-500"
                                                        : isWrongSelected
                                                            ? "border-red-500"
                                                            : isSelected
                                                                ? "border-sage"
                                                                : "border-gray-300 bg-white"
                                                        }`}>
                                                        {isSelected && <div className={`w-3 h-3 rounded-full ${isWrongSelected ? "bg-red-500" : isCorrectOption ? "bg-green-500" : "bg-sage"}`} />}
                                                    </div>
                                                )}
                                            </div>

                                            <span className="text-sm text-gray-700 pt-0.5">{opt}</span>

                                            {/* Hidden Input for A11y/Form behavior */}
                                            <input
                                                type={q.type === 'multiple' ? "checkbox" : "radio"}
                                                name={`question-${q.id}`}
                                                className="sr-only"
                                                checked={isSelected}
                                                onChange={() => handleAnswerSelect(q.id, optIndex, q.type)}
                                                disabled={lockedQuestions[q.id]}
                                            />
                                        </label>
                                    );
                                })}
                            </div>

                            {/* Helper text for multiple choice */}
                            {q.type === 'multiple' && (
                                <p className="text-xs text-gray-400 mt-2 italic">
                                    * Selecione todas as opções corretas
                                </p>
                            )}

                            <div className="mt-4 flex items-center justify-end">
                                <button
                                    onClick={() => handleLockAnswer(q.id)}
                                    disabled={(selectedAnswers[q.id] || []).length === 0 || lockedQuestions[q.id] || lockingQuestionId === q.id}
                                    className="px-4 py-2 text-sm rounded-lg bg-sage text-white hover:bg-sage/90 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {lockedQuestions[q.id]
                                        ? "Resposta bloqueada"
                                        : lockingQuestionId === q.id
                                            ? "A validar..."
                                            : "Bloquear resposta"}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Submit */}
                <div className="mt-8 sticky bottom-4 z-10">
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm -z-10 rounded-xl" />
                    <button
                        onClick={handleSubmit}
                        disabled={submitting || !isAllLocked()}
                        className="btn-primary w-full shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {submitting ? (
                            <div className="flex items-center justify-center gap-2">
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                A validar...
                            </div>
                        ) : (
                            "Submeter Respostas"
                        )}
                    </button>
                    {!isAllAnswered() && (
                        <p className="text-center text-xs text-gray-400 mt-2">
                            Responda e bloqueie todas as 5 questões para continuar
                        </p>
                    )}
                    {isAllAnswered() && !isAllLocked() && (
                        <p className="text-center text-xs text-gray-400 mt-2">
                            Bloqueie todas as respostas para submeter
                        </p>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
