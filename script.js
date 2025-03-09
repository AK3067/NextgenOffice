// State
let currentModule = "writer";
let currentUser = null;
let content = {
    writer: "",
    sheets: [[]],
    slides: [""],
    pdf: null
};
let annotations = [[]];
let annotationUndoStack = [[]];
let annotationRedoStack = [[]];
const socket = io("http://your-server:5555"); // Replace with your server

// Canvas for Annotations
const canvas = document.getElementById("annotation-canvas");
const ctx = canvas.getContext("2d");

function resizeCanvas() {
    const writerContent = document.getElementById("writer-content");
    canvas.width = writerContent.clientWidth;
    canvas.height = writerContent.clientHeight;
    canvas.style.top = writerContent.offsetTop + "px";
    canvas.style.left = writerContent.offsetLeft + "px";
    redrawAnnotations();
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// Sidebar Toggle
function toggleSidebar() {
    const sidebar = document.getElementById("sidebar");
    sidebar.classList.toggle("active");
}

// Module Switching
function switchModule(module) {
    currentModule = module;
    document.querySelectorAll(".module").forEach(m => m.style.display = "none");
    document.getElementById(`${module}-area`).style.display = "block";
    toggleSidebar(); // Close sidebar after selection
    updateToolbar();
}

// Toolbar Update
function updateToolbar() {
    const toolbar = document.getElementById("bottom-toolbar");
    if (currentModule === "writer") {
        toolbar.innerHTML = `
            <button onclick="boldText()">B</button>
            <button onclick="italicText()">I</button>
            <button onclick="underlineText()">U</button>
            <button onclick="saveFile()">💾</button>
        `;
    } else if (currentModule === "sheets") {
        toolbar.innerHTML = `
            <button onclick="addSheetRow()">Row</button>
            <button onclick="addSheetColumn()">Col</button>
            <button onclick="saveFile()">💾</button>
        `;
    } else if (currentModule === "slides") {
        toolbar.innerHTML = `
            <button onclick="addSlide()">Slide</button>
            <button onclick="saveFile()">💾</button>
        `;
    } else if (currentModule === "pdf") {
        toolbar.innerHTML = `
            <button onclick="zoomIn()">+</button>
            <button onclick="zoomOut()">-</button>
            <button onclick="saveFile()">💾</button>
        `;
    }
}

// Writer Functions
function saveContent(module) {
    if (module === "writer") content.writer = document.getElementById("writer-content").innerHTML;
    socket.emit("update", { content: content, module, user: currentUser });
}

function boldText() { document.execCommand("bold", false, null); saveContent("writer"); }
function italicText() { document.execCommand("italic", false, null); saveContent("writer"); }
function underlineText() { document.execCommand("underline", false, null); saveContent("writer"); }

// Annotations
canvas.addEventListener("touchstart", (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    annotations[0].push({ points: [x, y] });
    ctx.beginPath();
    ctx.moveTo(x, y);
}, { passive: false });

canvas.addEventListener("touchmove", (e) => {
    e.preventDefault();
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    annotations[0][annotations[0].length - 1].points.push(x, y);
    ctx.lineTo(x, y);
    ctx.stroke();
}, { passive: false });

canvas.addEventListener("touchend", () => {
    annotationUndoStack[0].push(annotations[0].pop());
    socket.emit("annotation", { annotations, user: currentUser });
});

function undoAnnotation() {
    if (!annotationUndoStack[0].length) return;
    const ann = annotationUndoStack[0].pop();
    annotationRedoStack[0].push(ann);
    annotations[0] = annotations[0].filter(a => a !== ann);
    redrawAnnotations();
}

function redoAnnotation() {
    if (!annotationRedoStack[0].length) return;
    const ann = annotationRedoStack[0].pop();
    annotationUndoStack[0].push(ann);
    annotations[0].push(ann);
    redrawAnnotations();
}

function redrawAnnotations() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#FFFFFF";
    annotations[0].forEach(ann => {
        ctx.beginPath();
        ctx.moveTo(ann.points[0], ann.points[1]);
        for (let i = 2; i < ann.points.length; i += 2) {
            ctx.lineTo(ann.points[i], ann.points[i + 1]);
        }
        ctx.stroke();
    });
}

// Sheets
function updateSheetsGrid() {
    const grid = document.getElementById("sheets-grid");
    grid.innerHTML = "";
    grid.style.gridTemplateColumns = `repeat(${content.sheets[0].length}, 80px)`;
    content.sheets.forEach((row, i) => {
        row.forEach((cell, j) => {
            const btn = document.createElement("button");
            btn.textContent = cell || "";
            btn.onclick = () => {
                const val = prompt("Enter value:", cell);
                if (val !== null) {
                    content.sheets[i][j] = val;
                    updateSheetsGrid();
                    saveContent("sheets");
                }
            };
            grid.appendChild(btn);
        });
    });
}

function addSheetRow() {
    content.sheets.push(Array(content.sheets[0].length).fill(""));
    updateSheetsGrid();
    saveContent("sheets");
}

function addSheetColumn() {
    content.sheets.forEach(row => row.push(""));
    updateSheetsGrid();
    saveContent("sheets");
}

// Slides
function updateSlidesGrid() {
    const grid = document.getElementById("slides-grid");
    grid.innerHTML = "";
    content.slides.forEach((slide, i) => {
        const div = document.createElement("div");
        div.className = "slide";
        div.textContent = slide || "New Slide";
        div.onclick = () => {
            const text = prompt("Edit slide text:", slide);
            if (text) {
                content.slides[i] = text;
                updateSlidesGrid();
                saveContent("slides");
            }
        };
        grid.appendChild(div);
    });
}

function addSlide() {
    content.slides.push("");
    updateSlidesGrid();
    saveContent("slides");
}

// PDF Viewer
async function loadPDF(file) {
    const url = URL.createObjectURL(file);
    const pdf = await pdfjsLib.getDocument(url).promise;
    const page = await pdf.getPage(1);
    const canvas = document.getElementById("pdf-canvas");
    const ctx = canvas.getContext("2d");
    const viewport = page.getViewport({ scale: 1.0 });
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    await page.render({ canvasContext: ctx, viewport });
    content.pdf = url;
    switchModule("pdf");
}

function zoomIn() {
    const canvas = document.getElementById("pdf-canvas");
    canvas.style.transform = `scale(${parseFloat(canvas.style.transform.replace("scale(", "").replace(")", "")) + 0.1 || 1.1})`;
}

function zoomOut() {
    const canvas = document.getElementById("pdf-canvas");
    canvas.style.transform = `scale(${parseFloat(canvas.style.transform.replace("scale(", "").replace(")", "")) - 0.1 || 0.9})`;
}

// File Management
function saveFile() {
    const name = prompt("Enter file name:");
    if (name) {
        localStorage.setItem(name, JSON.stringify(content));
        alert("File saved!");
    }
}

function openFile() {
    const name = prompt("Enter file name to open:");
    const data = localStorage.getItem(name);
    if (data) {
        content = JSON.parse(data);
        document.getElementById("writer-content").innerHTML = content.writer;
        updateSheetsGrid();
        updateSlidesGrid();
        if (content.pdf) loadPDF(new Blob([content.pdf], { type: "application/pdf" }));
        switchModule(currentModule);
    }
}

// Collaboration
socket.on("update", (data) => {
    if (data.user !== currentUser) {
        content = data.content;
        if (currentModule === "writer") document.getElementById("writer-content").innerHTML = content.writer;
        else if (currentModule === "sheets") updateSheetsGrid();
        else if (currentModule === "slides") updateSlidesGrid();
        redrawAnnotations();
    }
});

socket.on("annotation", (data) => {
    if (data.user !== currentUser) {
        annotations = data.annotations;
        redrawAnnotations();
    }
});

function toggleCollab() {
    document.getElementById("collab-panel").style.display = "block";
}

function sendChat() {
    const message = document.getElementById("chat").value;
    socket.emit("chat", { message, user: currentUser });
    document.getElementById("chat").value = "";
}

socket.on("chat", (data) => {
    const chat = document.getElementById("chat");
    chat.value += `${data.user}: ${data.message}\n`;
});

// Login
function login() {
    currentUser = document.getElementById("login-username").value;
    document.getElementById("user-status").textContent = `Logged in as: ${currentUser}`;
    socket.emit("join", currentUser);
    closeModal("login-modal");
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = "none";
}

// Initialization
document.addEventListener("DOMContentLoaded", () => {
    if (!currentUser) document.getElementById("login-modal").style.display = "flex";
    content.sheets = Array(5).fill().map(() => Array(5).fill(""));
    updateSheetsGrid();
    updateSlidesGrid();
    switchModule("writer");
});