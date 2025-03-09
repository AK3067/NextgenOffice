// State
let currentUser = null;
let currentFile = null;
let currentPages = [""];
let currentPage = 0;
let docType = null;
let images = [];
let tool = "pen";
let color = [1, 0, 0, 1]; // Red
let penWidth = 2;
let toolStatus = "Red, 2";
let annotations = [[]]; // Per-page annotations
let annotationUndoStack = [[]];
let annotationRedoStack = [[]];
let currentAnnotation = null;
let undoStack = []; // For page management
let spreadsheetData = [[]];
let slides = [""];
let watermarkText = "CONFIDENTIAL";

// Canvas for annotations
const canvas = document.getElementById("annotation-canvas");
const ctx = canvas.getContext("2d");

// Initialize canvas size
function resizeCanvas() {
    const textInput = document.getElementById("text-input");
    canvas.width = textInput.clientWidth;
    canvas.height = textInput.clientHeight;
    redrawAnnotations();
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// Show login modal on load
document.addEventListener("DOMContentLoaded", () => {
    if (!currentUser) {
        document.getElementById("login-modal").style.display = "flex";
    }
});

// Login
function login() {
    const username = document.getElementById("login-username").value;
    const password = document.getElementById("login-password").value;
    const users = JSON.parse(localStorage.getItem("users") || "{}");
    const hashedPassword = sha256(password);
    if (users[username] && users[username] === hashedPassword) {
        currentUser = username;
        document.getElementById("user-label").textContent = `Logged in as: ${username}`;
        document.getElementById("logout-btn").disabled = false;
        closeModal("login-modal");
        showPopup("Success", "Logged in successfully!");
    } else {
        showPopup("Error", "Invalid username or password!");
    }
}

// Sign Up
function showSignupModal() {
    closeModal("login-modal");
    document.getElementById("signup-modal").style.display = "flex";
}

function signup() {
    const username = document.getElementById("signup-username").value;
    const password = document.getElementById("signup-password").value;
    let users = JSON.parse(localStorage.getItem("users") || "{}");
    if (users[username]) {
        showPopup("Error", "Username already exists!");
        return;
    }
    users[username] = sha256(password);
    localStorage.setItem("users", JSON.stringify(users));
    showPopup("Success", "Signed up successfully! Please log in.");
    closeModal("signup-modal");
    document.getElementById("login-modal").style.display = "flex";
}

// Logout
function logout() {
    currentUser = null;
    document.getElementById("user-label").textContent = "Not logged in";
    document.getElementById("logout-btn").disabled = true;
    document.getElementById("login-modal").style.display = "flex";
}

// Modal handling
function closeModal(modalId) {
    document.getElementById(modalId).style.display = "none";
}

function showPopup(title, message) {
    document.getElementById("popup-title").textContent = title;
    document.getElementById("popup-message").textContent = message;
    document.getElementById("popup-modal").style.display = "flex";
}

// New Document Menu
function showNewDocumentMenu() {
    if (!currentUser) {
        showPopup("Warning", "Please log in first!");
        return;
    }
    const dropdown = document.getElementById("dropdown-menu");
    dropdown.innerHTML = "";
    const docTypes = [
        { name: "Word Document", callback: () => newDocument("word") },
        { name: "Presentation", callback: () => newDocument("presentation") },
        { name: "Spreadsheet", callback: () => newDocument("spreadsheet") }
    ];
    docTypes.forEach(type => {
        const btn = document.createElement("button");
        btn.textContent = type.name;
        btn.onclick = () => { type.callback(); dropdown.style.display = "none"; };
        dropdown.appendChild(btn);
    });
    dropdown.style.display = "block";
    dropdown.style.left = event.target.offsetLeft + "px";
    dropdown.style.top = event.target.offsetTop + event.target.offsetHeight + "px";
}

function newDocument(type) {
    currentFile = null;
    if (type === "word") {
        currentPages = [""];
        annotations = [[]];
        annotationUndoStack = [[]];
        annotationRedoStack = [[]];
        docType = "word";
        images = [];
        spreadsheetData = [];
        slides = [];
        document.getElementById("editor-area").style.display = "flex";
        document.getElementById("spreadsheet-area").style.display = "none";
        document.getElementById("presentation-area").style.display = "none";
        document.getElementById("text-input").innerHTML = "";
    } else if (type === "presentation") {
        currentPages = [];
        annotations = [];
        annotationUndoStack = [];
        annotationRedoStack = [];
        docType = "presentation";
        images = [];
        spreadsheetData = [];
        slides = [""];
        addSlide("");
        document.getElementById("editor-area").style.display = "none";
        document.getElementById("spreadsheet-area").style.display = "none";
        document.getElementById("presentation-area").style.display = "flex";
        currentPage = 0;
    } else if (type === "spreadsheet") {
        currentPages = [""];
        annotations = [[]];
        annotationUndoStack = [[]];
        annotationRedoStack = [[]];
        docType = "spreadsheet";
        images = [];
        spreadsheetData = Array(50).fill().map(() => Array(10).fill(""));
        slides = [];
        updateSpreadsheetGrid();
        document.getElementById("editor-area").style.display = "none";
        document.getElementById("spreadsheet-area").style.display = "flex";
        document.getElementById("presentation-area").style.display = "none";
        currentPage = 0;
    }
    currentPage = 0;
    redrawAnnotations();
    updatePageIndicator();
    showPopup("Info", `New ${type} document created.`);
}

// File Manager
let currentDir = "/"; // Simulated directory
let selectedFile = null;
let fileMode = null;

function showFileManager(mode) {
    if (!currentUser) {
        showPopup("Warning", "Please log in first!");
        return;
    }
    fileMode = mode;
    document.getElementById("file-manager-modal").style.display = "flex";
    updateFileList();
}

function updateFileList() {
    const fileList = document.getElementById("file-list");
    fileList.innerHTML = "";
    // Simulated file system (in a real app, this would interact with the File System Access API or a backend)
    const files = JSON.parse(localStorage.getItem("files") || "{}");
    const dirFiles = files[currentDir] || [];
    dirFiles.forEach(item => {
        const div = document.createElement("div");
        div.className = "file-item";
        div.textContent = item.name;
        div.onclick = () => {
            if (item.type === "folder") {
                currentDir = currentDir === "/" ? `/${item.name}` : `${currentDir}/${item.name}`;
                updateFileList();
            } else {
                selectedFile = `${currentDir}/${item.name}`;
                showPopup("Info", `Selected: ${item.name}`);
            }
        };
        fileList.appendChild(div);
    });
}

function newFolder() {
    const name = prompt("Enter folder name:");
    if (!name) return;
    const files = JSON.parse(localStorage.getItem("files") || "{}");
    if (!files[currentDir]) files[currentDir] = [];
    files[currentDir].push({ name, type: "folder" });
    const newDir = currentDir === "/" ? `/${name}` : `${currentDir}/${name}`;
    files[newDir] = [];
    localStorage.setItem("files", JSON.stringify(files));
    updateFileList();
}

function goBack() {
    if (currentDir === "/") return;
    currentDir = currentDir.split("/").slice(0, -1).join("/") || "/";
    updateFileList();
}

function saveFile() {
    if (!selectedFile) {
        showPopup("Warning", "Please select a file!");
        return;
    }
    const content = docType === "word" ? document.getElementById("text-input").innerHTML : currentPages.join("\n");
    const files = JSON.parse(localStorage.getItem("files") || "{}");
    const fileName = selectedFile.split("/").pop();
    const dir = selectedFile.substring(0, selectedFile.lastIndexOf("/")) || "/";
    if (!files[dir]) files[dir] = [];
    const existing = files[dir].find(f => f.name === fileName);
    if (existing) {
        existing.content = content;
    } else {
        files[dir].push({ name: fileName, type: "file", content });
    }
    localStorage.setItem("files", JSON.stringify(files));
    showPopup("Success", "File saved successfully!");
    closeModal("file-manager-modal");
}

function deleteFile() {
    if (!selectedFile) {
        showPopup("Warning", "Please select a file!");
        return;
    }
    const files = JSON.parse(localStorage.getItem("files") || "{}");
    const dir = selectedFile.substring(0, selectedFile.lastIndexOf("/")) || "/";
    files[dir] = files[dir].filter(f => `${dir}/${f.name}` !== selectedFile);
    localStorage.setItem("files", JSON.stringify(files));
    selectedFile = null;
    updateFileList();
    showPopup("Success", "File deleted!");
}

// Load File
function loadFileSelected() {
    if (!selectedFile) return;
    const files = JSON.parse(localStorage.getItem("files") || "{}"));
    const dir = selectedFile.substring(0, selectedFile.lastIndexOf("/")) || "/";
    const fileName = selectedFile.split("/").pop();
    const file = files[dir].find(f => f.name === fileName);
    if (!file) return;
    currentFile = selectedFile;
    if (fileName.endsWith(".txt")) {
        currentPages = [file.content];
        docType = "word";
        document.getElementById("editor-area").style.display = "flex";
        document.getElementById("spreadsheet-area").style.display = "none";
        document.getElementById("presentation-area").style.display = "none";
        document.getElementById("text-input").innerHTML = file.content;
    }
    annotations = [[]];
    annotationUndoStack = [[]];
    annotationRedoStack = [[]];
    currentPage = 0;
    redrawAnnotations();
    updatePageIndicator();
    closeModal("file-manager-modal");
}

// Add Image
function addImage() {
    if (!currentUser) {
        showPopup("Warning", "Please log in first!");
        return;
    }
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (event) => {
            const imgPath = event.target.result; // Base64 URL
            images.push({ path: imgPath, pos: currentPage });
            if (docType === "word") {
                document.getElementById("text-input").innerHTML += `<br><img src="${imgPath}" width="200"><br>`;
            } else if (docType === "presentation") {
                slides[currentPage] += `\n[Image: ${file.name}]`;
                updatePresentation();
            } else if (docType === "spreadsheet") {
                spreadsheetData[currentPage][0] += `\n[Image: ${file.name}]`;
                updateSpreadsheetGrid();
            }
            showPopup("Success", "Image added to document.");
        };
        reader.readAsDataURL(file);
    };
    input.click();
}

// Pen Options
function showPenOptions() {
    if (!currentUser) {
        showPopup("Warning", "Please log in first!");
        return;
    }
    const dropdown = document.getElementById("dropdown-menu");
    dropdown.innerHTML = "";
    const options = [
        { name: "Color", callback: showColorPicker },
        { name: "Width: Thin (2)", callback: () => setPenWidth(2) },
        { name: "Width: Medium (5)", callback: () => setPenWidth(5) },
        { name: "Width: Thick (10)", callback: () => setPenWidth(10) }
    ];
    options.forEach(opt => {
        const btn = document.createElement("button");
        btn.textContent = opt.name;
        btn.onclick = () => { opt.callback(); dropdown.style.display = "none"; };
        dropdown.appendChild(btn);
    });
    dropdown.style.display = "block";
    dropdown.style.left = event.target.offsetLeft + "px";
    dropdown.style.top = event.target.offsetTop + event.target.offsetHeight + "px";
    setTool("pen");
}

function showColorPicker() {
    const dropdown = document.getElementById("dropdown-menu");
    dropdown.innerHTML = "";
    const colors = [
        { name: "Red", value: [1, 0, 0, 1] },
        { name: "Green", value: [0, 1, 0, 1] },
        { name: "Blue", value: [0, 0, 1, 1] },
        { name: "Yellow", value: [1, 1, 0, 1] }
    ];
    colors.forEach(col => {
        const btn = document.createElement("button");
        btn.textContent = col.name;
        btn.onclick = () => { setColor(col.value); dropdown.style.display = "none"; };
        dropdown.appendChild(btn);
    });
    dropdown.style.display = "block";
    dropdown.style.left = event.target.offsetLeft + "px";
    dropdown.style.top = event.target.offsetTop + event.target.offsetHeight + "px";
}

function setColor(newColor) {
    color = newColor;
    toolStatus = `${color[0] === 1 ? "Red" : color[1] === 1 ? "Green" : color[2] === 1 ? "Blue" : "Yellow"}, ${penWidth}`;
    document.getElementById("pen-button").textContent = `Pen: ${toolStatus}`;
    showPopup("Info", "Color updated");
}

function setPenWidth(width) {
    penWidth = width;
    toolStatus = `${color[0] === 1 ? "Red" : color[1] === 1 ? "Green" : color[2] === 1 ? "Blue" : "Yellow"}, ${penWidth}`;
    document.getElementById("pen-button").textContent = `Pen: ${toolStatus}`;
    showPopup("Info", `Pen width set to ${width}`);
}

function setTool(newTool) {
    tool = newTool;
    canvas.style.pointerEvents = tool === "eraser" ? "auto" : "none";
    showPopup("Info", `Tool set to ${tool}`);
}

// Eraser Options
function showEraserOptions() {
    const dropdown = document.getElementById("dropdown-menu");
    dropdown.innerHTML = "";
    const options = [
        { name: "All Clear", callback: clearAllAnnotations },
        { name: "Circle to Erase", callback: () => setTool("eraser") }
    ];
    options.forEach(opt => {
        const btn = document.createElement("button");
        btn.textContent = opt.name;
        btn.onclick = () => { opt.callback(); dropdown.style.display = "none"; };
        dropdown.appendChild(btn);
    });
    dropdown.style.display = "block";
    dropdown.style.left = event.target.offsetLeft + "px";
    dropdown.style.top = event.target.offsetTop + event.target.offsetHeight + "px";
}

function clearAllAnnotations() {
    annotationUndoStack[currentPage].push(...annotations[currentPage]);
    annotations[currentPage] = [];
    annotationRedoStack[currentPage] = [];
    redrawAnnotations();
    showPopup("Info", "All annotations cleared on this page");
}

// Annotations
canvas.addEventListener("mousedown", (e) => {
    if (!currentUser) {
        showPopup("Warning", "Please log in first!");
        return;
    }
    if (tool === "eraser") return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    currentAnnotation = { tool, points: [x, y], color, width: penWidth };
    ctx.beginPath();
    ctx.strokeStyle = `rgba(${color[0]*255}, ${color[1]*255}, ${color[2]*255}, ${color[3]})`;
    ctx.lineWidth = tool === "highlighter" ? 10 : penWidth;
    ctx.globalAlpha = tool === "highlighter" ? 0.5 : 1;
    ctx.moveTo(x, y);
});

canvas.addEventListener("mousemove", (e) => {
    if (!currentAnnotation) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    currentAnnotation.points.push(x, y);
    ctx.lineTo(x, y);
    ctx.stroke();
});

canvas.addEventListener("mouseup", () => {
    if (!currentAnnotation) return;
    annotations[currentPage].push(currentAnnotation);
    annotationUndoStack[currentPage].push(currentAnnotation);
    annotationRedoStack[currentPage] = [];
    currentAnnotation = null;
});

canvas.addEventListener("mousemove", (e) => {
    if (tool !== "eraser" || !e.buttons) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    for (let i = annotations[currentPage].length - 1; i >= 0; i--) {
        const ann = annotations[currentPage][i];
        for (let j = 0; j < ann.points.length; j += 2) {
            const px = ann.points[j];
            const py = ann.points[j + 1];
            if (Math.abs(px - x) < 20 && Math.abs(py - y) < 20) {
                annotationUndoStack[currentPage].push(ann);
                annotations[currentPage].splice(i, 1);
                redrawAnnotations();
                break;
            }
        }
    }
});

function undoAnnotation() {
    if (!annotationUndoStack[currentPage].length) {
        showPopup("Warning", "Nothing to undo on this page.");
        return;
    }
    const ann = annotationUndoStack[currentPage].pop();
    annotationRedoStack[currentPage].push(ann);
    annotations[currentPage] = annotations[currentPage].filter(a => a !== ann);
    redrawAnnotations();
}

function redoAnnotation() {
    if (!annotationRedoStack[currentPage].length) {
        showPopup("Warning", "Nothing to redo on this page.");
        return;
    }
    const ann = annotationRedoStack[currentPage].pop();
    annotationUndoStack[currentPage].push(ann);
    annotations[currentPage].push(ann);
    redrawAnnotations();
}

function redrawAnnotations() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    annotations[currentPage].forEach(ann => {
        ctx.beginPath();
        ctx.strokeStyle = `rgba(${ann.color[0]*255}, ${ann.color[1]*255}, ${ann.color[2]*255}, ${ann.color[3]})`;
        ctx.lineWidth = ann.tool === "highlighter" ? 10 : ann.width;
        ctx.globalAlpha = ann.tool === "highlighter" ? 0.5 : 1;
        ctx.moveTo(ann.points[0], ann.points[1]);
        for (let i = 2; i < ann.points.length; i += 2) {
            ctx.lineTo(ann.points[i], ann.points[i + 1]);
        }
        ctx.stroke();
    });
}

// Page Navigation
function prevPage() {
    if (currentPage > 0) {
        currentPage--;
        updatePageDisplay();
    }
}

function nextPage() {
    if (currentPage < currentPages.length - 1) {
        currentPage++;
        updatePageDisplay();
    } else if (docType === "word" && currentPages[currentPage]) {
        currentPages.push("");
        annotations.push([]);
        annotationUndoStack.push([]);
        annotationRedoStack.push([]);
        currentPage++;
        updatePageDisplay();
    } else if (docType === "presentation" && slides[currentPage]) {
        addSlide("");
    } else if (docType === "spreadsheet") {
        addSpreadsheetRow();
        currentPage++;
        updateSpreadsheetGrid();
    }
}

function updatePageDisplay() {
    if (docType === "word") {
        document.getElementById("text-input").innerHTML = currentPages.join("<br><br>");
    }
    redrawAnnotations();
    updatePageIndicator();
}

function updatePageIndicator() {
    document.getElementById("page-indicator").textContent = `Page ${currentPage + 1} of ${currentPages.length}`;
}

// Text Change
function onTextChange() {
    if (docType === "word") {
        const content = document.getElementById("text-input").innerHTML;
        const newPages = content.split("<br><br>");
        if (newPages.length !== currentPages.length) {
            if (newPages.length > currentPages.length) {
                annotations = annotations.concat(Array(newPages.length - currentPages.length).fill([]));
                annotationUndoStack = annotationUndoStack.concat(Array(newPages.length - currentPages.length).fill([]));
                annotationRedoStack = annotationRedoStack.concat(Array(newPages.length - currentPages.length).fill([]));
            } else {
                annotations = annotations.slice(0, newPages.length);
                annotationUndoStack = annotationUndoStack.slice(0, newPages.length);
                annotationRedoStack = annotationRedoStack.slice(0, newPages.length);
                if (currentPage >= newPages.length) currentPage = newPages.length - 1;
            }
        }
        currentPages = newPages;
        updatePageIndicator();
    }
}

// Teaching Mode
function exitTeaching() {
    annotations = Array(currentPages.length).fill([]);
    annotationUndoStack = Array(currentPages.length).fill([]);
    annotationRedoStack = Array(currentPages.length).fill([]);
    redrawAnnotations();
    showPopup("Info", "Exited teaching mode without saving annotations");
}

function saveTeaching() {
    if (!currentFile) {
        showPopup("Warning", "Save the document first using 'File Manager'");
        return;
    }
    saveFile();
}

// Spreadsheet
function updateSpreadsheetGrid() {
    const grid = document.getElementById("spreadsheet-grid");
    grid.innerHTML = "";
    grid.style.gridTemplateColumns = `repeat(${spreadsheetData[0].length}, 100px)`;
    spreadsheetData.forEach((row, i) => {
        row.forEach((cell, j) => {
            const btn = document.createElement("button");
            btn.textContent = cell;
            btn.onclick = () => {
                const newVal = prompt("Enter value:", cell);
                if (newVal !== null) {
                    spreadsheetData[i][j] = newVal;
                    updateSpreadsheetGrid();
                }
            };
            grid.appendChild(btn);
        });
    });
}

function addSpreadsheetRow() {
    spreadsheetData.push(Array(spreadsheetData[0].length).fill(""));
    updateSpreadsheetGrid();
}

function addSpreadsheetColumn() {
    spreadsheetData.forEach(row => row.push(""));
    updateSpreadsheetGrid();
}

// Presentation
function addSlide(text) {
    slides.push(text);
    currentPages = slides;
    const grid = document.getElementById("slide-grid");
    const slide = document.createElement("div");
    slide.className = "slide-preview";
    slide.textContent = text || "New Slide";
    slide.onclick = () => selectSlide(slides.length - 1);
    grid.appendChild(slide);
    currentPage = slides.length - 1;
    updatePageIndicator();
}

function updatePresentation() {
    const grid = document.getElementById("slide-grid");
    grid.innerHTML = "";
    slides.forEach((slide, i) => {
        const div = document.createElement("div");
        div.className = "slide-preview";
        div.textContent = slide;
        div.onclick = () => selectSlide(i);
        grid.appendChild(div);
    });
}

function selectSlide(index) {
    currentPage = index;
    updatePageIndicator();
}

// Format Options
function showFormatOptions() {
    const dropdown = document.getElementById("dropdown-menu");
    dropdown.innerHTML = "";
    const options = [
        { name: "Color: Red", callback: () => setTextColor("red") },
        { name: "Color: Green", callback: () => setTextColor("green") },
        { name: "Color: Blue", callback: () => setTextColor("blue") },
        { name: "Font: Arial", callback: () => setFont("Arial") },
        { name: "Font: Times New Roman", callback: () => setFont("Times New Roman") }
    ];
    options.forEach(opt => {
        const btn = document.createElement("button");
        btn.textContent = opt.name;
        btn.onclick = () => { opt.callback(); dropdown.style.display = "none"; };
        dropdown.appendChild(btn);
    });
    dropdown.style.display = "block";
    dropdown.style.left = event.target.offsetLeft + "px";
    dropdown.style.top = event.target.offsetTop + event.target.offsetHeight + "px";
}

function setTextColor(color) {
    document.execCommand("foreColor", false, color);
}

function setFont(font) {
    document.execCommand("fontName", false, font);
}

// Watermark
function insertWatermark() {
    const text = prompt("Enter watermark text:", watermarkText);
    if (text) {
        watermarkText = text;
        annotations[currentPage].push({ tool: "watermark", text: watermarkText, color, width: penWidth });
        redrawAnnotations();
        showPopup("Info", `Watermark set to '${text}'`);
    }
}

// Tools Menu
function showToolsMenu() {
    const dropdown = document.getElementById("dropdown-menu");
    dropdown.innerHTML = "";
    const tools = [
        { name: "Image to PDF", callback: imageToPDF },
        { name: "PDF to Word", callback: pdfToWord },
        { name: "PDF to Excel", callback: pdfToExcel },
        { name: "PDF to PPT", callback: pdfToPPT },
        { name: "PDF to Image", callback: documentToImage },
        { name: "Export to Image-only", callback: exportToImageOnly },
        { name: "Fill & Sign", callback: showFillSignMenu },
        { name: "OCR Image", callback: performOCR }
    ];
    tools.forEach(tool => {
        const btn = document.createElement("button");
        btn.textContent = tool.name;
        btn.onclick = () => { tool.callback(); dropdown.style.display = "none"; };
        dropdown.appendChild(btn);
    });
    dropdown.style.display = "block";
    dropdown.style.left = event.target.offsetLeft + "px";
    dropdown.style.top = event.target.offsetTop + event.target.offsetHeight + "px";
}

function imageToPDF() {
    showPopup("Info", "Image to PDF requires server-side processing. Please implement a backend.");
}

function pdfToWord() {
    showPopup("Info", "PDF to Word requires server-side processing. Please implement a backend.");
}

function pdfToExcel() {
    showPopup("Info", "PDF to Excel requires server-side processing. Please implement a backend.");
}

function pdfToPPT() {
    showPopup("Info", "PDF to PPT requires server-side processing. Please implement a backend.");
}

function documentToImage() {
    showPopup("Info", "Document to Image requires server-side processing. Please implement a backend.");
}

function exportToImageOnly() {
    showPopup("Info", "Export to Image-only requires server-side processing. Please implement a backend.");
}

function showFillSignMenu() {
    const dropdown = document.getElementById("dropdown-menu");
    dropdown.innerHTML = "";
    const tools = [
        { name: "Fill Form", callback: () => setTool("fill_form") },
        { name: "Signature", callback: () => setTool("signature") },
        { name: "Signature Date", callback: () => setTool("signature_date") },
        { name: "Check", callback: () => setTool("check") },
        { name: "Cross", callback: () => setTool("cross") },
        { name: "Dot", callback: () => setTool("dot") },
        { name: "Dash", callback: () => setTool("dash") },
        { name: "Checkbox", callback: () => setTool("checkbox") }
    ];
    tools.forEach(tool => {
        const btn = document.createElement("button");
        btn.textContent = tool.name;
        btn.onclick = () => { tool.callback(); dropdown.style.display = "none"; };
        dropdown.appendChild(btn);
    });
    dropdown.style.display = "block";
    dropdown.style.left = event.target.offsetLeft + "px";
    dropdown.style.top = event.target.offsetTop + event.target.offsetHeight + "px";
}

function performOCR() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async (e) => {
        const file = e.target.files[0];
        try {
            const { data: { text } } = await Tesseract.recognize(file, "eng");
            showPopup("OCR Result", text);
        } catch (e) {
            showPopup("Error", `OCR failed: ${e.message}`);
        }
    };
    input.click();
}

// Page Management
function showPageManagement() {
    if (!currentFile || !currentPages.length) {
        showPopup("Warning", "No file loaded.");
        return;
    }
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.innerHTML = `
        <div class="modal-content">
            <h2>Page Management</h2>
            <div id="page-list" style="max-height: 300px; overflow-y: auto; border: 1px solid #ccc;"></div>
            <button onclick="undoDelete()">Undo Delete</button>
            <button onclick="savePageChanges()">Save Changes</button>
            <button onclick="closeModal('page-management-modal')">Close</button>
        </div>
    `;
    modal.id = "page-management-modal";
    document.body.appendChild(modal);
    updatePageList();
    modal.style.display = "flex";
}

function updatePageList() {
    const pageList = document.getElementById("page-list");
    pageList.innerHTML = "";
    (docType === "word" ? currentPages : slides).forEach((page, i) => {
        const div = document.createElement("div");
        div.className = "file-item";
        div.textContent = `Page ${i + 1}: ${page.substring(0, 50)}...`;
        div.onclick = () => deletePage(i);
        pageList.appendChild(div);
    });
}

function deletePage(idx) {
    undoStack.push({ idx, content: docType === "word" ? currentPages[idx] : slides[idx], annotations: annotations[idx] || [] });
    if (docType === "word") {
        currentPages.splice(idx, 1);
        annotations.splice(idx, 1);
        annotationUndoStack.splice(idx, 1);
        annotationRedoStack.splice(idx, 1);
    } else if (docType === "presentation") {
        slides.splice(idx, 1);
        currentPages = slides;
        updatePresentation();
    } else if (docType === "spreadsheet") {
        spreadsheetData.splice(idx, 1);
        currentPages = spreadsheetData.map(row => row.join("\n"));
        updateSpreadsheetGrid();
    }
    if (currentPage >= currentPages.length) currentPage = currentPages.length - 1;
    updatePageList();
    updatePageDisplay();
}

function undoDelete() {
    if (!undoStack.length) {
        showPopup("Warning", "Nothing to undo.");
        return;
    }
    const { idx, content, annotations: anns } = undoStack.pop();
    if (docType === "word") {
        currentPages.splice(idx, 0, content);
        annotations.splice(idx, 0, anns);
        annotationUndoStack.splice(idx, 0, []);
        annotationRedoStack.splice(idx, 0, []);
    } else if (docType === "presentation") {
        slides.splice(idx, 0, content);
        currentPages = slides;
        updatePresentation();
    } else if (docType === "spreadsheet") {
        spreadsheetData.splice(idx, 0, content.split("\n"));
        currentPages = spreadsheetData.map(row => row.join("\n"));
        updateSpreadsheetGrid();
    }
    updatePageList();
    updatePageDisplay();
}

function savePageChanges() {
    saveFile();
    closeModal("page-management-modal");
}

// Help
function showHelp() {
    const helpText = `
        NextGen Writer Help:
        - Use 'New' to create a document (Word, Presentation, Spreadsheet).
        - 'Open'/'Save As' via 'File Manager' for file management.
        - 'Add Image' to insert images.
        - 'Tools' for conversions (PDF to Word/Excel/PPT/Image, Fill & Sign, OCR Image).
        - 'Page Mgmt' to delete pages.
        - Teaching Tools (Pen, Highlighter, Eraser) for annotations, with Undo/Redo.
        - Format options for text styling (Word only).
        - Watermark for document protection.
        - Use Prev/Next Page for multi-page navigation.
        - File Manager: Navigate directories, create folders, save/delete files.
        - Login required for all actions; use 'Logout' to sign out.
    `;
    showPopup("Help", helpText);
}

// SHA-256 Hash (Simplified for demo purposes)
function sha256(str) {
    // In a real app, use a proper SHA-256 library like crypto.subtle
    return str; // Placeholder
}