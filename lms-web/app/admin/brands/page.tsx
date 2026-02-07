"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import AppLayout from "@/components/AppLayout";
import { LoadingSpinner, EmptyState, ErrorState } from "@/components/StateComponents";
import { Brand } from "@/lib/types";

export default function AdminBrandsPage() {
    const [brands, setBrands] = useState<Brand[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [newBrandName, setNewBrandName] = useState("");
    const [newBrandDesc, setNewBrandDesc] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState("");
    const [editingDesc, setEditingDesc] = useState("");
    const [saving, setSaving] = useState(false);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

    // Fetch brands
    useEffect(() => {
        fetchBrands();
    }, []);

    async function fetchBrands() {
        try {
            const brandsSnap = await getDocs(collection(db, "brands"));
            const brandsData = brandsSnap.docs
                .map((doc) => ({ id: doc.id, ...doc.data() } as Brand))
                .sort((a, b) => a.order - b.order);
            setBrands(brandsData);
        } catch (err) {
            console.error("Error fetching brands:", err);
            setError("Não foi possível carregar as marcas.");
        } finally {
            setLoading(false);
        }
    }

    // Add new brand
    async function handleAddBrand(e: React.FormEvent) {
        e.preventDefault();
        if (!newBrandName.trim() || saving) return;

        setSaving(true);
        try {
            const newOrder = brands.length > 0 ? Math.max(...brands.map(b => b.order)) + 1 : 1;
            await addDoc(collection(db, "brands"), {
                name: newBrandName.trim(),
                description: newBrandDesc.trim() || "",
                order: newOrder,
            });
            setNewBrandName("");
            setNewBrandDesc("");
            await fetchBrands();
        } catch (err) {
            console.error("Error adding brand:", err);
            alert("Erro ao adicionar marca.");
        } finally {
            setSaving(false);
        }
    }

    // Start editing
    function startEditing(brand: Brand) {
        setEditingId(brand.id);
        setEditingName(brand.name);
        setEditingDesc(brand.description || "");
    }

    // Save edit
    async function handleSaveEdit() {
        if (!editingId || !editingName.trim() || saving) return;

        setSaving(true);
        try {
            await updateDoc(doc(db, "brands", editingId), {
                name: editingName.trim(),
                description: editingDesc.trim() || "",
            });
            setEditingId(null);
            setEditingName("");
            setEditingDesc("");
            await fetchBrands();
        } catch (err) {
            console.error("Error updating brand:", err);
            alert("Erro ao atualizar marca.");
        } finally {
            setSaving(false);
        }
    }

    // Cancel edit
    function cancelEdit() {
        setEditingId(null);
        setEditingName("");
        setEditingDesc("");
    }

    // Delete brand
    async function handleDelete(brandId: string) {
        setSaving(true);
        try {
            await deleteDoc(doc(db, "brands", brandId));
            setDeleteConfirmId(null);
            await fetchBrands();
        } catch (err) {
            console.error("Error deleting brand:", err);
            alert("Erro ao eliminar marca.");
        } finally {
            setSaving(false);
        }
    }

    // Move brand up/down
    async function moveBrand(brandId: string, direction: "up" | "down") {
        const index = brands.findIndex(b => b.id === brandId);
        if (index === -1) return;
        if (direction === "up" && index === 0) return;
        if (direction === "down" && index === brands.length - 1) return;

        const swapIndex = direction === "up" ? index - 1 : index + 1;
        const batch = writeBatch(db);

        // Swap orders
        batch.update(doc(db, "brands", brands[index].id), { order: brands[swapIndex].order });
        batch.update(doc(db, "brands", brands[swapIndex].id), { order: brands[index].order });

        try {
            await batch.commit();
            await fetchBrands();
        } catch (err) {
            console.error("Error reordering brands:", err);
            alert("Erro ao reordenar marcas.");
        }
    }

    return (
        <AppLayout>
            <div className="max-w-4xl mx-auto">
                <h1 className="text-3xl font-light text-gray-800 mb-2">
                    Gerir Marcas
                </h1>
                <p className="text-gray-600 mb-6">
                    Adicionar, editar e remover marcas da plataforma
                </p>

                {/* Add New Brand Form */}
                <form onSubmit={handleAddBrand} className="mb-8 bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <div className="space-y-3">
                        <input
                            type="text"
                            placeholder="Nome da nova marca..."
                            value={newBrandName}
                            onChange={(e) => setNewBrandName(e.target.value)}
                            className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sage/50 focus:border-sage"
                            disabled={saving}
                        />
                        <input
                            type="text"
                            placeholder="Descrição curta (opcional)..."
                            value={newBrandDesc}
                            onChange={(e) => setNewBrandDesc(e.target.value)}
                            className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sage/50 focus:border-sage"
                            disabled={saving}
                        />
                        <button
                            type="submit"
                            disabled={!newBrandName.trim() || saving}
                            className="btn-primary w-full"
                        >
                            {saving ? "A guardar..." : "Adicionar Marca"}
                        </button>
                    </div>
                </form>

                {loading && <LoadingSpinner message="A carregar marcas..." />}

                {error && <ErrorState message={error} onRetry={fetchBrands} />}

                {!loading && !error && brands.length === 0 && (
                    <EmptyState
                        title="Sem marcas"
                        message="Adicione a primeira marca usando o formulário acima."
                    />
                )}

                {!loading && !error && brands.length > 0 && (
                    <div className="space-y-3">
                        {brands.map((brand, index) => (
                            <div
                                key={brand.id}
                                className="bg-white rounded-xl border border-gray-100 shadow-sm p-4"
                            >
                                {editingId === brand.id ? (
                                    /* Editing Mode */
                                    <div className="space-y-3">
                                        <input
                                            type="text"
                                            value={editingName}
                                            onChange={(e) => setEditingName(e.target.value)}
                                            placeholder="Nome da marca"
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sage/50"
                                            autoFocus
                                        />
                                        <input
                                            type="text"
                                            value={editingDesc}
                                            onChange={(e) => setEditingDesc(e.target.value)}
                                            placeholder="Descrição curta (opcional)"
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-sage/50"
                                        />
                                        <div className="flex gap-2">
                                            <button
                                                onClick={handleSaveEdit}
                                                disabled={!editingName.trim() || saving}
                                                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
                                            >
                                                Guardar
                                            </button>
                                            <button
                                                onClick={cancelEdit}
                                                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                                            >
                                                Cancelar
                                            </button>
                                        </div>
                                    </div>
                                ) : deleteConfirmId === brand.id ? (
                                    /* Delete Confirmation */
                                    <div className="flex items-center justify-between">
                                        <p className="text-red-600 font-medium">
                                            Tem a certeza que deseja eliminar "{brand.name}"?
                                        </p>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleDelete(brand.id)}
                                                disabled={saving}
                                                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
                                            >
                                                Sim, eliminar
                                            </button>
                                            <button
                                                onClick={() => setDeleteConfirmId(null)}
                                                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                                            >
                                                Cancelar
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    /* Normal View */
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            {/* Reorder Buttons */}
                                            <div className="flex flex-col gap-1">
                                                <button
                                                    onClick={() => moveBrand(brand.id, "up")}
                                                    disabled={index === 0}
                                                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                                    title="Mover para cima"
                                                >
                                                    ▲
                                                </button>
                                                <button
                                                    onClick={() => moveBrand(brand.id, "down")}
                                                    disabled={index === brands.length - 1}
                                                    className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                                                    title="Mover para baixo"
                                                >
                                                    ▼
                                                </button>
                                            </div>
                                            <div>
                                                <span className="text-xs text-gray-400">#{brand.order}</span>
                                                <h3 className="font-medium text-gray-800">{brand.name}</h3>
                                                {brand.description && (
                                                    <p className="text-sm text-gray-500">{brand.description}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => startEditing(brand)}
                                                className="px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
                                            >
                                                Editar
                                            </button>
                                            <button
                                                onClick={() => setDeleteConfirmId(brand.id)}
                                                className="px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
                                            >
                                                Eliminar
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Back to Admin */}
                <div className="mt-8 pt-8 border-t border-gray-200">
                    <a href="/admin" className="btn-secondary inline-block">
                        ← Voltar ao Painel
                    </a>
                </div>
            </div>
        </AppLayout>
    );
}
