export function initShellFeatures({ toast, clearFieldError }) {
  let deferredInstallPrompt = null;
  let waitingServiceWorker = null;
  let installedThisSession = false;
  const hadServiceWorkerControllerAtLoad = Boolean(navigator.serviceWorker?.controller);
  let updateActivationRequested = false;
  const installButton = document.querySelector("#installApp");
  const installModal = document.querySelector("#installHelpModal");
  const installContent = document.querySelector("#installHelpContent");
  const displayModeQuery = window.matchMedia?.("(display-mode: standalone)");

  function isStandalone() {
    return Boolean(installedThisSession || displayModeQuery?.matches || navigator.standalone === true);
  }
  function compactInstallLabel() {
    return window.matchMedia?.("(max-width: 480px)")?.matches ? "📲 Instalar" : "Instalar aplicativo";
  }
  function updateInstallUI() {
    const installed = isStandalone();
    installButton?.classList.toggle("hidden", installed);
    if (installButton) {
      installButton.textContent = compactInstallLabel();
      installButton.setAttribute("aria-hidden", String(installed));
    }
    document.documentElement.dataset.installed = installed ? "true" : "false";
    if (installed) installModal?.classList.add("hidden");
  }
  function platformKind() {
    const nav = navigator;
    const platform = String(nav.userAgentData?.platform || nav.platform || "");
    const ua = String(nav.userAgent || "");
    const ios = /iPhone|iPad|iPod/i.test(ua) || (platform === "MacIntel" && Number(nav.maxTouchPoints || 0) > 1);
    if (ios) return "ios";
    if (/Android/i.test(platform) || /Android/i.test(ua)) return "android";
    return "generic";
  }
  function showInstallHelp() {
    if (!installContent || !installModal) return;
    const kind = platformKind();
    installContent.innerHTML = kind === "ios"
      ? '<ol class="install-steps"><li>Toque em <strong>Compartilhar</strong>.</li><li>Escolha <strong>Adicionar à Tela de Início</strong>.</li><li>Confirme em <strong>Adicionar</strong>.</li></ol>'
      : kind === "android"
        ? '<p>Abra o menu do navegador (<strong>⋮</strong>) e escolha <strong>Instalar aplicativo</strong> ou <strong>Adicionar à tela inicial</strong>. O nome pode variar conforme o navegador.</p>'
        : '<p>Abra o menu do navegador e procure <strong>Instalar aplicativo</strong> ou <strong>Adicionar à tela inicial</strong>.</p>';
    installModal.classList.remove("hidden");
  }

  function updateConnectionUI() {
    const offline = !navigator.onLine;
    document.querySelector("#offlineBanner")?.classList.toggle("hidden", !offline);
    document.documentElement.dataset.online = offline ? "false" : "true";
  }

  window.addEventListener("online", () => { updateConnectionUI(); toast("Conexão restaurada."); });
  window.addEventListener("offline", updateConnectionUI);
  updateConnectionUI();
  updateInstallUI();
  displayModeQuery?.addEventListener?.("change", updateInstallUI);
  window.addEventListener("pageshow", updateInstallUI);
  window.addEventListener("resize", updateInstallUI);

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    updateInstallUI();
  });
  window.addEventListener("appinstalled", () => {
    installedThisSession = true;
    deferredInstallPrompt = null;
    updateInstallUI();
    toast("Banco Mundo instalado com sucesso.");
  });
  installButton?.addEventListener("click", async () => {
    if (isStandalone()) return updateInstallUI();
    if (!deferredInstallPrompt) return showInstallHelp();
    try {
      await deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      if (choice?.outcome === "accepted") toast("Instalação solicitada ao navegador.", "info");
      updateInstallUI();
    } catch {
      deferredInstallPrompt = null;
      showInstallHelp();
    }
  });
  const closeInstallHelp = () => installModal?.classList.add("hidden");
  document.querySelector("#installHelpClose")?.addEventListener("click", closeInstallHelp);
  document.querySelector("#installHelpDone")?.addEventListener("click", closeInstallHelp);
  installModal?.addEventListener("keydown", (event) => { if (event.key === "Escape") closeInstallHelp(); });

  document.querySelector("#updateApp")?.addEventListener("click", () => {
    if (waitingServiceWorker) {
      updateActivationRequested = true;
      waitingServiceWorker.postMessage({ type: "SKIP_WAITING" });
    } else location.reload();
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
        const showUpdate = (worker) => { waitingServiceWorker = worker; document.querySelector("#updateCard")?.classList.remove("hidden"); };
        if (registration.waiting) showUpdate(registration.waiting);
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          worker?.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) showUpdate(worker);
          });
        });
        let refreshing = false;
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (refreshing) return;
          // Na primeira instalação, clients.claim() também dispara controllerchange.
          // Não recarregue a partida recém-criada nesse primeiro claim.
          if (!hadServiceWorkerControllerAtLoad && !updateActivationRequested) return;
          refreshing = true;
          location.reload();
        });
      } catch (error) { console.warn("Não foi possível registrar a PWA.", error); }
    });
  }

  document.addEventListener("click", (event) => {
    if (navigator.onLine) return;
    const button = event.target.closest("button");
    if (!button || button.matches(".tab, #theme, #installApp, #updateApp, #installHelpClose, #installHelpDone") || button.closest("#installHelpModal")) return;
    event.preventDefault(); event.stopImmediatePropagation();
    toast("Operação indisponível sem conexão com o servidor.");
  }, true);

  document.querySelector(".tabs")?.addEventListener("click", () => {
    requestAnimationFrame(() => document.querySelectorAll(".tab").forEach((tab) => {
      tab.setAttribute("aria-selected", String(tab.classList.contains("active")));
    }));
  });

  function activatePanel(id) {
    const target = document.getElementById(id);
    if (!target) return;
    document.querySelectorAll(".panel,.advanced-panel").forEach((panel) => panel.classList.remove("active"));
    document.querySelectorAll(".tab").forEach((tab) => { tab.classList.remove("active"); tab.setAttribute("aria-selected", "false"); });
    target.classList.add("active");
    const tab = document.querySelector(`.tab[data-tab="${id}"]`) || document.querySelector('.tab[data-tab="rules"]');
    tab?.classList.add("active"); tab?.setAttribute("aria-selected", "true");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  document.addEventListener("click", (event) => {
    const jump = event.target.closest("[data-jump-tab]");
    if (jump) { event.preventDefault(); activatePanel(jump.dataset.jumpTab); return; }
    const back = event.target.closest("[data-back-main]");
    if (back) { event.preventDefault(); activatePanel(back.dataset.backMain || "rules"); }
  });
  document.querySelectorAll("input,select,textarea").forEach((control) => {
    control.addEventListener("input", () => clearFieldError(control));
    control.addEventListener("change", () => clearFieldError(control));
  });
}
