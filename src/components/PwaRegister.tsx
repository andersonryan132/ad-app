"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const MOBILE_UA = /Mobi|Android|iPhone|iPad|iPod/i;
const STORED_DISMISS_KEY = "adapp-install-dismissed";

export default function PwaRegister() {
  const [deferredPrompt, setDeferredPrompt] = useState<InstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showManualFallback, setShowManualFallback] = useState(false);

  const isStandalone = () =>
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;

  const isMobile = () => MOBILE_UA.test(navigator.userAgent);

  const alreadyDismissed = () =>
    typeof window !== "undefined" &&
    window.localStorage.getItem(STORED_DISMISS_KEY) === "1";

  const openInstallPrompt = async () => {
    if (!deferredPrompt) return;
    try {
      await deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === "accepted") {
        setShowPrompt(false);
      }
    } finally {
      setDeferredPrompt(null);
      setShowPrompt(false);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const registerServiceWorker = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch (error) {
        console.error("Erro ao registrar service worker:", error);
      }
    };

    const onBeforeInstallPrompt = (event: Event) => {
      const promptEvent = event as InstallPromptEvent;
      const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      setIsIos(ios);

      if (alreadyDismissed()) return;
      if (!isMobile() || isStandalone()) return;

      event.preventDefault();
      setDeferredPrompt(promptEvent);
      setShowManualFallback(false);
      setShowPrompt(true);
    };

    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setShowPrompt(false);
      setShowManualFallback(false);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    registerServiceWorker();

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    setIsIos(ios);

    if (alreadyDismissed()) return;
    if (!isMobile() || isStandalone()) return;

    if (ios) {
      setShowPrompt(true);
      return;
    }

    const timer = window.setTimeout(() => {
      if (!showPrompt && !deferredPrompt) {
        setShowManualFallback(true);
        setShowPrompt(true);
      }
    }, 1800);

    return () => window.clearTimeout(timer);
  }, [deferredPrompt, showPrompt]);

  const dismissPrompt = () => {
    setShowPrompt(false);
    setShowManualFallback(false);
    window.localStorage.setItem(STORED_DISMISS_KEY, "1");
  };

  if (!showPrompt) {
    return null;
  }

  const title = isIos ? "Instalar no iPhone" : "Instalar app";
  const description = isIos
    ? "No iOS, toque em Compartilhar e depois em Adicionar à Tela de Início."
    : showManualFallback
      ? "Se o botão de instalação não aparecer, escolha 'Adicionar à tela inicial' no menu do navegador."
      : "Quer adicionar o AD Telecom na tela inicial do celular?";

  return (
    <div
      style={{
        position: "fixed",
        inset: "0",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.45)",
        zIndex: 9999,
        padding: 16,
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: 16,
          width: "100%",
          maxWidth: 360,
          padding: 16,
          boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: 8 }}>{title}</h2>
        <p style={{ marginTop: 0, lineHeight: 1.4 }}>{description}</p>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            type="button"
            onClick={dismissPrompt}
            style={{
              borderRadius: 8,
              border: "1px solid #cbd5e1",
              background: "white",
              padding: "10px 14px",
            }}
          >
            Agora não
          </button>

          {!isIos && deferredPrompt && (
            <button
              type="button"
              onClick={openInstallPrompt}
              style={{
                borderRadius: 8,
                border: "1px solid transparent",
                background: "#0f172a",
                color: "white",
                padding: "10px 14px",
              }}
            >
              Instalar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
