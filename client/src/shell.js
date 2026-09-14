export function initShellFeatures({ toast, clearFieldError }) {
  let deferredInstallPrompt = null;
  let waitingServiceWorker = null;
  const hadServiceWorkerControllerAtLoad = Boolean(navigator.serviceWorker?.controller);
  let updateActivationRequested = false;

  function updateConnectionUI() {
    const offline = !navigator.onLine;
    document.querySelector("#offlineBanner")?.classList.toggle("hidden", !offline);
    document.documentElement.dataset.online = offline ? "false" : "true";
  }

  window.addEventListener("online", () => { updateConnectionUI(); toast("Conexão restaurada."); });
  window.addEventListener("offline", updateConnectionUI);
  updateConnectionUI();

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    document.querySelector("#installApp")?.classList.remove("hidden");
  });
  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    document.querySelector("#installApp")?.classList.add("hidden");
    toast("Banco Mundo instalado.");
  });
  document.querySelector("#installApp")?.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return toast("Use 'Adicionar à tela inicial' no menu do navegador.");
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    document.querySelector("#installApp")?.classList.add("hidden");
  });
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
    if (!button || button.matches(".tab, #theme, #installApp, #updateApp")) return;
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
