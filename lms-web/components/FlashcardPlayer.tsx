"use client";

import { useState } from "react";
import { FlashcardActivity } from "@/lib/types";

interface FlashcardPlayerProps {
    activity: FlashcardActivity;
}

export default function FlashcardPlayer({ activity }: FlashcardPlayerProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [knownCount, setKnownCount] = useState(0);
    const [unknownCount, setUnknownCount] = useState(0);
    const [completed, setCompleted] = useState(false);

    const totalCards = activity.cards.length;
    const currentCard = activity.cards[currentIndex];

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
        setIsFlipped(false);
        setCurrentIndex((value) => value - 1);
    };

    const handleAssess = (known: boolean) => {
        if (known) {
            setKnownCount((value) => value + 1);
        } else {
            setUnknownCount((value) => value + 1);
        }
        goToNext();
    };

    const restart = () => {
        setCurrentIndex(0);
        setIsFlipped(false);
        setKnownCount(0);
        setUnknownCount(0);
        setCompleted(false);
    };

    if (!currentCard && !completed) {
        return null;
    }

    return (
        <div className="bg-white rounded-xl border border-taupe/30 p-6 mb-8 shadow-sm">
            <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                    <h3 className="text-lg font-display text-charcoal">{activity.title}</h3>
                    <p className="text-sm text-charcoal/55">{activity.cardCount} flashcards</p>
                </div>
                {!completed && (
                    <span className="text-sm text-charcoal/60">
                        Cartão {currentIndex + 1} de {totalCards}
                    </span>
                )}
            </div>

            {completed ? (
                <div className="rounded-2xl border border-sage/20 bg-cream/40 p-8 text-center">
                    <h4 className="text-2xl font-display text-charcoal mb-2">Atividade concluída</h4>
                    <p className="text-charcoal/70 mb-6">Terminou o baralho de flashcards.</p>
                    <div className="flex items-center justify-center gap-6 mb-6 text-sm">
                        <span className="px-3 py-2 rounded-full bg-green-50 text-green-700 border border-green-200">
                            Sabia: {knownCount}
                        </span>
                        <span className="px-3 py-2 rounded-full bg-red-50 text-red-700 border border-red-200">
                            Rever: {unknownCount}
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={restart}
                        className="px-5 py-3 bg-amber-700 text-white rounded-lg hover:bg-amber-800 transition-colors font-medium"
                    >
                        Recomeçar
                    </button>
                </div>
            ) : (
                <>
                    <div className="perspective-[1400px] mb-6">
                        <button
                            type="button"
                            onClick={() => setIsFlipped((value) => !value)}
                            className="group relative h-[24rem] w-full rounded-2xl text-left focus:outline-none focus:ring-2 focus:ring-sage/40"
                        >
                            <div
                                className={`relative h-full w-full rounded-2xl transition-transform duration-500 [transform-style:preserve-3d] ${isFlipped ? "[transform:rotateY(180deg)]" : ""}`}
                            >
                                <div className="absolute inset-0 rounded-2xl border border-sage/20 bg-gradient-to-br from-white to-cream/80 p-8 shadow-sm [backface-visibility:hidden]">
                                    <div className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-sage/70">
                                        Frente
                                    </div>
                                    <div className="flex h-[18rem] items-center justify-center overflow-y-auto text-center text-xl leading-relaxed text-charcoal">
                                        {currentCard.front}
                                    </div>
                                </div>
                                <div className="absolute inset-0 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-8 shadow-sm [backface-visibility:hidden] [transform:rotateY(180deg)]">
                                    <div className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-amber-700/80">
                                        Verso
                                    </div>
                                    <div className="flex h-[18rem] items-center justify-center overflow-y-auto text-center text-xl leading-relaxed text-charcoal">
                                        {currentCard.back}
                                    </div>
                                </div>
                            </div>
                        </button>
                    </div>

                    <div className="flex items-center justify-between gap-3 mb-4">
                        <button
                            type="button"
                            onClick={goToPrevious}
                            disabled={currentIndex === 0}
                            className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            Anterior
                        </button>
                        <p className="text-sm text-charcoal/60 text-center">
                            Clique no cartão para virar
                        </p>
                        <button
                            type="button"
                            onClick={goToNext}
                            className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                            Seguinte
                        </button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <button
                            type="button"
                            onClick={() => handleAssess(false)}
                            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors"
                        >
                            ✕ Precisa de revisão
                        </button>
                        <button
                            type="button"
                            onClick={() => handleAssess(true)}
                            className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700 hover:bg-green-100 transition-colors"
                        >
                            ✓ Já sei
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
