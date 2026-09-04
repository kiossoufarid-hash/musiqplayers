"use strict";

/* ============================================================
   MUSICPLAYER — APP.JS
   Version propre alignée sur le HTML actuel
============================================================ */


/* ============================================================
   CONFIGURATION
============================================================ */

const DB_NAME = "MusicPlayerDB";
const DB_VERSION = 1;

const AUDIO_STORE = "tracks";
const PLAYLIST_STORE = "playlists";

const SETTINGS_KEY = "musicplayer_settings";

const AUDIO_EXTENSIONS = [
    "mp3",
    "wav",
    "ogg",
    "oga",
    "m4a",
    "aac",
    "flac",
    "opus",
    "webm"
];


/* ============================================================
   ÉTAT GLOBAL
============================================================ */

const state = {

    tracks: [],

    playlists: [],

    queue: [],

    history: [],

    currentTrackId: null,

    currentTrackIndex: -1,

    search: "",

    libraryFilter: "all",

    sort: "recent",

    isPlaying: false,

    repeatMode: "off",

    shuffle: false,

    volume: 1,

    activePage: "home",

    selectedTrackId: null,

    playlistModalMode: "create",

    selectedPlaylistId: null,

    installPrompt: null,

    settings: {
        darkMode: true
    },

    decks: {

        A: {
            trackId: null,
            objectUrl: null,
            cue: 0,
            pitch: 0,
            volume: 1
        },

        B: {
            trackId: null,
            objectUrl: null,
            cue: 0,
            pitch: 0,
            volume: 1
        }

    },

    crossfader: 0,

    masterVolume: 1,

    effects: {
        echo: false,
        reverb: false,
        filter: false,
        flanger: false
    },

    hotCues: {
        A: {},
        B: {}
    }

};


/* ============================================================
   DOM HELPER
============================================================ */

const $ = id => document.getElementById(id);


/* ============================================================
   ELEMENTS AUDIO
============================================================ */

const mainAudio = $("mainAudio");

const deckAAudio = $("deckAAudio");

const deckBAudio = $("deckBAudio");


/* ============================================================
   INDEXEDDB
============================================================ */

let db = null;


function openDatabase() {

    return new Promise((resolve, reject) => {

        if (!window.indexedDB) {

            reject(
                new Error("IndexedDB n'est pas disponible.")
            );

            return;
        }


        const request = indexedDB.open(
            DB_NAME,
            DB_VERSION
        );


        request.onupgradeneeded = event => {

            const database = event.target.result;


            if (!database.objectStoreNames.contains(AUDIO_STORE)) {

                const store =
                    database.createObjectStore(
                        AUDIO_STORE,
                        {
                            keyPath: "id"
                        }
                    );


                store.createIndex(
                    "name",
                    "name",
                    {
                        unique: false
                    }
                );
            }


            if (!database.objectStoreNames.contains(PLAYLIST_STORE)) {

                database.createObjectStore(
                    PLAYLIST_STORE,
                    {
                        keyPath: "id"
                    }
                );
            }

        };


        request.onsuccess = () => {

            db = request.result;

            resolve(db);

        };


        request.onerror = () => {

            reject(request.error);

        };

    });

}


function dbPut(storeName, value) {

    return new Promise((resolve, reject) => {

        if (!db) {

            resolve();

            return;
        }


        const transaction =
            db.transaction(
                storeName,
                "readwrite"
            );


        const store =
            transaction.objectStore(
                storeName
            );


        const request =
            store.put(value);


        request.onsuccess = () => {

            resolve(request.result);

        };


        request.onerror = () => {

            reject(request.error);

        };

    });

}


function dbGetAll(storeName) {

    return new Promise((resolve, reject) => {

        if (!db) {

            resolve([]);

            return;
        }


        const transaction =
            db.transaction(
                storeName,
                "readonly"
            );


        const store =
            transaction.objectStore(
                storeName
            );


        const request =
            store.getAll();


        request.onsuccess = () => {

            resolve(request.result || []);

        };


        request.onerror = () => {

            reject(request.error);

        };

    });

}


function dbDelete(storeName, id) {

    return new Promise((resolve, reject) => {

        if (!db) {

            resolve();

            return;
        }


        const transaction =
            db.transaction(
                storeName,
                "readwrite"
            );


        const store =
            transaction.objectStore(
                storeName
            );


        const request =
            store.delete(id);


        request.onsuccess = () => {

            resolve();

        };


        request.onerror = () => {

            reject(request.error);

        };

    });

}


function dbClear(storeName) {

    return new Promise((resolve, reject) => {

        if (!db) {

            resolve();

            return;
        }


        const transaction =
            db.transaction(
                storeName,
                "readwrite"
            );


        const store =
            transaction.objectStore(
                storeName
            );


        const request =
            store.clear();


        request.onsuccess = () => {

            resolve();

        };


        request.onerror = () => {

            reject(request.error);

        };

    });

}


/* ============================================================
   UTILITAIRES
============================================================ */

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


function formatTime(seconds) {

    if (!Number.isFinite(seconds) || seconds < 0) {

        return "00:00";

    }


    const total =
        Math.floor(seconds);


    const minutes =
        Math.floor(total / 60);


    const secondsLeft =
        total % 60;


    return (
        String(minutes).padStart(2, "0") +
        ":" +
        String(secondsLeft).padStart(2, "0")
    );

}


function formatSize(bytes) {

    if (!bytes || bytes <= 0) {

        return "0 Mo";

    }


    const mb =
        bytes / 1024 / 1024;


    if (mb < 1) {

        return (
            Math.round(bytes / 1024) +
            " Ko"
        );

    }


    return mb.toFixed(1) + " Mo";

}


function cleanTitle(filename) {

    return filename
        .replace(/\.[^/.]+$/, "")
        .replace(/[_-]+/g, " ")
        .trim();

}


function isAudioFile(file) {

    if (!file) return false;


    if (
        file.type &&
        file.type.startsWith("audio/")
    ) {

        return true;

    }


    const extension =
        file.name
            .split(".")
            .pop()
            ?.toLowerCase();


    return AUDIO_EXTENSIONS.includes(
        extension
    );

}


function getTrackById(id) {

    return (
        state.tracks.find(
            track => track.id === id
        ) || null
    );

}


function getCurrentTrack() {

    return getTrackById(
        state.currentTrackId
    );

}


function refreshIcons() {

    if (
        window.lucide &&
        typeof window.lucide.createIcons === "function"
    ) {

        window.lucide.createIcons();

    }

}


/* ============================================================
   TOAST
============================================================ */

let toastTimer = null;


function showToast(
    title,
    message = "",
    type = "success"
) {

    const toast = $("toast");

    if (!toast) return;


    const toastTitle =
        $("toastTitle");

    const toastMessage =
        $("toastMessage");

    const toastIcon =
        $("toastIcon");


    if (toastTitle) {

        toastTitle.textContent =
            title;

    }


    if (toastMessage) {

        toastMessage.textContent =
            message;

    }


    if (toastIcon) {

        const icons = {
            success: "circle-check",
            error: "circle-x",
            info: "info",
            warning: "triangle-alert"
        };


        toastIcon.innerHTML =
            `<i data-lucide="${
                icons[type] || icons.info
            }"></i>`;

    }


    toast.classList.add("show");


    refreshIcons();


    clearTimeout(toastTimer);


    toastTimer =
        setTimeout(() => {

            toast.classList.remove("show");

        }, 3000);

}


/* ============================================================
   NAVIGATION
============================================================ */

const validPages = [
    "home",
    "library",
    "favorites",
    "playlists",
    "dj"
];


function navigateTo(page) {

    if (!validPages.includes(page)) {

        page = "home";

    }


    state.activePage = page;


    /* Cacher toutes les pages */

    document
        .querySelectorAll("[data-page-content]")
        .forEach(section => {

            section.classList.toggle(
                "active-section",
                section.dataset.pageContent === page
            );

        });


    /* Activer les boutons correspondants */

    document
        .querySelectorAll("[data-page]")
        .forEach(button => {

            button.classList.toggle(
                "active",
                button.dataset.page === page
            );

        });


    /* Actualiser la page */

    if (page === "home") {

        renderHome();

    }


    if (page === "library") {

        renderLibrary();

    }


    if (page === "favorites") {

        renderFavorites();

    }


    if (page === "playlists") {

        renderPlaylists();

    }


    if (page === "dj") {

        updateDJInterface();

        drawWaveform("A");

        drawWaveform("B");

    }


    const mainContent =
        $("mainContent");


    if (mainContent) {

        mainContent.scrollTo({
            top: 0,
            behavior: "smooth"
        });

    }


    closeSidebar();

    refreshIcons();

}


function setupNavigation() {

    /*
       IMPORTANT :

       Ton HTML utilise :
       data-page="home"

       et les sections utilisent :
       data-page-content="home"

       On respecte exactement cette structure.
    */

    document
        .querySelectorAll(
            ".sidebar-link[data-page], .bottom-nav-item[data-page]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    navigateTo(
                        button.dataset.page
                    );

                }
            );

        });

}


/* ============================================================
   SIDEBAR
============================================================ */

function openSidebar() {

    const sidebar =
        $("sidebar");

    const overlay =
        $("sidebarOverlay");


    if (sidebar) {

        sidebar.classList.add("open");
        sidebar.classList.add("active");

    }


    if (overlay) {

        overlay.classList.remove("hidden");

        overlay.classList.add("active");

    }

}


function closeSidebar() {

    const sidebar =
        $("sidebar");

    const overlay =
        $("sidebarOverlay");


    if (sidebar) {

        sidebar.classList.remove("open");

        sidebar.classList.remove("active");

    }


    if (overlay) {

        overlay.classList.add("hidden");

        overlay.classList.remove("active");

    }

}


function setupSidebar() {

    $("menuBtn")?.addEventListener(
        "click",
        openSidebar
    );


    $("closeSidebarBtn")?.addEventListener(
        "click",
        closeSidebar
    );


    $("sidebarOverlay")?.addEventListener(
        "click",
        closeSidebar
    );

}


/* ============================================================
   IMPORTATION
============================================================ */

function openFilePicker() {

    $("audioFileInput")?.click();

}


function openFolderPicker() {

    $("folderInput")?.click();

}


function setupImport() {

    const importButtons = [

        $("importMusicBtn"),

        $("libraryImportBtn"),

        $("mobileImportBtn"),

        $("emptyImportBtn")

    ];


    importButtons.forEach(button => {

        button?.addEventListener(
            "click",
            openFilePicker
        );

    });

    $("libraryFolderImportBtn")?.addEventListener(
        "click",
        openFolderPicker
    );

    $("sidebarImportBtn")?.addEventListener(
        "click",
        openFolderPicker
    );


    $("audioFileInput")?.addEventListener(
        "change",
        event => {

            processFiles(
                Array.from(
                    event.target.files || []
                )
            );

            event.target.value = "";

        }
    );


    $("folderInput")?.addEventListener(
        "change",
        event => {

            processFiles(
                Array.from(
                    event.target.files || []
                )
            );

            event.target.value = "";

        }
    );

}


async function processFiles(files) {

    const audioFiles =
        files.filter(isAudioFile);


    if (!audioFiles.length) {

        showToast(
            "Aucun fichier audio",
            "Aucun fichier compatible n'a été trouvé.",
            "error"
        );

        return;

    }


    let added = 0;


    for (const file of audioFiles) {

        try {

            const duplicate =
                state.tracks.some(
                    track =>
                        (track.relativePath || track.name) ===
                            (file.webkitRelativePath || file.name) &&
                        track.size === file.size
                );


            if (duplicate) {

                continue;

            }


            const track = {

                id:
                    "track_" +
                    Date.now() +
                    "_" +
                    Math.random()
                        .toString(36)
                        .slice(2, 9),

                name: file.name,

                relativePath:
                    file.webkitRelativePath ||
                    file.name,

                title: cleanTitle(
                    file.name
                ),

                artist:
                    "Artiste inconnu",

                album:
                    "Album inconnu",

                size:
                    file.size,

                type:
                    file.type ||
                    "audio/*",

                duration: 0,

                favorite: false,

                addedAt:
                    Date.now(),

                playCount: 0,

                blob: file

            };


            await readAudioMetadata(
                track
            );


            await dbPut(
                AUDIO_STORE,
                track
            );


            state.tracks.push(
                track
            );


            added++;

        } catch (error) {

            console.error(
                "Erreur import :",
                error
            );

        }

    }


    updateAllViews();


    if (added > 0) {

        showToast(
            "Importation terminée",
            `${added} morceau${added > 1 ? "x" : ""} ajouté${added > 1 ? "s" : ""}.`,
            "success"
        );

    } else {

        showToast(
            "Aucun nouveau morceau",
            "Les fichiers sélectionnés existent déjà.",
            "info"
        );

    }

}


function readAudioMetadata(track) {

    return new Promise(resolve => {

        if (!track.blob) {

            resolve();

            return;

        }


        const url =
            URL.createObjectURL(
                track.blob
            );


        const audio =
            document.createElement(
                "audio"
            );


        audio.preload =
            "metadata";


        audio.onloadedmetadata =
            () => {

                track.duration =
                    Number.isFinite(
                        audio.duration
                    )
                        ? audio.duration
                        : 0;


                URL.revokeObjectURL(
                    url
                );


                resolve();

            };


        audio.onerror = () => {

            URL.revokeObjectURL(
                url
            );


            resolve();

        };


        audio.src = url;

    });

}


/* ============================================================
   RENDU D'UNE MUSIQUE
============================================================ */

function createMusicItem(
    track,
    index = 0
) {

    return `

        <div
            class="music-item"
            data-track-id="${escapeHTML(track.id)}"
        >

            <button
                class="music-main"
                type="button"
                data-action="play"
                data-track-id="${escapeHTML(track.id)}"
            >

                <span class="music-number">
                    ${index + 1}
                </span>


                <span class="music-cover">
                    <i data-lucide="music-2"></i>
                </span>


                <span class="music-info">

                    <strong>
                        ${escapeHTML(track.title)}
                    </strong>

                    <span>
                        ${escapeHTML(track.artist)}
                    </span>

                </span>


                <span class="music-duration">
                    ${formatTime(track.duration)}
                </span>

            </button>


            <button
                class="music-action favorite-action ${
                    track.favorite ? "active" : ""
                }"
                type="button"
                data-action="favorite"
                data-track-id="${escapeHTML(track.id)}"
                aria-label="Favori"
            >

                <i data-lucide="heart"></i>

            </button>


            <button
                class="music-action"
                type="button"
                data-action="options"
                data-track-id="${escapeHTML(track.id)}"
                aria-label="Options"
            >

                <i data-lucide="more-horizontal"></i>

            </button>

        </div>

    `;

}


function attachMusicActions(
    container
) {

    if (!container) return;


    container
        .querySelectorAll(
            "[data-action]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                event => {

                    event.stopPropagation();


                    const action =
                        button.dataset.action;


                    const id =
                        button.dataset.trackId;


                    if (action === "play") {

                        playTrackById(id);

                    }


                    if (action === "favorite") {

                        toggleFavorite(id);

                    }


                    if (action === "options") {

                        openTrackOptions(id);

                    }

                }
            );

        });

}


/* ============================================================
   ACCUEIL
============================================================ */

function renderHome() {

    renderRecentMusic();

    renderHomePlaylists();

    updateStatistics();

}


function renderRecentMusic() {

    const container =
        $("musicList");


    if (!container) return;


    let tracks =
        [...state.tracks];


    if (state.search) {

        const query =
            state.search.toLowerCase();


        tracks =
            tracks.filter(
                track =>
                    `${track.title} ${track.artist} ${track.album} ${track.name}`
                        .toLowerCase()
                        .includes(query)
            );

    }


    if (state.libraryFilter === "favorites") {

        tracks =
            tracks.filter(
                track => track.favorite
            );

    }


    if (state.libraryFilter === "recent") {

        tracks =
            tracks
                .sort(
                    (a, b) =>
                        b.addedAt -
                        a.addedAt
                )
                .slice(0, 10);

    } else {

        tracks =
            tracks.slice(0, 10);

    }


    if (!tracks.length) {

        container.innerHTML = `

            <div class="empty-state">

                <div class="empty-state-icon">
                    <i data-lucide="music"></i>
                </div>

                <h3>
                    ${
                        state.search
                            ? "Aucun morceau trouvé"
                            : "Votre bibliothèque est vide"
                    }
                </h3>

                <p>
                    ${
                        state.search
                            ? "Essayez une autre recherche."
                            : "Importez vos fichiers audio pour commencer."
                    }
                </p>

            </div>

        `;


        refreshIcons();

        return;

    }


    container.innerHTML =
        tracks
            .map(
                (track, index) =>
                    createMusicItem(
                        track,
                        index
                    )
            )
            .join("");


    attachMusicActions(
        container
    );


    refreshIcons();

}


/* ============================================================
   BIBLIOTHÈQUE
============================================================ */

function renderLibrary() {

    const container =
        $("libraryMusicList");


    if (!container) return;


    let tracks =
        [...state.tracks];


    if (state.search) {

        const query =
            state.search.toLowerCase();


        tracks =
            tracks.filter(
                track =>
                    `${track.title} ${track.artist} ${track.album} ${track.name}`
                        .toLowerCase()
                        .includes(query)
            );

    }


    if (state.libraryFilter === "favorites") {

        tracks =
            tracks.filter(
                track => track.favorite
            );

    }


    if (state.libraryFilter === "recent") {

        tracks.sort(
            (a, b) =>
                b.addedAt -
                a.addedAt
        );

    }


    if (state.sort === "title") {

        tracks.sort(
            (a, b) =>
                a.title.localeCompare(
                    b.title,
                    "fr",
                    {
                        sensitivity:
                            "base"
                    }
                )
        );

    }


    if (state.sort === "artist") {

        tracks.sort(
            (a, b) =>
                a.artist.localeCompare(
                    b.artist,
                    "fr",
                    {
                        sensitivity:
                            "base"
                    }
                )
        );

    }


    if (state.sort === "duration") {

        tracks.sort(
            (a, b) =>
                a.duration -
                b.duration
        );

    }


    const resultCount =
        $("libraryResultCount");


    if (resultCount) {

        resultCount.textContent =
            `${tracks.length} musique${tracks.length > 1 ? "s" : ""}`;

    }


    if (!tracks.length) {

        container.innerHTML = `

            <div class="empty-state">

                <div class="empty-state-icon">
                    <i data-lucide="music"></i>
                </div>

                <h3>
                    Aucune musique
                </h3>

                <p>
                    Importez vos fichiers audio pour les retrouver ici.
                </p>

            </div>

        `;


        refreshIcons();

        return;

    }


    container.innerHTML =
        tracks
            .map(
                (track, index) =>
                    createMusicItem(
                        track,
                        index
                    )
            )
            .join("");


    attachMusicActions(
        container
    );


    refreshIcons();

}


/* ============================================================
   FAVORIS
============================================================ */

function renderFavorites() {

    const container =
        $("favoritesList");


    if (!container) return;


    const favorites =
        state.tracks.filter(
            track => track.favorite
        );


    if (!favorites.length) {

        container.innerHTML = `

            <div class="empty-state">

                <div class="empty-state-icon">
                    <i data-lucide="heart"></i>
                </div>

                <h3>
                    Aucun favori
                </h3>

                <p>
                    Ajoutez vos morceaux préférés ici.
                </p>

            </div>

        `;


        refreshIcons();

        return;

    }


    container.innerHTML =
        favorites
            .map(
                (track, index) =>
                    createMusicItem(
                        track,
                        index
                    )
            )
            .join("");


    attachMusicActions(
        container
    );


    refreshIcons();

}


async function toggleFavorite(id) {

    const track =
        getTrackById(id);


    if (!track) return;


    track.favorite =
        !track.favorite;


    await dbPut(
        AUDIO_STORE,
        track
    );


    updateAllViews();


    showToast(
        track.favorite
            ? "Ajouté aux favoris"
            : "Retiré des favoris",
        track.title,
        "success"
    );

}


/* ============================================================
   LECTEUR PRINCIPAL
============================================================ */

async function playTrackById(id) {

    const track =
        getTrackById(id);


    if (!track) {

        showToast(
            "Morceau introuvable",
            "",
            "error"
        );

        return;

    }


    if (!track.blob) {

        showToast(
            "Fichier indisponible",
            "Réimportez ce morceau.",
            "error"
        );

        return;

    }


    state.currentTrackId =
        track.id;


    state.currentTrackIndex =
        state.tracks.findIndex(
            item =>
                item.id === track.id
        );


    try {

        if (
            mainAudio.dataset.objectUrl
        ) {

            URL.revokeObjectURL(
                mainAudio.dataset.objectUrl
            );

        }


        const url =
            URL.createObjectURL(
                track.blob
            );


        mainAudio.dataset.objectUrl =
            url;


        mainAudio.src =
            url;


        mainAudio.currentTime =
            0;


        await mainAudio.play();


        state.isPlaying =
            true;


        track.playCount =
            Number(track.playCount || 0) + 1;


        state.history = [
            track.id,
            ...state.history.filter(
                id => id !== track.id
            )
        ].slice(0, 50);


        await dbPut(
            AUDIO_STORE,
            track
        );


        updatePlayerUI();

        updateStatistics();

    } catch (error) {

        console.error(
            "Lecture impossible :",
            error
        );


        showToast(
            "Lecture impossible",
            "Le fichier ne peut pas être lu.",
            "error"
        );

    }

}


async function toggleMainPlay() {

    if (!state.currentTrackId) {

        if (!state.tracks.length) {

            showToast(
                "Bibliothèque vide",
                "Importez d'abord votre musique.",
                "info"
            );

            return;

        }


        await playTrackById(
            state.tracks[0].id
        );

        return;

    }


    if (mainAudio.paused) {

        try {

            await mainAudio.play();

            state.isPlaying =
                true;

        } catch (error) {

            console.error(error);

        }

    } else {

        mainAudio.pause();

        state.isPlaying =
            false;

    }


    updatePlayerUI();

}


function playNext() {

    if (!state.tracks.length) return;


    if (
        state.repeatMode === "one" &&
        state.currentTrackId
    ) {

        playTrackById(
            state.currentTrackId
        );

        return;

    }


    if (state.queue.length) {

        const nextId =
            state.queue.shift();


        playTrackById(
            nextId
        );


        return;

    }


    let nextIndex;


    if (state.shuffle) {

        const available =
            state.tracks
                .map(
                    (_, index) =>
                        index
                )
                .filter(
                    index =>
                        index !==
                        state.currentTrackIndex
                );


        if (!available.length) {

            nextIndex = 0;

        } else {

            nextIndex =
                available[
                    Math.floor(
                        Math.random() *
                        available.length
                    )
                ];

        }

    } else {

        nextIndex =
            state.currentTrackIndex + 1;


        if (
            nextIndex >=
            state.tracks.length
        ) {

            if (
                state.repeatMode === "all"
            ) {

                nextIndex = 0;

            } else {

                state.isPlaying =
                    false;

                updatePlayerUI();

                return;

            }

        }

    }


    playTrackById(
        state.tracks[nextIndex].id
    );

}


function playPrevious() {

    if (!state.tracks.length) return;


    if (
        mainAudio.currentTime >
        3
    ) {

        mainAudio.currentTime =
            0;

        return;

    }


    let index =
        state.currentTrackIndex - 1;


    if (index < 0) {

        index =
            state.tracks.length - 1;

    }


    playTrackById(
        state.tracks[index].id
    );

}


/* ============================================================
   PLAYER UI
============================================================ */

function updatePlayerUI() {

    const track =
        getCurrentTrack();


    const miniTitle =
        $("miniTitle");

    const miniArtist =
        $("miniArtist");


    if (track) {

        if (miniTitle) {

            miniTitle.textContent =
                track.title;

        }


        if (miniArtist) {

            miniArtist.textContent =
                track.artist;

        }

    } else {

        if (miniTitle) {

            miniTitle.textContent =
                "Aucun morceau";

        }


        if (miniArtist) {

            miniArtist.textContent =
                "MusicPlayer";

        }

    }


    const playButton =
        $("mainPlayBtn");


    if (playButton) {

        playButton.innerHTML = `
            <i data-lucide="${
                state.isPlaying
                    ? "pause"
                    : "play"
            }"></i>
        `;

        playButton.setAttribute(
            "aria-label",
            state.isPlaying
                ? "Pause"
                : "Lecture"
        );

    }


    const favoriteButton =
        $("miniFavoriteBtn");


    if (favoriteButton) {

        favoriteButton.classList.toggle(
            "active",
            Boolean(
                track?.favorite
            )
        );

        favoriteButton.innerHTML = `
            <i data-lucide="heart"></i>
        `;

    }


    refreshProgress();

    refreshIcons();

}


function refreshProgress() {

    if (!mainAudio) return;


    const current =
        mainAudio.currentTime || 0;


    const duration =
        Number.isFinite(
            mainAudio.duration
        )
            ? mainAudio.duration
            : 0;


    const currentTime =
        $("currentTime");

    const durationElement =
        $("duration");

    const progressBar =
        $("progressBar");

    const progressThumb =
        $("progressThumb");


    if (currentTime) {

        currentTime.textContent =
            formatTime(current);

    }


    if (durationElement) {

        durationElement.textContent =
            formatTime(duration);

    }


    const percentage =
        duration > 0
            ? (current / duration) * 100
            : 0;


    if (progressBar) {

        progressBar.style.width =
            `${percentage}%`;

    }


    if (progressThumb) {

        progressThumb.style.left =
            `${percentage}%`;

    }

}


/* ============================================================
   ÉVÉNEMENTS AUDIO PRINCIPAL
============================================================ */

function setupMainAudio() {

    if (!mainAudio) return;


    mainAudio.addEventListener(
        "timeupdate",
        refreshProgress
    );


    mainAudio.addEventListener(
        "loadedmetadata",
        refreshProgress
    );


    mainAudio.addEventListener(
        "play",
        () => {

            state.isPlaying =
                true;

            updatePlayerUI();

        }
    );


    mainAudio.addEventListener(
        "pause",
        () => {

            state.isPlaying =
                false;

            updatePlayerUI();

        }
    );


    mainAudio.addEventListener(
        "ended",
        playNext
    );


    mainAudio.addEventListener(
        "error",
        () => {

            showToast(
                "Erreur audio",
                "Impossible de lire ce fichier.",
                "error"
            );

        }
    );

}


/* ============================================================
   PROGRESSION
============================================================ */

function setupProgressBar() {

    const container =
        $("progressContainer");


    if (!container) return;


    container.addEventListener(
        "click",
        event => {

            if (!mainAudio) return;


            const rect =
                container.getBoundingClientRect();


            const position =
                event.clientX -
                rect.left;


            const percentage =
                Math.max(
                    0,
                    Math.min(
                        1,
                        position /
                        rect.width
                    )
                );


            if (
                Number.isFinite(
                    mainAudio.duration
                )
            ) {

                mainAudio.currentTime =
                    mainAudio.duration *
                    percentage;

            }

        }
    );

}


/* ============================================================
   VOLUME
============================================================ */

function setupVolume() {

    const slider =
        $("volumeSlider");


    if (!slider) return;


    slider.value =
        Math.round(
            state.volume * 100
        );


    mainAudio.volume =
        state.volume;


    slider.addEventListener(
        "input",
        () => {

            const value =
                Number(
                    slider.value
                ) / 100;


            state.volume =
                Math.max(
                    0,
                    Math.min(
                        1,
                        value
                    )
                );


            mainAudio.volume =
                state.volume;

        }
    );

}


/* ============================================================
   SHUFFLE / REPEAT
============================================================ */

function setupPlaybackControls() {

    $("mainPlayBtn")?.addEventListener(
        "click",
        toggleMainPlay
    );


    $("previousBtn")?.addEventListener(
        "click",
        playPrevious
    );


    $("nextBtn")?.addEventListener(
        "click",
        playNext
    );


    $("shuffleBtn")?.addEventListener(
        "click",
        () => {

            state.shuffle =
                !state.shuffle;


            $("shuffleBtn")
                ?.classList.toggle(
                    "active",
                    state.shuffle
                );

        }
    );


    $("repeatBtn")?.addEventListener(
        "click",
        () => {

            if (
                state.repeatMode ===
                "off"
            ) {

                state.repeatMode =
                    "all";

            } else if (
                state.repeatMode ===
                "all"
            ) {

                state.repeatMode =
                    "one";

            } else {

                state.repeatMode =
                    "off";

            }


            const button =
                $("repeatBtn");


            if (button) {

                button.classList.toggle(
                    "active",
                    state.repeatMode !== "off"
                );

            }


            showToast(
                "Répétition",
                state.repeatMode === "off"
                    ? "Désactivée"
                    : state.repeatMode === "all"
                        ? "Toute la file"
                        : "Morceau actuel",
                "info"
            );

        }
    );


    $("miniFavoriteBtn")?.addEventListener(
        "click",
        () => {

            if (
                state.currentTrackId
            ) {

                toggleFavorite(
                    state.currentTrackId
                );

            }

        }
    );

}


/* ============================================================
   RECHERCHE
============================================================ */

function setupSearch() {

    const input =
        $("searchInput");


    const clearButton =
        $("clearSearchBtn");


    if (!input) return;


    input.addEventListener(
        "input",
        () => {

            state.search =
                input.value.trim();


            if (clearButton) {

                clearButton.classList.toggle(
                    "hidden",
                    !state.search
                );

            }


            renderHome();

            renderLibrary();

        }
    );


    clearButton?.addEventListener(
        "click",
        () => {

            input.value = "";

            state.search = "";

            clearButton.classList.add(
                "hidden"
            );


            renderHome();

            renderLibrary();

        }
    );

}


/* ============================================================
   FILTRES
============================================================ */

function setupFilters() {

    document
        .querySelectorAll(
            ".filter-btn"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    document
                        .querySelectorAll(
                            ".filter-btn"
                        )
                        .forEach(
                            btn =>
                                btn.classList.remove(
                                    "active"
                                )
                        );


                    button.classList.add(
                        "active"
                    );


                    state.libraryFilter =
                        button.dataset.filter ||
                        "all";


                    renderHome();

                    renderLibrary();

                }
            );

        });

}


/* ============================================================
   TRI
============================================================ */

function setupSorting() {

    $("sortMusicBtn")?.addEventListener(
        "click",
        () => {

            const sorts = [
                "recent",
                "title",
                "artist",
                "duration"
            ];


            const current =
                sorts.indexOf(
                    state.sort
                );


            state.sort =
                sorts[
                    (current + 1) %
                    sorts.length
                ];


            const names = {
                recent: "Récent",
                title: "Titre",
                artist: "Artiste",
                duration: "Durée"
            };


            showToast(
                "Tri",
                names[state.sort],
                "info"
            );


            renderLibrary();

        }
    );

}


/* ============================================================
   TOUT LIRE / ALÉATOIRE
============================================================ */

function setupLibraryPlayback() {

    $("playAllBtn")?.addEventListener(
        "click",
        () => {

            if (!state.tracks.length) {

                showToast(
                    "Bibliothèque vide",
                    "Importez votre musique.",
                    "info"
                );

                return;

            }


            state.queue = [];


            playTrackById(
                state.tracks[0].id
            );

        }
    );


    $("shuffleAllBtn")?.addEventListener(
        "click",
        () => {

            if (!state.tracks.length) {

                showToast(
                    "Bibliothèque vide",
                    "Importez votre musique.",
                    "info"
                );

                return;

            }


            const shuffled =
                [...state.tracks]
                    .sort(
                        () =>
                            Math.random() -
                            0.5
                    );


            state.queue =
                shuffled
                    .slice(1)
                    .map(
                        track =>
                            track.id
                    );


            playTrackById(
                shuffled[0].id
            );

        }
    );


    $("playFavoritesBtn")?.addEventListener(
        "click",
        () => {

            const favorites =
                state.tracks.filter(
                    track =>
                        track.favorite
                );


            if (!favorites.length) {

                showToast(
                    "Aucun favori",
                    "Ajoutez d'abord des morceaux.",
                    "info"
                );

                return;

            }


            state.queue =
                favorites
                    .slice(1)
                    .map(
                        track =>
                            track.id
                    );


            playTrackById(
                favorites[0].id
            );

        }
    );

}


/* ============================================================
   PLAYLISTS
============================================================ */

function renderPlaylistCard(
    playlist
) {

    const count =
        playlist.tracks?.length || 0;


    return `

        <div
            class="playlist-card"
            data-playlist-id="${escapeHTML(playlist.id)}"
        >

            <div class="playlist-cover">
                <i data-lucide="list-music"></i>
            </div>


            <div class="playlist-info">

                <strong>
                    ${escapeHTML(playlist.name)}
                </strong>

                <span>
                    ${count} morceau${count > 1 ? "x" : ""}
                </span>

            </div>


            <button
                type="button"
                class="playlist-play-btn"
                data-playlist-action="play"
                data-playlist-id="${escapeHTML(playlist.id)}"
                aria-label="Lire"
            >

                <i data-lucide="play"></i>

            </button>

        </div>

    `;

}


function renderPlaylists() {

    const container =
        $("playlistGrid");


    if (!container) return;


    if (!state.playlists.length) {

        container.innerHTML = `

            <div class="empty-state">

                <div class="empty-state-icon">
                    <i data-lucide="list-music"></i>
                </div>

                <h3>
                    Aucune playlist
                </h3>

                <p>
                    Créez votre première playlist.
                </p>

                <button
                    type="button"
                    class="primary-btn"
                    id="dynamicCreatePlaylist"
                >
                    <i data-lucide="plus"></i>
                    Nouvelle playlist
                </button>

            </div>

        `;


        $("dynamicCreatePlaylist")
            ?.addEventListener(
                "click",
                openPlaylistModal
            );


        refreshIcons();

        return;

    }


    container.innerHTML =
        state.playlists
            .map(
                renderPlaylistCard
            )
            .join("");


    attachPlaylistActions(
        container
    );


    refreshIcons();

}


function renderHomePlaylists() {

    const container =
        $("homePlaylistGrid");


    if (!container) return;


    if (!state.playlists.length) {

        container.innerHTML = `

            <div class="empty-state">

                <div class="empty-state-icon">
                    <i data-lucide="list-music"></i>
                </div>

                <h3>
                    Créez votre première playlist
                </h3>

                <p>
                    Organisez vos morceaux facilement.
                </p>

            </div>

        `;


        refreshIcons();

        return;

    }


    container.innerHTML =
        state.playlists
            .slice(0, 4)
            .map(
                renderPlaylistCard
            )
            .join("");


    attachPlaylistActions(
        container
    );


    refreshIcons();

}


function attachPlaylistActions(
    container
) {

    container
        .querySelectorAll(
            "[data-playlist-action]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                event => {

                    event.stopPropagation();


                    const playlist =
                        state.playlists.find(
                            item =>
                                item.id ===
                                button.dataset.playlistId
                        );


                    if (!playlist) return;


                    if (
                        button.dataset.playlistAction ===
                        "play"
                    ) {

                        playPlaylist(
                            playlist
                        );

                    }

                }
            );

        });

}


function playPlaylist(
    playlist
) {

    const tracks =
        (playlist.tracks || [])
            .map(
                id =>
                    getTrackById(id)
            )
            .filter(Boolean);


    if (!tracks.length) {

        showToast(
            "Playlist vide",
            "Cette playlist ne contient aucun morceau.",
            "info"
        );

        return;

    }


    state.queue =
        tracks
            .slice(1)
            .map(
                track =>
                    track.id
            );


    playTrackById(
        tracks[0].id
    );

}


function openPlaylistModal() {

    const modal =
        $("playlistModal");


    if (!modal) return;


    state.playlistModalMode =
        "create";


    state.selectedPlaylistId =
        null;


    const title =
        $("playlistModalTitle");


    if (title) {

        title.textContent =
            "Nouvelle playlist";

    }


    const input =
        $("playlistNameInput");


    if (input) {

        input.value = "";

    }


    $("playlistNameError")
        ?.classList.add(
            "hidden"
        );


    modal.classList.remove(
        "hidden"
    );


    modal.setAttribute(
        "aria-hidden",
        "false"
    );


    setTimeout(
        () =>
            input?.focus(),
        50
    );

}


function closePlaylistModal() {

    const modal =
        $("playlistModal");


    if (!modal) return;


    modal.classList.add(
        "hidden"
    );


    modal.setAttribute(
        "aria-hidden",
        "true"
    );

}


async function createPlaylist() {

    const input =
        $("playlistNameInput");


    if (!input) return;


    const name =
        input.value.trim();


    if (!name) {

        $("playlistNameError")
            ?.classList.remove(
                "hidden"
            );

        input.focus();

        return;

    }


    const playlist = {

        id:
            "playlist_" +
            Date.now() +
            "_" +
            Math.random()
                .toString(36)
                .slice(2, 8),

        name,

        tracks: [],

        createdAt:
            Date.now()

    };


    await dbPut(
        PLAYLIST_STORE,
        playlist
    );


    state.playlists.push(
        playlist
    );


    closePlaylistModal();

    updateAllViews();


    showToast(
        "Playlist créée",
        name,
        "success"
    );

}


function setupPlaylistModals() {

    $("createPlaylistBtn")
        ?.addEventListener(
            "click",
            openPlaylistModal
        );


    $("homeCreatePlaylistBtn")
        ?.addEventListener(
            "click",
            openPlaylistModal
        );


    $("closePlaylistModalBtn")
        ?.addEventListener(
            "click",
            closePlaylistModal
        );


    $("cancelPlaylistBtn")
        ?.addEventListener(
            "click",
            closePlaylistModal
        );


    $("savePlaylistBtn")
        ?.addEventListener(
            "click",
            createPlaylist
        );


    $("playlistNameInput")
        ?.addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                    "Enter"
                ) {

                    createPlaylist();

                }


                if (
                    event.key ===
                    "Escape"
                ) {

                    closePlaylistModal();

                }

            }
        );


    $("playlistModal")
        ?.querySelector(
            ".modal-overlay"
        )
        ?.addEventListener(
            "click",
            closePlaylistModal
        );

}


/* ============================================================
   OPTIONS MUSIQUE
============================================================ */

function openTrackOptions(
    id
) {

    const track =
        getTrackById(id);


    if (!track) return;


    state.selectedTrackId =
        id;


    const title =
        $("trackOptionsTitle");


    if (title) {

        title.textContent =
            track.title;

    }


    const favoriteButton =
        $("trackOptionFavorite");


    if (favoriteButton) {

        const span =
            favoriteButton.querySelector(
                "span"
            );


        if (span) {

            span.textContent =
                track.favorite
                    ? "Retirer des favoris"
                    : "Ajouter aux favoris";

        }

    }


    const modal =
        $("trackOptionsModal");


    if (modal) {

        modal.classList.remove(
            "hidden"
        );

        modal.setAttribute(
            "aria-hidden",
            "false"
        );

    }

}


function closeTrackOptions() {

    const modal =
        $("trackOptionsModal");


    if (modal) {

        modal.classList.add(
            "hidden"
        );

        modal.setAttribute(
            "aria-hidden",
            "true"
        );

    }


    state.selectedTrackId =
        null;

}


function setupTrackOptions() {

    $("closeTrackOptionsBtn")
        ?.addEventListener(
            "click",
            closeTrackOptions
        );


    $("trackOptionsModal")
        ?.querySelector(
            ".modal-overlay"
        )
        ?.addEventListener(
            "click",
            closeTrackOptions
        );


    $("trackOptionPlay")
        ?.addEventListener(
            "click",
            () => {

                if (
                    state.selectedTrackId
                ) {

                    playTrackById(
                        state.selectedTrackId
                    );

                }


                closeTrackOptions();

            }
        );


    $("trackOptionFavorite")
        ?.addEventListener(
            "click",
            () => {

                if (
                    state.selectedTrackId
                ) {

                    toggleFavorite(
                        state.selectedTrackId
                    );

                }


                closeTrackOptions();

            }
        );


    $("trackOptionPlaylist")
        ?.addEventListener(
            "click",
            () => {

                closeTrackOptions();

                openPlaylistSelector();

            }
        );


    $("trackOptionDj")
        ?.addEventListener(
            "click",
            () => {

                const id =
                    state.selectedTrackId;


                closeTrackOptions();


                if (id) {

                    navigateTo("dj");

                    loadTrackToDeck(
                        "A",
                        id
                    );

                }

            }
        );


    $("trackOptionRemove")
        ?.addEventListener(
            "click",
            () => {

                const id =
                    state.selectedTrackId;


                closeTrackOptions();


                if (id) {

                    removeTrack(
                        id
                    );

                }

            }
        );

}


/* ============================================================
   AJOUT À UNE PLAYLIST
============================================================ */

function openPlaylistSelector() {

    if (!state.playlists.length) {

        openPlaylistModal();

        return;

    }


    const track =
        getTrackById(
            state.selectedTrackId
        );


    if (!track) return;


    const names =
        state.playlists
            .map(
                (playlist, index) =>
                    `${index + 1}. ${playlist.name}`
            )
            .join("\n");


    const choice =
        prompt(
            `Choisissez une playlist :\n\n${names}\n\nEntrez son numéro.`
        );


    if (!choice) return;


    const index =
        Number(choice) - 1;


    const playlist =
        state.playlists[index];


    if (!playlist) {

        showToast(
            "Playlist invalide",
            "",
            "error"
        );

        return;

    }


    if (
        !playlist.tracks.includes(
            track.id
        )
    ) {

        playlist.tracks.push(
            track.id
        );


        dbPut(
            PLAYLIST_STORE,
            playlist
        );


        updateAllViews();


        showToast(
            "Ajouté à la playlist",
            playlist.name,
            "success"
        );

    } else {

        showToast(
            "Déjà présent",
            "Ce morceau est déjà dans cette playlist.",
            "info"
        );

    }

}


/* ============================================================
   SUPPRESSION MUSIQUE
============================================================ */

async function removeTrack(
    id
) {

    const track =
        getTrackById(id);


    if (!track) return;


    const confirmed =
        confirm(
            `Supprimer "${track.title}" de votre bibliothèque ?`
        );


    if (!confirmed) return;


    if (
        state.currentTrackId ===
        id
    ) {

        mainAudio.pause();

        mainAudio.removeAttribute(
            "src"
        );

        mainAudio.load();


        state.currentTrackId =
            null;

        state.currentTrackIndex =
            -1;

        state.isPlaying =
            false;

    }


    state.queue =
        state.queue.filter(
            trackId =>
                trackId !== id
        );


    state.history =
        state.history.filter(
            trackId =>
                trackId !== id
        );


    state.playlists.forEach(
        playlist => {

            playlist.tracks =
                (playlist.tracks || [])
                    .filter(
                        trackId =>
                            trackId !== id
                    );

            dbPut(
                PLAYLIST_STORE,
                playlist
            );

        }
    );


    state.tracks =
        state.tracks.filter(
            track =>
                track.id !== id
        );


    await dbDelete(
        AUDIO_STORE,
        id
    );


    updateAllViews();


    showToast(
        "Musique supprimée",
        track.title,
        "success"
    );

}


/* ============================================================
   FILE D'ATTENTE
============================================================ */

function addToQueue(
    id
) {

    const track =
        getTrackById(id);


    if (!track) return;


    if (
        state.queue.includes(id)
    ) {

        showToast(
            "Déjà dans la file",
            track.title,
            "info"
        );

        return;

    }


    state.queue.push(
        id
    );


    showToast(
        "Ajouté à la file",
        track.title,
        "success"
    );

}


function renderQueue() {

    const container =
        $("queueList");


    if (!container) return;


    if (!state.queue.length) {

        container.innerHTML = `

            <div class="empty-state">

                <div class="empty-state-icon">
                    <i data-lucide="list-video"></i>
                </div>

                <h3>
                    File vide
                </h3>

                <p>
                    Ajoutez des morceaux à la file d'attente.
                </p>

            </div>

        `;


        refreshIcons();

        return;

    }


    container.innerHTML =
        state.queue
            .map(
                (id, index) => {

                    const track =
                        getTrackById(id);


                    if (!track) {
                        return "";
                    }


                    return `

                        <div
                            class="queue-item"
                            data-queue-id="${escapeHTML(id)}"
                        >

                            <span>
                                ${index + 1}
                            </span>

                            <div>
                                <strong>
                                    ${escapeHTML(track.title)}
                                </strong>

                                <small>
                                    ${escapeHTML(track.artist)}
                                </small>
                            </div>

                            <button
                                type="button"
                                class="icon-btn"
                                data-remove-queue="${escapeHTML(id)}"
                            >
                                <i data-lucide="x"></i>
                            </button>

                        </div>

                    `;

                }
            )
            .join("");


    container
        .querySelectorAll(
            "[data-queue-id]"
        )
        .forEach(item => {

            item.addEventListener(
                "click",
                () => {

                    playTrackById(
                        item.dataset.queueId
                    );

                    state.queue =
                        state.queue.filter(
                            id =>
                                id !==
                                item.dataset.queueId
                        );

                    renderQueue();

                }
            );

        });


    container
        .querySelectorAll(
            "[data-remove-queue]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                event => {

                    event.stopPropagation();


                    state.queue =
                        state.queue.filter(
                            id =>
                                id !==
                                button.dataset.removeQueue
                        );


                    renderQueue();

                }
            );

        });


    refreshIcons();

}


function setupQueue() {

    $("queueBtn")?.addEventListener(
        "click",
        () => {

            renderQueue();


            const modal =
                $("queueModal");


            if (modal) {

                modal.classList.remove(
                    "hidden"
                );

                modal.setAttribute(
                    "aria-hidden",
                    "false"
                );

            }

        }
    );


    $("closeQueueModalBtn")
        ?.addEventListener(
            "click",
            closeQueueModal
        );


    $("queueModal")
        ?.querySelector(
            ".modal-overlay"
        )
        ?.addEventListener(
            "click",
            closeQueueModal
        );

}


function closeQueueModal() {

    const modal =
        $("queueModal");


    if (modal) {

        modal.classList.add(
            "hidden"
        );

        modal.setAttribute(
            "aria-hidden",
            "true"
        );

    }

}


/* ============================================================
   STATISTIQUES
============================================================ */

function updateStatistics() {

    const musicCount =
        $("musicCount");


    const favoriteCount =
        $("favoriteCount");


    const playlistCount =
        $("playlistCount");


    const storageCount =
        $("storageCount");


    const sidebarFavoriteCount =
        $("sidebarFavoriteCount");


    const totalSize =
        state.tracks.reduce(
            (total, track) =>
                total +
                Number(track.size || 0),
            0
        );


    const favorites =
        state.tracks.filter(
            track =>
                track.favorite
        ).length;


    if (musicCount) {

        musicCount.textContent =
            state.tracks.length;

    }


    if (favoriteCount) {

        favoriteCount.textContent =
            favorites;

    }


    if (playlistCount) {

        playlistCount.textContent =
            state.playlists.length;

    }


    if (storageCount) {

        storageCount.textContent =
            formatSize(totalSize);

    }


    if (sidebarFavoriteCount) {

        sidebarFavoriteCount.textContent =
            favorites;

    }

}


/* ============================================================
   SIDEBAR PLAYLISTS
============================================================ */

function renderSidebarPlaylists() {

    const container =
        $("sidebarPlaylistList");


    if (!container) return;


    if (!state.playlists.length) {

        container.innerHTML = `

            <div class="empty-sidebar">

                <i data-lucide="music"></i>

                <span>
                    Aucune playlist
                </span>

            </div>

        `;


        refreshIcons();

        return;

    }


    container.innerHTML =
        state.playlists
            .map(
                playlist => `

                    <button
                        type="button"
                        class="sidebar-link"
                        data-sidebar-playlist="${escapeHTML(playlist.id)}"
                    >

                        <i data-lucide="list-music"></i>

                        <span>
                            ${escapeHTML(playlist.name)}
                        </span>

                    </button>

                `
            )
            .join("");


    container
        .querySelectorAll(
            "[data-sidebar-playlist]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const playlist =
                        state.playlists.find(
                            item =>
                                item.id ===
                                button.dataset.sidebarPlaylist
                        );


                    if (playlist) {

                        playPlaylist(
                            playlist
                        );

                    }

                }
            );

        });


    refreshIcons();

}


/* ============================================================
   VIDER LA BIBLIOTHÈQUE
============================================================ */

function setupClearLibrary() {

    $("clearLibraryBtn")
        ?.addEventListener(
            "click",
            async () => {

                if (!state.tracks.length) {

                    showToast(
                        "Bibliothèque vide",
                        "",
                        "info"
                    );

                    return;

                }


                const confirmed =
                    confirm(
                        "Voulez-vous vraiment supprimer toute votre musique ?"
                    );


                if (!confirmed) return;


                mainAudio.pause();


                if (
                    mainAudio.dataset.objectUrl
                ) {

                    URL.revokeObjectURL(
                        mainAudio.dataset.objectUrl
                    );

                }


                mainAudio.removeAttribute(
                    "src"
                );


                mainAudio.load();


                state.tracks = [];

                state.queue = [];

                state.history = [];

                state.currentTrackId =
                    null;

                state.currentTrackIndex =
                    -1;

                state.isPlaying =
                    false;


                await dbClear(
                    AUDIO_STORE
                );


                state.playlists =
                    state.playlists.map(
                        playlist => {

                            playlist.tracks =
                                [];

                            dbPut(
                                PLAYLIST_STORE,
                                playlist
                            );


                            return playlist;

                        }
                    );


                updateAllViews();


                showToast(
                    "Bibliothèque vidée",
                    "",
                    "success"
                );

            }
        );

}


/* ============================================================
   THÈME
============================================================ */

function loadSettings() {

    try {

        const saved =
            localStorage.getItem(
                SETTINGS_KEY
            );


        if (saved) {

            const parsed = JSON.parse(saved);

            if (parsed && typeof parsed === "object") {
                state.settings = {
                    ...state.settings,
                    ...parsed,
                    darkMode: parsed.darkMode !== false
                };
            }

        }

    } catch (error) {

        console.warn(
            "Paramètres impossibles à charger.",
            error
        );

    }

}


function saveSettings() {

    try {

        localStorage.setItem(
            SETTINGS_KEY,
            JSON.stringify(
                state.settings
            )
        );

    } catch (error) {

        console.warn(
            "Paramètres impossibles à sauvegarder.",
            error
        );

    }

}


function applyTheme() {

    document.documentElement
        .dataset.theme =
        state.settings.darkMode
            ? "dark"
            : "light";


    document.body
        .classList.toggle(
            "light-mode",
            !state.settings.darkMode
        );

    const themeColor =
        state.settings.darkMode
            ? "#08090d"
            : "#edf3ff";

    document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute("content", themeColor);


    const button =
        $("themeBtn");


    if (button) {

        button.innerHTML = `
            <i data-lucide="${
                state.settings.darkMode
                    ? "sun"
                    : "moon"
            }"></i>
        `;

        button.setAttribute(
            "aria-label",
            state.settings.darkMode
                ? "Activer le mode clair"
                : "Activer le mode sombre"
        );

    }


    refreshIcons();

}


function setupTheme() {

    $("themeBtn")?.addEventListener(
        "click",
        () => {

            state.settings.darkMode =
                !state.settings.darkMode;


            saveSettings();

            applyTheme();

        }
    );

}


/* ============================================================
   DJ STUDIO
============================================================ */

function getDeckAudio(
    deck
) {

    return deck === "A"
        ? deckAAudio
        : deckBAudio;

}


function loadTrackToDeck(
    deck,
    trackId
) {

    const track =
        getTrackById(trackId);


    if (!track) return;


    const audio =
        getDeckAudio(deck);


    if (!audio) return;


    const deckState =
        state.decks[deck];


    if (
        deckState.objectUrl
    ) {

        URL.revokeObjectURL(
            deckState.objectUrl
        );

    }


    const url =
        URL.createObjectURL(
            track.blob
        );


    deckState.objectUrl =
        url;


    deckState.trackId =
        track.id;


    audio.src =
        url;


    audio.currentTime =
        0;


    updateDeckUI(
        deck
    );


    drawWaveform(
        deck
    );


    showToast(
        `Deck ${deck}`,
        track.title,
        "success"
    );

}


function updateDeckVolumes() {

    const crossfader =
        state.crossfader / 100;

    deckAAudio.volume =
        Math.max(0, 1 - crossfader) *
        state.decks.A.volume *
        state.masterVolume;

    deckBAudio.volume =
        Math.max(0, 1 + crossfader) *
        state.decks.B.volume *
        state.masterVolume;

}


function updateDeckUI(
    deck
) {

    const deckState =
        state.decks[deck];


    const track =
        getTrackById(
            deckState.trackId
        );


    const prefix =
        deck === "A"
            ? "deckA"
            : "deckB";


    const title =
        $(`${prefix}Title`);


    const artist =
        $(`${prefix}Artist`);


    const status =
        $(`${prefix}Status`);


    const currentTime =
        $(`${prefix}CurrentTime`);


    const duration =
        $(`${prefix}Duration`);


    if (track) {

        if (title) {

            title.textContent =
                track.title;

        }


        if (artist) {

            artist.textContent =
                track.artist;

        }

    } else {

        if (title) {

            title.textContent =
                "Aucun morceau";

        }


        if (artist) {

            artist.textContent =
                `Deck ${deck}`;

        }

    }


    const audio =
        getDeckAudio(deck);


    if (currentTime) {

        currentTime.textContent =
            formatTime(
                audio?.currentTime || 0
            );

    }


    if (duration) {

        duration.textContent =
            formatTime(
                Number.isFinite(
                    audio?.duration
                )
                    ? audio.duration
                    : 0
            );

    }


    if (status) {

        status.textContent =
            audio && !audio.paused
                ? "PLAY"
                : "STOP";

    }


    updateDeckPlayhead(
        deck
    );

}


function updateDeckPlayhead(
    deck
) {

    const audio =
        getDeckAudio(deck);


    const playhead =
        $(
            deck === "A"
                ? "deckAPlayhead"
                : "deckBPlayhead"
        );


    if (!audio || !playhead) return;


    const duration =
        audio.duration;


    if (
        !Number.isFinite(duration) ||
        duration <= 0
    ) {

        playhead.style.left =
            "0%";

        return;

    }


    playhead.style.left =
        `${
            (audio.currentTime /
                duration) *
            100
        }%`;

}


function setupDeck(
    deck
) {

    const prefix =
        deck === "A"
            ? "deckA"
            : "deckB";


    const audio =
        getDeckAudio(deck);


    const fileButton =
        $(`${prefix}FileBtn`);


    const fileInput =
        $(`${prefix}FileInput`);


    fileButton?.addEventListener(
        "click",
        () => {

            fileInput?.click();

        }
    );


    fileInput?.addEventListener(
        "change",
        event => {

            const file =
                event.target.files?.[0];


            if (!file) return;


            if (!isAudioFile(file)) {

                showToast(
                    "Fichier invalide",
                    "Sélectionnez un fichier audio.",
                    "error"
                );

                return;

            }


            const id =
                "dj_" +
                Date.now();


            const temporaryTrack = {

                id,

                name:
                    file.name,

                title:
                    cleanTitle(
                        file.name
                    ),

                artist:
                    "Artiste inconnu",

                album:
                    "Album inconnu",

                size:
                    file.size,

                blob:
                    file,

                duration: 0,

                favorite: false

            };


            state.tracks.push(
                temporaryTrack
            );


            loadTrackToDeck(
                deck,
                id
            );


            /*
               Le morceau chargé directement
               dans le deck n'est pas ajouté
               à IndexedDB automatiquement.
            */


            event.target.value = "";

        }
    );


    $(`${prefix}PlayBtn`)
        ?.addEventListener(
            "click",
            () => {

                if (!audio.src) {

                    showToast(
                        `Deck ${deck}`,
                        "Chargez d'abord un morceau.",
                        "info"
                    );

                    return;

                }


                audio.play();

            }
        );


    $(`${prefix}PauseBtn`)
        ?.addEventListener(
            "click",
            () => {

                audio.pause();

            }
        );


    $(`${prefix}StopBtn`)
        ?.addEventListener(
            "click",
            () => {

                audio.pause();

                audio.currentTime =
                    0;

            }
        );


    $(`${prefix}CueBtn`)
        ?.addEventListener(
            "click",
            () => {

                audio.currentTime =
                    state.decks[deck].cue ||
                    0;

                audio.play();

            }
        );


    const pitch =
        $(`${prefix}Pitch`);


    const pitchValue =
        $(`${prefix}PitchValue`);


    pitch?.addEventListener(
        "input",
        () => {

            const value =
                Number(
                    pitch.value
                );


            state.decks[deck].pitch =
                value;


            if (pitchValue) {

                pitchValue.textContent =
                    `${value}%`;

            }


            /*
               Variation de vitesse
               approximative du deck.
            */

            audio.playbackRate =
                Math.max(
                    0.5,
                    1 + value / 100
                );

        }
    );


    const volume =
        $(`${prefix}Volume`);


    const volumeValue =
        $(`${prefix}VolumeValue`);


    volume?.addEventListener(
        "input",
        () => {

            const value =
                Number(
                    volume.value
                );


            const normalized =
                value / 100;


            state.decks[deck].volume =
                normalized;


            updateDeckVolumes();


            if (volumeValue) {

                volumeValue.textContent =
                    `${value}%`;

            }

        }
    );


    audio?.addEventListener(
        "timeupdate",
        () => {

            updateDeckUI(
                deck
            );

        }
    );


    audio?.addEventListener(
        "loadedmetadata",
        () => {

            updateDeckUI(
                deck
            );

            drawWaveform(
                deck
            );

        }
    );


    audio?.addEventListener(
        "play",
        () => {

            updateDeckUI(
                deck
            );

        }
    );


    audio?.addEventListener(
        "pause",
        () => {

            updateDeckUI(
                deck
            );

        }
    );

}


/* ============================================================
   DJ — MASTER
============================================================ */

function setupDJMaster() {

    $("djMasterPlayBtn")
        ?.addEventListener(
            "click",
            () => {

                const a =
                    deckAAudio;


                const b =
                    deckBAudio;


                const anyPlaying =
                    !a.paused ||
                    !b.paused;


                if (anyPlaying) {

                    a.pause();

                    b.pause();

                } else {

                    if (a.src) {
                        a.play();
                    }

                    if (b.src) {
                        b.play();
                    }

                }

            }
        );


    $("djResetBtn")
        ?.addEventListener(
            "click",
            () => {

                resetDJ();

            }
        );


    $("masterVolume")
        ?.addEventListener(
            "input",
            event => {

                const value =
                    Number(
                        event.target.value
                    ) / 100;


                state.masterVolume =
                    value;


                updateDeckVolumes();


                const output =
                    $("masterVolumeValue");


                if (output) {

                    output.textContent =
                        `${Math.round(value * 100)}%`;

                }

            }
        );


    $("crossfader")
        ?.addEventListener(
            "input",
            event => {

                const value =
                    Number(
                        event.target.value
                    );


                state.crossfader =
                    value;


                updateDeckVolumes();

            }
        );


    $("syncBtn")
        ?.addEventListener(
            "click",
            () => {

                const source =
                    Number.isFinite(
                        deckAAudio.duration
                    )
                        ? deckAAudio
                        : deckBAudio;


                if (
                    !source ||
                    !Number.isFinite(
                        source.duration
                    )
                ) {

                    showToast(
                        "SYNC",
                        "Chargez un morceau.",
                        "info"
                    );

                    return;

                }


                if (
                    deckAAudio.src &&
                    deckBAudio.src
                ) {

                    deckBAudio.currentTime =
                        deckAAudio.currentTime;

                }


                showToast(
                    "SYNC activé",
                    "Les deux decks sont synchronisés.",
                    "success"
                );

            }
        );

}


/* ============================================================
   DJ — EQ
============================================================ */

function setupDJEqualizer() {

    const ids = [

        "deckAEqHigh",
        "deckAEqMid",
        "deckAEqLow",

        "deckBEqHigh",
        "deckBEqMid",
        "deckBEqLow"

    ];


    ids.forEach(id => {

        $(id)?.addEventListener(
            "input",
            () => {

                /*
                   Les sliders EQ sont préparés
                   pour la future Web Audio API.
                */

            }
        );

    });

}


/* ============================================================
   DJ — EFFETS
============================================================ */

function setupEffects() {

    const effects = {

        effectEchoBtn: "echo",

        effectReverbBtn: "reverb",

        effectFilterBtn: "filter",

        effectFlangerBtn: "flanger"

    };


    Object.entries(
        effects
    ).forEach(
        ([buttonId, effect]) => {

            $(buttonId)?.addEventListener(
                "click",
                () => {

                    state.effects[
                        effect
                    ] =
                        !state.effects[
                            effect
                        ];


                    $(buttonId)
                        ?.classList.toggle(
                            "active",
                            state.effects[
                                effect
                            ]
                        );

                }
            );

        }
    );

}


/* ============================================================
   DJ — HOT CUES
============================================================ */

function setupHotCues() {

    $("hotCuesA")
        ?.querySelectorAll(
            ".hot-cue"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const number =
                        Number(
                            button.dataset.cue
                        );


                    if (
                        !deckAAudio.src
                    ) {

                        showToast(
                            "Hot Cue",
                            "Chargez un morceau dans le Deck A.",
                            "info"
                        );

                        return;

                    }


                    if (
                        state.hotCues.A[
                            number
                        ] === undefined
                    ) {

                        state.hotCues.A[
                            number
                        ] =
                            deckAAudio.currentTime;


                        button.classList.add(
                            "active"
                        );


                        showToast(
                            `Hot Cue ${number}`,
                            "Point enregistré.",
                            "success"
                        );

                    } else {

                        deckAAudio.currentTime =
                            state.hotCues.A[
                                number
                            ];

                    }

                }
            );

        });

}


/* ============================================================
   DJ — JOG WHEEL
============================================================ */

function setupJogWheels() {

    ["A", "B"].forEach(
        deck => {

            const wheel =
                $(
                    deck === "A"
                        ? "jogWheelA"
                        : "jogWheelB"
                );


            const audio =
                getDeckAudio(
                    deck
                );


            if (!wheel || !audio)
                return;


            let dragging =
                false;


            let lastX = 0;


            wheel.addEventListener(
                "pointerdown",
                event => {

                    dragging =
                        true;

                    lastX =
                        event.clientX;


                    wheel.setPointerCapture(
                        event.pointerId
                    );

                }
            );


            wheel.addEventListener(
                "pointermove",
                event => {

                    if (!dragging)
                        return;


                    const delta =
                        event.clientX -
                        lastX;


                    lastX =
                        event.clientX;


                    if (
                        Number.isFinite(
                            audio.duration
                        )
                    ) {

                        audio.currentTime =
                            Math.max(
                                0,
                                Math.min(
                                    audio.duration,
                                    audio.currentTime +
                                    delta *
                                    0.02
                                )
                            );

                    }

                }
            );


            wheel.addEventListener(
                "pointerup",
                () => {

                    dragging =
                        false;

                }
            );


            wheel.addEventListener(
                "pointercancel",
                () => {

                    dragging =
                        false;

                }
            );

        }
    );

}


/* ============================================================
   DJ — RESET
============================================================ */

function resetDJ() {

    [deckAAudio, deckBAudio]
        .forEach(
            audio => {

                if (!audio) return;


                audio.pause();

                audio.currentTime =
                    0;

            }
        );


    state.decks.A.pitch =
        0;

    state.decks.B.pitch =
        0;


    state.decks.A.volume =
        1;

    state.decks.B.volume =
        1;


    state.crossfader =
        0;


    state.masterVolume =
        1;


    $("deckAPitch").value =
        0;

    $("deckBPitch").value =
        0;


    $("deckAVolume").value =
        100;

    $("deckBVolume").value =
        100;


    $("crossfader").value =
        0;

    $("masterVolume").value =
        100;


    $("deckAPitchValue").textContent =
        "0%";

    $("deckBPitchValue").textContent =
        "0%";


    $("deckAVolumeValue").textContent =
        "100%";

    $("deckBVolumeValue").textContent =
        "100%";


    $("masterVolumeValue").textContent =
        "100%";


    deckAAudio.volume =
        1;

    deckBAudio.volume =
        1;


    updateDeckUI("A");

    updateDeckUI("B");


    showToast(
        "DJ Studio réinitialisé",
        "",
        "success"
    );

}


function updateDJInterface() {

    updateDeckUI("A");

    updateDeckUI("B");

}


/* ============================================================
   WAVEFORM
============================================================ */

function drawWaveform(
    deck
) {

    const canvas =
        $(
            deck === "A"
                ? "deckAWaveform"
                : "deckBWaveform"
        );


    if (!canvas) return;


    const context =
        canvas.getContext(
            "2d"
        );


    if (!context) return;


    const rect =
        canvas.getBoundingClientRect();


    const width =
        Math.max(
            300,
            Math.floor(
                rect.width
            )
        );


    const height =
        Math.max(
            60,
            Math.floor(
                rect.height
            )
        );


    canvas.width =
        width;


    canvas.height =
        height;


    context.clearRect(
        0,
        0,
        width,
        height
    );


    context.globalAlpha =
        0.8;


    const bars =
        90;


    const barWidth =
        width / bars;


    for (
        let i = 0;
        i < bars;
        i++
    ) {

        const amplitude =
            8 +
            Math.random() *
            (height * 0.35);


        const x =
            i * barWidth;


        const y =
            (height - amplitude) /
            2;


        context.fillRect(
            x,
            y,
            Math.max(
                1,
                barWidth - 2
            ),
            amplitude
        );

    }

}


/* ============================================================
   INSTALLATION PWA
============================================================ */

function setupPWA() {

    window.addEventListener(
        "beforeinstallprompt",
        event => {

            event.preventDefault();


            state.installPrompt =
                event;


            const button =
                $("installBtn");


            button?.classList.remove(
                "hidden"
            );

        }
    );


    $("installBtn")
        ?.addEventListener(
            "click",
            async () => {

                if (
                    !state.installPrompt
                ) {

                    showToast(
                        "Installation",
                        "Utilisez le menu de votre navigateur pour installer MusicPlayer.",
                        "info"
                    );

                    return;

                }


                state.installPrompt.prompt();


                await state.installPrompt
                    .userChoice;


                state.installPrompt =
                    null;


                $("installBtn")
                    ?.classList.add(
                        "hidden"
                    );

            }
        );


    if (
        "serviceWorker" in
        navigator
    ) {

        window.addEventListener(
            "load",
            () => {

                navigator.serviceWorker
                    .register(
                        "sw.js"
                    )
                    .catch(
                        error =>
                            console.warn(
                                "Service Worker :",
                                error
                            )
                    );

            }
        );

    }

}


/* ============================================================
   TOAST CLOSE
============================================================ */

function setupToast() {

    $("toastCloseBtn")
        ?.addEventListener(
            "click",
            () => {

                $("toast")
                    ?.classList.remove(
                        "show"
                    );

            }
        );

}


/* ============================================================
   RACCOURCIS CLAVIER
============================================================ */

function setupKeyboard() {

    document.addEventListener(
        "keydown",
        event => {

            const target =
                event.target;


            const typing =
                target &&
                (
                    target.tagName ===
                    "INPUT" ||
                    target.tagName ===
                    "TEXTAREA"
                );


            if (typing) return;


            if (
                event.code ===
                "Space"
            ) {

                event.preventDefault();

                toggleMainPlay();

            }


            if (
                event.code ===
                "ArrowRight"
            ) {

                playNext();

            }


            if (
                event.code ===
                "ArrowLeft"
            ) {

                playPrevious();

            }

        }
    );

}


/* ============================================================
   CHARGEMENT DES DONNÉES
============================================================ */

async function loadData() {

    try {

        state.tracks =
            await dbGetAll(
                AUDIO_STORE
            );


        state.playlists =
            await dbGetAll(
                PLAYLIST_STORE
            );


        /*
           Nettoyage des anciennes playlists
           contenant des morceaux supprimés.
        */

        state.playlists.forEach(
            playlist => {

                playlist.tracks =
                    (playlist.tracks || [])
                        .filter(
                            id =>
                                getTrackById(id)
                        );

            }
        );

    } catch (error) {

        console.error(
            "Chargement des données impossible :",
            error
        );


        state.tracks = [];

        state.playlists = [];

    }

}


/* ============================================================
   ACTUALISATION GÉNÉRALE
============================================================ */

function updateAllViews() {

    renderHome();

    renderLibrary();

    renderFavorites();

    renderPlaylists();

    renderSidebarPlaylists();

    updateStatistics();

    updatePlayerUI();

    updateDJInterface();

    refreshIcons();

}


/* ============================================================
   INITIALISATION
============================================================ */

async function initMusicPlayer() {

    console.log(
        "MusicPlayer : initialisation..."
    );


    loadSettings();


    applyTheme();


    try {

        await openDatabase();

        await loadData();

    } catch (error) {

        console.error(
            "Base de données :",
            error
        );


        showToast(
            "Mode limité",
            "IndexedDB n'est pas disponible.",
            "warning"
        );

    }


    setupNavigation();

    setupSidebar();

    setupImport();

    setupMainAudio();

    setupProgressBar();

    setupVolume();

    setupPlaybackControls();

    setupSearch();

    setupFilters();

    setupSorting();

    setupLibraryPlayback();

    setupPlaylistModals();

    setupTrackOptions();

    setupQueue();

    setupClearLibrary();

    setupTheme();

    setupDeck("A");

    setupDeck("B");

    setupDJMaster();

    setupDJEqualizer();

    setupEffects();

    setupHotCues();

    setupJogWheels();

    setupPWA();

    setupToast();

    setupKeyboard();


    updateAllViews();


    navigateTo(
        state.activePage
    );


    refreshIcons();


    const status =
        $("appStatus");


    if (status) {

        status.textContent =
            "Prêt";

    }


    console.log(
        "MusicPlayer : prêt."
    );

}


/* ============================================================
   LANCEMENT
============================================================ */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initMusicPlayer
    );

} else {

    initMusicPlayer();

}