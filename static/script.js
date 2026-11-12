
function renderMarkdown(element, markdown) {
    if (!element) return;

    // Escape HTML first to prevent injected HTML from running.
    const escapeHTML = (text) => text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    let html = escapeHTML(String(markdown || ""));

    // Basic Markdown formatting
    html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
    html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
    html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");
    html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    html = html.replace(/^\s*[-*] (.+)$/gm, "<li>$1</li>");
    html = html.replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>");
    html = html.replace(/^\d+\.\s+(.+)$/gm, "<li>$1</li>");
    html = html.replace(/\n/g, "<br>");

    element.innerHTML = html;
}

// ==========================================
// PROMPTMATE - COMPLETE JAVASCRIPT
// ==========================================

// One storage key for the entire application
const USER_ID = window.PROMPTMATE_USER_ID;
const HISTORY_KEY = `promptmate_history_user_${USER_ID}`;

// ==========================================
// PROMPT HISTORY STORAGE
// ==========================================

function getPromptHistory() {
    try {
        const history = JSON.parse(
            localStorage.getItem(HISTORY_KEY)
        );

        return Array.isArray(history) ? history : [];

    } catch (error) {
        console.error("Could not load prompt history:", error);
        return [];
    }
}

function storePromptHistory(history) {
    try {
        localStorage.setItem(
            HISTORY_KEY,
            JSON.stringify(history)
        );
    } catch (error) {
        console.error("Could not save prompt history:", error);
        alert("Unable to save prompt history. Check your browser storage.");
    }
}

function savePromptToHistory(
    prompt,
    type,
    originalPrompt = "",
    metadata = {}
) {
    if (
        typeof prompt !== "string" ||
        !prompt.trim() ||
        prompt.startsWith("Error:")
    ) {
        return;
    }

    const history = getPromptHistory();

    const newEntry = {
        id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
        prompt: prompt.trim(),
        originalPrompt: originalPrompt || "",
        type: String(type || "generated").toLowerCase(),
        date: new Date().toISOString(),
        category: metadata.category || "",
        qualityScore: Number.isFinite(metadata.qualityScore)
            ? Math.max(0, Math.min(100, Math.round(metadata.qualityScore)))
            : null,
        favorite: false
    };

    history.unshift(newEntry);

    // Keep only the latest 100 prompts.
    storePromptHistory(history.slice(0, 100));

    renderPromptHistory();
    renderDashboardHistory();
    renderPromptStatistics();
}

// ==========================================
// NAVIGATION
// ==========================================

function showSection(sectionId) {

    const targetSection = document.getElementById(sectionId);

    if (!targetSection) {
        console.error("Section not found:", sectionId);
        return;
    }

    document.querySelectorAll(".page").forEach(page => {
        page.classList.toggle(
            "active",
            page.id === sectionId
        );
    });

    // Highlight active sidebar button
    document.querySelectorAll(".navigation .nav-item").forEach(button => {

        const onclickValue = button.getAttribute("onclick") || "";

        const isActive = onclickValue.includes(
            "'" + sectionId + "'"
        ) || onclickValue.includes(
            '"' + sectionId + '"'
        );

        button.classList.toggle("active", isActive);
    });

    // Update page title
    const pageNames = {
        dashboard: "Dashboard",
        builder: "Prompt Builder",
        improve: "Prompt Improvement",
        history: "Prompt History",
        learn: "Learn Prompting",
        preferences: "User Preferences"
    };

    const pageName = document.getElementById("page-name");

    if (pageName) {
        pageName.textContent =
            pageNames[sectionId] || "PromptMate";
    }

    // Refresh content when opening these sections
    if (sectionId === "history") {
        renderPromptHistory();
    }

    if (sectionId === "dashboard") {
        renderDashboardHistory();
        renderPromptStatistics();
    }
}

// ==========================================
// GENERATE PROMPT
// ==========================================

async function generatePrompt() {

    const result = document.getElementById("result");

    if (!result) {
        console.error("Prompt result element not found.");
        return;
    }

    const button = document.querySelector(
        "#builder .generate-btn"
    );

    const placeholder = result.parentElement
        ? result.parentElement.querySelector(".output-placeholder")
        : null;

    const data = {
        category: document.getElementById("category")?.value || "",
        goal: document.getElementById("goal")?.value || "",
        context: document.getElementById("context")?.value || "",
        audience: document.getElementById("audience")?.value || "",
        tone: document.getElementById("tone")?.value || "",
        format: document.getElementById("format")?.value || ""
    };

    if (!data.goal.trim()) {
        alert("Please enter your goal first.");
        return;
    }

    result.textContent = "Generating your prompt...";

    if (placeholder) {
        placeholder.style.display = "none";
    }

    if (button) {
        button.disabled = true;
        button.textContent = "Generating...";
    }

    try {

        const response = await fetch("/api/generate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(data)
        });

        const output = await response.json();

        if (!response.ok) {
            throw new Error(
                output.error || "Prompt generation failed."
            );
        }

        if (!output.prompt) {
            throw new Error("The server did not return a prompt.");
        }

        renderMarkdown(result, output.prompt);

        // Calculate and save the actual prompt quality score.
calculatePromptQuality();

const qualityScoreText =
    document.getElementById("quality-score")?.textContent || "";

const scoreMatch = qualityScoreText.match(/\d+/);
const qualityScore = scoreMatch ? Number(scoreMatch[0]) : null;

savePromptToHistory(output.prompt, "generated", "", {
    category: data.category,
    qualityScore: qualityScore
});

    } catch (error) {

        console.error("Generation error:", error);

        result.textContent = "Error: " + error.message;

    } finally {

        if (button) {
            button.disabled = false;
            button.textContent = "✧ Generate My Prompt";
        }
    }
}

// ==========================================
// COPY GENERATED PROMPT
// ==========================================

async function copyPrompt() {

    const result = document.getElementById("result");

    if (!result) return;

    const prompt = result.textContent.trim();

    if (
        !prompt ||
        prompt === "Your prompt will appear here." ||
        prompt.startsWith("Error:") ||
        prompt === "Generating your prompt..."
    ) {
        alert("Generate a prompt first.");
        return;
    }

    try {

        await navigator.clipboard.writeText(prompt);
        alert("Prompt copied successfully!");

    } catch (error) {

        console.error("Copy error:", error);

        alert("Unable to copy. Please select and copy manually.");
    }
}

// ==========================================
// IMPROVE EXISTING PROMPT
// ==========================================

async function improvePrompt() {

    const originalPrompt = document.getElementById(
        "originalPrompt"
    )?.value.trim() || "";

    const result = document.getElementById("improvedResult");

    const suggestions = document.getElementById(
        "improvementSuggestions"
    );

    if (!result) {
        console.error("Improved result element not found.");
        return;
    }

    const button = document.querySelector(
        "#improve .generate-btn"
    );

    const placeholder = result.parentElement
        ? result.parentElement.querySelector(".output-placeholder")
        : null;

    if (!originalPrompt) {
        alert("Please enter a prompt to improve.");
        return;
    }

    result.textContent = "Improving your prompt...";

    if (suggestions) {
        suggestions.textContent = "Analyzing your prompt...";
    }

    if (placeholder) {
        placeholder.style.display = "none";
    }

    if (button) {
        button.disabled = true;
        button.textContent = "Improving...";
    }

    try {

        const data = {
            prompt: originalPrompt,

            audience: document.getElementById(
                "improveAudience"
            )?.value || "",

            tone: document.getElementById(
                "improveTone"
            )?.value || "",

            format: document.getElementById(
                "improveFormat"
            )?.value || ""
        };

        const response = await fetch("/api/improve", {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify(data)
        });

        const output = await response.json();

        if (!response.ok) {
            throw new Error(
                output.error || "Prompt improvement failed."
            );
        }

        if (!output.improved_prompt) {
            throw new Error("The server did not return an improved prompt.");
        }

        renderMarkdown(result, output.improved_prompt);
        // Update Before-and-After Comparison
document.getElementById("comparison-original").textContent =
    originalPrompt;

document.getElementById("comparison-improved").textContent =
    output.improved_prompt;

        // Save improved prompt once
        savePromptToHistory(
            output.improved_prompt,
            "improved",
            originalPrompt
        );

        // Display improvement suggestions
        if (suggestions) {

            suggestions.replaceChildren();

            if (
                Array.isArray(output.improvements) &&
                output.improvements.length > 0
            ) {

                const list = document.createElement("ul");

                output.improvements.forEach(item => {

                    const li = document.createElement("li");
                    li.textContent = item;

                    list.appendChild(li);
                });

                suggestions.appendChild(list);

            } else {

                suggestions.textContent =
                    "Your prompt has been successfully improved.";
            }
        }

    } catch (error) {

        console.error("Improvement error:", error);

        result.textContent = "Error: " + error.message;

        if (suggestions) {
            suggestions.textContent =
                "Please check your Flask server and try again.";
        }

    } finally {

        if (button) {
            button.disabled = false;
            button.textContent = "✧ Improve My Prompt";
        }
    }
}

// ==========================================
// COPY IMPROVED PROMPT
// ==========================================

async function copyImprovedPrompt() {

    const result = document.getElementById("improvedResult");

    if (!result) return;

    const prompt = result.textContent.trim();

    if (
        !prompt ||
        prompt === "Your improved prompt will appear here." ||
        prompt.startsWith("Error:") ||
        prompt === "Improving your prompt..."
    ) {
        alert("Improve a prompt first.");
        return;
    }

    try {

        await navigator.clipboard.writeText(prompt);
        alert("Improved prompt copied successfully!");

    } catch (error) {

        console.error("Copy error:", error);

        alert("Unable to copy. Please select and copy manually.");
    }
}

// ==========================================
// HISTORY BUTTON CREATOR
// ==========================================

function createHistoryButton(label, callback) {

    const button = document.createElement("button");

    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", callback);

    return button;
}

// ==========================================
// DISPLAY PROMPT HISTORY
// ==========================================

function renderPromptHistory() {

    const list = document.getElementById("history-list");

    if (!list) return;

    const count = document.getElementById("history-count");

    const searchInput = document.getElementById("history-search");
    const filterInput = document.getElementById("history-filter");
    const sortInput = document.getElementById("history-sort");

    const searchTerm = (
        searchInput?.value || ""
    ).toLowerCase().trim();

    const filter = filterInput?.value || "all";
    const sort = sortInput?.value || "newest";

    const allHistory = getPromptHistory();

    if (count) {
        count.textContent = allHistory.length;
    }

    // Search and filter
    let filteredHistory = allHistory.filter(item => {

        const prompt = (item.prompt || "").toLowerCase();
        const original = (item.originalPrompt || "").toLowerCase();
        const type = (item.type || "").toLowerCase();

        const matchesSearch =
            prompt.includes(searchTerm) ||
            original.includes(searchTerm) ||
            type.includes(searchTerm);

        const matchesFilter =
            filter === "all" || type === filter.toLowerCase();

        return matchesSearch && matchesFilter;
    });

    // Sorting
    if (sort === "newest") {

        filteredHistory.sort((a, b) =>
            new Date(b.date || b.createdAt || 0) -
            new Date(a.date || a.createdAt || 0)
        );

    } else if (sort === "oldest") {

        filteredHistory.sort((a, b) =>
            new Date(a.date || a.createdAt || 0) -
            new Date(b.date || b.createdAt || 0)
        );

    } else if (sort === "alphabetical") {

        filteredHistory.sort((a, b) =>
            (a.prompt || "").localeCompare(b.prompt || "")
        );
    }

    list.replaceChildren();

    // Empty history state
    if (filteredHistory.length === 0) {

        const empty = document.createElement("div");
        empty.className = "history-empty";

        const heading = document.createElement("h3");
        const description = document.createElement("p");

        if (allHistory.length === 0) {

            heading.textContent = "No prompts saved yet.";

            description.textContent =
                "Your generated and improved prompts will appear here.";

            const button = createHistoryButton(
                "Create Your First Prompt →",
                () => showSection("builder")
            );

            button.className = "primary-btn";

            empty.append(heading, description, button);

        } else {

            heading.textContent = "No matching prompts found.";

            description.textContent =
                "Try changing your search or filter.";

            empty.append(heading, description);
        }

        list.appendChild(empty);
        return;
    }

    // Create history cards
    filteredHistory.forEach(item => {

        const card = document.createElement("article");
        card.className = "history-card";

        const info = document.createElement("div");
        info.className = "history-card-info";

        const type = document.createElement("span");
        type.className = "history-type";
        type.textContent =
            item.type === "improved" ? "Improved" : "Generated";

        const title = document.createElement("h3");

        title.textContent =
            (item.prompt || "").split("\n").find(
                line => line.trim()
            ) || "Saved Prompt";

        const date = document.createElement("small");

        date.textContent = new Date(
            item.date || item.createdAt || Date.now()
        ).toLocaleString();

        const preview = document.createElement("p");

        preview.className = "history-preview";

        preview.textContent =
            item.prompt.length > 180
                ? item.prompt.substring(0, 180) + "..."
                : item.prompt;

        info.append(type, title, date, preview);

        const actions = document.createElement("div");
        actions.className = "history-actions";

        const viewButton = createHistoryButton(
            "View",
            () => viewHistoryPrompt(item.id)
        );

        const copyButton = createHistoryButton(
            "Copy",
            () => copyHistoryPrompt(item.id)
        );

        const favoriteButton = createHistoryButton(
            item.favorite ? "★ Favorited" : "☆ Favorite",
            () => toggleFavoritePrompt(item.id)
        );
        favoriteButton.className = "history-action-btn";
        favoriteButton.setAttribute(
            "aria-pressed",
            item.favorite ? "true" : "false"
        );

        const deleteButton = createHistoryButton(
            "Delete",
            () => deleteHistoryPrompt(item.id)
        );

        actions.append(viewButton, copyButton, favoriteButton, deleteButton);

        card.append(info, actions);

        list.appendChild(card);
    });
}

// ==========================================
// VIEW SAVED PROMPT
// ==========================================

function viewHistoryPrompt(id) {

    const item = getPromptHistory().find(
        entry => entry.id === id
    );

    if (!item) return;

    if (item.type === "improved") {

        const improvedResult = document.getElementById(
            "improvedResult"
        );

        const originalInput = document.getElementById(
            "originalPrompt"
        );

        if (improvedResult) {
            improvedResult.textContent = item.prompt;
        }

        if (originalInput) {
            originalInput.value = item.originalPrompt || "";
        }

        showSection("improve");

    } else {

        const result = document.getElementById("result");

        if (result) {
            result.textContent = item.prompt;
        }

        showSection("builder");
    }
}

// ==========================================
// COPY SAVED PROMPT
// ==========================================

async function copyHistoryPrompt(id) {

    const item = getPromptHistory().find(
        entry => entry.id === id
    );

    if (!item) return;

    try {

        await navigator.clipboard.writeText(item.prompt);
        alert("Prompt copied successfully!");

    } catch (error) {

        console.error("Copy error:", error);
        alert("Unable to copy this prompt.");
    }
}

// ==========================================
// DELETE ONE SAVED PROMPT
// ==========================================

function deleteHistoryPrompt(id) {

    if (!confirm("Are you sure you want to delete this prompt?")) {
        return;
    }

    const updatedHistory = getPromptHistory().filter(
        item => item.id !== id
    );

    storePromptHistory(updatedHistory);

    renderPromptHistory();
    renderDashboardHistory();
    renderPromptStatistics();
}

// ==========================================
// CLEAR ALL PROMPT HISTORY
// ==========================================

function clearPromptHistory() {

    const history = getPromptHistory();

    if (history.length === 0) {
        alert("Your history is already empty.");
        return;
    }

    if (!confirm("Delete all saved prompts? This cannot be undone.")) {
        return;
    }

    localStorage.removeItem(HISTORY_KEY);

    renderPromptHistory();
    renderDashboardHistory();
    renderPromptStatistics();

    alert("Prompt history cleared successfully!");
}

// ==========================================
// EXPORT HISTORY AS JSON OR CSV
// ==========================================

function exportHistory(format) {

    const history = getPromptHistory();

    if (history.length === 0) {
        alert("There are no prompts to export.");
        return;
    }

    let content;
    let mimeType;
    let extension;

    if (format === "json") {

        content = JSON.stringify(history, null, 2);
        mimeType = "application/json";
        extension = "json";

    } else if (format === "csv") {

        const escapeCSV = value =>
            '"' + String(value ?? "").replace(/"/g, '""') + '"';

        const rows = [
            ["Type", "Prompt", "Original Prompt", "Date"],
            ...history.map(item => [
                item.type,
                item.prompt,
                item.originalPrompt || "",
                item.date || item.createdAt || ""
            ])
        ];

        content = rows.map(row =>
            row.map(escapeCSV).join(",")
        ).join("\n");

        mimeType = "text/csv;charset=utf-8;";
        extension = "csv";

    } else {

        alert("Unsupported export format.");
        return;
    }

    const blob = new Blob(
        ["\uFEFF" + content],
        { type: mimeType }
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = `promptmate-history.${extension}`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
}

// ==========================================
// DASHBOARD RECENT PROMPTS
// ==========================================

function renderDashboardHistory() {

    const container = document.getElementById(
        "dashboard-history"
    );

    if (!container) return;

    const history = getPromptHistory().slice(0, 3);

    container.replaceChildren();

    if (history.length === 0) {

        const empty = document.createElement("p");

        empty.className = "empty-history";

        empty.textContent =
            "No recent prompts. Start creating your first prompt!";

        container.appendChild(empty);
        return;
    }

    history.forEach(item => {

        const card = document.createElement("div");
        card.className = "dashboard-history-card";

        const title = document.createElement("h3");

        title.textContent =
            (item.prompt || "").split("\n").find(
                line => line.trim()
            ) || "Saved Prompt";

        const type = document.createElement("span");

        type.textContent =
            item.type === "improved" ? "Improved" : "Generated";

        const button = createHistoryButton(
            "View Prompt →",
            () => viewHistoryPrompt(item.id)
        );

        button.className = "text-btn";

        card.append(title, type, button);
        container.appendChild(card);
    });
}

// ==========================================
// INITIALIZE APPLICATION
// ==========================================

document.addEventListener("DOMContentLoaded", () => {

    console.log("PromptMate JavaScript loaded successfully.");

    renderPromptHistory();
    renderDashboardHistory();
    renderPromptStatistics();

    // History search
    const searchInput = document.getElementById("history-search");

    if (searchInput) {
        searchInput.addEventListener("input", renderPromptHistory);
    }

    // History filter
    const filterInput = document.getElementById("history-filter");

    if (filterInput) {
        filterInput.addEventListener("change", renderPromptHistory);
    }

    // History sorting
    const sortInput = document.getElementById("history-sort");

    if (sortInput) {
        sortInput.addEventListener("change", renderPromptHistory);
    }
});

// =====================================
// PROMPT TEMPLATE LIBRARY
// =====================================

function applyTemplate(type) {

    const templates = {

        study: {
            category: "Study and Learning",
            goal: "Explain a difficult topic in simple language. Break it into smaller concepts, provide relevant examples, and include a short summary to help me understand and remember it.",
            context: "Focus on clear explanations and practical learning examples."
        },

        writing: {
            category: "Writing",
            goal: "Help me create clear, engaging and well-structured written content. Organize the ideas logically and use appropriate language for the intended audience.",
            context: "Make the content readable, original and grammatically correct."
        },

        coding: {
            category: "Coding",
            goal: "Help me solve a programming problem. Explain the solution step by step, provide clean and understandable code, and identify possible errors or improvements.",
            context: "Include code examples and explain important programming concepts."
        },

        research: {
            category: "Research",
            goal: "Help me research a topic by explaining its key concepts, organizing important findings and identifying relevant points for further investigation.",
            context: "Use a structured academic approach and distinguish established facts from uncertain information."
        },

        presentation: {
            category: "Creative Ideas",
            goal: "Create a well-organized presentation outline on my chosen topic. Divide it into logical slides and provide key points and suggestions for each slide.",
            context: "Keep the slide content concise, clear and suitable for an audience."
        }

    };

    const selected = templates[type];

    if (!selected) {
        alert("Template not found.");
        return;
    }

    const category = document.getElementById("category");
    const goal = document.getElementById("goal");
    const context = document.getElementById("context");

    if (!category || !goal || !context) {
        alert("Prompt Builder fields could not be found.");
        return;
    }

    category.value = selected.category;
    goal.value = selected.goal;
    context.value = selected.context;

    // Move the user to the builder form
    goal.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });

    // Show confirmation
    alert("Template applied successfully! You can now customize your prompt.");
}

// =====================================
// PROMPT QUALITY SCORE
// =====================================

function calculatePromptQuality() {
    const goal = document.getElementById("goal")?.value.trim() || "";
    const context = document.getElementById("context")?.value.trim() || "";

    const scoreElement = document.getElementById("quality-score");
    const progressBar = document.getElementById("quality-progress-bar");
    const clarityElement = document.getElementById("clarity-score");
    const contextElement = document.getElementById("context-score");
    const specificityElement = document.getElementById("specificity-score");
    const labelElement = document.getElementById("quality-label");
    const suggestionsElement = document.getElementById("quality-suggestions");

    if (!scoreElement || !progressBar) return;

    const words = goal.split(/\s+/).filter(Boolean);
    const contextWords = context.split(/\s+/).filter(Boolean);

    // CLARITY: based on whether a task is provided and sufficiently described
    let clarity = 0;

    if (words.length >= 3) clarity = 40;
    if (words.length >= 6) clarity = 65;
    if (words.length >= 10) clarity = 85;
    if (words.length >= 15) clarity = 100;

    // CONTEXT: based on supporting information
    let contextScore = 0;

    if (contextWords.length >= 3) contextScore = 40;
    if (contextWords.length >= 8) contextScore = 70;
    if (contextWords.length >= 15) contextScore = 100;

    // SPECIFICITY: checks for useful details and action words
    const detailWords = [
        "explain", "compare", "analyze", "create",
        "summarize", "describe", "include", "provide",
        "step", "example", "audience", "format",
        "beginner", "detailed", "specific"
    ];

    const matchingDetails = detailWords.filter(word =>
        (goal + " " + context).toLowerCase().includes(word)
    ).length;

    let specificity = Math.min(100, matchingDetails * 15);

    // Overall score
    let totalScore = Math.round(
        clarity * 0.35 +
        contextScore * 0.30 +
        specificity * 0.35
    );

    if (!goal) {
        clarity = 0;
        contextScore = 0;
        specificity = 0;
        totalScore = 0;
    }

    // Update score display
    scoreElement.textContent = totalScore;
    progressBar.style.width = totalScore + "%";

    clarityElement.textContent = clarity + "%";
    contextElement.textContent = contextScore + "%";
    specificityElement.textContent = specificity + "%";

    // Feedback suggestions
    const suggestions = [];

    if (!goal) {
        suggestions.push("Enter a task to begin your prompt analysis.");
    } else {
        if (words.length < 6) {
            suggestions.push("Make your task description more detailed.");
        }

        if (!context) {
            suggestions.push("Add background information or relevant context.");
        }

        if (context && contextWords.length < 8) {
            suggestions.push("Provide more supporting details in the context field.");
        }

        if (specificity < 60) {
            suggestions.push("Include specific instructions, examples or expected results.");
        }

        if (totalScore >= 80) {
            suggestions.push("Good work! Your prompt has a strong structure.");
        }

        if (totalScore >= 60 && totalScore < 80) {
            suggestions.push("Your prompt is developing well. Add a few more details.");
        }
    }

    labelElement.textContent =
        totalScore >= 80 ? "Excellent prompt!" :
        totalScore >= 60 ? "Good prompt" :
        totalScore >= 30 ? "Needs improvement" :
        "Let's improve your prompt";

    suggestionsElement.innerHTML = "";

    suggestions.forEach(suggestion => {
        const item = document.createElement("li");
        item.textContent = suggestion;
        suggestionsElement.appendChild(item);
    });
}

// Update score while the user types
document.addEventListener("DOMContentLoaded", function () {
    const goalInput = document.getElementById("goal");
    const contextInput = document.getElementById("context");

    if (goalInput && contextInput) {
        goalInput.addEventListener("input", calculatePromptQuality);
        contextInput.addEventListener("input", calculatePromptQuality);

        calculatePromptQuality();
    }
});

/* =====================================
   DARK MODE FUNCTIONALITY
===================================== */

function toggleTheme() {
    const body = document.body;
    const themeIcon = document.getElementById("theme-icon");
    const themeLabel = document.getElementById("theme-label");
    const themeButton = document.getElementById("theme-toggle");

    body.classList.toggle("dark-mode");

    const isDark = body.classList.contains("dark-mode");

    // Update button appearance
    themeIcon.textContent = isDark ? "☀️" : "🌙";
    themeLabel.textContent = isDark ? "Light Mode" : "Dark Mode";

    themeButton.setAttribute(
        "aria-label",
        isDark ? "Switch to light mode" : "Switch to dark mode"
    );

    // Remember the selected theme
    const selectedTheme = isDark ? "dark" : "light";

    localStorage.setItem("promptMateTheme", selectedTheme);

    // Keep the User Preferences setting synchronized with the theme toggle.
    if (typeof saveUserPreferences === "function") {
        saveUserPreferences({ theme: selectedTheme });
    }

    const preferenceTheme = document.getElementById("preference-theme");
    if (preferenceTheme) {
        preferenceTheme.value = selectedTheme;
    }
}

// Restore the saved theme when the page loads
document.addEventListener("DOMContentLoaded", function () {
    const savedTheme = localStorage.getItem("promptMateTheme");

    if (savedTheme === "dark") {
        document.body.classList.add("dark-mode");

        const themeIcon = document.getElementById("theme-icon");
        const themeLabel = document.getElementById("theme-label");
        const themeButton = document.getElementById("theme-toggle");

        if (themeIcon) themeIcon.textContent = "☀️";
        if (themeLabel) themeLabel.textContent = "Light Mode";

        if (themeButton) {
            themeButton.setAttribute(
                "aria-label",
                "Switch to light mode"
            );
        }
    }
});

function startTutorial() {
    const steps = [
        {
            title: "Welcome to PromptMate!",
            description: "Your AI prompt workspace. This tour will show you how to use its main features."
        },
        {
            title: "Prompt Builder",
            description: "Describe your task, add context, choose your audience and tone, and generate a structured prompt."
        },
        {
            title: "Prompt Improvement",
            description: "Enter an existing prompt and let PromptMate improve its clarity, detail, and structure."
        },
        {
            title: "Prompt History",
            description: "Find, review, copy, and manage prompts you have created or improved."
        },
        {
            title: "Learn Prompting",
            description: "Explore prompting techniques and examples to improve your AI instructions."
        }
    ];

    let currentStep = 0;

    const overlay = document.createElement("div");
    overlay.className = "tutorial-overlay";

    overlay.innerHTML = `
        <div class="tutorial-modal">
            <button class="tutorial-close" aria-label="Close tour">&times;</button>
            <span class="tutorial-label">PROMPTMATE QUICK TOUR</span>
            <h2 class="tutorial-title"></h2>
            <p class="tutorial-description"></p>
            <div class="tutorial-progress"></div>
            <div class="tutorial-actions">
                <button class="tutorial-back">Back</button>
                <button class="tutorial-next">Next</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const title = overlay.querySelector(".tutorial-title");
    const description = overlay.querySelector(".tutorial-description");
    const progress = overlay.querySelector(".tutorial-progress");
    const back = overlay.querySelector(".tutorial-back");
    const next = overlay.querySelector(".tutorial-next");

    function showStep() {
        title.textContent = steps[currentStep].title;
        description.textContent = steps[currentStep].description;
        progress.textContent = `Step ${currentStep + 1} of ${steps.length}`;

        back.disabled = currentStep === 0;
        next.textContent =
            currentStep === steps.length - 1 ? "Finish" : "Next";
    }

    next.addEventListener("click", () => {
        if (currentStep === steps.length - 1) {
            overlay.remove();
            return;
        }

        currentStep++;
        showStep();
    });

    back.addEventListener("click", () => {
        if (currentStep > 0) {
            currentStep--;
            showStep();
        }
    });

    overlay.querySelector(".tutorial-close").addEventListener("click", () => {
        overlay.remove();
    });

    overlay.addEventListener("click", (event) => {
        if (event.target === overlay) overlay.remove();
    });

    showStep();
}

// =====================================
// PROMPTMATE SMART USER PREFERENCES
// =====================================

const PREFERENCES_KEY = `promptMatePreferences_user_${USER_ID}`;

const defaultPreferences = {
    audience: "Beginner",
    tone: "Simple",
    format: "Bullet Points",
    theme: "light"
};

function getUserPreferences() {
    try {
        const saved = JSON.parse(
            localStorage.getItem(PREFERENCES_KEY)
        );

        return {
            ...defaultPreferences,
            ...(saved && typeof saved === "object" ? saved : {})
        };
    } catch (error) {
        return { ...defaultPreferences };
    }
}

function saveUserPreferences(preferences) {
    const current = getUserPreferences();

    const updated = {
        ...current,
        ...preferences
    };

    localStorage.setItem(
        PREFERENCES_KEY,
        JSON.stringify(updated)
    );

    return updated;
}

function applyUserPreferences() {
    const preferences = getUserPreferences();

    const fields = [
        ["audience", preferences.audience],
        ["tone", preferences.tone],
        ["format", preferences.format],
        ["improveAudience", preferences.audience],
        ["improveTone", preferences.tone],
        ["improveFormat", preferences.format]
    ];

    fields.forEach(([id, value]) => {
        const field = document.getElementById(id);

        if (field) {
            field.value = value;
        }
    });

    // Keep the theme preference and application theme synchronized.
    const theme = preferences.theme === "dark" ? "dark" : "light";
    document.body.classList.toggle("dark-mode", theme === "dark");
    localStorage.setItem("promptMateTheme", theme);

    const themeIcon = document.getElementById("theme-icon");
    const themeLabel = document.getElementById("theme-label");
    const themeButton = document.getElementById("theme-toggle");

    if (themeIcon) themeIcon.textContent = theme === "dark" ? "☀️" : "🌙";
    if (themeLabel) themeLabel.textContent = theme === "dark" ? "Light Mode" : "Dark Mode";
    if (themeButton) {
        themeButton.setAttribute(
            "aria-label",
            theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
        );
    }

    const preferenceTheme = document.getElementById("preference-theme");
    if (preferenceTheme) preferenceTheme.value = theme;
}

document.addEventListener("DOMContentLoaded", () => {
    applyUserPreferences();
});
function savePreferencesFromPage() {
    const audience = document.getElementById("preference-audience").value;
    const tone = document.getElementById("preference-tone").value;
    const format = document.getElementById("preference-format").value;
    const theme = document.getElementById("preference-theme").value;

    saveUserPreferences({
        audience: audience,
        tone: tone,
        format: format,
        theme: theme
    });

    // Apply preferences to the Prompt Builder and Improvement pages
    applyUserPreferences();

    // Apply the selected theme
    document.body.classList.toggle("dark-mode", theme === "dark");
    localStorage.setItem("promptMateTheme", theme);

    const themeIcon = document.getElementById("theme-icon");
    const themeLabel = document.getElementById("theme-label");
    const themeButton = document.getElementById("theme-toggle");

    if (themeIcon) themeIcon.textContent = theme === "dark" ? "☀️" : "🌙";
    if (themeLabel) themeLabel.textContent = theme === "dark" ? "Light Mode" : "Dark Mode";
    if (themeButton) {
        themeButton.setAttribute(
            "aria-label",
            theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
        );
    }

    const message = document.getElementById("preferences-message");
    if (message) message.textContent = "Preferences saved successfully!";
}


function resetPreferences() {
    saveUserPreferences(defaultPreferences);

    document.getElementById("preference-audience").value = defaultPreferences.audience;
    document.getElementById("preference-tone").value = defaultPreferences.tone;
    document.getElementById("preference-format").value = defaultPreferences.format;
    document.getElementById("preference-theme").value = defaultPreferences.theme;

    applyUserPreferences();

    document.body.classList.remove("dark-mode");
    localStorage.setItem("promptMateTheme", "light");

    const themeIcon = document.getElementById("theme-icon");
    const themeLabel = document.getElementById("theme-label");

    if (themeIcon) themeIcon.textContent = "🌙";
    if (themeLabel) themeLabel.textContent = "Dark Mode";

    const message = document.getElementById("preferences-message");
    if (message) message.textContent = "Preferences reset to defaults.";
}


// ==========================================
// FAVOURITES
// ==========================================

function toggleFavoritePrompt(id) {
    const history = getPromptHistory();
    const item = history.find(entry => entry.id === id);

    if (!item) return;

    item.favorite = !item.favorite;
    storePromptHistory(history);

    renderPromptHistory();
    renderDashboardHistory();
    renderPromptStatistics();
}

// ==========================================
// SMART PROMPT STATISTICS DASHBOARD
// ==========================================

function getPromptStatistics() {
    const history = getPromptHistory();

    const generated = history.filter(item => item.type === "generated");
    const improved = history.filter(item => item.type === "improved");
    const favorites = history.filter(item => item.favorite === true);

    const scoredItems = history.filter(item =>
        Number.isFinite(item.qualityScore) &&
        item.qualityScore >= 0 &&
        item.qualityScore <= 100
    );

    const averageQuality = scoredItems.length
        ? Math.round(
            scoredItems.reduce((sum, item) => sum + item.qualityScore, 0) /
            scoredItems.length
        )
        : null;

    const categoryCounts = {};
    history.forEach(item => {
        if (item.category) {
            categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
        }
    });

    const mostUsedCategory = Object.entries(categoryCounts)
        .sort((a, b) => b[1] - a[1])[0] || null;

    const today = new Date();
    const weeklyActivity = [];

    for (let offset = 6; offset >= 0; offset--) {
        const date = new Date(today);
        date.setHours(0, 0, 0, 0);
        date.setDate(today.getDate() - offset);

        const nextDate = new Date(date);
        nextDate.setDate(date.getDate() + 1);

        const count = history.filter(item => {
            const itemDate = new Date(item.date || item.createdAt || 0);
            return itemDate >= date && itemDate < nextDate;
        }).length;

        weeklyActivity.push({
            label: date.toLocaleDateString(undefined, { weekday: "short" }),
            count
        });
    }

    return {
        total: history.length,
        generated: generated.length,
        improved: improved.length,
        favorites: favorites.length,
        averageQuality,
        scoredCount: scoredItems.length,
        mostUsedCategory,
        weeklyActivity
    };
}

function renderPromptStatistics() {
    const dashboard = document.getElementById("dashboard");
    if (!dashboard) return;

    let panel = document.getElementById("prompt-statistics-panel");

    if (!panel) {
        panel = document.createElement("section");
        panel.id = "prompt-statistics-panel";
        panel.className = "prompt-statistics-panel";

        const recentHistory = dashboard.querySelector(".dashboard-history");
        const recentHeading = recentHistory
            ? recentHistory.previousElementSibling
            : null;

        if (recentHistory) {
            dashboard.insertBefore(panel, recentHistory);
        } else {
            const historyContainer = dashboard.querySelector("#dashboard-history");
            if (historyContainer && historyContainer.parentElement) {
                historyContainer.parentElement.insertBefore(panel, historyContainer);
            } else {
                dashboard.appendChild(panel);
            }
        }
    }

    const stats = getPromptStatistics();
    const maxActivity = Math.max(1, ...stats.weeklyActivity.map(day => day.count));

    
const makeStatCard = (label, value, note) => {
    const card = document.createElement("article");
    card.className = "prompt-stat-card";

    const title = document.createElement("span");
    title.className = "prompt-stat-label";
    title.textContent = label;

    const number = document.createElement("strong");
    number.className = "prompt-stat-value";

    const numericValue = Number(value);
    const shouldAnimate =
        typeof value === "number" &&
        Number.isFinite(numericValue);

    number.textContent = shouldAnimate ? "0" : value;

    const detail = document.createElement("small");
    detail.className = "prompt-stat-note";
    detail.textContent = note;

    card.append(title, number, detail);

    if (shouldAnimate) {
        const duration = 900;
        const startTime = performance.now();

        function updateCounter(currentTime) {
            const progress = Math.min(
                (currentTime - startTime) / duration,
                1
            );

            const easedProgress = 1 - Math.pow(1 - progress, 3);

            number.textContent = Math.round(
                numericValue * easedProgress
            );

            if (progress < 1) {
                requestAnimationFrame(updateCounter);
            }
        }

        requestAnimationFrame(updateCounter);
    }

    return card;
};


    panel.replaceChildren();

    const heading = document.createElement("div");
    heading.className = "prompt-stats-heading";

    const headingText = document.createElement("div");
    const eyebrow = document.createElement("span");
    eyebrow.className = "eyebrow";
    eyebrow.textContent = "YOUR ACTIVITY";

    const title = document.createElement("h2");
    title.textContent = "Prompt Statistics";

    const subtitle = document.createElement("p");
    subtitle.textContent = "A live overview of your PromptMate activity.";

    headingText.append(eyebrow, title, subtitle);
    heading.appendChild(headingText);

    const grid = document.createElement("div");
    grid.className = "prompt-stats-grid";

    grid.append(
        makeStatCard("Total Prompts", stats.total, "Saved in your history"),
        makeStatCard("Generated", stats.generated, "New prompts created"),
        makeStatCard("Improved", stats.improved, "Existing prompts refined"),
        makeStatCard(
            "Average Quality",
            stats.averageQuality === null ? "—" : `${stats.averageQuality}/100`,
            stats.scoredCount
                ? `Based on ${stats.scoredCount} scored prompts`
                : "Scores collected from new prompts"
        ),
        makeStatCard("Favourites", stats.favorites, "Prompts you saved as favourites")
    );

    const activitySection = document.createElement("div");
    activitySection.className = "prompt-activity-section";

    const activityTitle = document.createElement("h3");
    activityTitle.textContent = "Last 7 Days";

    const activityDescription = document.createElement("p");
    activityDescription.textContent = "Number of prompts saved each day.";

    const chart = document.createElement("div");
    chart.className = "prompt-activity-chart";
    chart.setAttribute("role", "img");
    chart.setAttribute("aria-label", "Prompt activity over the last seven days");

    stats.weeklyActivity.forEach(day => {
        const column = document.createElement("div");
        column.className = "prompt-activity-column";

        const count = document.createElement("span");
        count.className = "prompt-activity-count";
        count.textContent = day.count;

        const track = document.createElement("div");
        track.className = "prompt-activity-track";

        const bar = document.createElement("div");
        bar.className = "prompt-activity-bar";
        bar.style.height = `${Math.max(4, (day.count / maxActivity) * 100)}%`;
        if (day.count === 0) bar.style.opacity = "0.25";

        track.appendChild(bar);

        const label = document.createElement("small");
        label.className = "prompt-activity-label";
        label.textContent = day.label;

        column.append(count, track, label);
        chart.appendChild(column);
    });

    activitySection.append(activityTitle, activityDescription, chart);

    const insights = document.createElement("div");
    insights.className = "prompt-smart-insights";

    const insightTitle = document.createElement("h3");
    insightTitle.textContent = "Smart Insights";

    const insightList = document.createElement("ul");
    const insightMessages = [];

    if (stats.total === 0) {
        insightMessages.push("Create your first prompt to start seeing personalized statistics.");
    } else {
        if (stats.mostUsedCategory) {
            insightMessages.push(
                `Your most-used category is ${stats.mostUsedCategory[0]} (${stats.mostUsedCategory[1]} prompts).`
            );
        }

        if (stats.averageQuality !== null) {
            if (stats.averageQuality >= 80) {
                insightMessages.push("Your average prompt quality is strong. Keep using clear tasks and relevant context.");
            } else {
                insightMessages.push("Try adding more context and specific instructions to improve your prompt quality score.");
            }
        } else {
            insightMessages.push("Generate prompts in Prompt Builder to begin collecting quality scores.");
        }

        if (stats.favorites > 0) {
            insightMessages.push(`You have saved ${stats.favorites} favourite prompt${stats.favorites === 1 ? "" : "s"} for quick reference.`);
        } else {
            insightMessages.push("Mark useful prompts as favourites in Prompt History to build a reusable collection.");
        }

        const lastSeven = stats.weeklyActivity.reduce((sum, day) => sum + day.count, 0);
        insightMessages.push(
            lastSeven
                ? `You saved ${lastSeven} prompt${lastSeven === 1 ? "" : "s"} in the last seven days.`
                : "No prompts have been saved in the last seven days. Your activity chart will update as you work."
        );
    }

    insightMessages.forEach(message => {
        const item = document.createElement("li");
        item.textContent = message;
        insightList.appendChild(item);
    });

    insights.append(insightTitle, insightList);
    panel.append(heading, grid, activitySection, insights);
}

// ==========================================
// STATISTICS DASHBOARD STYLES
// ==========================================

(function addPromptStatisticsStyles() {
    if (document.getElementById("prompt-statistics-styles")) return;

    const style = document.createElement("style");
    style.id = "prompt-statistics-styles";
    style.textContent = `
        .prompt-statistics-panel {
            margin: 30px 0;
            padding: 24px;
            border: 1px solid var(--border, #eceaf3);
            border-radius: 18px;
            background: var(--white, #fff);
            box-shadow: 0 5px 20px rgba(35, 28, 65, .04);
        }
        .prompt-stats-heading h2 { margin: 4px 0; }
        .prompt-stats-heading p { margin-bottom: 18px; }
        .prompt-stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(145px, 1fr));
            gap: 12px;
        }
        .prompt-stat-card {
            min-height: 112px;
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 7px;
            border: 1px solid #e9e5f5;
            border-radius: 13px;
            background: #faf9fe;
        }
        .prompt-stat-label { color: #77718d; font-size: 12px; }
        .prompt-stat-value { color: #704de5; font-size: 25px; }
        .prompt-stat-note { color: #9690a8; font-size: 10px; }
        .prompt-activity-section, .prompt-smart-insights {
            margin-top: 22px;
            padding: 18px;
            border: 1px solid #e9e5f5;
            border-radius: 13px;
            background: #faf9fe;
        }
        .prompt-activity-section h3, .prompt-smart-insights h3 {
            margin-bottom: 4px;
        }
        .prompt-activity-section > p { margin-bottom: 14px; }
        .prompt-activity-chart {
            height: 145px;
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            gap: 12px;
            align-items: end;
        }
        .prompt-activity-column {
            height: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-end;
            gap: 6px;
        }
        .prompt-activity-count, .prompt-activity-label {
            color: #89839c;
            font-size: 10px;
        }
        .prompt-activity-track {
            width: min(34px, 75%);
            height: 90px;
            display: flex;
            align-items: flex-end;
            overflow: hidden;
            border-radius: 8px;
            background: #eeeaf7;
        }
        .prompt-activity-bar {
            width: 100%;
            min-height: 4px;
            border-radius: 8px;
            background: linear-gradient(180deg, #a58aff, #704de5);
        }
        .prompt-smart-insights ul {
            margin: 10px 0 0;
            padding-left: 20px;
            color: #77718d;
            font-size: 12px;
            line-height: 1.9;
        }
        body.dark-mode .prompt-statistics-panel {
            background: #211c35;
            border-color: #39304f;
            color: #eeeafc;
        }
        body.dark-mode .prompt-stat-card,
        body.dark-mode .prompt-activity-section,
        body.dark-mode .prompt-smart-insights {
            background: #302744;
            border-color: #483765;
        }
        body.dark-mode .prompt-stat-label,
        body.dark-mode .prompt-stat-note,
        body.dark-mode .prompt-activity-count,
        body.dark-mode .prompt-activity-label,
        body.dark-mode .prompt-activity-section p,
        body.dark-mode .prompt-smart-insights li {
            color: #c4badb;
        }
        body.dark-mode .prompt-stat-value {
            color: #b69aff;
        }
        body.dark-mode .prompt-activity-track {
            background: #45385e;
        }
        @media (max-width: 600px) {
            .prompt-statistics-panel { padding: 16px; }
            .prompt-activity-chart { gap: 5px; }
        }
    `;
    document.head.appendChild(style);
})();
// COLLAPSIBLE SIDEBAR
function toggleSidebar() {
    const isCollapsed = document.body.classList.toggle("sidebar-collapsed");

    localStorage.setItem(
        "promptMateSidebar",
        isCollapsed ? "collapsed" : "expanded"
    );

    const button = document.getElementById("sidebar-toggle");

    if (button) {
        button.setAttribute(
            "aria-label",
            isCollapsed ? "Expand sidebar" : "Collapse sidebar"
        );
    }
}

// Restore sidebar preference
document.addEventListener("DOMContentLoaded", function () {
    const savedSidebar = localStorage.getItem("promptMateSidebar");

    if (savedSidebar === "collapsed") {
        document.body.classList.add("sidebar-collapsed");
    }
});
function toggleSidebar() {
    document.body.classList.toggle("sidebar-collapsed");

    const button = document.getElementById("sidebar-toggle");
    const isCollapsed = document.body.classList.contains("sidebar-collapsed");

    if (button) {
        button.setAttribute(
            "aria-label",
            isCollapsed ? "Show sidebar" : "Collapse sidebar"
        );
        button.setAttribute(
            "title",
            isCollapsed ? "Show sidebar" : "Hide sidebar"
        );
    }
}
document.addEventListener("DOMContentLoaded", function () {
    const sidebar = document.querySelector(".sidebar");
    const trigger = document.getElementById("sidebar-trigger");

    if (!sidebar || !trigger) return;

    trigger.addEventListener("mouseenter", function () {
        sidebar.classList.add("sidebar-visible");
    });

    sidebar.addEventListener("mouseleave", function () {
        sidebar.classList.remove("sidebar-visible");
    });
});
/* ==========================================
   PROMPTMATE THEME STUDIO — FOUR PRESETS
========================================== */

const PROMPTMATE_THEME_KEY = `promptMateThemePreset_user_${USER_ID}`;

const PROMPTMATE_THEMES = {
    midnight: { dark: true, label: "Midnight Purple" },
    ocean: { dark: true, label: "Ocean Blue" },
    graphite: { dark: true, label: "Graphite" },
    lavender: { dark: false, label: "Lavender" }
};

function applyAppTheme(themeName, save = true) {
    if (!PROMPTMATE_THEMES[themeName]) {
        themeName = "lavender";
    }

    const theme = PROMPTMATE_THEMES[themeName];

    document.body.dataset.theme = themeName;
    document.body.classList.toggle("dark-mode", theme.dark);

    const icon = document.getElementById("theme-icon");
    const label = document.getElementById("theme-label");
    const button = document.getElementById("theme-toggle");

    if (icon) icon.textContent = theme.dark ? "☀️" : "🌙";
    if (label) label.textContent = theme.dark ? "Light Mode" : "Dark Mode";

    if (button) {
        button.setAttribute(
            "aria-label",
            theme.dark ? "Switch to light mode" : "Switch to dark mode"
        );
    }

    document.querySelectorAll("[data-theme-option]").forEach(card => {
        const selected = card.dataset.themeOption === themeName;

        card.classList.toggle("selected", selected);
        card.setAttribute("aria-pressed", String(selected));

        const status = card.querySelector("[data-theme-status]");
        if (status) {
            status.textContent = selected
                ? "✓ Currently active"
                : "Select theme";
        }
    });

    const message = document.getElementById("theme-studio-message");
    if (message) {
        message.textContent = theme.label + " is now active.";
    }

    const preferenceTheme = document.getElementById("preference-theme");
    if (preferenceTheme) {
        preferenceTheme.value = theme.dark ? "dark" : "light";
    }

    if (save) {
        localStorage.setItem(PROMPTMATE_THEME_KEY, themeName);
        localStorage.setItem(
            "promptMateTheme",
            theme.dark ? "dark" : "light"
        );

        saveUserPreferences({
            ...getUserPreferences(),
            theme: theme.dark ? "dark" : "light"
        });
    }
}

function selectAppTheme(themeName) {
    applyAppTheme(themeName, true);
}

function loadAppTheme() {
    let savedTheme = localStorage.getItem(PROMPTMATE_THEME_KEY);

    if (!savedTheme) {
        savedTheme =
            localStorage.getItem("promptMateTheme") === "dark"
                ? "midnight"
                : "lavender";
    }

    if (!PROMPTMATE_THEMES[savedTheme]) {
        savedTheme = "lavender";
    }

    applyAppTheme(savedTheme, false);
}

// Keep the existing top-bar theme toggle working.
function toggleTheme() {
    const currentTheme = document.body.dataset.theme || "lavender";
    const isDark = PROMPTMATE_THEMES[currentTheme]?.dark || false;

    selectAppTheme(isDark ? "lavender" : "midnight");
}

// Preserve existing User Preferences functionality.
function applyUserPreferences() {
    const preferences = getUserPreferences();

    [
        ["audience", preferences.audience],
        ["tone", preferences.tone],
        ["format", preferences.format],
        ["improveAudience", preferences.audience],
        ["improveTone", preferences.tone],
        ["improveFormat", preferences.format]
    ].forEach(([id, value]) => {
        const field = document.getElementById(id);
        if (field) field.value = value;
    });

    const savedPreset = localStorage.getItem(PROMPTMATE_THEME_KEY);

    applyAppTheme(
        PROMPTMATE_THEMES[savedPreset]
            ? savedPreset
            : preferences.theme === "dark"
                ? "midnight"
                : "lavender",
        false
    );
}

function savePreferencesFromPage() {
    const audience =
        document.getElementById("preference-audience")?.value ||
        defaultPreferences.audience;

    const tone =
        document.getElementById("preference-tone")?.value ||
        defaultPreferences.tone;

    const format =
        document.getElementById("preference-format")?.value ||
        defaultPreferences.format;

    const theme =
        document.getElementById("preference-theme")?.value || "light";

    saveUserPreferences({ audience, tone, format, theme });

    const currentPreset = localStorage.getItem(PROMPTMATE_THEME_KEY);

    const chosenPreset = theme === "dark"
        ? (PROMPTMATE_THEMES[currentPreset]?.dark
            ? currentPreset
            : "midnight")
        : "lavender";

    applyUserPreferences();
    applyAppTheme(chosenPreset, true);

    const message = document.getElementById("preferences-message");
    if (message) {
        message.textContent = "Preferences saved successfully!";
    }
}

function resetPreferences() {
    saveUserPreferences(defaultPreferences);

    const audience = document.getElementById("preference-audience");
    const tone = document.getElementById("preference-tone");
    const format = document.getElementById("preference-format");

    if (audience) audience.value = defaultPreferences.audience;
    if (tone) tone.value = defaultPreferences.tone;
    if (format) format.value = defaultPreferences.format;

    applyUserPreferences();
    applyAppTheme("lavender", true);

    const message = document.getElementById("preferences-message");
    if (message) {
        message.textContent = "Preferences reset to defaults.";
    }
}

// Restore the selected theme when the app loads.
document.addEventListener("DOMContentLoaded", () => {
    loadAppTheme();
    applyUserPreferences();
});
// ==========================================
// CUSTOM FONT COLOUR PICKER
// ==========================================

const FONT_COLOR_KEY = `promptMateCustomFontColor_user_${USER_ID}`;

function applyCustomFontColor(color, save = true) {
    if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
        return;
    }

    // Apply the selected colour to the workspace.
    document.body.style.setProperty("--custom-font-color", color);

    const picker = document.getElementById("custom-font-color");
    const colorValue = document.getElementById("font-color-value");

    if (picker) {
        picker.value = color;
    }

    if (colorValue) {
        colorValue.textContent = color.toUpperCase();
    }

    if (save) {
        localStorage.setItem(FONT_COLOR_KEY, color);
    }
}

function resetFontColor() {
    const currentTheme = document.body.dataset.theme || "midnight";

    const defaultColor = currentTheme === "lavender"
        ? "#302044"
        : "#FFFFFF";

    applyCustomFontColor(defaultColor, true);
}

document.addEventListener("DOMContentLoaded", () => {
    const picker = document.getElementById("custom-font-color");

    const savedColor = localStorage.getItem(FONT_COLOR_KEY);

    applyCustomFontColor(savedColor || "#FFFFFF", false);

    if (picker) {
        picker.addEventListener("input", (event) => {
            applyCustomFontColor(event.target.value, true);
        });
    }
});