"use client";

import { useState } from "react";
import { FlashcardActivity } from "@/lib/types";

interface FlashcardPlayerProps {
    activity: FlashcardActivity;
}

type Assessment = "known" | "review";

export default function FlashcardPlayer({ activity }: FlashcardPlayerProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [completed, setCompleted] = useState(false);
    const [assessments, setAssessments] = useState<Record<number, Assessment>>({});

    const totalCards = activity.cards.length;
    const currentCard = activity.cards[currentIndex];
    const knownCount = Object.values(assessments).filter((value) => value === "known").length;
    const reviewCount = Object.values(assessments).filter((value) => value === "review").length;
    const reviewedCount = knownCount + reviewCount;
    const progressPercentage = completed
        ? 100
        : totalCards > 0
            ? Math.round(((currentIndex + 1) / totalCards) * 100)
            : 0;

    const goToNext = () => {
        if (currentIndex >= totalCards - 1) {
            setCompleted(true);
            setIsFlipped(false);
            return;
        }

        setIsFlipped(false);
        setCurrentIndex((value) => value + 1);
    };

    const goToPrevious = () => {
        if (currentIndex === 0) return;
        setCompleted(false);
        setIsFlipped(false);
        setCurrentIndex((value) => value - 1);
    };

    const handleAssess = (assessment: Assessment) => {
        if (!currentCard) return;

        setAssessments((value) => ({
            ...value,
            [currentCard.id]: assessment
        }));
        goToNext();
    };

    const restart = () => {
        setCurrentIndex(0);
        setIsFlipped(false);
        setCompleted(false);
        setAssessments({});
    };

    if (!currentCard && !completed) {
        return null;
    }

    return (
        <section className="relative mb-8 overflow-hidden rounded-[2rem] border border-taupe/40 bg-white shadow-[0_24px_80px_rgba(74,74,74,0.08)]">
            <div className="absolute inset-x-0 top-0 h-48 bg-[radial-gradient(circle_at_top_left,_rgba(170,182,162,0.26),_transparent_52%),radial-gradient(circle_at_top_right,_rgba(217,206,197,0.35),_transparent_45%)]" />

            <div className="relative p-5 sm:p-8">
                <div className="mb-6 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-2xl">
                        <span className="mb-3 inline-flex items-center rounded-full border border-sage/20 bg-sage/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-charcoal/70">
                            Flashcards
                        </span>
                        <h3 className="font-display text-2xl text-charcoal sm:text-[2rem]">
                            {activity.title}
                        </h3>
                        <p className="mt-2 max-w-xl text-sm leading-6 text-charcoal/65">
                            Reveja os conceitos essenciais do CSV num formato mais leve e rápido. Vire cada cartão para ver a resposta e marque o que precisa de revisão.
                        </p>
                    </div>

                    <div className="w-full max-w-sm rounded-[1.5rem] border border-taupe/40 bg-white/80 p-4 shadow-sm backdrop-blur">
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-charcoal/45">
                                    Progresso
                                </p>
                                <p className="mt-1 text-sm text-charcoal/70">
                                    {completed ? "Baralho concluído" : `Cartão ${currentIndex + 1} de ${totalCards}`}
                                </p>
                            </div>
                            <span className="rounded-full bg-cream px-3 py-1 text-sm font-medium text-charcoal">
                                {progressPercentage}%
                            </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-taupe/25">
                            <div
                                className="h-full rounded-full bg-sage transition-all duration-300"
                                style={{ width: `${progressPercentage}%` }}
                            />
                        </div>
                        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                            <div className="rounded-2xl bg-cream/80 px-3 py-3">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-charcoal/45">
                                    Total
                                </p>
                                <p className="mt-1 text-lg font-display text-charcoal">{totalCards}</p>
                            </div>
                            <div className="rounded-2xl bg-sage/12 px-3 py-3">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-charcoal/45">
                                    Sei
                                </p>
                                <p className="mt-1 text-lg font-display text-charcoal">{knownCount}</p>
                            </div>
                            <div className="rounded-2xl bg-amber-50 px-3 py-3">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-charcoal/45">
                                    Rever
                                </p>
                                <p className="mt-1 text-lg font-display text-charcoal">{reviewCount}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {completed ? (
                    <div className="relative overflow-hidden rounded-[2rem] border border-sage/20 bg-[linear-gradient(135deg,rgba(249,247,242,0.98),rgba(255,255,255,0.95),rgba(170,182,162,0.12))] p-8 sm:p-10">
                        <div className="absolute -right-10 top-0 h-40 w-40 rounded-full bg-sage/12 blur-3xl" />
                        <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-taupe/20 blur-3xl" />

                        <div className="relative mx-auto max-w-2xl text-center">
                            <span className="inline-flex rounded-full border border-sage/25 bg-white/80 px-4 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-charcoal/60">
                                Sessão concluída
                            </span>
                            <h4 className="mt-4 font-display text-3xl text-charcoal sm:text-4xl">
                                Terminou o baralho
                            </h4>
                            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-charcoal/70">
                                Fez a revisão de {reviewedCount} cartão{reviewedCount === 1 ? "" : "ões"} e já tem uma leitura clara do que está consolidado e do que precisa de mais atenção.
                            </p>

                            <div className="mt-8 grid gap-3 sm:grid-cols-3">
                                <div className="rounded-[1.5rem] border border-white/70 bg-white/80 px-4 py-5 shadow-sm">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-charcoal/45">
                                        Cartões
                                    </p>
                                    <p className="mt-2 font-display text-3xl text-charcoal">{totalCards}</p>
                                </div>
                                <div className="rounded-[1.5rem] border border-sage/20 bg-sage/12 px-4 py-5 shadow-sm">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-charcoal/45">
                                        Dominados
                                    </p>
                                    <p className="mt-2 font-display text-3xl text-charcoal">{knownCount}</p>
                                </div>
                                <div className="rounded-[1.5rem] border border-amber-200 bg-amber-50 px-4 py-5 shadow-sm">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-charcoal/45">
                                        Rever
                                    </p>
                                    <p className="mt-2 font-display text-3xl text-charcoal">{reviewCount}</p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={restart}
                                className="mt-8 inline-flex items-center justify-center rounded-full bg-charcoal px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-charcoal/90"
                            >
                                Recomeçar deck
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_14rem]">
                            <div className="relative overflow-hidden rounded-[2rem] border border-taupe/40 bg-[linear-gradient(135deg,rgba(255,255,255,1),rgba(249,247,242,0.98),rgba(170,182,162,0.12))] p-3 sm:p-4">
                                <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-sage/40 to-transparent" />
                                <div className="perspective-[1600px]">
                                    <button
                                        type="button"
                                        onClick={() => setIsFlipped((value) => !value)}
                                        className="group relative h-[28rem] w-full rounded-[1.75rem] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2 sm:h-[30rem]"
                                        aria-label="Virar flashcard"
                                    >
                                        <div
                                            className={`relative h-full w-full rounded-[1.75rem] transition-transform duration-500 [transform-style:preserve-3d] ${isFlipped ? "[transform:rotateY(180deg)]" : ""}`}
                                        >
                                            <div className="absolute inset-0 overflow-hidden rounded-[1.75rem] border border-white/70 bg-[linear-gradient(160deg,rgba(255,255,255,1),rgba(249,247,242,0.95),rgba(217,206,197,0.25))] p-6 shadow-[0_20px_50px_rgba(74,74,74,0.08)] [backface-visibility:hidden] sm:p-8">
                                                <div className="absolute right-6 top-6 h-20 w-20 rounded-full bg-sage/12 blur-2xl" />
                                                <div className="relative flex h-full flex-col">
                                                    <div className="flex items-start justify-between gap-4">
                                                        <div>
                                                            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-charcoal/45">
                                                                Frente
                                                            </p>
                                                            <p className="mt-2 text-sm text-charcoal/55">
                                                                Leia com calma e toque para revelar a resposta.
                                                            </p>
                                                        </div>
                                                        <span className="rounded-full border border-sage/20 bg-white/80 px-3 py-1 text-xs font-medium text-charcoal/70">
                                                            Toque para virar
                                                        </span>
                                                    </div>

                                                    <div className="my-6 h-px bg-gradient-to-r from-transparent via-taupe/60 to-transparent" />

                                                    <div className="flex flex-1 items-center justify-center overflow-y-auto px-2 text-center">
                                                        <p className="max-w-2xl font-display text-[1.9rem] leading-[1.22] text-charcoal sm:text-[2.35rem]">
                                                            {currentCard.front}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="absolute inset-0 overflow-hidden rounded-[1.75rem] border border-amber-200/60 bg-[linear-gradient(160deg,rgba(255,251,245,1),rgba(255,255,255,0.98),rgba(245,222,179,0.2))] p-6 shadow-[0_20px_50px_rgba(74,74,74,0.08)] [backface-visibility:hidden] [transform:rotateY(180deg)] sm:p-8">
                                                <div className="absolute left-6 top-6 h-20 w-20 rounded-full bg-amber-100 blur-2xl" />
                                                <div className="relative flex h-full flex-col">
                                                    <div className="flex items-start justify-between gap-4">
                                                        <div>
                                                            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-charcoal/45">
                                                                Verso
                                                            </p>
                                                            <p className="mt-2 text-sm text-charcoal/55">
                                                                Use esta resposta como revisão rápida antes de avançar.
                                                            </p>
                                                        </div>
                                                        <span className="rounded-full border border-amber-200 bg-white/80 px-3 py-1 text-xs font-medium text-charcoal/70">
                                                            Marque o resultado abaixo
                                                        </span>
                                                    </div>

                                                    <div className="my-6 h-px bg-gradient-to-r from-transparent via-amber-200 to-transparent" />

                                                    <div className="flex flex-1 items-center justify-center overflow-y-auto px-2 text-center">
                                                        <p className="max-w-2xl text-lg leading-8 text-charcoal sm:text-xl">
                                                            {currentCard.back}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                </div>
                            </div>

                            <aside className="rounded-[2rem] border border-taupe/40 bg-white/80 p-4 shadow-sm backdrop-blur sm:p-5">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-charcoal/45">
                                    Resumo rápido
                                </p>
                                <div className="mt-4 space-y-3">
                                    <div className="rounded-[1.25rem] bg-cream/80 p-4">
                                        <p className="text-xs text-charcoal/55">Fonte</p>
                                        <p className="mt-1 text-sm font-medium text-charcoal">
                                            {activity.sourceFileName}
                                        </p>
                                    </div>
                                    <div className="rounded-[1.25rem] bg-sage/12 p-4">
                                        <p className="text-xs text-charcoal/55">Falta rever</p>
                                        <p className="mt-1 text-2xl font-display text-charcoal">
                                            {Math.max(totalCards - knownCount, 0)}
                                        </p>
                                    </div>
                                    <div className="rounded-[1.25rem] bg-white p-4 ring-1 ring-inset ring-taupe/30">
                                        <p className="text-xs text-charcoal/55">Sugestão</p>
                                        <p className="mt-1 text-sm leading-6 text-charcoal/70">
                                            Vire, responda e avance num ritmo constante. O objetivo aqui é memorização rápida, não perfeição.
                                        </p>
                                    </div>
                                </div>
                            </aside>
                        </div>

                        <div className="mb-4 flex flex-col gap-3 rounded-[1.75rem] border border-taupe/35 bg-cream/45 p-4 sm:flex-row sm:items-center sm:justify-between">
                            <button
                                type="button"
                                onClick={goToPrevious}
                                disabled={currentIndex === 0}
                                className="inline-flex items-center justify-center rounded-full border border-taupe/45 bg-white px-4 py-2 text-sm font-medium text-charcoal transition-colors hover:bg-cream disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                ← Anterior
                            </button>
                            <p className="text-center text-sm text-charcoal/65">
                                Clique no cartão para virar entre pergunta e resposta.
                            </p>
                            <button
                                type="button"
                                onClick={goToNext}
                                className="inline-flex items-center justify-center rounded-full border border-taupe/45 bg-white px-4 py-2 text-sm font-medium text-charcoal transition-colors hover:bg-cream"
                            >
                                Seguinte →
                            </button>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                            <button
                                type="button"
                                onClick={() => handleAssess("review")}
                                className="rounded-[1.5rem] border border-amber-200 bg-[linear-gradient(135deg,rgba(255,251,235,1),rgba(255,255,255,0.96))] px-5 py-4 text-left transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md"
                            >
                                <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-charcoal/45">
                                    Rever
                                </span>
                                <p className="mt-2 text-base font-medium text-charcoal">
                                    Precisa de revisão
                                </p>
                                <p className="mt-1 text-sm leading-6 text-charcoal/65">
                                    Guarde este conceito para uma nova passagem.
                                </p>
                            </button>

                            <button
                                type="button"
                                onClick={() => handleAssess("known")}
                                className="rounded-[1.5rem] border border-sage/25 bg-[linear-gradient(135deg,rgba(170,182,162,0.16),rgba(255,255,255,0.98))] px-5 py-4 text-left transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md"
                            >
                                <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-charcoal/45">
                                    Consolidado
                                </span>
                                <p className="mt-2 text-base font-medium text-charcoal">
                                    Já sei esta resposta
                                </p>
                                <p className="mt-1 text-sm leading-6 text-charcoal/65">
                                    Marque como dominado e avance para o próximo cartão.
                                </p>
                            </button>
                        </div>
                    </>
                )}
            </div>
        </section>
    );
}
