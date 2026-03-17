"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getRedirectResult, signInWithPopup, signInWithRedirect } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { useAuth } from "@/lib/auth-context";
import { LoadingSpinner } from "@/components/StateComponents";

const MOBILE_USER_AGENT_REGEX = /iPhone|iPad|iPod|Android|Mobile|Tablet/i;

function isMobileBrowser() {
  if (typeof navigator === "undefined") {
    return false;
  }

  return MOBILE_USER_AGENT_REGEX.test(navigator.userAgent);
}

function getAuthErrorMessage(error: unknown) {
  const authError = error as { code?: string; message?: string } | null;
  const code = authError?.code;
  const message = authError?.message?.toLowerCase() ?? "";

  if (message.includes("missing initial state")) {
    return "O navegador perdeu a sessão temporária de início de sessão. Tente novamente abrindo o site diretamente no Safari.";
  }

  switch (code) {
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "O início de sessão foi cancelado.";
    case "auth/popup-blocked":
      return "O navegador bloqueou a janela de início de sessão.";
    case "auth/network-request-failed":
      return "Falha de rede. Tente novamente.";
    case "auth/unauthorized-domain":
      return "Este domínio não está autorizado no Firebase Authentication.";
    default:
      return "Não foi possível iniciar sessão com Google.";
  }
}

export default function LoginPage() {
  const { user, loading, error } = useAuth();
  const router = useRouter();
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isCheckingRedirect, setIsCheckingRedirect] = useState(true);

  useEffect(() => {
    if (user) {
      router.push("/brands");
    }
  }, [user, router]);

  useEffect(() => {
    let isMounted = true;

    async function checkRedirectResult() {
      try {
        await getRedirectResult(auth);
      } catch (err) {
        console.error("Redirect login error:", err);
        if (isMounted) {
          setLoginError(getAuthErrorMessage(err));
        }
      } finally {
        if (isMounted) {
          setIsCheckingRedirect(false);
          setIsSigningIn(false);
        }
      }
    }

    void checkRedirectResult();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogin = async () => {
    setLoginError(null);
    setIsSigningIn(true);

    try {
      if (isMobileBrowser()) {
        await signInWithRedirect(auth, googleProvider);
        return;
      }

      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("Login error:", err);
      setLoginError(getAuthErrorMessage(err));
      setIsSigningIn(false);
    }
  };

  if (loading || isCheckingRedirect || isSigningIn) {
    const message = loading
      ? "A verificar autenticação..."
      : isCheckingRedirect
        ? "A concluir autenticação..."
        : "A iniciar sessão...";

    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <LoadingSpinner message={message} />
      </div>
    );
  }

  const displayedError = error ?? loginError;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-cream px-4">
      <div className="text-center max-w-md">
        {/* Logo placeholder */}
        <h1 className="font-display text-4xl text-charcoal mb-2">
          Skin Self Love
        </h1>
        <p className="text-charcoal/70 mb-8">
          Plataforma de Formação
        </p>

        {/* Error message */}
        {displayedError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {displayedError}
          </div>
        )}

        {/* Login button */}
        <button
          onClick={handleLogin}
          className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white border border-taupe rounded-lg shadow-sm hover:shadow-md transition-shadow"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          <span className="text-charcoal font-medium">Entrar com Google</span>
        </button>

        <p className="mt-6 text-sm text-charcoal/50">
          Acesso restrito a colaboradores da empresa
        </p>
      </div>
    </div>
  );
}
