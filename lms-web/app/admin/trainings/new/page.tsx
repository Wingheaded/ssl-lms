"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
import AppLayout from "@/components/AppLayout";
import { Brand } from "@/lib/types";

export default function NewTrainingPage() {
    const { user, loading: authLoading, isAdmin } = useAuth();
    const router = useRouter();

    const [brands, setBrands] = useState<Brand[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Success Modal State
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [successMessage, setSuccessMessage] = useState("");
    const [createdId, setCreatedId] = useState("");

    // Form state
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [brandId, setBrandId] = useState("");
    const [notifyUsers, setNotifyUsers] = useState(false);

    // Fetch brands on load
    useEffect(() => {
        async function fetchBrands() {
            try {
                const brandsSnap = await getDocs(collection(db, "brands"));
                const brandsData = brandsSnap.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as Brand[];
                setBrands(brandsData);

                // Pre-select first brand if available
                if (brandsData.length > 0) {
                    setBrandId(brandsData[0].id);
                }
            } catch (err) {
                console.error("Error fetching brands:", err);
                setError("Erro ao carregar marcas.");
            } finally {
                setLoading(false);
            }
        }

        if (user && isAdmin) {
            fetchBrands();
        }
    }, [user, isAdmin]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!title.trim() || !brandId) {
            setError("Por favor, preencha todos os campos obrigatórios.");
            return;
        }

        setSaving(true);
        setError(null);

        try {
            // 1. Create Training
            const docRef = await addDoc(collection(db, "trainings"), {
                brandId,
                title,
                description,
                isActive: true,
                createdAt: serverTimestamp(),
                mediaFiles: [],
            });

            // 2. Send Notification (if enabled)
            // 2. Send Notification (if enabled)
            let emailStatus = "";

            if (notifyUsers) {
                try {
                    // Fetch users (emails) - MVP limit to avoid huge doc
                    const usersSnap = await getDocs(collection(db, "users"));
                    const userEmails = usersSnap.docs
                        .map(d => d.data().email)
                        .filter(email => email && email.includes("@")); // Basic validation

                    console.log("Attempting to send email to", userEmails.length, "users");

                    const response = await fetch('/api/send-email', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            to: user ? user.email : "jose.antonio.luanda@gmail.com",
                            bcc: userEmails,
                            subject: `Nova Formação: ${title}`,
                            html: `
                                <div style="font-family: sans-serif; padding: 20px; color: #333;">
                                    <h1 style="color: #d97706;">Nova Formação Disponível!</h1>
                                    <p>Olá,</p>
                                    <p>Uma nova formação foi adicionada à plataforma Skin Self Love.</p>
                                    <div style="background: #fdf6e7; padding: 15px; border-radius: 8px; margin: 20px 0;">
                                        <h2 style="margin: 0; color: #b45309;">${title}</h2>
                                        <p style="margin: 10px 0 0;">${description || "Confira os novos conteúdos já disponíveis."}</p>
                                    </div>
                                    <a href="https://skinselflove-lms.web.app/trainings/${docRef.id}" style="display: inline-block; background: #b45309; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                                        Ver Formação
                                    </a>
                                    <p style="margin-top: 30px; font-size: 12px; color: #999;">
                                        Skin Self Love Academy
                                    </p>
                                </div>
                            `
                        })
                    });

                    if (response.ok) {
                        emailStatus = "Emails de notificação enviados com sucesso!";
                    } else {
                        console.error("Email API failed");
                        emailStatus = "Formação criada, mas houve um erro ao enviar emails.";
                    }

                } catch (emailErr) {
                    console.error("Error sending notification:", emailErr);
                    emailStatus = "Formação criada, mas falha ao enviar notificações.";
                }
            }

            // Show Success Modal instead of immediate redirect
            setSuccessMessage(emailStatus || "Formação criada com sucesso!");
            setCreatedId(docRef.id);
            setShowSuccessModal(true);
            setSaving(false);
        } catch (err) {
            console.error("Error creating training:", err);
            setError("Erro ao criar formação. Tente novamente.");
            setSaving(false);
        }
    };

    if (authLoading || loading) {
        return (
            <AppLayout>
                <div className="flex items-center justify-center min-h-[50vh]">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-700"></div>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <div className="max-w-2xl mx-auto">
                <Link
                    href="/admin/trainings"
                    className="text-amber-700 hover:text-amber-800 text-sm mb-6 inline-block"
                >
                    ← Voltar às Formações
                </Link>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
                    <h1 className="text-2xl font-light text-gray-800 mb-6">
                        Nova Formação
                    </h1>

                    {error && (
                        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg border border-red-200">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleCreate} className="space-y-6">
                        {/* Title */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Título da Formação *
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                                placeholder="Ex: Crystal Retinal: Guia Completo"
                                required
                            />
                        </div>

                        {/* Brand */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Marca *
                            </label>
                            <select
                                value={brandId}
                                onChange={(e) => setBrandId(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
                                required
                            >
                                <option value="" disabled>Selecione uma marca</option>
                                {brands.map(brand => (
                                    <option key={brand.id} value={brand.id}>
                                        {brand.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Descrição
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={4}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                                placeholder="Breve descrição dos conteúdos..."
                            />
                        </div>

                        {/* Notifications */}
                        <div className="flex items-start gap-3 pt-2">
                            <input
                                type="checkbox"
                                id="notifyUsers"
                                checked={notifyUsers}
                                onChange={(e) => setNotifyUsers(e.target.checked)}
                                className="w-5 h-5 mt-0.5 text-amber-600 rounded border-gray-300 focus:ring-amber-500 cursor-pointer"
                            />
                            <div className="flex-1">
                                <label htmlFor="notifyUsers" className="text-sm text-gray-700 cursor-pointer font-medium select-none">
                                    Enviar notificação por email?
                                </label>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    Isto enviará um email para todos os utilizadores registados (BCC) e uma cópia para si.
                                </p>
                            </div>
                        </div>

                        <div className="pt-4 flex items-center justify-end gap-3">
                            <Link
                                href="/admin/trainings"
                                className="px-4 py-2 text-gray-600 hover:text-gray-800"
                            >
                                Cancelar
                            </Link>
                            <button
                                type="submit"
                                disabled={saving}
                                className="px-6 py-2 bg-amber-700 text-white rounded-lg hover:bg-amber-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {saving ? (
                                    <>
                                        <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        A criar...
                                    </>
                                ) : (
                                    "Criar e Continuar"
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
            {/* Success Modal */}
            {showSuccessModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6 text-center animate-in fade-in zoom-in duration-200">
                        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-serif text-charcoal mb-2">Sucesso!</h3>
                        <p className="text-gray-600 mb-6">{successMessage}</p>
                        <button
                            onClick={() => router.push(`/admin/trainings/${createdId}`)}
                            className="w-full py-3 bg-amber-700 text-white rounded-lg font-medium hover:bg-amber-800 transition-colors"
                        >
                            Continuar
                        </button>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}
