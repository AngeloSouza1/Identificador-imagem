(() => {
  "use strict";

  const MAX_SIZE = 5 * 1024 * 1024;

  // ---- Tabs ----
  const tabs = document.querySelectorAll(".tab");
  const panes = {
    identify: document.getElementById("tab-identify"),
    register: document.getElementById("tab-register"),
  };

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => {
        t.classList.toggle("active", t === tab);
        t.setAttribute("aria-selected", t === tab);
      });
      Object.entries(panes).forEach(([key, pane]) => {
        pane.classList.toggle("active", key === tab.dataset.tab);
      });
    });
  });

  // ---- Result card ----
  const resultEl = document.getElementById("result");
  const resultIcon = document.getElementById("result-icon");
  const resultTitle = document.getElementById("result-title");
  const resultBody = document.getElementById("result-body");

  function showResult({ success, title, body, confidence }) {
    resultEl.classList.remove("hidden", "success", "fail");
    resultEl.classList.add(success ? "success" : "fail");
    resultIcon.textContent = success ? "\u2705" : "\u274C";
    resultTitle.textContent = title;
    resultBody.innerHTML = "";
    const text = document.createElement("span");
    text.textContent = body;
    resultBody.appendChild(text);
    if (confidence != null) {
      const conf = document.createElement("div");
      conf.className = "confidence";
      conf.textContent = `${confidence}% de confiança`;
      resultBody.appendChild(conf);
    }
    resultEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function setStatus(el, message, type = "info") {
    el.textContent = message;
    el.className = "status " + (type === "error" ? "error" : "info");
  }

  function friendlyError(detail) {
    const text = typeof detail === "string" ? detail : "Erro inesperado.";
    if (/nenhum rosto/i.test(text)) return "Nenhum rosto detectado. Tente uma foto com melhor iluminação.";
    if (/mais de um rosto/i.test(text)) return "Mais de um rosto detectado. Envie uma foto com apenas uma pessoa.";
    if (/inválida|invalido|imagem/i.test(text)) return "Imagem inválida ou formato não suportado.";
    if (/grande/i.test(text)) return "Imagem muito grande. O limite é de 5 MB.";
    return text;
  }

  // ---- Camera controller ----
  function createCapture(tabKey) {
    const video = document.getElementById(tabKey === "identify" ? "video" : "register-video");
    const canvas = document.getElementById(tabKey === "identify" ? "canvas" : "register-canvas");
    const preview = document.getElementById(tabKey === "identify" ? "preview" : "register-preview");
    const placeholder = document.getElementById(
      tabKey === "identify" ? "camera-placeholder" : "register-camera-placeholder"
    );
    const toggleBtn = document.getElementById(
      tabKey === "identify" ? "camera-toggle" : "register-camera-toggle"
    );
    // Na aba "identify" não há botão de captura: o envio já tira a foto.
    const captureBtn =
      tabKey === "identify" ? null : document.getElementById("register-capture-btn");
    const fileInput = document.getElementById(
      tabKey === "identify" ? "identify-file" : "register-file"
    );

    let stream = null;
    let capturedBlob = null;

    function stopCamera() {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        stream = null;
      }
      video.srcObject = null;
      video.classList.add("hidden");
      toggleBtn.textContent = "Ativar câmera";
      if (captureBtn) captureBtn.disabled = true;
      updateReadyState();
    }

    function grabFrame() {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d").drawImage(video, 0, 0);
      return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    }

    toggleBtn.addEventListener("click", async () => {
      if (stream) {
        stopCamera();
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        video.srcObject = stream;
        video.classList.remove("hidden");
        preview.classList.add("hidden");
        placeholder.classList.add("hidden");
        capturedBlob = null;
        toggleBtn.textContent = "Desativar câmera";
        if (captureBtn) captureBtn.disabled = false;
        updateReadyState();
      } catch (err) {
        setStatus(
          document.getElementById(tabKey === "identify" ? "identify-status" : "register-status"),
          "Câmera negada ou indisponível. Verifique as permissões ou envie um arquivo.",
          "error"
        );
      }
    });

    if (captureBtn) {
      captureBtn.addEventListener("click", async () => {
        if (!stream) return;
        const blob = await grabFrame();
        if (!blob) return;
        capturedBlob = blob;
        preview.src = URL.createObjectURL(blob);
        preview.classList.remove("hidden");
        placeholder.classList.add("hidden");
        updateReadyState();
      });
    }

    fileInput.addEventListener("change", () => {
      const file = fileInput.files[0];
      if (!file) return;
      if (file.size > MAX_SIZE) {
        setStatus(
          document.getElementById(tabKey === "identify" ? "identify-status" : "register-status"),
          "Imagem muito grande. O limite é de 5 MB.",
          "error"
        );
        fileInput.value = "";
        return;
      }
      capturedBlob = file;
      preview.src = URL.createObjectURL(file);
      preview.classList.remove("hidden");
      placeholder.classList.add("hidden");
      if (stream) stopCamera();
      updateReadyState();
    });

    function updateReadyState() {
      const submit = document.getElementById(
        tabKey === "identify" ? "identify-submit" : "register-submit"
      );
      submit.disabled = !isReady();
    }

    function isReady() {
      if (tabKey === "identify") return Boolean(stream || capturedBlob);
      return Boolean(capturedBlob && consent.checked && nome.value.trim().length > 0);
    }

    // Na aba "identify", com a câmera ligada, tira a foto na hora do envio.
    async function getBlob() {
      if (tabKey === "identify" && stream) return grabFrame();
      return capturedBlob;
    }

    return { stopCamera, updateReadyState, getBlob, isReady };
  }

  const identifyCapture = createCapture("identify");
  const registerCapture = createCapture("register");

  // ---- Register extras (name + consent) ----
  const nome = document.getElementById("nome");
  const consent = document.getElementById("consentimento");
  const registerSubmit = document.getElementById("register-submit");
  const identifySubmit = document.getElementById("identify-submit");

  nome.addEventListener("input", () => registerCapture.updateReadyState());
  consent.addEventListener("change", () => registerCapture.updateReadyState());

  // ---- Forms ----
  const identifyForm = document.getElementById("identify-form");
  const registerForm = document.getElementById("register-form");
  const identifyStatus = document.getElementById("identify-status");
  const registerStatus = document.getElementById("register-status");

  identifyForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const blob = await identifyCapture.getBlob();
    if (!blob) {
      setStatus(identifyStatus, "Ative a câmera ou envie um arquivo primeiro.", "error");
      return;
    }
    await submitIdentify(blob);
  });

  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const blob = await registerCapture.getBlob();
    if (!blob) {
      setStatus(registerStatus, "Capture uma imagem ou envie um arquivo primeiro.", "error");
      return;
    }
    if (!consent.checked) {
      setStatus(registerStatus, "O consentimento é obrigatório para o cadastro.", "error");
      return;
    }
    if (!nome.value.trim()) {
      setStatus(registerStatus, "Informe um nome.", "error");
      return;
    }
    await submitRegister(blob);
  });

  async function submitIdentify(blob) {
    identifySubmit.disabled = true;
    identifySubmit.textContent = "Analisando...";
    setStatus(identifyStatus, "Processando imagem...", "info");
    try {
      const form = new FormData();
      form.append("imagem", blob, "foto.jpg");
      const res = await fetch("/api/identify", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Erro ao identificar.");
      if (data.reconhecido) {
        showResult({ success: true, title: data.nome, body: "Rosto reconhecido com sucesso.", confidence: data.confianca });
        setStatus(identifyStatus, "Identificação concluída.", "info");
      } else {
        showResult({ success: false, title: "Não reconhecido", body: "Nenhum cadastro corresponde a esta foto." });
        setStatus(identifyStatus, "Rosto não reconhecido.", "info");
      }
    } catch (err) {
      setStatus(identifyStatus, friendlyError(err.message), "error");
    } finally {
      identifySubmit.disabled = !identifyCapture.isReady();
      identifySubmit.textContent = "Identificar rosto";
    }
  }

  async function submitRegister(blob) {
    registerSubmit.disabled = true;
    registerSubmit.textContent = "Cadastrando...";
    setStatus(registerStatus, "Extraindo embedding facial...", "info");
    try {
      const form = new FormData();
      form.append("nome", nome.value.trim());
      form.append("consentimento", "true");
      form.append("imagem", blob, "foto.jpg");
      const res = await fetch("/api/register", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Erro ao cadastrar.");
      showResult({ success: true, title: "Cadastro realizado", body: `${data.nome} foi cadastrado com sucesso.` });
      setStatus(registerStatus, "Cadastro concluído.", "info");
      nome.value = "";
      consent.checked = false;
      registerCapture.updateReadyState();
    } catch (err) {
      setStatus(registerStatus, friendlyError(err.message), "error");
    } finally {
      registerSubmit.disabled = !registerCapture.isReady();
      registerSubmit.textContent = "Cadastrar";
    }
  }
})();
