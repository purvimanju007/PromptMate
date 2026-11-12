
// ========================================
// PROMPTMATE - PROMPT HISTORY
// ========================================

const HISTORY_KEY = "promptmate_history";

// Get saved history
function getPromptHistory() {
    try {
        return JSON.parse(
            localStorage.getItem(HISTORY_KEY)
        ) || [];
    } catch (error) {
        console.error("History loading error:", error);
        return [];
    }
}


// Save a generated or improved prompt
function savePromptToHistory(data) {

    if (!data.prompt || !data.prompt.trim()) {
        return;
    }

    const history = getPromptHistory();

    const newPrompt = {
        id: Date.now().toString() +
            Math.random().toString(36).slice(2),

        type: data.type || "Generated",

        title: data.title || "Untitled Prompt",

        category: data.category || "General",

        prompt: data.prompt,

        date: new Date().toISOString()
    };

    history.unshift(newPrompt);

    // Keep the latest 100 prompts
    localStorage.setItem(
        HISTORY_KEY,
        JSON.stringify(history.slice(0, 100))
    );

    renderPromptHistory();

}


// Display prompts
function renderPromptHistory() {

    const history = getPromptHistory();

    const historyList =
        document.getElementById("history-list");

    const dashboardList =
        document.getElementById("dashboard-history");

    const count =
        document.getElementById("history-count");

    const searchInput =
        document.getElementById("history-search");

    if (!historyList) return;

    if (count) {
        count.textContent = history.length;
    }

    const searchTerm = searchInput
        ? searchInput.value.toLowerCase().trim()
        : "";

    const filtered = history.filter(item =>
        item.title.toLowerCase().includes(searchTerm) ||
        item.prompt.toLowerCase().includes(searchTerm) ||
        item.type.toLowerCase().includes(searchTerm)
    );

    // Dashboard: show latest three prompts
    if (dashboardList) {

        dashboardList.replaceChildren();

        if (history.length === 0) {

            const empty = document.createElement("p");
            empty.className = "empty-history";
            empty.textContent =
                "No recent prompts. Start creating one!";

            dashboardList.appendChild(empty);

        } else {

            history.slice(0, 3).forEach(item => {
                dashboardList.appendChild(
                    createHistoryCard(item, false)
                );
            });

        }
    }

    // History page
    historyList.replaceChildren();

    if (filtered.length === 0) {

        const empty = document.createElement("div");
        empty.className = "history-empty";

        const heading = document.createElement("h3");
        heading.textContent = history.length
            ? "No matching prompts found"
            : "No prompts saved yet";

        const description = document.createElement("p");
        description.textContent = history.length
            ? "Try a different search."
            : "Your prompts will appear here automatically.";

        empty.append(heading, description);
        historyList.appendChild(empty);

        return;
    }

    filtered.forEach(item => {
        historyList.appendChild(
            createHistoryCard(item, true)
        );
    });

}


// Create a prompt card safely
function createHistoryCard(item, fullView) {

    const card = document.createElement("article");
    card.className = "history-card";

    const header = document.createElement("div");
    header.className = "history-card-header";

    const information = document.createElement("div");

    const title = document.createElement("h3");
    title.textContent = item.title;

    const metadata = document.createElement("p");
    metadata.className = "history-meta";

    const date = new Date(item.date);

    metadata.textContent =
        item.type + " • " +
        item.category + " • " +
        date.toLocaleString();

    information.append(title, metadata);

    const tag = document.createElement("span");
    tag.className = "history-tag";
    tag.textContent = item.type;

    header.append(information, tag);

    const preview = document.createElement("p");
    preview.className = "history-preview";
    preview.textContent = item.prompt;

    card.append(header, preview);

    if (fullView) {

        const actions = document.createElement("div");
        actions.className = "history-actions";

        const viewButton = document.createElement("button");
        viewButton.textContent = "View Prompt";
        viewButton.className = "history-action-btn";

        viewButton.onclick = () => {
            const details = card.querySelector("pre");

            if (details) {
                details.hidden = !details.hidden;
                viewButton.textContent = details.hidden
                    ? "View Prompt"
                    : "Hide Prompt";
            }
        };

        const copyButton = document.createElement("button");
        copyButton.textContent = "Copy";
        copyButton.className = "history-action-btn";

        copyButton.onclick = async () => {
            try {
                await navigator.clipboard.writeText(item.prompt);
                alert("Prompt copied successfully!");
            } catch (error) {
                alert("Unable to copy this prompt.");
            }
        };

        const deleteButton = document.createElement("button");
        deleteButton.textContent = "Delete";
        deleteButton.className = "history-delete-btn";

        deleteButton.onclick = () => {
            deletePrompt(item.id);
        };

        actions.append(
            viewButton,
            copyButton,
            deleteButton
        );

        const details = document.createElement("pre");
        details.textContent = item.prompt;
        details.hidden = true;
        details.className = "history-full-prompt";

        card.append(details, actions);
    }

    return card;

}


// Delete one prompt
function deletePrompt(id) {

    const confirmed = confirm(
        "Are you sure you want to delete this prompt?"
    );

    if (!confirmed) return;

    const updated = getPromptHistory().filter(
        item => item.id !== id
    );

    localStorage.setItem(
        HISTORY_KEY,
        JSON.stringify(updated)
    );

    renderPromptHistory();

}


// Clear all history
function clearPromptHistory() {

    const history = getPromptHistory();

    if (history.length === 0) {
        alert("Your history is already empty.");
        return;
    }

    const confirmed = confirm(
        "Are you sure you want to delete all saved prompts?"
    );

    if (!confirmed) return;

    localStorage.removeItem(HISTORY_KEY);

    renderPromptHistory();

}


// Load history when application starts
document.addEventListener("DOMContentLoaded", () => {
    renderPromptHistory();
});
