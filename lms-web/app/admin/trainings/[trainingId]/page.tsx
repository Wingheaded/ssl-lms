"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { doc, getDoc, updateDoc, collection, getDocs, arrayUnion, arrayRemove } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { useAuth } from "@/lib/auth-context";
import { db, storage, functions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";
import AppLayout from "@/components/AppLayout";
import { parseFlashcardsCsv } from "@/lib/flashcards/parseCsv";
import { Training, Brand, MediaFile, FlashcardActivity } from "@/lib/types";
import { getNextTrainingContentOrder, getOrderedTrainingContent, reindexTrainingContent, type OrderedTrainingContent } from "@/lib/training-content";

type UploadType = "video" | "audio" | "pdf" | "youtube" | "image" | "flashcards";

interface QuizPreviewQuestion {
    id: number;
    question: string;
    type: "single" | "boolean" | "multiple";
    options: string[];
    correctAnswer: number[];
}

interface QuizPreviewFact {
    fact: string;
    excerpt: string;
}

export default function EditTrainingPage() {
    const { user, loading, isAdmin } = useAuth();
    const router = useRouter();
    const params = useParams();
    const trainingId = params.trainingId as string;
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [training, setTraining] = useState<Training | null>(null);
    const [brands, setBrands] = useState<Brand[]>([]);
    const [loadingData, setLoadingData] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploading, setUploading] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Form state
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [brandId, setBrandId] = useState("");
    const [isActive, setIsActive] = useState(true);
    const [selectedType, setSelectedType] = useState<UploadType>("video");
    const [youtubeUrl, setYoutubeUrl] = useState("");
    const [transcript, setTranscript] = useState("");
    const [extracting, setExtracting] = useState(false);
    const [previewingQuiz, setPreviewingQuiz] = useState(false);
    const [quizPreviewQuestions, setQuizPreviewQuestions] = useState<QuizPreviewQuestion[]>([]);
    const [quizPreviewFacts, setQuizPreviewFacts] = useState<QuizPreviewFact[]>([]);
    const [quizPreviewError, setQuizPreviewError] = useState<string | null>(null);
    const [draggedContentId, setDraggedContentId] = useState<string | null>(null);
    const [dragOverContentId, setDragOverContentId] = useState<string | null>(null);
    const [dragOverPosition, setDragOverPosition] = useState<"before" | "after" | null>(null);
    const [reordering, setReordering] = useState(false);



    useEffect(() => {
        async function fetchData() {
            if (!user || !isAdmin || !trainingId) return;

            try {
                // Fetch brands
                const brandsSnap = await getDocs(collection(db, "brands"));
                const brandsData = brandsSnap.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as Brand[];
                setBrands(brandsData);

                // Fetch training
                const trainingDoc = await getDoc(doc(db, "trainings", trainingId));
                if (trainingDoc.exists()) {
                    const data = { id: trainingDoc.id, ...trainingDoc.data() } as Training;
                    setTraining(data);
                    setTitle(data.title);
                    setDescription(data.description);
                    setBrandId(data.brandId);
                    setBrandId(data.brandId);
                    setIsActive(data.isActive);
                    setTranscript(data.transcript || "");
                }
            } catch (err) {
                console.error("Error fetching data:", err);
                setMessage({ type: "error", text: "Erro ao carregar dados" });
            } finally {
                setLoadingData(false);
            }
        }

        fetchData();
    }, [user, isAdmin, trainingId]);

    const handleAddYouTube = async () => {
        if (!training || !youtubeUrl.trim()) return;

        setUploading(true); // Reusing uploading state for UI feedback
        setMessage(null);

        try {
            const newMediaFile: MediaFile = {
                id: crypto.randomUUID(),
                type: "youtube",
                url: youtubeUrl,
                fileName: "YouTube Video",
                title: "YouTube Video",
                order: getNextTrainingContentOrder(training),
                uploadedAt: new Date(),
            };

            await updateDoc(doc(db, "trainings", trainingId), {
                mediaFiles: arrayUnion(newMediaFile),
            });

            setTraining({
                ...training,
                mediaFiles: [...(training.mediaFiles || []), newMediaFile],
            });

            setMessage({ type: "success", text: "Vídeo do YouTube adicionado!" });
            setYoutubeUrl(""); // Reset input
        } catch (err) {
            console.error("Error adding YouTube video:", err);
            setMessage({ type: "error", text: "Erro ao adicionar vídeo" });
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async () => {
        if (!training) return;
        setIsDeleting(true);

        try {
            const deleteTrainingFn = httpsCallable(functions, "deleteTrainingCascade");
            await deleteTrainingFn({ trainingId });

            // Redirect
            router.push("/admin/trainings");

        } catch (err) {
            console.error("Error deleting training:", err);
            setMessage({ type: "error", text: "Erro ao eliminar formação." });
            setIsDeleting(false);
            setShowDeleteModal(false);
        }
    };

    const handleExtractTranscript = async () => {
        if (!trainingId) return;
        setExtracting(true);
        setMessage(null);

        try {
            const extractFn = httpsCallable(functions, "extractTranscript");
            const result = await extractFn({ trainingId });
            const { success, transcriptLength } = result.data as { success?: boolean; transcriptLength?: number };

            if (success) {
                // Fetch updated doc to get the transcript
                const docSnap = await getDoc(doc(db, "trainings", trainingId));
                if (docSnap.exists()) {
                    const data = docSnap.data() as Training;
                    setTranscript(data.transcript || "");
                    setTraining({ ...training!, transcript: data.transcript });
                    setMessage({ type: "success", text: `Transcrição extraída com sucesso (${transcriptLength} caracteres)!` });
                }
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Tente novamente";
            console.error("Extraction error:", err);
            setMessage({ type: "error", text: "Erro ao extrair transcrição: " + errorMessage });
        } finally {
            setExtracting(false);
        }
    };

    const handleSaveTranscript = async () => {
        if (!training) return;
        setSaving(true);
        try {
            await updateDoc(doc(db, "trainings", trainingId), {
                transcript
            });
            setTraining({ ...training, transcript });
            setMessage({ type: "success", text: "Transcrição guardada!" });
        } catch (err) {
            console.error("Error saving transcript:", err);
            setMessage({ type: "error", text: "Erro ao guardar transcrição" });
        } finally {
            setSaving(false);
        }
    };

    const handleSave = async () => {
        if (!training) return;

        setSaving(true);
        setMessage(null);

        try {
            await updateDoc(doc(db, "trainings", trainingId), {
                title,
                description,
                brandId,
                isActive,
            });
            setMessage({ type: "success", text: "Formação guardada com sucesso!" });
        } catch (err) {
            console.error("Error saving:", err);
            setMessage({ type: "error", text: "Erro ao guardar formação" });
        } finally {
            setSaving(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !training) return;

        if (selectedType === "flashcards") {
            if (!file.name.toLowerCase().endsWith(".csv")) {
                setMessage({ type: "error", text: "Por favor carregue um ficheiro .csv válido." });
                return;
            }

            setUploading(true);
            setUploadProgress(0);
            setMessage(null);

            try {
                const content = await file.text();
                const { cards, warnings } = parseFlashcardsCsv(content);

                if (cards.length === 0) {
                    setMessage({ type: "error", text: warnings[0] || "Não foi possível gerar flashcards válidos." });
                    setUploading(false);
                    return;
                }

                const newActivity: FlashcardActivity = {
                    id: crypto.randomUUID(),
                    type: "flashcards",
                    title: file.name.replace(/\.csv$/i, ""),
                    sourceFileName: file.name,
                    cardCount: cards.length,
                    cards,
                    order: getNextTrainingContentOrder(training),
                    createdAt: new Date(),
                };

                const updatedActivities = [...(training.flashcardActivities || []), newActivity];

                await updateDoc(doc(db, "trainings", trainingId), {
                    flashcardActivities: updatedActivities,
                });

                setTraining({
                    ...training,
                    flashcardActivities: updatedActivities,
                });

                setMessage({
                    type: "success",
                    text: warnings.length > 0
                        ? `Flashcards criados (${cards.length} cartões). ${warnings.join(" ")}`
                        : `Flashcards criados com sucesso (${cards.length} cartões).`,
                });
            } catch (err) {
                console.error("Flashcard parse error:", err);
                setMessage({ type: "error", text: "Erro ao processar o ficheiro CSV." });
            } finally {
                setUploading(false);
                setUploadProgress(0);
                if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                }
            }
            return;
        }

        // Validate file type
        const allowedTypes: Record<string, string[]> = {
            video: ["video/mp4", "video/webm", "video/quicktime"],
            audio: ["audio/mpeg", "audio/wav", "audio/mp3", "audio/x-m4a"],
            pdf: ["application/pdf"],
            image: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/jpg"],
        };

        if (!allowedTypes[selectedType].includes(file.type)) {
            setMessage({ type: "error", text: `Tipo de ficheiro inválido para ${selectedType}` });
            return;
        }

        // Max size: 500MB
        if (file.size > 500 * 1024 * 1024) {
            setMessage({ type: "error", text: "Ficheiro demasiado grande (máx. 500MB)" });
            return;
        }

        setUploading(true);
        setUploadProgress(0);
        setMessage(null);

        try {
            // Generate unique ID for this file
            const fileId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const extension = file.name.split(".").pop();
            const storagePath = `trainings/${trainingId}/${fileId}.${extension}`;
            const storageRef = ref(storage, storagePath);

            const uploadTask = uploadBytesResumable(storageRef, file);

            uploadTask.on(
                "state_changed",
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    setUploadProgress(Math.round(progress));
                },
                (error) => {
                    console.error("Upload error:", error);
                    setMessage({ type: "error", text: "Erro no upload: " + error.message });
                    setUploading(false);
                },
                async () => {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

                    // Create new media file object
                    const newMediaFile: MediaFile = {
                        id: fileId,
                        type: selectedType,
                        url: downloadURL,
                        fileName: file.name,
                        order: getNextTrainingContentOrder(training),
                        storagePath: storagePath, // Save explicit path
                        uploadedAt: new Date(),
                    };

                    // Update Firestore with new file
                    await updateDoc(doc(db, "trainings", trainingId), {
                        mediaFiles: arrayUnion(newMediaFile),
                    });

                    // Update local state
                    setTraining({
                        ...training,
                        mediaFiles: [...(training.mediaFiles || []), newMediaFile],
                    });

                    setMessage({ type: "success", text: "Ficheiro carregado com sucesso!" });
                    setUploading(false);
                    setUploadProgress(0);

                    // Reset file input
                    if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                    }
                }
            );
        } catch (err) {
            console.error("Upload error:", err);
            setMessage({ type: "error", text: "Erro no upload" });
            setUploading(false);
        }
    };

    const handleUpdateTitle = async (mediaFile: MediaFile, newTitle: string) => {
        if (!training) return;

        // Optimistic update
        const updatedFiles = (training.mediaFiles || []).map(f =>
            f.id === mediaFile.id ? { ...f, title: newTitle } : f
        );

        setTraining({
            ...training,
            mediaFiles: updatedFiles
        });

        try {
            await updateDoc(doc(db, "trainings", trainingId), {
                mediaFiles: updatedFiles,
            });
        } catch (err) {
            console.error("Update title error:", err);
            setMessage({ type: "error", text: "Erro ao atualizar título" });
            // Revert on error
            setTraining({
                ...training,
                mediaFiles: training.mediaFiles
            });
        }
    };

    const handleDeleteFile = async (mediaFile: MediaFile) => {
        if (!training || !confirm(`Tem certeza que deseja apagar "${mediaFile.fileName}"?`)) {
            return;
        }

        setDeleting(mediaFile.id);
        setMessage(null);

        try {
            // Delete from Firebase Storage (only if NOT youtube)
            if (mediaFile.type !== "youtube") {
                let storageRef;

                if (mediaFile.storagePath) {
                    storageRef = ref(storage, mediaFile.storagePath);
                } else {
                    try {
                        const urlPath = decodeURIComponent(mediaFile.url.split("/o/")[1].split("?")[0]);
                        storageRef = ref(storage, urlPath);
                    } catch (parseError) {
                        console.error("Error parsing URL for deletion:", parseError);
                        throw new Error("Não foi possível determinar o caminho do ficheiro.");
                    }
                }

                try {
                    await deleteObject(storageRef);
                } catch (storageErr) {
                    const storageError = storageErr as { code?: string };
                    // Only ignore "Object Not Found" (404) errors
                    if (storageError.code === 'storage/object-not-found') {
                        console.warn("File was already deleted from storage (404). Proceeding to remove record.");
                    } else {
                        // Rethrow other errors (permission, network, etc) to prevent data inconsistency
                        console.error("Critical Storage Error:", storageErr);
                        throw new Error("Erro ao apagar ficheiro do armazenamento. Tente novamente.");
                    }
                }
            }

            // Remove from Firestore ONLY if Storage deletion succeeded (or was 404)
            await updateDoc(doc(db, "trainings", trainingId), {
                mediaFiles: arrayRemove(mediaFile),
            });

            // Update local state
            setTraining({
                ...training,
                mediaFiles: (training.mediaFiles || []).filter(f => f.id !== mediaFile.id),
            });

            setMessage({ type: "success", text: "Ficheiro apagado com sucesso e espaço libertado!" });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Erro ao apagar ficheiro";
            console.error("Delete error:", err);
            setMessage({ type: "error", text: errorMessage });
        } finally {
            setDeleting(null);
        }
    };

    const handlePreviewQuiz = async () => {
        if (!trainingId) return;

        setPreviewingQuiz(true);
        setQuizPreviewError(null);

        try {
            const previewQuizFn = httpsCallable(functions, "previewQuiz");
            const result = await previewQuizFn({ trainingId });
            const data = result.data as {
                extractedFacts: QuizPreviewFact[];
                questions: QuizPreviewQuestion[];
            };

            setQuizPreviewFacts(data.extractedFacts || []);
            setQuizPreviewQuestions(data.questions || []);
        } catch (err) {
            console.error("Preview quiz error:", err);
            const errorMessage = err instanceof Error ? err.message : "Erro ao gerar a pré-visualização do quiz.";
            setQuizPreviewError(errorMessage);
        } finally {
            setPreviewingQuiz(false);
        }
    };

    const handleUpdateFlashcardTitle = async (activity: FlashcardActivity, newTitle: string) => {
        if (!training) return;

        const trimmedTitle = newTitle.trim() || activity.sourceFileName.replace(/\.csv$/i, "");
        const updatedActivities = (training.flashcardActivities || []).map((item) =>
            item.id === activity.id ? { ...item, title: trimmedTitle } : item
        );

        setTraining({
            ...training,
            flashcardActivities: updatedActivities,
        });

        try {
            await updateDoc(doc(db, "trainings", trainingId), {
                flashcardActivities: updatedActivities,
            });
        } catch (err) {
            console.error("Update flashcard title error:", err);
            setMessage({ type: "error", text: "Erro ao atualizar o título do deck." });
            setTraining({
                ...training,
                flashcardActivities: training.flashcardActivities,
            });
        }
    };

    const handleDeleteFlashcardActivity = async (activity: FlashcardActivity) => {
        if (!training || !confirm(`Tem certeza que deseja apagar o deck "${activity.title}"?`)) {
            return;
        }

        setDeleting(activity.id);
        setMessage(null);

        const updatedActivities = (training.flashcardActivities || []).filter((item) => item.id !== activity.id);

        try {
            await updateDoc(doc(db, "trainings", trainingId), {
                flashcardActivities: updatedActivities,
            });

            setTraining({
                ...training,
                flashcardActivities: updatedActivities,
            });

            setMessage({ type: "success", text: "Deck de flashcards apagado com sucesso." });
        } catch (err) {
            console.error("Delete flashcard activity error:", err);
            setMessage({ type: "error", text: "Erro ao apagar o deck de flashcards." });
        } finally {
            setDeleting(null);
        }
    };

    const resetDragState = () => {
        setDraggedContentId(null);
        setDragOverContentId(null);
        setDragOverPosition(null);
    };

    const handleContentDragStart = (event: React.DragEvent<HTMLElement>, contentId: string) => {
        setDraggedContentId(contentId);
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", contentId);
    };

    const handleContentDragOver = (event: React.DragEvent<HTMLDivElement>, targetId: string) => {
        event.preventDefault();

        if (!draggedContentId || draggedContentId === targetId) {
            return;
        }

        const bounds = event.currentTarget.getBoundingClientRect();
        const nextPosition = event.clientY - bounds.top < bounds.height / 2 ? "before" : "after";

        setDragOverContentId(targetId);
        setDragOverPosition(nextPosition);
        event.dataTransfer.dropEffect = "move";
    };

    const handleContentDrop = async (event: React.DragEvent<HTMLDivElement>, targetId: string) => {
        event.preventDefault();

        if (!training || !draggedContentId || !dragOverPosition || draggedContentId === targetId) {
            resetDragState();
            return;
        }

        const orderedContent = getOrderedTrainingContent(training);
        const draggedEntry = orderedContent.find((entry) => entry.id === draggedContentId);

        if (!draggedEntry) {
            resetDragState();
            return;
        }

        const remainingEntries = orderedContent.filter((entry) => entry.id !== draggedContentId);
        const targetIndex = remainingEntries.findIndex((entry) => entry.id === targetId);

        if (targetIndex === -1) {
            resetDragState();
            return;
        }

        const insertIndex = dragOverPosition === "after" ? targetIndex + 1 : targetIndex;
        const reorderedEntries: OrderedTrainingContent[] = [
            ...remainingEntries.slice(0, insertIndex),
            draggedEntry,
            ...remainingEntries.slice(insertIndex),
        ];

        const reorderedIds = reorderedEntries.map((entry) => entry.id);
        const originalIds = orderedContent.map((entry) => entry.id);

        if (reorderedIds.every((id, index) => id === originalIds[index])) {
            resetDragState();
            return;
        }

        const updatedContent = reindexTrainingContent(reorderedEntries);
        const previousTraining = training;

        setTraining({
            ...training,
            ...updatedContent,
        });
        setReordering(true);
        resetDragState();

        try {
            await updateDoc(doc(db, "trainings", trainingId), updatedContent);
            setMessage({ type: "success", text: "Ordem dos conteúdos atualizada." });
        } catch (err) {
            console.error("Reorder content error:", err);
            setTraining(previousTraining);
            setMessage({ type: "error", text: "Erro ao guardar a nova ordem dos conteúdos." });
        } finally {
            setReordering(false);
        }
    };

    const getFileIcon = (type: string) => {
        switch (type) {
            case "video": return "🎬";
            case "audio": return "🎧";
            case "pdf": return "📄";
            case "youtube": return "▶️";
            case "image": return "🖼️";
            case "flashcards": return "🗂️";
            default: return "📁";
        }
    };

    if (loading || loadingData) {
        return (
            <AppLayout>
                <div className="flex items-center justify-center min-h-[50vh]">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-700"></div>
                </div>
            </AppLayout>
        );
    }

    if (!training) {
        return (
            <AppLayout>
                <div className="text-center py-12">
                    <p className="text-gray-500">Formação não encontrada</p>
                </div>
            </AppLayout>
        );
    }

    const mediaFiles = training.mediaFiles || [];
    const flashcardActivities = training.flashcardActivities || [];
    const orderedContentItems = getOrderedTrainingContent(training);
    const uploadTypeOptions: { value: UploadType; label: string; accept: string | null }[] = [
        { value: "video", label: "🎬 Vídeo", accept: ".mp4,.webm,.mov" },
        { value: "audio", label: "🎧 Áudio", accept: ".mp3,.wav,.m4a" },
        { value: "pdf", label: "📄 PDF", accept: ".pdf" },
        { value: "image", label: "🖼️ Imagem", accept: ".jpg,.jpeg,.png,.webp,.gif" },
        { value: "flashcards", label: "🗂️ Flashcards", accept: ".csv" },
        { value: "youtube", label: "▶️ YouTube", accept: null },
    ];

    return (
        <AppLayout>
            <div className="max-w-3xl mx-auto">
                <Link
                    href="/admin/trainings"
                    className="text-amber-700 hover:text-amber-800 text-sm mb-4 inline-block"
                >
                    ← Voltar às Formações
                </Link>

                <h1 className="text-3xl font-light text-gray-800 mb-8">
                    Editar Formação
                </h1>

                {/* Fixed Toast Notification */}
                {message && (
                    <div className={`fixed bottom-6 right-6 p-4 rounded-lg shadow-lg border animate-slide-up z-50 flex items-center gap-3 ${message.type === "success"
                        ? "bg-white border-green-200 text-green-700"
                        : "bg-white border-red-200 text-red-700"
                        }`}>
                        <span className="text-xl">
                            {message.type === "success" ? "✅" : "❌"}
                        </span>
                        <p className="font-medium">{message.text}</p>
                        <button
                            onClick={() => setMessage(null)}
                            className="ml-2 text-gray-400 hover:text-gray-600"
                        >
                            ✕
                        </button>
                    </div>
                )}

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
                    {/* Title */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Título
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Descrição
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={3}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                        />
                    </div>

                    {/* Brand */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Marca
                        </label>
                        <select
                            value={brandId}
                            onChange={(e) => setBrandId(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                        >
                            {brands.map((brand) => (
                                <option key={brand.id} value={brand.id}>
                                    {brand.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Existing Content */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Conteúdos ({mediaFiles.length + flashcardActivities.length})
                        </label>
                        <p className="mb-3 text-xs text-gray-500">
                            Arraste o controlo à esquerda de cada slot para definir a sequência em que o conteúdo aparece.
                        </p>

                        {mediaFiles.length === 0 && flashcardActivities.length === 0 ? (
                            <p className="text-sm text-gray-500 italic">Nenhum conteúdo carregado</p>
                        ) : (
                            <div className="space-y-4">
                                {orderedContentItems.map((content, index) => {
                                    const isDragged = draggedContentId === content.id;
                                    const isDropTarget = dragOverContentId === content.id && draggedContentId !== content.id;
                                    const cardClasses = [
                                        "flex flex-col gap-4 rounded-lg border bg-gray-50 p-4 transition-colors sm:flex-row sm:items-center sm:justify-between",
                                        isDragged ? "border-amber-300 bg-amber-50 opacity-60" : "border-gray-200",
                                        isDropTarget && dragOverPosition === "before" ? "border-t-2 border-t-amber-400" : "",
                                        isDropTarget && dragOverPosition === "after" ? "border-b-2 border-b-amber-400" : "",
                                    ].filter(Boolean).join(" ");

                                    if (content.kind === "media") {
                                        const file = content.item;

                                        return (
                                            <div
                                                key={file.id}
                                                onDragOver={(event) => handleContentDragOver(event, file.id)}
                                                onDrop={(event) => void handleContentDrop(event, file.id)}
                                                className={cardClasses}
                                            >
                                                <div className="flex items-center gap-3 flex-1">
                                                    <div
                                                        draggable={!reordering}
                                                        onDragStart={(event) => handleContentDragStart(event, file.id)}
                                                        onDragEnd={resetDragState}
                                                        aria-label={`Reordenar ${file.title || file.fileName}`}
                                                        className="flex h-11 w-11 flex-shrink-0 cursor-grab items-center justify-center rounded-xl border border-gray-300 bg-white text-gray-500 transition-colors hover:border-amber-300 hover:text-amber-700 active:cursor-grabbing"
                                                        title="Arraste para reordenar"
                                                    >
                                                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                                                            <circle cx="6" cy="4.5" r="1.1" fill="currentColor" />
                                                            <circle cx="12" cy="4.5" r="1.1" fill="currentColor" />
                                                            <circle cx="6" cy="9" r="1.1" fill="currentColor" />
                                                            <circle cx="12" cy="9" r="1.1" fill="currentColor" />
                                                            <circle cx="6" cy="13.5" r="1.1" fill="currentColor" />
                                                            <circle cx="12" cy="13.5" r="1.1" fill="currentColor" />
                                                        </svg>
                                                    </div>
                                                    <span className="text-2xl flex-shrink-0">{getFileIcon(file.type)}</span>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
                                                            <span>Posição {index + 1}</span>
                                                            <span>•</span>
                                                            <span>{file.type}</span>
                                                            <span>•</span>
                                                            <span className="truncate">{file.fileName}</span>
                                                        </div>
                                                        <input
                                                            type="text"
                                                            placeholder="Título de exibição (ex: Aula 1 - Introdução)"
                                                            defaultValue={file.title || ""}
                                                            onBlur={(e) => handleUpdateTitle(file, e.target.value)}
                                                            className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3 flex-shrink-0">
                                                    <a
                                                        href={file.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="px-3 py-1.5 bg-white border border-gray-300 rounded text-amber-700 hover:bg-amber-50 hover:border-amber-200 text-sm font-medium transition-colors"
                                                    >
                                                        Ver
                                                    </a>
                                                    <button
                                                        onClick={() => handleDeleteFile(file)}
                                                        disabled={deleting === file.id}
                                                        className="px-3 py-1.5 bg-white border border-gray-300 rounded text-red-600 hover:bg-red-50 hover:border-red-200 text-sm font-medium transition-colors disabled:opacity-50"
                                                    >
                                                        {deleting === file.id ? "..." : "Apagar"}
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    }

                                    const activity = content.item;

                                    return (
                                        <div
                                            key={activity.id}
                                            onDragOver={(event) => handleContentDragOver(event, activity.id)}
                                            onDrop={(event) => void handleContentDrop(event, activity.id)}
                                            className={cardClasses}
                                        >
                                            <div className="flex items-center gap-3 flex-1">
                                                <div
                                                    draggable={!reordering}
                                                    onDragStart={(event) => handleContentDragStart(event, activity.id)}
                                                    onDragEnd={resetDragState}
                                                    aria-label={`Reordenar ${activity.title}`}
                                                    className="flex h-11 w-11 flex-shrink-0 cursor-grab items-center justify-center rounded-xl border border-gray-300 bg-white text-gray-500 transition-colors hover:border-amber-300 hover:text-amber-700 active:cursor-grabbing"
                                                    title="Arraste para reordenar"
                                                >
                                                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                                                        <circle cx="6" cy="4.5" r="1.1" fill="currentColor" />
                                                        <circle cx="12" cy="4.5" r="1.1" fill="currentColor" />
                                                        <circle cx="6" cy="9" r="1.1" fill="currentColor" />
                                                        <circle cx="12" cy="9" r="1.1" fill="currentColor" />
                                                        <circle cx="6" cy="13.5" r="1.1" fill="currentColor" />
                                                        <circle cx="12" cy="13.5" r="1.1" fill="currentColor" />
                                                    </svg>
                                                </div>
                                                <span className="text-2xl flex-shrink-0">{getFileIcon(activity.type)}</span>
                                                <div className="flex-1 min-w-0">
                                                    <div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500">
                                                        <span>Posição {index + 1}</span>
                                                        <span>•</span>
                                                        <span>flashcards</span>
                                                        <span>•</span>
                                                        <span className="truncate">{activity.sourceFileName}</span>
                                                        <span>•</span>
                                                        <span>{activity.cardCount} cartões</span>
                                                    </div>
                                                    <input
                                                        type="text"
                                                        placeholder="Título do deck"
                                                        defaultValue={activity.title}
                                                        onBlur={(e) => handleUpdateFlashcardTitle(activity, e.target.value)}
                                                        className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 flex-shrink-0">
                                                <div className="px-3 py-1.5 bg-white border border-gray-300 rounded text-gray-600 text-sm">
                                                    {activity.cards[0] ? `${activity.cards[0].front.slice(0, 40)}${activity.cards[0].front.length > 40 ? "..." : ""}` : "Sem preview"}
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteFlashcardActivity(activity)}
                                                    disabled={deleting === activity.id}
                                                    className="px-3 py-1.5 bg-white border border-gray-300 rounded text-red-600 hover:bg-red-50 hover:border-red-200 text-sm font-medium transition-colors disabled:opacity-50"
                                                >
                                                    {deleting === activity.id ? "..." : "Apagar"}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Transcript Section */}
                    <div className="border-t border-gray-100 pt-6">
                        <div className="flex items-center justify-between mb-4">
                            <label className="block text-sm font-medium text-gray-700">
                                Transcrição (IA Quiz)
                            </label>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handlePreviewQuiz}
                                    disabled={previewingQuiz}
                                    className="px-3 py-1.5 bg-sage/10 text-sage rounded text-xs font-medium hover:bg-sage/20 disabled:opacity-50 transition-colors"
                                >
                                    {previewingQuiz ? "A gerar preview..." : "👁️ Pré-visualizar Quiz"}
                                </button>
                                {mediaFiles.some(f => f.type === 'youtube' || f.url.includes('youtube')) && (
                                    <button
                                        type="button"
                                        onClick={handleExtractTranscript}
                                        disabled={extracting}
                                        className="px-3 py-1.5 bg-amber-100 text-amber-800 rounded text-xs font-medium hover:bg-amber-200 disabled:opacity-50 transition-colors"
                                    >
                                        {extracting ? "A extrair..." : "✨ Extrair do YouTube"}
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="relative">
                            <textarea
                                value={transcript}
                                onChange={(e) => setTranscript(e.target.value)}
                                rows={6}
                                placeholder="A transcrição aparecerá aqui ou pode colar manualmente..."
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
                            />
                            <div className="absolute bottom-2 right-2">
                                <button
                                    type="button"
                                    onClick={handleSaveTranscript}
                                    disabled={saving || !transcript}
                                    className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-1 rounded transition-colors"
                                >
                                    Guardar Texto
                                </button>
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            Esta transcrição será usada para gerar o quiz automaticamente.
                        </p>

                        {(quizPreviewError || quizPreviewQuestions.length > 0) && (
                            <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <h3 className="text-sm font-semibold text-gray-800">Pré-visualização do Quiz IA</h3>
                                        <p className="text-xs text-gray-500">
                                            Reveja os factos usados pelo agente e regenere até a qualidade ficar correta.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handlePreviewQuiz}
                                        disabled={previewingQuiz}
                                        className="px-3 py-2 bg-white border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                                    >
                                        {previewingQuiz ? "A regenerar..." : "Regenerar"}
                                    </button>
                                </div>

                                {quizPreviewError && (
                                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                        {quizPreviewError}
                                    </div>
                                )}

                                {quizPreviewFacts.length > 0 && (
                                    <div>
                                        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                                            Factos extraídos da transcrição
                                        </h4>
                                        <div className="space-y-2">
                                            {quizPreviewFacts.map((fact, index) => (
                                                <div key={`${fact.fact}-${index}`} className="rounded-lg border border-gray-200 bg-white p-3">
                                                    <p className="text-sm font-medium text-gray-800">{index + 1}. {fact.fact}</p>
                                                    <p className="text-xs text-gray-500 mt-1">{fact.excerpt}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {quizPreviewQuestions.length > 0 && (
                                    <div>
                                        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                                            Perguntas geradas
                                        </h4>
                                        <div className="space-y-3">
                                            {quizPreviewQuestions.map((question, index) => (
                                                <div key={question.id} className="rounded-lg border border-gray-200 bg-white p-4">
                                                    <div className="flex items-start justify-between gap-3 mb-3">
                                                        <p className="text-sm font-medium text-gray-800">
                                                            {index + 1}. {question.question}
                                                        </p>
                                                        <span className="text-[11px] uppercase tracking-wide text-gray-500">
                                                            {question.type}
                                                        </span>
                                                    </div>
                                                    <div className="space-y-2">
                                                        {question.options.map((option, optionIndex) => {
                                                            const isCorrect = question.correctAnswer.includes(optionIndex);
                                                            return (
                                                                <div
                                                                    key={`${question.id}-${optionIndex}`}
                                                                    className={`rounded-md border px-3 py-2 text-sm ${isCorrect
                                                                        ? "border-green-300 bg-green-50 text-green-800"
                                                                        : "border-gray-200 bg-gray-50 text-gray-700"
                                                                        }`}
                                                                >
                                                                    {option} {isCorrect ? "✓" : ""}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Upload New File */}
                    <div className="border-t border-gray-100 pt-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Adicionar Conteúdo
                        </label>

                        {/* File Type Selection */}
                        <div className="flex gap-2 mb-4">
                            {uploadTypeOptions.map((type) => (
                                <button
                                    key={type.value}
                                    type="button"
                                    onClick={() => setSelectedType(type.value)}
                                    className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${selectedType === type.value ? "bg-amber-100 border-amber-300 text-amber-800" : "bg-white border-gray-200 text-gray-600 hover:border-amber-200"}`}
                                >
                                    {type.label}
                                </button>
                            ))}
                        </div>

                        {selectedType === "youtube" ? (
                            <div className="space-y-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">URL do Vídeo</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="url"
                                            value={youtubeUrl}
                                            onChange={(e) => setYoutubeUrl(e.target.value)}
                                            placeholder="https://www.youtube.com/watch?v=..."
                                            className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleAddYouTube}
                                            disabled={!youtubeUrl.trim()}
                                            className="px-4 py-2 bg-amber-700 text-white rounded text-sm font-medium hover:bg-amber-800 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Adicionar
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-400 mt-1">
                                        Copie o link diretamento do browser ou do botão &apos;Partilhar&apos; do YouTube.
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    onChange={handleFileUpload}
                                    accept={
                                        selectedType === "video" ? ".mp4,.webm,.mov" :
                                            selectedType === "audio" ? ".mp3,.wav,.m4a" :
                                                selectedType === "flashcards" ? ".csv" :
                                                selectedType === "image" ? ".jpg,.jpeg,.png,.webp,.gif" : ".pdf"
                                    }
                                    className="hidden"
                                />

                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploading}
                                    className="w-full px-4 py-6 border-2 border-dashed border-gray-300 rounded-lg hover:border-amber-400 transition-colors text-gray-500 hover:text-amber-700 disabled:opacity-50"
                                >
                                    {uploading ? (
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="w-48 h-2 bg-gray-200 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-amber-500 transition-all duration-300"
                                                    style={{ width: `${uploadProgress}%` }}
                                                />
                                            </div>
                                            <span>{uploadProgress}% carregado</span>
                                        </div>
                                    ) : (
                                        <span>
                                            Clique para adicionar {selectedType === "video"
                                                ? "vídeo"
                                                : selectedType === "audio"
                                                    ? "áudio"
                                                    : selectedType === "flashcards"
                                                        ? "deck de flashcards (.csv)"
                                                    : selectedType === "image"
                                                        ? "imagem"
                                                        : "PDF"}
                                        </span>
                                    )}
                                </button>
                                {selectedType === "flashcards" && (
                                    <p className="text-xs text-gray-500 mt-2">
                                        O CSV deve usar a coluna A como frente/pergunta e a coluna B como verso/resposta.
                                    </p>
                                )}
                            </>
                        )}
                    </div>

                    {/* Active Toggle */}
                    <div className="flex items-center gap-3 border-t border-gray-100 pt-6">
                        <button
                            type="button"
                            onClick={() => setIsActive(!isActive)}
                            className={`w-12 h-6 rounded-full transition-colors ${isActive ? "bg-green-500" : "bg-gray-300"}`}
                        >
                            <div className={`w-5 h-5 bg-white rounded-full shadow transform transition-transform ${isActive ? "translate-x-6" : "translate-x-0.5"}`} />
                        </button>
                        <span className="text-sm text-gray-700">
                            {isActive ? "Formação ativa" : "Formação inativa"}
                        </span>
                    </div>

                    {/* Save Button */}
                    <div className="pt-6 border-t border-gray-100 flex items-center justify-between">
                        <button
                            onClick={() => setShowDeleteModal(true)}
                            type="button"
                            className="px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium border border-transparent hover:border-red-100"
                        >
                            Eliminar Formação
                        </button>

                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-6 py-3 bg-amber-700 text-white rounded-lg hover:bg-amber-800 transition-colors disabled:opacity-50 font-medium"
                        >
                            {saving ? "A guardar..." : "Guardar Alterações"}
                        </button>
                    </div>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 text-center animate-in fade-in zoom-in duration-200">
                        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-serif text-charcoal mb-2">Eliminar Formação?</h3>
                        <p className="text-gray-600 mb-6 text-sm">
                            Esta ação é irreversível. A formação e todos os ficheiros associados serão removidos permanentemente.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeleteModal(false)}
                                disabled={isDeleting}
                                className="flex-1 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                            >
                                {isDeleting ? "A eliminar..." : "Eliminar"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
