"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, onAuthStateChanged, signOut } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";

// Allowed email domain for company users
const ALLOWED_DOMAIN = "skinselflove.com.pt";

// DEV MODE: Set to true to bypass domain restriction for testing
// IMPORTANT: Set to false before production deployment!
const DEV_MODE = false;

interface AuthContextType {
    user: User | null;
    loading: boolean;
    error: string | null;
    isAdmin: boolean;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    loading: true,
    error: null,
    isAdmin: false,
    logout: async () => { },
});

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            console.log("Auth state changed:", firebaseUser?.email);

            if (firebaseUser) {
                // Check domain restriction
                const emailDomain = firebaseUser.email?.split("@")[1];
                console.log("Email domain:", emailDomain, "Expected:", ALLOWED_DOMAIN);

                if (emailDomain !== ALLOWED_DOMAIN && !DEV_MODE) {
                    // Sign out unauthorized user
                    await signOut(auth);
                    setError(`Acesso restrito a emails @${ALLOWED_DOMAIN}.`);
                    setUser(null);
                    setIsAdmin(false);
                    setLoading(false);
                } else {
                    // Check admin claim from ID token
                    try {
                        const tokenResult = await firebaseUser.getIdTokenResult(true);
                        const adminClaim = tokenResult.claims.admin === true;
                        setIsAdmin(adminClaim);
                        console.log("Admin claim:", adminClaim);
                    } catch (err) {
                        console.error("Error getting ID token:", err);
                        setIsAdmin(false);
                    }

                    // Set user immediately so redirect can happen
                    setUser(firebaseUser);
                    setError(null);
                    setLoading(false);

                    // Create/update user document (non-blocking)
                    try {
                        await setDoc(
                            doc(db, "users", firebaseUser.uid),
                            {
                                name: firebaseUser.displayName,
                                email: firebaseUser.email,
                                createdAt: serverTimestamp(),
                            },
                            { merge: true }
                        );
                        console.log("User doc created/updated successfully");
                    } catch (err) {
                        console.error("Error creating user doc (non-blocking):", err);
                        // Don't block login if user doc creation fails
                    }
                }
            } else {
                setUser(null);
                setIsAdmin(false);
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    const logout = async () => {
        await signOut(auth);
        setUser(null);
        setIsAdmin(false);
    };

    return (
        <AuthContext.Provider value={{ user, loading, error, isAdmin, logout }}>
            {children}
        </AuthContext.Provider>
    );
}
