import Phaser from "phaser";
const API_URL = process.env.REACT_APP_API_URL; // => http://localhost:5000

export class PhotoGalleryScene extends Phaser.Scene {
    constructor() {
        super({ key: "PhotoGalleryScene" });
        this.photos = [];
        this.selectedDay = this.getTodayString();
        this.days = this.getLastNDays(7);
    }

    preload() {
        this.load.image("placeholder", "/assets/defautPhoto.png");
        this.load.image("upload", "https://img.icons8.com/ios-filled/50/ffffff/upload.png");
        this.load.image("vote", "https://img.icons8.com/ios-filled/50/ffd700/star--v1.png");
        this.load.image("heart", "https://img.icons8.com/fluency/96/like.png");
    }

    create() {
        const { width, height } = this.sys.game.canvas;
        this.add.rectangle(width / 2, height / 2, width, height, 0x222222, 0.96);

        this.add.text(width / 2, height * 0.07, "Galerie Photo", {
            font: `bold ${Math.round(height * 0.045)}px Arial`,
            fill: "#fff",
            stroke: "#000",
            strokeThickness: 6
        }).setOrigin(0.5);

        // Bouton retour
        const backBtn = this.add.text(width - width * 0.03, height * 0.025, "✖", {
            font: `${Math.round(height * 0.035)}px Arial`,
            fill: "#fff",
            backgroundColor: "#333",
            padding: { x: 10, y: 4 }
        }).setOrigin(1, 0).setInteractive();
        backBtn.on("pointerdown", () => {
            this.scene.stop();
            this.scene.resume("GameScene");
        });

        // Sélecteur de jour
        this.createDaySelector(width, height);

        // Bouton upload
        this.createUploadButton(width, height);

        // Mock: photos pour chaque jour
        this.fetchPhotosForDay(this.selectedDay);

        // Affichage des photos
        this.displayPhotos();
    }
async fetchPhotosForDay(day) {
    const res = await fetch(`${API_URL}/api/photos?date=${encodeURIComponent(this.formatDayToISO(day))}`);
    const data = await res.json();
    this.photos = data.photos || [];
    this.displayPhotos();
}
    createDaySelector(width, height) {
        const y = height * 0.14;
        const dayWidth = width * 0.13;
        this.dayButtons = [];
        this.days.forEach((day, i) => {
            const btn = this.add.text(
                width / 2 + (i - Math.floor(this.days.length / 2)) * dayWidth,
                y,
                day,
                {
                    font: `${Math.round(height * 0.020)}px Arial`,
                    fill: day === this.selectedDay ? "#ffd700" : "#fff",
                    backgroundColor: day === this.selectedDay ? "#444" : "#222",
                    padding: { x: 10, y: 4 }
                }
            ).setOrigin(0.5).setInteractive();
            btn.on("pointerdown", () => {
                this.selectedDay = day;
                this.dayButtons.forEach(b => b.setStyle({ fill: "#fff", backgroundColor: "#222" }));
                btn.setStyle({ fill: "#ffd700", backgroundColor: "#444" });
                this.fetchPhotosForDay(day);
            });
            this.dayButtons.push(btn);
        });
    }
getTodayString() {
        const d = new Date();
        return d.toISOString().slice(0, 10);
    }

getLastNDays(n) {
    const days = [];
    for (let i = 0; i < n; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        // Format: "JJ/MM"
        const day = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
        days.unshift(day);
    }
    return days;
}

formatDayToISO(day) {
    if (!day || typeof day !== "string" || !day.includes("/")) {
        // Si day est déjà au format ISO, retourne-le
        if (typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day)) return day;
        // Sinon, retourne la date du jour au format ISO
        return new Date().toISOString().slice(0, 10);
    }
    const [d, m] = day.split("/");
    const year = new Date().getFullYear();
    return `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

createUploadButton(width, height) {
    document.addEventListener('keydown', function(e) {
    const active = document.activeElement;
    if (
        active &&
        (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)
    ) {
        e.stopPropagation();
    }
}, true);
    const btnY = height - height * 0.09;
    const iconSize = Math.round(height * 0.06);
    const uploadBtn = this.add.image(width / 2, btnY, "upload")
        .setDisplaySize(iconSize, iconSize)
        .setInteractive();

    // Crée un input file invisible
    let fileInput = document.getElementById('photo-upload-input');
    if (!fileInput) {
        fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';
        fileInput.id = 'photo-upload-input';
        document.body.appendChild(fileInput);
    }

    let uploadForm = document.getElementById('photo-upload-form');
    if (!uploadForm) {
        uploadForm = document.createElement('form');
        uploadForm.id = 'photo-upload-form';
        uploadForm.style.display = 'none';
        uploadForm.style.position = 'fixed';
        uploadForm.style.left = '50%';
        uploadForm.style.top = '50%';
        uploadForm.style.transform = 'translate(-50%, -50%)';
        uploadForm.style.background = '#222';
        uploadForm.style.padding = '20px';
        uploadForm.style.borderRadius = '10px';
        uploadForm.style.zIndex = 10000;
        uploadForm.innerHTML = `
            <div style="font-size: 1.1em; color: #fff; margin-bottom: 12px; font-weight: bold;">Description :</div>
            <input type="text" id="photo-desc" style="width: 100%; margin-bottom: 18px; font-size: 1em; padding: 6px; border-radius: 5px; border: none; background: #333; color: #fff;">
            <div style="font-size: 1.1em; color: #fff; margin-bottom: 8px; font-weight: bold;">Tag joueurs :</div>
            <div id="photo-tags-list" style="margin-bottom: 18px; padding-left: 6px;"></div>
            <div style="display: flex; gap: 16px; justify-content: center;">
                <button type="submit" style="padding: 8px 22px; border-radius: 6px; border: none; background: #ffd700; color: #222; font-weight: bold; font-size: 1em; cursor: pointer;">Choisir la photo</button>
                <button type="button" id="photo-cancel" style="padding: 8px 22px; border-radius: 6px; border: none; background: #444; color: #fff; font-weight: bold; font-size: 1em; cursor: pointer;">Annuler</button>
            </div>
        `;
        uploadForm.style.background = "rgba(30,30,30,0.98)";
        uploadForm.style.boxShadow = "0 8px 32px #000a";
        uploadForm.style.border = "2px solid #ffd700";
        uploadForm.style.minWidth = "270px";
        document.body.appendChild(uploadForm);
    }

    // Fonction pour remplir la liste des joueurs à taguer
async function fillPlayersList() {
    const res = await fetch(`${API_URL}/api/players`);
    const players = await res.json();
    const tagsDiv = document.getElementById('photo-tags-list');
    tagsDiv.innerHTML = '';
    players.forEach(p => {
        const id = `tag-player-${p._id || p.pseudo || p.username || p.name}`;
        const label = document.createElement('label');
        label.style.display = 'flex';
        label.style.alignItems = 'center';
        label.style.gap = '8px';
        label.style.marginBottom = '6px';
        label.style.fontSize = '1em';
        label.style.color = '#fff';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = p.pseudo || p.username || p.name || p._id;
        checkbox.id = id;
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(' ' + (p.pseudo || p.username || p.name || p._id)));
        tagsDiv.appendChild(label);
    });
}

    uploadBtn.on("pointerdown", () => {
        fillPlayersList();
        uploadForm.style.display = '';
    });

    uploadForm.onsubmit = (e) => {
        e.preventDefault();
        if (!fileInput.files || !fileInput.files[0]) {
            fileInput.click();
        }
    };

    document.getElementById('photo-cancel').onclick = () => {
        uploadForm.style.display = 'none';
    };

    fileInput.onchange = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const description = document.getElementById('photo-desc').value;
const checked = Array.from(document.querySelectorAll('#photo-tags-list input[type="checkbox"]:checked'));
const taggedPlayers = checked.map(cb => cb.value);

        const formData = new FormData();
        formData.append("photo", file);
        formData.append("description", description);
        formData.append("taggedPlayers", JSON.stringify(taggedPlayers));
        formData.append("uploader", (this.registry.get("playerPseudo") || "Moi").trim().toLowerCase());
        formData.append("dateTaken", this.formatDayToISO(this.selectedDay));

        fetch(`${API_URL}/api/photos/upload`, {
            method: "POST",
            body: formData
        })
        .then(res => res.json())
        .then(data => {
            if (!data.url) {
                alert("Erreur lors de l'upload");
                return;
            }
            this.fetchPhotosForDay(this.selectedDay);
        })
        .catch(() => alert("Erreur upload"));
        fileInput.value = "";
        uploadForm.style.display = 'none';
        document.getElementById('photo-desc').value = '';
    };

    this.add.text(width / 2, btnY + iconSize * 0.7, "Uploader une photo", {
        font: `${Math.round(height * 0.022)}px Arial`,
        fill: "#fff"
    }).setOrigin(0.5);
    document.querySelectorAll('#photo-tags-list input[type="checkbox"]').forEach(cb => cb.checked = false);
}

async fetchPhotosForDay(day) {

    const res = await fetch(`${API_URL}/api/photos?date=${encodeURIComponent(this.formatDayToISO(day))}`);
    const data = await res.json();
    this.photos = data.photos || [];
    this.displayPhotos();
}


displayPhotos() {
    if (this.load.isLoading()) {
        this.load.once('complete', () => this.displayPhotos());
        return;
    }
    // Détruit l'ancien groupe s'il existe
    if (this.photoGroup && typeof this.photoGroup.clear === "function") {
        try {
            this.photoGroup.clear(true, true);
            this.photoGroup.destroy(true);
        } catch (e) {}
        this.photoGroup = null;
    }
    this.photoGroup = this.add.group();
    const { width, height } = this.sys.game.canvas;
    const margin = width * 0.025;
    const photoSize = Math.min(width, height) * 0.18;
    const photos = this.photos
        .filter(p => {
            if (!p.dateTaken) return false;
            if (!p.filename) return false;
            if (!p.url || p.url.startsWith('blob:')) return false;
            const [year, month, day] = p.dateTaken.split("-");
            const dayMonth = `${day}/${month}`;
            return dayMonth === this.selectedDay;
        })
        .sort((a, b) => b.votes - a.votes);

    const cols = Math.floor(width / (photoSize + margin));
    const startX = width / 2 - ((cols - 1) * (photoSize + margin)) / 2;
    const startY = height * 0.27;

    let needLoad = false;
    photos.forEach((photo, i) => {
        const key = `photo_${photo._id || photo.filename || i}`;
        const url = `${API_URL}/public/photos/${photo.filename}`;
        if (!this.textures.exists(key)) {
            this.load.image(key, url);
            needLoad = true;
        }
    });

    const showPhotos = () => {
        photos.forEach((photo, i) => {
            const key = `photo_${photo._id || photo.filename || i}`;
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = startX + col * (photoSize + margin);
            const y = startY + row * (photoSize + height * 0.08);
            this.addPhotoMiniature(photo, x, y, photoSize, key, width, height);
        });
        if (photos.length === 0) {
            this.photoGroup.add(
                this.add.text(width / 2, startY + height * 0.04, "Aucune photo ce jour-là.", {
                    font: `${Math.round(height * 0.022)}px Arial`,
                    fill: "#fff"
                }).setOrigin(0.5)
            );
        }
    };

    if (needLoad) {
        this.load.once('complete', showPhotos);
        this.load.start();
    } else {
        showPhotos();
    }
}

addPhotoMiniature(photo, x, y, photoSize, key, width, height) {
    const texture = this.textures.get(key);
    let img;
    if (texture && texture.source[0]) {
        const source = texture.source[0];
        const originalWidth = source.width;
        const originalHeight = source.height;
        const scale = Math.min(photoSize / originalWidth, photoSize / originalHeight);
        img = this.add.image(x, y, key)
            .setScale(scale)
            .setInteractive();
    } else {
        img = this.add.image(x, y, key)
            .setDisplaySize(photoSize, photoSize)
            .setInteractive();
    }

    const border = this.add.graphics();
    border.lineStyle(3, 0xffffff, 0.2);
    border.strokeRect(
        img.x - photoSize / 2,
        img.y - photoSize / 2,
        photoSize,
        photoSize
    );
    this.photoGroup.add(border);
    this.photoGroup.add(img);

    this.photoGroup.add(
        this.add.text(x, y + photoSize / 2 + height * 0.01, `par ${photo.uploader}`, {
            font: `${Math.round(height * 0.017)}px Arial`,
            fill: "#aaa"
        }).setOrigin(0.5, 0)
    );

const iconSize = photoSize * 0.18;
const gap = width * 0.012; // petit espace entre l'étoile et le nombre
const tempText = this.add.text(0, 0, `${photo.votes}`, {
    font: `${Math.round(height * 0.018)}px Arial`
});
const totalWidth = iconSize + gap + tempText.width;
tempText.destroy(); // <-- Ajoute cette ligne pour ne pas l'afficher

const centerX = x - totalWidth / 2 + iconSize / 2;
const centerY = y - photoSize / 2 - height * 0.018;

const voteIcon = this.add.image(centerX, centerY, "vote")
    .setDisplaySize(iconSize, iconSize)
    .setInteractive();
this.photoGroup.add(voteIcon);

    const voteText = this.add.text(centerX + iconSize / 2 + gap, centerY, `${photo.votes}`, {
        font: `${Math.round(height * 0.018)}px Arial`,
        fill: "#ffd700"
    }).setOrigin(0, 0.5);
    this.photoGroup.add(voteText);

    voteIcon.on("pointerdown", () => {
        photo.votes++;
        voteText.setText(`${photo.votes}`);
        this.displayPhotos();
    });

    img.on("pointerdown", () => {
        this.showPhotoModal(photo);
    });
}

showPhotoModal(photo) {
    const { width, height } = this.sys.game.canvas;
    const key = `photo_${photo._id || photo.filename}`;
    const url = `${API_URL}/public/photos/${photo.filename}`;
    if (!this.textures.exists(key)) {
        this.load.image(key, url);
        this.load.once('complete', () => {
            this._showModalWithKey(photo, key, width, height);
        });
        this.load.start();
    } else {
        this._showModalWithKey(photo, key, width, height);
    }
}
_showModalWithKey(photo, key, width, height) {
    // Fond noir semi-transparent
    const modalBg = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.85)
        .setDepth(1000);

    // Affichage image en gardant le ratio et en maximisant la taille
    const texture = this.textures.get(key);
    const centerY = height / 2 - height * 0.07;

    let img;
    let imgTopRight;
    if (texture && texture.source[0]) {
        const source = texture.source[0];
        const originalWidth = source.width;
        const originalHeight = source.height;
        const maxW = width * 0.95;
        const maxH = height * 0.7;
        const scale = Math.min(maxW / originalWidth, maxH / originalHeight);
        img = this.add.image(width / 2, centerY, key) // <-- ici
            .setScale(scale)
            .setDepth(1001);
                imgTopRight = {
        x: img.x + (originalWidth * scale) / 2,
        y: img.y - (originalHeight * scale) / 2
    };
    } else {
        const displayW = width * 0.7;
        const displayH = height * 0.7;
        img = this.add.image(width / 2, centerY, key)
            .setDisplaySize(displayW, displayH)
            .setDepth(1001);

        imgTopRight = {
            x: img.x + displayW / 2,
            y: img.y - displayH / 2
        };
    }
    // Ajout du coeur centré en bas de l'image
    const heartSize = Math.round(height * 0.06);
    const heartY = centerY + (img.displayHeight / 2) - heartSize / 2 - height * 0.01;
    const heartIcon = this.add.image(width / 2, heartY, "heart")
        .setDisplaySize(heartSize, heartSize)
        .setDepth(1002)
        .setInteractive({ useHandCursor: true })
        .setAlpha(0.92);

    // Affichage du nombre de votes à côté du coeur
    const likeText = this.add.text(width / 2 + heartSize * 0.7, heartY, `${photo.votes || 0}`, {
        font: `${Math.round(height * 0.028)}px Arial`,
        fill: "#ff5a5a",
        stroke: "#fff",
        strokeThickness: 2
    }).setOrigin(0, 0.5).setDepth(1002);

    let isLiking = false; // Ajoute ce flag au début de _showModalWithKey ou dans la portée de la modale
    // Animation et gestion du like
heartIcon.on("pointerdown", () => {
    if (isLiking) return;
    isLiking = true;
    this.tweens.add({
        targets: heartIcon,
        scale: 1.25,
        duration: 120,
        yoyo: true,
        ease: "Quad.easeInOut",
        onComplete: () => {
            isLiking = false;
        }
    });
    // Incrémente le like localement pour le ressenti immédiat
    photo.votes = (photo.votes || 0) + 1;
    likeText.setText(`${photo.votes}`);

    fetch(`${API_URL}/api/photos/${photo._id}/vote`, { method: "POST" })
        .then(res => {
            if (!res.ok) throw new Error("Erreur serveur");
            // Pas de res.json() ici, juste un 200 attendu
            // Optionnel : tu peux rafraîchir la liste si tu veux la vraie valeur
            // this.fetchPhotosForDay(this.selectedDay);
        })
        .catch(err => {
            photo.votes = (photo.votes || 1) - 1;
            likeText.setText(`${photo.votes}`);
            alert("Erreur lors du vote !");
        });
});

    // Infos sous la photo
    const infoY = centerY + (img.displayHeight / 2) + height * 0.03;
    const dateStr = photo.dateTaken ? `📅 ${photo.dateTaken}` : "";
    const uploaderStr = `par ${photo.uploader}`;
    const tagsStr = photo.taggedPlayers && photo.taggedPlayers.length
        ? `👥 ${photo.taggedPlayers.join(", ")}`
        : "";
    // Ligne description (au-dessus des autres infos)
    let descText = null;
    if (photo.description && photo.description.trim() !== "") {
        descText = this.add.text(width / 2, infoY, photo.description, {
            font: `${Math.round(height * 0.021)}px Arial`,
            fill: "#ffd700",
            wordWrap: { width: width * 0.8 }
        }).setOrigin(0.5, 0).setDepth(1002);
    }

    // Décale les autres infos en dessous de la description si elle existe
    const info1Y = descText ? infoY + descText.height + height * 0.01 : infoY;

    // Première ligne : date, votes, uploader
    const infoText1 = [dateStr, uploaderStr]
        .filter(Boolean)
        .join("   |   ");

    const info1 = this.add.text(width / 2, info1Y, infoText1, {
        font: `${Math.round(height * 0.022)}px Arial`,
        fill: "#fff"
    }).setOrigin(0.5, 0).setDepth(1002);

    // Deuxième ligne : tags (joueurs associés)
    const infoText2 = tagsStr;
    let info2 = null;
    if (infoText2) {
        info2 = this.add.text(width / 2, info1Y + info1.height + height * 0.01, infoText2, {
            font: `${Math.round(height * 0.019)}px Arial`,
            fill: "#aaa"
        }).setOrigin(0.5, 0).setDepth(1002);
    }

    // Bouton supprimer si c'est moi qui ai posté
    let actionBtn = null;
    let infoBottom = info2 ? infoY + info1.height + info2.height + height * 0.02 : infoY + info1.height + height * 0.02;
    let uploader = (photo.uploader || "").trim().toLowerCase();
    let currentUser = ((this.registry.get("playerPseudo") || "Moi") + "").trim().toLowerCase();
    console.log("photo.uploader =", uploader, "currentUser =", currentUser);

    if (uploader === currentUser) {
        actionBtn = this.add.text(width / 2, infoBottom, "🗑️ Supprimer cette photo", {
            font: `${Math.round(height * 0.022)}px Arial`,
            fill: "#ff4444",
            backgroundColor: "#222",
            padding: { x: 12, y: 6 }
        }).setOrigin(0.5, 0).setInteractive().setDepth(1002);

        actionBtn.on("pointerdown", () => {
            this.showConfirmModal(
                "Supprimer cette photo ?",
                async () => {
                    try {
                        const res = await fetch(`${API_URL}/api/photos/${photo._id}`, { method: "DELETE" });
                        if (!res.ok) throw new Error("Suppression impossible");
                        [modalBg, img, info1, info2, actionBtn, closeBtn].forEach(o => o && o.destroy());
                        this.fetchPhotosForDay(this.selectedDay);
                    } catch (e) {
                        // Optionnel : afficher une erreur
                    }
                },
                () => {}
            );
        });
    } else {
        // Bouton télécharger si ce n'est pas moi
        actionBtn = this.add.text(width / 2, infoBottom, "⬇️ Télécharger cette photo", {
            font: `${Math.round(height * 0.022)}px Arial`,
            fill: "#ffd700",
            backgroundColor: "#222",
            padding: { x: 12, y: 6 }
        }).setOrigin(0.5, 0).setInteractive().setDepth(1002);

        actionBtn.on("pointerdown", (event) => {
            event && event.preventDefault && event.preventDefault();
            const url = `${API_URL}/public/photos/${photo.filename}`;
            const link = document.createElement('a');
            link.href = url;
            link.download = photo.filename || "photo.jpg";
            document.body.appendChild(link);
            link.click();
            setTimeout(() => document.body.removeChild(link), 100);
        });
    }

    // Bouton fermer
    const closeBtn = this.add.text(
        imgTopRight.x - 8, // petit décalage pour ne pas coller au bord
        imgTopRight.y + 8, // petit décalage pour ne pas coller au bord
        "✖",
        {
            font: `${Math.round(height * 0.035)}px Arial`,
            fill: "#fff",
            backgroundColor: "#333",
            padding: { x: 10, y: 4 }
        }
    ).setOrigin(1, 0).setInteractive().setDepth(1002);


    closeBtn.on("pointerdown", () => {
        modalBg.destroy();
        img.destroy();
        info1.destroy();
        if (info2) info2.destroy();
        if (heartIcon) heartIcon.destroy();
        if (likeText) likeText.destroy(); // <-- Ajoute cette ligne
        if (descText) descText.destroy();
        if (actionBtn) actionBtn.destroy();
        closeBtn.destroy();
    });
}

showConfirmModal(message, onConfirm, onCancel) {
    const { width, height } = this.sys.game.canvas;
    const modalW = width * 0.5;
    const modalH = height * 0.22;
    const container = this.add.container(width / 2, height / 2).setDepth(2000);

    const bg = this.add.rectangle(0, 0, modalW, modalH, 0x222222, 0.97)
        .setStrokeStyle(2, 0xff4444);
    const txt = this.add.text(0, -modalH * 0.22, message, {
        font: `${Math.round(height * 0.022)}px Arial`,
        fill: "#fff"
    }).setOrigin(0.5);

    const btnOui = this.add.text(-modalW * 0.18, modalH * 0.18, "Oui", {
        font: `${Math.round(height * 0.022)}px Arial`,
        fill: "#fff",
        backgroundColor: "#ff4444",
        padding: { x: 18, y: 6 }
    }).setOrigin(0.5).setInteractive();

    const btnNon = this.add.text(modalW * 0.18, modalH * 0.18, "Non", {
        font: `${Math.round(height * 0.022)}px Arial`,
        fill: "#fff",
        backgroundColor: "#444",
        padding: { x: 18, y: 6 }
    }).setOrigin(0.5).setInteractive();

    btnOui.on("pointerdown", () => {
        container.destroy();
        if (onConfirm) onConfirm();
    });
    btnNon.on("pointerdown", () => {
        container.destroy();
        if (onCancel) onCancel();
    });

    container.add([bg, txt, btnOui, btnNon]);
    return container;
}


}