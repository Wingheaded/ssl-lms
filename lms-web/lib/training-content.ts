import { FlashcardActivity, MediaFile, Training } from "@/lib/types";

export type OrderedTrainingContent =
    | {
        kind: "media";
        id: string;
        order: number;
        item: MediaFile;
    }
    | {
        kind: "flashcards";
        id: string;
        order: number;
        item: FlashcardActivity;
    };

function resolveOrder(order: number | undefined, fallback: number) {
    return typeof order === "number" && Number.isFinite(order) ? order : fallback;
}

export function getOrderedTrainingContent(training: Pick<Training, "mediaFiles" | "flashcardActivities">): OrderedTrainingContent[] {
    const mediaFiles = training.mediaFiles || [];
    const flashcardActivities = training.flashcardActivities || [];

    const orderedMedia = mediaFiles.map((item, index) => ({
        kind: "media" as const,
        id: item.id,
        order: resolveOrder(item.order, index),
        fallbackIndex: index,
        item,
    }));

    const orderedFlashcards = flashcardActivities.map((item, index) => ({
        kind: "flashcards" as const,
        id: item.id,
        order: resolveOrder(item.order, mediaFiles.length + index),
        fallbackIndex: mediaFiles.length + index,
        item,
    }));

    return [...orderedMedia, ...orderedFlashcards]
        .sort((left, right) => left.order - right.order || left.fallbackIndex - right.fallbackIndex)
        .map((content): OrderedTrainingContent => (
            content.kind === "media"
                ? {
                    kind: "media",
                    id: content.id,
                    order: content.order,
                    item: content.item,
                }
                : {
                    kind: "flashcards",
                    id: content.id,
                    order: content.order,
                    item: content.item,
                }
        ));
}

export function getNextTrainingContentOrder(training: Pick<Training, "mediaFiles" | "flashcardActivities">) {
    const orderedContent = getOrderedTrainingContent(training);
    return orderedContent.length === 0
        ? 0
        : Math.max(...orderedContent.map((content) => content.order)) + 1;
}

export function reindexTrainingContent(content: OrderedTrainingContent[]) {
    const mediaFiles: MediaFile[] = [];
    const flashcardActivities: FlashcardActivity[] = [];

    content.forEach((entry, index) => {
        if (entry.kind === "media") {
            mediaFiles.push({
                ...entry.item,
                order: index,
            });
            return;
        }

        flashcardActivities.push({
            ...entry.item,
            order: index,
        });
    });

    return { mediaFiles, flashcardActivities };
}
