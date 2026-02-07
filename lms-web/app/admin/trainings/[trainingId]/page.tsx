"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { doc, getDoc, updateDoc, collection, getDocs, arrayUnion, arrayRemove, deleteDoc } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { useAuth } from "@/lib/auth-context";
import { db, storage, functions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";
import AppLayout from "@/components/AppLayout";
import { Training, Brand, MediaFile } from "@/lib/types";

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
    const [selectedType, setSelectedType] = useState<"video" | "audio" | "pdf" | "youtube">("video");
    const [youtubeUrl, setYoutubeUrl] = useState("");
    const [transcript, setTranscript] = useState("");
    const [extracting, setExtracting] = useState(false);



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
            // 1. Delete media files from Storage
            const deletePromises = (training.mediaFiles || []).map(async (file) => {
                if (file.type !== 'youtube' && (file.storagePath || file.url)) {
                    try {
                        const fileRef = file.storagePath
                            ? ref(storage, file.storagePath)
                            : ref(storage, file.url);
                        await deleteObject(fileRef);
                    } catch (err) {
                        console.warn(`Failed to delete file ${file.fileName}:`, err);
                        // Continue deleting record even if file delete fails
                    }
                }
            });
            await Promise.all(deletePromises);

            // 2. Delete Training Document
            await deleteDoc(doc(db, "trainings", trainingId));

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
            const { success, transcriptLength } = result.data as any;

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
        } catch (err: any) {
            console.error("Extraction error:", err);
            setMessage({ type: "error", text: "Erro ao extrair transcrição: " + (err.message || "Tente novamente") });
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

        // Validate file type
        const allowedTypes: Record<string, string[]> = {
            video: ["video/mp4", "video/webm", "video/quicktime"],
            audio: ["audio/mpeg", "audio/wav", "audio/mp3", "audio/x-m4a"],
            pdf: ["application/pdf"],
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
                } catch (storageErr: any) {
                    // Only ignore "Object Not Found" (404) errors
                    if (storageErr.code === 'storage/object-not-found') {
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
        } catch (err: any) {
            console.error("Delete error:", err);
            setMessage({ type: "error", text: err.message || "Erro ao apagar ficheiro" });
        } finally {
            setDeleting(null);
        }
    };

    const getFileIcon = (type: string) => {
        switch (type) {
            case "video": return "🎬";
            case "audio": return "🎧";
            case "pdf": return "📄";
            case "youtube": return "▶️";
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

                    {/* Existing Files */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Ficheiros ({mediaFiles.length})
                        </label>

                        {mediaFiles.length === 0 ? (
                            <p className="text-sm text-gray-500 italic">Nenhum ficheiro carregado</p>
                        ) : (
                            <div className="space-y-4">
                                {mediaFiles.map((file) => (
                                    <div
                                        key={file.id}
                                        className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 gap-4"
                                    >
                                        <div className="flex items-center gap-3 flex-1">
                                            <span className="text-2xl flex-shrink-0">{getFileIcon(file.type)}</span>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex flex-col">
                                                    <span className="text-xs text-gray-500 uppercase tracking-wide mb-1">
                                                        {file.type} • {file.fileName}
                                                    </span>
                                                    <input
                                                        type="text"
                                                        placeholder="Título de exibição (ex: Aula 1 - Introdução)"
                                                        defaultValue={file.title || ""}
                                                        onBlur={(e) => handleUpdateTitle(file, e.target.value)}
                                                        className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
                                                    />
                                                </div>
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
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Transcript Section */}
                    <div className="border-t border-gray-100 pt-6">
                        <div className="flex items-center justify-between mb-4">
                            <label className="block text-sm font-medium text-gray-700">
                                Transcrição (IA Quiz)
                            </label>
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
                    </div>

                    {/* Upload New File */}
                    <div className="border-t border-gray-100 pt-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Adicionar Ficheiro
                        </label>

                        {/* File Type Selection */}
                        <div className="flex gap-2 mb-4">
                            {[
                                { value: "video", label: "🎬 Vídeo", accept: ".mp4,.webm,.mov" },
                                { value: "audio", label: "🎧 Áudio", accept: ".mp3,.wav,.m4a" },
                                { value: "pdf", label: "📄 PDF", accept: ".pdf" },
                                { value: "youtube", label: "▶️ YouTube", accept: null },
                            ].map((type) => (
                                <button
                                    key={type.value}
                                    type="button"
                                    onClick={() => setSelectedType(type.value as any)}
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
                                        Copie o link diretamento do browser ou do botão 'Partilhar' do YouTube.
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
                                            selectedType === "audio" ? ".mp3,.wav,.m4a" : ".pdf"
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
                                            Clique para adicionar {selectedType === "video" ? "vídeo" : selectedType === "audio" ? "áudio" : "PDF"}
                                        </span>
                                    )}
                                </button>
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
