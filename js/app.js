/* Nuestra historia - aplicación sin dependencias externas.
   Los textos se guardan en localStorage y los archivos multimedia en IndexedDB. */
(() => {
  "use strict";

  const STORAGE_KEY = "nuestraHistoria.app.v1";
  const DB_NAME = "nuestraHistoria.media.v1";
  const DB_STORE = "media";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [
    ...root.querySelectorAll(selector),
  ];
  const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const makeId = () =>
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  const escapeHTML = (value = "") =>
    String(value).replace(
      /[&<>"']/g,
      (ch) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[ch],
    );
  const niceDate = (
    date,
    options = { day: "numeric", month: "long", year: "numeric" },
  ) => {
    if (!date) return "Fecha por añadir";
    const d = new Date(`${date}T12:00:00`);
    if (Number.isNaN(d.getTime())) return "Fecha por añadir";
    return new Intl.DateTimeFormat("es-CO", options).format(d);
  };
  const dateFromInput = (value) =>
    value ? new Date(`${value}T00:00:00`) : null;
  const mediaURLs = new Map();
  let dbPromise;
  let stagedGalleryFiles = [];
  let currentSongIndex = -1;
  let currentGalleryFilter = "Todos";
  let state = loadState();

  function defaultState() {
    return {
      settings: { yourName: "", partnerName: "", startDate: "", whatsapp: "" },
      stories: [],
      memories: [],
      songs: [],
      letters: [],
      dreams: [],
      capsules: [],
    };
  }
  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (!parsed || typeof parsed !== "object") return defaultState();
      const fresh = defaultState();
      return {
        ...fresh,
        ...parsed,
        settings: { ...fresh.settings, ...(parsed.settings || {}) },
        stories: Array.isArray(parsed.stories) ? parsed.stories : [],
        memories: Array.isArray(parsed.memories) ? parsed.memories : [],
        songs: Array.isArray(parsed.songs) ? parsed.songs : [],
        letters: Array.isArray(parsed.letters) ? parsed.letters : [],
        dreams: Array.isArray(parsed.dreams) ? parsed.dreams : [],
        capsules: Array.isArray(parsed.capsules) ? parsed.capsules : [],
      };
    } catch (error) {
      console.warn("No se pudo leer el estado guardado.", error);
      return defaultState();
    }
  }
  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      showToast(
        "No se pudieron guardar algunos datos. El almacenamiento del navegador puede estar lleno.",
        "error",
      );
      console.error(error);
    }
  }
  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) {
        reject(
          new Error("Este navegador no permite guardar archivos localmente."),
        );
        return;
      }
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(DB_STORE))
          database.createObjectStore(DB_STORE, { keyPath: "id" });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () =>
        reject(
          request.error ||
            new Error("No se pudo abrir el almacenamiento de archivos."),
        );
    });
    return dbPromise;
  }
  async function saveMedia(file) {
    const database = await openDB();
    const id = makeId();
    await new Promise((resolve, reject) => {
      const tx = database.transaction(DB_STORE, "readwrite");
      tx.objectStore(DB_STORE).put({
        id,
        blob: file,
        name: file.name,
        type: file.type,
        size: file.size,
      });
      tx.oncomplete = resolve;
      tx.onerror = () =>
        reject(tx.error || new Error("No se pudo guardar el archivo."));
    });
    return id;
  }
  async function getMedia(id) {
    if (!id) return null;
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const request = database
        .transaction(DB_STORE, "readonly")
        .objectStore(DB_STORE)
        .get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () =>
        reject(request.error || new Error("No se pudo leer el archivo."));
    });
  }
  async function mediaURL(id) {
    if (!id) return "";
    if (mediaURLs.has(id)) return mediaURLs.get(id);
    const item = await getMedia(id);
    if (!item || !item.blob) return "";
    const url = URL.createObjectURL(item.blob);
    mediaURLs.set(id, url);
    return url;
  }
  async function deleteMedia(id) {
    if (!id) return;
    if (mediaURLs.has(id)) {
      URL.revokeObjectURL(mediaURLs.get(id));
      mediaURLs.delete(id);
    }
    try {
      const database = await openDB();
      await new Promise((resolve, reject) => {
        const tx = database.transaction(DB_STORE, "readwrite");
        tx.objectStore(DB_STORE).delete(id);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
    } catch (error) {
      console.warn("No se pudo eliminar el archivo.", error);
    }
  }
  function showToast(message, type = "success") {
    const region = $("#toastRegion");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    region.append(toast);
    window.setTimeout(() => toast.remove(), 4300);
  }
  function openDialog(id) {
    const dialog = document.getElementById(id);
    if (!dialog) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }
  function closeDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
  }
  function cleanMediaUrl(id) {
    if (id && mediaURLs.has(id)) {
      URL.revokeObjectURL(mediaURLs.get(id));
      mediaURLs.delete(id);
    }
  }
  function prettyNames() {
    const { yourName, partnerName } = state.settings;
    const both = [yourName.trim(), partnerName.trim()].filter(Boolean);
    if (both.length === 2) return `${both[0]} & ${both[1]}`;
    return "Nuestra historia";
  }
  function updateBrand() {
    const label = prettyNames();
    $("#brandNames").textContent = label;
    $$(".footer-brand").forEach((el) => {
      el.lastChild.textContent = label;
    });
    const hint = state.settings.startDate
      ? "El tiempo que llevamos construyendo algo bonito."
      : "Configura la fecha en que comenzó vuestra historia.";
    $("#counterHint").textContent = hint;
    $("#togetherLabel").textContent = state.settings.startDate
      ? `Desde ${niceDate(state.settings.startDate, { day: "numeric", month: "long", year: "numeric" })}`
      : "Nuestro tiempo juntos";
    $("#whatsappHint").textContent = state.settings.whatsapp
      ? `El mensaje se abrirá para el número configurado, listo para revisar y enviar.`
      : "Configura el número de WhatsApp desde el botón ⚙ del menú.";
    document.title = state.settings.partnerName
      ? `Para ${state.settings.partnerName} ❤️`
      : "Nuestra historia ❤️";
  }
  function calculateElapsed(start, now) {
    if (!start || start > now) return null;
    let totalMonths =
      (now.getFullYear() - start.getFullYear()) * 12 +
      (now.getMonth() - start.getMonth());
    const anchorForMonth = addMonthsClamped(start, totalMonths);
    if (anchorForMonth > now) totalMonths--;
    const anchor = addMonthsClamped(start, totalMonths);
    let remaining = Math.max(0, now.getTime() - anchor.getTime());
    const days = Math.floor(remaining / 86400000);
    remaining -= days * 86400000;
    const hours = Math.floor(remaining / 3600000);
    remaining -= hours * 3600000;
    const minutes = Math.floor(remaining / 60000);
    remaining -= minutes * 60000;
    const seconds = Math.floor(remaining / 1000);
    return {
      years: Math.floor(totalMonths / 12),
      months: totalMonths % 12,
      days,
      hours,
      minutes,
      seconds,
    };
  }
  function addMonthsClamped(date, months) {
    const result = new Date(date.getTime());
    const day = result.getDate();
    result.setDate(1);
    result.setMonth(result.getMonth() + months);
    const lastDay = new Date(
      result.getFullYear(),
      result.getMonth() + 1,
      0,
    ).getDate();
    result.setDate(Math.min(day, lastDay));
    return result;
  }
  function updateTimer() {
    const startDate = dateFromInput(state.settings.startDate);
    const now = new Date();
    const target = $("#loveCounter");
    if (!startDate || startDate > now) {
      target.innerHTML = ["años", "meses", "días", "horas", "min", "seg"]
        .map((label) => `<div><b>—</b><span>${label}</span></div>`)
        .join("");
      $("#counterHint").textContent =
        startDate && startDate > now
          ? "La fecha debe ser hoy o una fecha pasada."
          : "Configura la fecha en que comenzó vuestra historia.";
      $("#anniversaryTitle").textContent =
        "Cada día juntos es motivo para celebrar.";
      $("#anniversaryText").textContent =
        "Configura vuestra fecha especial y aquí contaremos cuánto falta para el próximo aniversario.";
      $("#anniversaryCountdown").innerHTML = "∞<span>momentos por vivir</span>";
      return;
    }
    const elapsed = calculateElapsed(startDate, now);
    const values = [
      elapsed.years,
      elapsed.months,
      elapsed.days,
      elapsed.hours,
      elapsed.minutes,
      elapsed.seconds,
    ];
    const labels = ["años", "meses", "días", "horas", "min", "seg"];
    target.innerHTML = values
      .map(
        (value, index) =>
          `<div><b>${value}</b><span>${labels[index]}</span></div>`,
      )
      .join("");
    const anniversaryThisYear = new Date(
      now.getFullYear(),
      startDate.getMonth(),
      Math.min(
        startDate.getDate(),
        new Date(now.getFullYear(), startDate.getMonth() + 1, 0).getDate(),
      ),
    );
    const passed =
      new Date(
        anniversaryThisYear.getFullYear(),
        anniversaryThisYear.getMonth(),
        anniversaryThisYear.getDate() + 1,
      ) > new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let next = anniversaryThisYear;
    if (!passed)
      next = new Date(
        now.getFullYear() + 1,
        startDate.getMonth(),
        Math.min(
          startDate.getDate(),
          new Date(
            now.getFullYear() + 1,
            startDate.getMonth() + 1,
            0,
          ).getDate(),
        ),
      );
    const daysLeft = Math.max(
      0,
      Math.ceil(
        (new Date(next.getFullYear(), next.getMonth(), next.getDate()) -
          new Date(now.getFullYear(), now.getMonth(), now.getDate())) /
          86400000,
      ),
    );
    const yearsTogether = elapsed.years;
    if (
      now.getMonth() === startDate.getMonth() &&
      now.getDate() === startDate.getDate()
    ) {
      const count = Math.max(1, yearsTogether);
      $("#anniversaryTitle").textContent =
        yearsTogether > 0
          ? `¡Feliz aniversario número ${count}! ❤️`
          : "¡Hoy celebramos el comienzo de lo nuestro! ❤️";
      $("#anniversaryText").textContent =
        `Hoy es un día para agradecer la historia que han construido y todos los momentos que todavía les esperan.`;
      $("#anniversaryCountdown").innerHTML =
        "¡Hoy!<span>un día para celebrar</span>";
    } else {
      $("#anniversaryTitle").textContent =
        next.getFullYear() === now.getFullYear()
          ? "Nuestro próximo aniversario se acerca."
          : "Ya estamos escribiendo el próximo capítulo.";
      $("#anniversaryText").textContent =
        `Cada momento cuenta. El próximo aniversario será el ${niceDate(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`)}.`;
      $("#anniversaryCountdown").innerHTML =
        `${daysLeft}<span>${daysLeft === 1 ? "día para celebrar" : "días para celebrar"}</span>`;
    }
  }
  function updateSettingsForm() {
    $("#yourName").value = state.settings.yourName || "";
    $("#partnerName").value = state.settings.partnerName || "";
    $("#startDate").value = state.settings.startDate || "";
    $("#whatsappNumber").value = state.settings.whatsapp || "";
  }
  function renderStories() {
    const container = $("#timelineList");
    const stories = [...state.stories].sort((a, b) =>
      (a.date || "").localeCompare(b.date || ""),
    );
    if (!stories.length) {
      container.innerHTML = `<div class="empty-state"><span>✦</span><h3>Todo gran amor tiene un comienzo</h3><p>Añade la primera fecha especial y empieza a construir vuestra línea de tiempo.</p><button class="text-button" data-action="add-story">Crear primer recuerdo ↗</button></div>`;
      return;
    }
    container.innerHTML = stories
      .map(
        (story) => `
      <article class="timeline-item"><span class="timeline-dot"></span><div class="timeline-card"><span class="timeline-date">${escapeHTML(niceDate(story.date))}</span><h3>${escapeHTML(story.title)}</h3><p>${escapeHTML(story.description || "Un momento que merece quedarse en nuestra historia.")}</p><span class="timeline-tag">${escapeHTML(story.category || "Un recuerdo")}</span><div class="story-image" data-media-id="${escapeHTML(story.mediaId || "")}"></div><div class="item-actions"><button class="small-action" data-action="delete-story" data-id="${escapeHTML(story.id)}">Eliminar momento ×</button></div></div></article>`,
      )
      .join("");
    stories.forEach(async (story) => {
      if (!story.mediaId) return;
      try {
        const url = await mediaURL(story.mediaId);
        const slot = container.querySelector(
          `.story-image[data-media-id="${CSS.escape(story.mediaId)}"]`,
        );
        if (slot && url)
          slot.innerHTML = `<img src="${url}" alt="${escapeHTML(story.title)}">`;
      } catch (error) {
        console.warn(error);
      }
    });
  }
  function renderGallery() {
    const grid = $("#galleryGrid");
    let memories = [...state.memories].sort((a, b) =>
      (b.createdAt || "").localeCompare(a.createdAt || ""),
    );
    if (currentGalleryFilter !== "Todos")
      memories = memories.filter((m) => m.category === currentGalleryFilter);
    $("#galleryCount").textContent =
      `${state.memories.length} ${state.memories.length === 1 ? "recuerdo guardado" : "recuerdos guardados"}`;
    if (!memories.length) {
      const msg = state.memories.length
        ? "No hay recuerdos en esta categoría todavía."
        : "Sube una foto o video y acompáñalo de una descripción.";
      grid.innerHTML = `<div class="gallery-empty"><div class="empty-camera">▧</div><h3>${state.memories.length ? "Pronto habrá más momentos" : "Este espacio espera sus recuerdos"}</h3><p>${msg}</p><label class="text-button upload-link">Elegir archivos <input type="file" accept="image/*,video/*" multiple hidden class="gallery-upload-secondary"></label></div>`;
      return;
    }
    grid.innerHTML = memories
      .map(
        (item) =>
          `<article class="gallery-card"><div class="gallery-media" role="button" tabindex="0" data-action="open-media" data-id="${escapeHTML(item.id)}" aria-label="Ver ${escapeHTML(item.title)}"><div class="gallery-loading">Cargando recuerdo…</div></div><div class="gallery-caption"><h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(item.description || "Un momento para guardar cerquita del corazón.")}</p></div><div class="gallery-card-bottom"><span class="gallery-category">${escapeHTML(item.category || "Momentos")}</span><span class="gallery-date">${escapeHTML(niceDate(item.date))}</span><button class="small-action" data-action="delete-memory" data-id="${escapeHTML(item.id)}" aria-label="Eliminar recuerdo">Eliminar ×</button></div></article>`,
      )
      .join("");
    memories.forEach(async (item) => {
      try {
        const url = await mediaURL(item.mediaId);
        const slot = grid.querySelector(
          `.gallery-media[data-id="${CSS.escape(item.id)}"]`,
        );
        if (!slot) return;
        if (!url) {
          slot.innerHTML =
            '<span class="gallery-loading">Archivo no disponible</span>';
          return;
        }
        if (item.type && item.type.startsWith("video/"))
          slot.innerHTML = `<video src="${url}" muted playsinline preload="metadata"></video><span class="video-badge">▶ video</span>`;
        else
          slot.innerHTML = `<img src="${url}" alt="${escapeHTML(item.title)}" loading="lazy">`;
      } catch (error) {
        console.warn(error);
      }
    });
  }
  function renderSongs() {
    const list = $("#playlist");
    if (!state.songs.length) {
      list.innerHTML =
        '<div class="playlist-empty">Todavía no hay canciones en la lista.</div>';
      $("#songTitle").textContent = "Nuestra próxima canción";
      $("#songArtist").textContent = "Añade una canción para comenzar";
      $("#songPosition").textContent = "0 canciones";
      $("#audioPlayer").removeAttribute("src");
      $("#vinylDisc").classList.remove("playing");
      currentSongIndex = -1;
      return;
    }
    if (currentSongIndex >= state.songs.length) currentSongIndex = 0;
    if (currentSongIndex < 0) currentSongIndex = 0;
    list.innerHTML = state.songs
      .map(
        (song, index) =>
          `<div class="playlist-item ${index === currentSongIndex ? "active" : ""}" data-action="select-song" data-id="${escapeHTML(song.id)}" role="button" tabindex="0"><span class="playlist-index">${index === currentSongIndex ? "♪" : String(index + 1).padStart(2, "0")}</span><div class="playlist-meta"><strong>${escapeHTML(song.title)}</strong><span>${escapeHTML(song.artist || "Canción especial")}</span></div><span class="playlist-play">${index === currentSongIndex ? "♫" : "▶"}</span><button class="playlist-remove" data-action="delete-song" data-id="${escapeHTML(song.id)}" aria-label="Eliminar canción">×</button></div>`,
      )
      .join("");
    updateSongHeader();
  }
  async function updateSongHeader() {
    const song = state.songs[currentSongIndex];
    if (!song) return;
    $("#songTitle").textContent = song.title;
    $("#songArtist").textContent = song.artist || "Una canción para nosotros";
    $("#songPosition").textContent =
      `${currentSongIndex + 1} de ${state.songs.length}`;
    const audio = $("#audioPlayer");
    if (audio.dataset.songId !== song.id) {
      const url = await mediaURL(song.mediaId).catch(() => "");
      if (!url) {
        showToast("No se encontró el archivo de audio guardado.", "error");
        return;
      }
      audio.pause();
      audio.src = url;
      audio.dataset.songId = song.id;
      $("#vinylDisc").classList.remove("playing");
    }
    $$(".playlist-item").forEach((item, index) =>
      item.classList.toggle("active", index === currentSongIndex),
    );
  }
  async function selectSong(index, autoplay = false) {
    if (!state.songs.length) return;
    currentSongIndex = (index + state.songs.length) % state.songs.length;
    renderSongs();
    await updateSongHeader();
    if (autoplay) {
      try {
        await $("#audioPlayer").play();
        $("#vinylDisc").classList.add("playing");
      } catch {
        showToast(
          "Pulsa reproducir en el reproductor para escuchar la canción.",
          "",
        );
      }
    }
  }
  function renderLetters() {
    const grid = $("#lettersGrid");
    if (!state.letters.length) {
      grid.innerHTML =
        '<div class="letter-placeholder"><div class="envelope-illustration">✉</div><h3>Hay palabras esperando ser escritas</h3><p>Tu primera carta puede quedarse aquí para siempre.</p></div>';
      return;
    }
    const items = [...state.letters].sort((a, b) =>
      (b.createdAt || "").localeCompare(a.createdAt || ""),
    );
    grid.innerHTML = items
      .map(
        (letter) =>
          `<article class="letter-card" data-action="open-letter" data-id="${escapeHTML(letter.id)}" tabindex="0" role="button"><div class="letter-icon">✉</div><h3>${escapeHTML(letter.title)}</h3><p>${escapeHTML(letter.text)}</p><span class="letter-date">${escapeHTML(niceDate((letter.createdAt || "").slice(0, 10)))} · Abrir carta ↗</span><button class="small-action" data-action="delete-letter" data-id="${escapeHTML(letter.id)}">Eliminar ×</button></article>`,
      )
      .join("");
  }
  function renderDreams() {
    const list = $("#dreamList");
    if (!state.dreams.length)
      list.innerHTML =
        '<div class="dreams-empty">Todavía no hay planes. ¿Cuál será la primera aventura? ✨</div>';
    else
      list.innerHTML = state.dreams
        .map(
          (dream) =>
            `<div class="dream-item ${dream.done ? "done" : ""}"><input class="dream-check" type="checkbox" data-action="toggle-dream" data-id="${escapeHTML(dream.id)}" ${dream.done ? "checked" : ""} aria-label="Marcar ${escapeHTML(dream.title)} como cumplido"><div class="dream-details"><strong>${escapeHTML(dream.title)}</strong><span>${escapeHTML(dream.category || "Un plan")} · ${dream.done ? "¡Ya lo vivimos! ♥" : "Nos espera"}</span></div><button class="dream-delete" data-action="delete-dream" data-id="${escapeHTML(dream.id)}" aria-label="Eliminar plan">×</button></div>`,
        )
        .join("");
    const done = state.dreams.filter((d) => d.done).length;
    $("#dreamProgressLabel").textContent = `${done} de ${state.dreams.length}`;
    $("#dreamProgressBar").style.width =
      `${state.dreams.length ? (done / state.dreams.length) * 100 : 0}%`;
  }
  function renderCapsules() {
    const container = $("#capsuleList");
    const sorted = [...state.capsules].sort((a, b) =>
      (a.unlockDate || "").localeCompare(b.unlockDate || ""),
    );
    $("#capsuleCount").textContent =
      `${sorted.length} ${sorted.length === 1 ? "cápsula" : "cápsulas"}`;
    if (!sorted.length) {
      container.innerHTML =
        '<div class="capsules-empty">Aquí aparecerán las cartas y recuerdos que reservemos para el futuro.</div>';
      return;
    }
    const nowDate = todayISO();
    container.innerHTML = sorted
      .map((capsule) => {
        const unlocked = nowDate >= capsule.unlockDate;
        return `<article class="capsule-card ${unlocked ? "unlocked" : ""}"><button class="capsule-delete" data-action="delete-capsule" data-id="${escapeHTML(capsule.id)}" aria-label="Eliminar cápsula">Eliminar ×</button><div class="capsule-card-top"><span class="capsule-status-icon">${unlocked ? "✉" : "🔒"}</span><div><h4>${escapeHTML(capsule.title)}</h4><span class="capsule-type">${escapeHTML(capsule.type || "Carta para el futuro")}</span></div></div><p>${unlocked ? "El momento de volver a leer este recuerdo ha llegado." : `Este recuerdo espera hasta el ${niceDate(capsule.unlockDate)}.`}</p><span class="capsule-date">${unlocked ? "Disponible para abrir" : `Faltan ${daysBetween(nowDate, capsule.unlockDate)} días`}</span><button class="button ${unlocked ? "button-light" : "button-outline"}" data-action="open-capsule" data-id="${escapeHTML(capsule.id)}">${unlocked ? "Abrir cápsula ♥" : "Ver cápsula bloqueada 🔒"}</button></article>`;
      })
      .join("");
  }
  function daysBetween(startIso, endIso) {
    const a = dateFromInput(startIso),
      b = dateFromInput(endIso);
    if (!a || !b) return 0;
    return Math.max(0, Math.ceil((b - a) / 86400000));
  }
  function checkSpecialCelebrations() {
    const start = dateFromInput(state.settings.startDate);
    if (!start) return;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (start > today) return;
    const sameMonthDay =
      start.getMonth() === today.getMonth() &&
      start.getDate() === today.getDate();
    let kind = "";
    let message = "";
    if (sameMonthDay) {
      const years = today.getFullYear() - start.getFullYear();
      kind = `aniversario-${years}`;
      message =
        years > 0
          ? `¡Feliz aniversario, ${prettyNames()}! Gracias por esta historia que siguen construyendo. ❤️`
          : `¡Hoy comenzó esta historia tan especial! Que sea el primero de muchos recuerdos bonitos. ❤️`;
    } else {
      const elapsedDays = Math.floor(
        (today.getTime() -
          new Date(
            start.getFullYear(),
            start.getMonth(),
            start.getDate(),
          ).getTime()) /
          86400000,
      );
      const milestones = [
        100, 200, 300, 500, 700, 1000, 1500, 2000, 2500, 3000, 3650, 5000,
      ];
      if (milestones.includes(elapsedDays)) {
        kind = `dias-${elapsedDays}`;
        message = `¡Hoy cumplen ${elapsedDays} días de historia compartida! Gracias por cada momento que les ha traído hasta aquí. ❤️`;
      }
    }
    if (!kind) return;
    const key = `${STORAGE_KEY}.celebrated.${todayISO()}.${kind}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {}
    showToast(message);
  }
  function checkCapsuleUnlockNotifications() {
    const nowDate = todayISO();
    state.capsules.forEach((capsule) => {
      if (nowDate < capsule.unlockDate || capsule.openedAt) return;
      const key = `${STORAGE_KEY}.capsule-ready.${capsule.id}`;
      try {
        if (localStorage.getItem(key)) return;
        localStorage.setItem(key, "1");
      } catch {}
      showToast(`¡La cápsula “${capsule.title}” ya está lista para abrir! ♥`);
    });
  }
  function renderDailyMemory(forceRandom = false) {
    const options = [
      ...state.memories.map((m) => ({
        title: m.title,
        text: m.description || `Un recuerdo de ${niceDate(m.date)}.`,
        id: m.id,
        kind: "memory",
      })),
      ...state.stories.map((s) => ({
        title: s.title,
        text:
          s.description ||
          `Un capítulo importante de nuestra historia (${niceDate(s.date)}).`,
        id: s.id,
        kind: "story",
      })),
      ...state.letters.map((l) => ({
        title: l.title,
        text: l.text,
        id: l.id,
        kind: "letter",
      })),
    ];
    if (!options.length) {
      $("#dailyTitle").textContent = "Un recuerdo para volver a sonreír";
      $("#dailyText").textContent =
        "Cuando guardes vuestro primer recuerdo, aparecerá aquí para sorprenderte cada día.";
      return;
    }
    let item;
    const dateKey = todayISO();
    const cacheKey = "nuestraHistoria.dailyMemory";
    if (!forceRandom) {
      try {
        const cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
        if (cached && cached.date === dateKey)
          item = options.find(
            (o) => o.id === cached.id && o.kind === cached.kind,
          );
      } catch {}
    }
    if (!item) {
      item = options[Math.floor(Math.random() * options.length)];
      try {
        localStorage.setItem(
          cacheKey,
          JSON.stringify({ date: dateKey, id: item.id, kind: item.kind }),
        );
      } catch {}
    }
    $("#dailyTitle").textContent = item.title;
    const compact =
      item.text.length > 190 ? `${item.text.slice(0, 187)}…` : item.text;
    $("#dailyText").textContent = compact;
  }
  function renderAll() {
    updateBrand();
    updateTimer();
    renderStories();
    renderGallery();
    renderSongs();
    renderLetters();
    renderDreams();
    renderCapsules();
    renderDailyMemory();
  }

  // Settings
  $("#openSettings").addEventListener("click", () => {
    updateSettingsForm();
    openDialog("settingsDialog");
  });
  $("#settingsForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const number = $("#whatsappNumber").value.trim().replace(/[^\d]/g, "");
    state.settings = {
      yourName: $("#yourName").value.trim(),
      partnerName: $("#partnerName").value.trim(),
      startDate: $("#startDate").value,
      whatsapp: number,
    };
    saveState();
    renderAll();
    closeDialog($("#settingsDialog"));
    showToast("Los detalles de vuestra historia se han actualizado.");
    checkSpecialCelebrations();
  });
  $$("[data-close]").forEach((button) =>
    button.addEventListener("click", () =>
      closeDialog(document.getElementById(button.dataset.close)),
    ),
  );
  $$(".app-dialog").forEach((dialog) =>
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) closeDialog(dialog);
    }),
  );

  // Responsive navigation
  $("#menuToggle").addEventListener("click", () => {
    const isOpen = $("#mainNav").classList.toggle("open");
    $("#menuToggle").setAttribute("aria-expanded", String(isOpen));
    $("#menuToggle").textContent = isOpen ? "×" : "☰";
  });
  $$("#mainNav a").forEach((link) =>
    link.addEventListener("click", () => {
      $("#mainNav").classList.remove("open");
      $("#menuToggle").setAttribute("aria-expanded", "false");
      $("#menuToggle").textContent = "☰";
    }),
  );

  // Story timeline
  function showStoryDialog() {
    $("#storyForm").reset();
    $("#storyDate").value = todayISO();
    openDialog("storyDialog");
  }
  $("#addStoryButton").addEventListener("click", showStoryDialog);
  $("#storyForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const file = $("#storyImage").files[0];
    let mediaId = "";
    try {
      if (file) mediaId = await saveMedia(file);
      state.stories.push({
        id: makeId(),
        title: $("#storyTitle").value.trim(),
        date: $("#storyDate").value,
        category: $("#storyCategory").value,
        description: $("#storyDescription").value.trim(),
        mediaId,
        createdAt: new Date().toISOString(),
      });
      saveState();
      renderStories();
      renderDailyMemory();
      closeDialog($("#storyDialog"));
      showToast("El momento ya forma parte de vuestra historia.");
    } catch (error) {
      showToast(error.message || "No se pudo guardar el momento.", "error");
    }
  });

  // Gallery upload and categories
  function setGalleryFiles(files) {
    stagedGalleryFiles = [...files].filter(
      (file) =>
        file.type.startsWith("image/") || file.type.startsWith("video/"),
    );
    if (!stagedGalleryFiles.length) return;
    const totalSize = stagedGalleryFiles.reduce(
      (sum, file) => sum + file.size,
      0,
    );
    if (totalSize > 300 * 1024 * 1024) {
      stagedGalleryFiles = [];
      showToast(
        "El conjunto de archivos supera 300 MB. Prueba con archivos más pequeños.",
        "error",
      );
      return;
    }
    $("#galleryForm").reset();
    $("#galleryDate").value = todayISO();
    $("#galleryFilesLabel").textContent =
      `${stagedGalleryFiles.length} archivo(s) seleccionado(s). Se usará la misma descripción para esta selección.`;
    $("#galleryTitle").value =
      stagedGalleryFiles.length === 1
        ? stagedGalleryFiles[0].name.replace(/\.[^.]+$/, "")
        : "Un momento para recordar";
    openDialog("galleryDialog");
  }
  $("#galleryUpload").addEventListener("change", (event) => {
    setGalleryFiles(event.target.files);
    event.target.value = "";
  });
  document.addEventListener("change", (event) => {
    if (event.target.matches(".gallery-upload-secondary")) {
      setGalleryFiles(event.target.files);
      event.target.value = "";
    }
  });
  $("#galleryForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!stagedGalleryFiles.length) {
      closeDialog($("#galleryDialog"));
      return;
    }
    const title = $("#galleryTitle").value.trim();
    const description = $("#galleryDescription").value.trim();
    const date = $("#galleryDate").value || todayISO();
    const category = $("#galleryCategory").value;
    try {
      for (let i = 0; i < stagedGalleryFiles.length; i++) {
        const file = stagedGalleryFiles[i];
        const mediaId = await saveMedia(file);
        const suffix = stagedGalleryFiles.length > 1 ? ` (${i + 1})` : "";
        state.memories.push({
          id: makeId(),
          title: `${title}${suffix}`,
          description,
          date,
          category,
          mediaId,
          type: file.type,
          originalName: file.name,
          createdAt: new Date().toISOString(),
        });
      }
      stagedGalleryFiles = [];
      saveState();
      renderGallery();
      renderDailyMemory();
      closeDialog($("#galleryDialog"));
      showToast("Vuestro recuerdo quedó guardado.");
    } catch (error) {
      showToast(
        error.message ||
          "No se pudo guardar el archivo. Intenta con otro navegador.",
        "error",
      );
    }
  });
  $$("#galleryFilters .filter-pill").forEach((button) =>
    button.addEventListener("click", () => {
      currentGalleryFilter = button.dataset.filter;
      $$("#galleryFilters .filter-pill").forEach((pill) =>
        pill.classList.toggle("active", pill === button),
      );
      renderGallery();
    }),
  );

  // Music player
  $("#songUpload").addEventListener("change", async (event) => {
    const files = [...event.target.files];
    event.target.value = "";
    const audioFiles = files.filter((file) => file.type.startsWith("audio/"));
    if (!audioFiles.length) {
      if (files.length)
        showToast("Elige archivos de audio compatibles.", "error");
      return;
    }
    try {
      for (const file of audioFiles) {
        const mediaId = await saveMedia(file);
        state.songs.push({
          id: makeId(),
          title: file.name.replace(/\.[^.]+$/, "") || "Canción sin título",
          artist: "Nuestra banda sonora",
          mediaId,
          createdAt: new Date().toISOString(),
        });
      }
      saveState();
      if (currentSongIndex < 0) currentSongIndex = 0;
      renderSongs();
      await updateSongHeader();
      showToast(`${audioFiles.length} canción(es) añadida(s).`);
    } catch (error) {
      showToast(
        error.message || "No se pudieron guardar las canciones.",
        "error",
      );
    }
  });
  $("#prevSong").addEventListener("click", () =>
    selectSong(currentSongIndex - 1, true),
  );
  $("#nextSong").addEventListener("click", () =>
    selectSong(currentSongIndex + 1, true),
  );
  $("#audioPlayer").addEventListener("play", () =>
    $("#vinylDisc").classList.add("playing"),
  );
  $("#audioPlayer").addEventListener("pause", () =>
    $("#vinylDisc").classList.remove("playing"),
  );
  $("#audioPlayer").addEventListener("ended", () => {
    if (state.songs.length > 1) selectSong(currentSongIndex + 1, true);
    else $("#vinylDisc").classList.remove("playing");
  });

  // Letters
  $("#addLetterButton").addEventListener("click", () => {
    $("#letterForm").reset();
    openDialog("letterDialog");
  });
  $("#letterForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const file = $("#letterImage").files[0];
      const mediaId = file ? await saveMedia(file) : "";
      state.letters.push({
        id: makeId(),
        title: $("#letterTitle").value.trim(),
        text: $("#letterText").value.trim(),
        mediaId,
        createdAt: new Date().toISOString(),
      });
      saveState();
      renderLetters();
      renderDailyMemory();
      closeDialog($("#letterDialog"));
      showToast("Tu carta quedó guardada con cariño.");
    } catch (error) {
      showToast(error.message || "No se pudo guardar la carta.", "error");
    }
  });
  async function viewLetter(id) {
    const letter = state.letters.find((item) => item.id === id);
    if (!letter) return;
    $("#letterViewTitle").textContent = letter.title;
    let imageHtml = "";
    if (letter.mediaId) {
      const url = await mediaURL(letter.mediaId).catch(() => "");
      if (url) imageHtml = `<img src="${url}" alt="Fotografía de la carta">`;
    }
    $("#letterViewContent").innerHTML =
      `<div class="letter-reading"><div class="letter-reading-title">${escapeHTML(letter.title)}</div><div class="letter-reading-date">${escapeHTML(niceDate((letter.createdAt || "").slice(0, 10)))}</div>${escapeHTML(letter.text)}${imageHtml}</div>`;
    openDialog("letterViewDialog");
  }

  // Shared click / keyboard actions
  async function handleAction(action, id, target) {
    switch (action) {
      case "add-story":
        showStoryDialog();
        break;
      case "delete-story": {
        const item = state.stories.find((x) => x.id === id);
        if (!item) return;
        if (!confirm(`¿Eliminar el momento "${item.title}"?`)) return;
        state.stories = state.stories.filter((x) => x.id !== id);
        if (item.mediaId) await deleteMedia(item.mediaId);
        saveState();
        renderStories();
        renderDailyMemory();
        showToast("Momento eliminado.");
        break;
      }
      case "delete-memory": {
        const item = state.memories.find((x) => x.id === id);
        if (!item) return;
        if (!confirm(`¿Eliminar el recuerdo "${item.title}"?`)) return;
        state.memories = state.memories.filter((x) => x.id !== id);
        await deleteMedia(item.mediaId);
        saveState();
        renderGallery();
        renderDailyMemory();
        showToast("Recuerdo eliminado.");
        break;
      }
      case "open-media": {
        const item = state.memories.find((x) => x.id === id);
        if (!item) return;
        const url = await mediaURL(item.mediaId).catch(() => "");
        if (!url) {
          showToast("No se encontró el archivo.", "error");
          return;
        }
        let box = $("#lightbox");
        if (!box) {
          box = document.createElement("div");
          box.id = "lightbox";
          box.className = "lightbox";
          box.innerHTML =
            '<button class="lightbox-close" aria-label="Cerrar">×</button><div class="lightbox-inner"></div>';
          document.body.append(box);
          box.addEventListener("click", (e) => {
            if (e.target === box || e.target.closest(".lightbox-close"))
              box.classList.remove("visible");
          });
        }
        const inner = $(".lightbox-inner", box);
        inner.innerHTML =
          item.type && item.type.startsWith("video/")
            ? `<video src="${url}" controls autoplay playsinline></video><p>${escapeHTML(item.title)}</p>`
            : `<img src="${url}" alt="${escapeHTML(item.title)}"><p>${escapeHTML(item.title)}${item.description ? ` — ${escapeHTML(item.description)}` : ""}</p>`;
        box.classList.add("visible");
        break;
      }
      case "select-song": {
        if (target && target.closest('[data-action="delete-song"]')) return;
        const index = state.songs.findIndex((x) => x.id === id);
        if (index >= 0) selectSong(index, true);
        break;
      }
      case "delete-song": {
        const index = state.songs.findIndex((x) => x.id === id);
        if (index < 0) return;
        const item = state.songs[index];
        if (!confirm(`¿Eliminar "${item.title}" de la lista?`)) return;
        const audio = $("#audioPlayer");
        if (audio.dataset.songId === item.id) {
          audio.pause();
          audio.removeAttribute("src");
          delete audio.dataset.songId;
          cleanMediaUrl(item.mediaId);
        }
        state.songs.splice(index, 1);
        if (currentSongIndex >= state.songs.length)
          currentSongIndex = state.songs.length - 1;
        saveState();
        renderSongs();
        if (state.songs.length) await updateSongHeader();
        await deleteMedia(item.mediaId);
        showToast("Canción eliminada.");
        break;
      }
      case "open-letter": {
        if (target && target.closest('[data-action="delete-letter"]')) return;
        await viewLetter(id);
        break;
      }
      case "delete-letter": {
        const item = state.letters.find((x) => x.id === id);
        if (!item) return;
        if (!confirm(`¿Eliminar la carta "${item.title}"?`)) return;
        state.letters = state.letters.filter((x) => x.id !== id);
        if (item.mediaId) await deleteMedia(item.mediaId);
        saveState();
        renderLetters();
        renderDailyMemory();
        showToast("Carta eliminada.");
        break;
      }
      case "toggle-dream": {
        const dream = state.dreams.find((x) => x.id === id);
        if (!dream) return;
        dream.done = Boolean(target.checked);
        saveState();
        renderDreams();
        if (dream.done)
          showToast("¡Un sueño más que se convierte en recuerdo! ✨");
        break;
      }
      case "delete-dream": {
        const dream = state.dreams.find((x) => x.id === id);
        if (!dream) return;
        state.dreams = state.dreams.filter((x) => x.id !== id);
        saveState();
        renderDreams();
        showToast("Plan eliminado.");
        break;
      }
      case "open-capsule": {
        const capsule = state.capsules.find((x) => x.id === id);
        if (!capsule) return;
        if (todayISO() < capsule.unlockDate) {
          showToast(
            `Esta cápsula se desbloquea el ${niceDate(capsule.unlockDate)}.`,
            "",
          );
          return;
        }
        $("#openCapsuleTitle").textContent = capsule.title;
        let photo = "";
        if (capsule.mediaId) {
          const url = await mediaURL(capsule.mediaId).catch(() => "");
          if (url)
            photo = `<img src="${url}" alt="Fotografía guardada en la cápsula">`;
        }
        $("#openCapsuleContent").innerHTML =
          `<div class="capsule-meta">${escapeHTML(capsule.type)} · Escrito por ${escapeHTML(capsule.author)} · Creado el ${escapeHTML(niceDate((capsule.createdAt || "").slice(0, 10)))}</div>${escapeHTML(capsule.text)}${photo}`;
        if (!capsule.openedAt) {
          capsule.openedAt = new Date().toISOString();
          saveState();
          renderCapsules();
        }
        openDialog("openCapsuleDialog");
        showToast("Una pequeña sorpresa del pasado, justo a tiempo.");
        break;
      }
      case "delete-capsule": {
        const capsule = state.capsules.find((x) => x.id === id);
        if (!capsule) return;
        if (
          !confirm(
            `¿Eliminar la cápsula "${capsule.title}"? Esta acción no se puede deshacer.`,
          )
        )
          return;
        state.capsules = state.capsules.filter((x) => x.id !== id);
        if (capsule.mediaId) await deleteMedia(capsule.mediaId);
        saveState();
        renderCapsules();
        showToast("Cápsula eliminada.");
        break;
      }
    }
  }
  document.addEventListener("click", async (event) => {
    const actionElement = event.target.closest("[data-action]");
    if (!actionElement) return;
    if (
      actionElement.matches('button[type="submit"]') ||
      actionElement.matches("input")
    )
      return;
    event.preventDefault();
    try {
      await handleAction(
        actionElement.dataset.action,
        actionElement.dataset.id || "",
        actionElement,
      );
    } catch (error) {
      console.error(error);
      showToast("No se pudo completar esa acción.", "error");
    }
  });
  document.addEventListener("keydown", async (event) => {
    if (
      (event.key === "Enter" || event.key === " ") &&
      event.target.matches('[role="button"][data-action]')
    ) {
      if (event.target.matches("input")) return;
      event.preventDefault();
      try {
        await handleAction(
          event.target.dataset.action,
          event.target.dataset.id || "",
          event.target,
        );
      } catch (error) {
        console.error(error);
      }
    }
  });

  // Dreams
  $("#dreamForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const title = $("#dreamInput").value.trim();
    if (!title) return;
    state.dreams.push({
      id: makeId(),
      title,
      category: $("#dreamCategory").value,
      done: false,
      createdAt: new Date().toISOString(),
    });
    saveState();
    renderDreams();
    event.target.reset();
    showToast("Plan añadido a vuestra lista.");
  });
  const dateIdeas = [
    "Preparar una cena juntos y elegir una canción para cocinar.",
    "Salir a caminar sin prisa y tomar algo por el camino.",
    "Tener una noche de películas con snacks y mantita.",
    "Visitar un lugar nuevo de la ciudad.",
    "Preparar una cita en casa con luces suaves y música.",
    "Hacer una lista de 10 cosas que queremos vivir juntos.",
    "Recrear una de nuestras primeras citas.",
    "Ver el atardecer y tomar una foto para el álbum.",
    "Jugar algo juntos y que el perdedor elija el próximo plan.",
    "Probar un restaurante que nunca hayamos visitado.",
  ];
  $("#rouletteButton").addEventListener("click", () => {
    const idea = dateIdeas[Math.floor(Math.random() * dateIdeas.length)];
    $("#rouletteResult").textContent = `La idea de hoy: ${idea}`;
    $("#rouletteResult").classList.add("visible");
  });

  // Capsules
  $("#addCapsuleButton").addEventListener("click", () => {
    $("#capsuleForm").reset();
    const minDate = new Date();
    minDate.setDate(minDate.getDate() + 1);
    const minISO = `${minDate.getFullYear()}-${String(minDate.getMonth() + 1).padStart(2, "0")}-${String(minDate.getDate()).padStart(2, "0")}`;
    $("#capsuleDate").min = minISO;
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);
    $("#capsuleDate").value =
      `${nextYear.getFullYear()}-${String(nextYear.getMonth() + 1).padStart(2, "0")}-${String(nextYear.getDate()).padStart(2, "0")}`;
    openDialog("capsuleDialog");
  });
  $("#capsuleForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const unlockDate = $("#capsuleDate").value;
    if (!unlockDate || unlockDate <= todayISO()) {
      showToast("Elige una fecha futura para abrir la cápsula.", "error");
      return;
    }
    try {
      const file = $("#capsuleImage").files[0];
      const mediaId = file ? await saveMedia(file) : "";
      state.capsules.push({
        id: makeId(),
        title: $("#capsuleTitle").value.trim(),
        unlockDate,
        type: $("#capsuleType").value,
        text: $("#capsuleText").value.trim(),
        author: $("#capsuleAuthor").value,
        mediaId,
        createdAt: new Date().toISOString(),
        openedAt: "",
      });
      saveState();
      renderCapsules();
      closeDialog($("#capsuleDialog"));
      showToast("Cápsula sellada. Su sorpresa espera en el futuro. ♥");
    } catch (error) {
      showToast(error.message || "No se pudo crear la cápsula.", "error");
    }
  });

  // WhatsApp quick message
  let selectedMessage = "Quiero comer algo: 🍔";
  $$("#messageChoices .message-choice").forEach((button) =>
    button.addEventListener("click", () => {
      selectedMessage = button.dataset.choice;
      $$("#messageChoices .message-choice").forEach((choice) =>
        choice.classList.toggle("selected", choice === button),
      );
    }),
  );
  $("#whatsappForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const number = (state.settings.whatsapp || "").replace(/\D/g, "");
    if (!number) {
      showToast("Primero configura tu número de WhatsApp desde ⚙.", "error");
      updateSettingsForm();
      openDialog("settingsDialog");
      return;
    }
    const custom = $("#whatsappMessage").value.trim();
    const yourName = state.settings.yourName.trim();
    const who = yourName ? `Hola, soy ${yourName} ❤️` : "Hola ❤️";
    const message = `${who}. ${selectedMessage}${custom ? `\n\nTe cuento un poquito más: ${custom}` : ""}`;
    window.open(
      `https://wa.me/${number}?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );
  });

  // Surprise button: pick a memory or an idea for a date.
  $("#surpriseButton").addEventListener("click", () => {
    const choices = [
      () => {
        renderDailyMemory(true);
        $("#recuerdoDelDia").scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        showToast("Un recuerdo elegido especialmente para ahora.");
      },
      () => {
        $("#rouletteButton").click();
        $("#suenos").scrollIntoView({ behavior: "smooth", block: "center" });
      },
      () => {
        $("#addLetterButton").click();
      },
    ];
    choices[Math.floor(Math.random() * choices.length)]();
  });
  $("#newMemoryButton").addEventListener("click", () => {
    renderDailyMemory(true);
    showToast("Aquí tienes otro pedacito de vuestra historia.");
  });
  $("#footerYear").textContent = new Date().getFullYear();

  // Initial render and clock.
  renderAll();
  checkSpecialCelebrations();
  checkCapsuleUnlockNotifications();
  window.setInterval(updateTimer, 1000);
  window.setInterval(() => {
    renderCapsules();
    checkSpecialCelebrations();
    checkCapsuleUnlockNotifications();
  }, 60000);
  window.addEventListener("beforeunload", () => {
    mediaURLs.forEach((url) => URL.revokeObjectURL(url));
  });
})();
