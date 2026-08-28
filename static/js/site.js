const storageKey = "ungdomsøen-rundtur-svar";
const tourCodeStorageKey = "ungdomsøen-rundtur-turkode";

const textareas = Array.from(document.querySelectorAll("[data-question]"));
const actions = Array.from(document.querySelectorAll("[data-action]"));
const tourCodeInput = document.querySelector("[data-tour-code]");
const groupStatus = document.querySelector("[data-group-status]");
const supabaseConfig = window.SUPABASE_CONFIG || {};

let answersByQuestion = {};
let channel = null;

const supabaseClient =
  supabaseConfig.url &&
  supabaseConfig.anonKey &&
  !supabaseConfig.url.includes("your-project") &&
  !supabaseConfig.anonKey.includes("your-anon-key") &&
  window.supabase
    ? window.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey)
    : null;

const readDrafts = () => {
  try {
    return JSON.parse(window.localStorage.getItem(storageKey) || "{}");
  } catch {
    return {};
  }
};

const writeDrafts = (answers) => {
  window.localStorage.setItem(storageKey, JSON.stringify(answers));
};

const readTourCode = () => window.localStorage.getItem(tourCodeStorageKey) || "";

const writeTourCode = (value) => {
  if (value) {
    window.localStorage.setItem(tourCodeStorageKey, value);
    return;
  }

  window.localStorage.removeItem(tourCodeStorageKey);
};

const normalizeTourCode = (value) =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9æøå-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const formatDate = (value) =>
  new Intl.DateTimeFormat("da-DK", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit"
  }).format(new Date(value));

const setGroupStatus = (message) => {
  if (groupStatus) {
    groupStatus.textContent = message;
  }
};

const renderAnswersForQuestion = (questionKey) => {
  const list = document.querySelector(`[data-answer-list="${questionKey}"]`);
  const count = document.querySelector(`[data-answer-count="${questionKey}"]`);
  const answers = answersByQuestion[questionKey] || [];

  if (!list || !count) {
    return;
  }

  count.textContent = `${answers.length} svar`;

  if (answers.length === 0) {
    list.innerHTML = '<p class="shared-empty">Ingen delte svar endnu.</p>';
    return;
  }

  list.innerHTML = answers
    .map(
      (answer) => `
        <article class="shared-answer">
          <p>${escapeHtml(answer.answer_text)}</p>
          <p class="shared-answer-time">Delt ${formatDate(answer.created_at)}</p>
        </article>
      `
    )
    .join("");
};

const renderAllAnswers = () => {
  textareas.forEach((textarea) => renderAnswersForQuestion(textarea.dataset.question));
};

const escapeHtml = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const setQuestionStatus = (questionKey, message) => {
  const node = document.querySelector(`[data-question-status="${questionKey}"]`);
  if (node) {
    node.textContent = message;
  }
};

const hydrateDrafts = () => {
  const answers = readDrafts();
  textareas.forEach((textarea) => {
    textarea.value = answers[textarea.dataset.question] || "";
  });
};

const hydrateTourCode = () => {
  if (tourCodeInput) {
    tourCodeInput.value = readTourCode();
  }
};

const downloadDrafts = () => {
  const answers = readDrafts();
  const sections = textareas.map((textarea) => {
    const label = textarea.dataset.questionLabel || textarea.dataset.question;
    const value = answers[textarea.dataset.question] || "";
    return `${label}\n${value || "Ingen svar endnu."}`;
  });

  const blob = new Blob([sections.join("\n\n---\n\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "ungdomsøen-rundtur-svar.txt";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const resetDrafts = () => {
  window.localStorage.removeItem(storageKey);
  textareas.forEach((textarea) => {
    textarea.value = "";
    setQuestionStatus(textarea.dataset.question, "Lokalt svar slettet. Del igen, hvis du vil sende et nyt svar til gruppen.");
  });
};

const disconnectRealtime = async () => {
  if (!channel || !supabaseClient) {
    return;
  }

  await supabaseClient.removeChannel(channel);
  channel = null;
};

const rebuildAnswerMap = (rows) => {
  answersByQuestion = {};
  rows.forEach((row) => {
    if (!answersByQuestion[row.question_key]) {
      answersByQuestion[row.question_key] = [];
    }

    answersByQuestion[row.question_key].push(row);
  });
};

const loadSharedAnswers = async () => {
  const tourCode = readTourCode();

  if (!tourCode) {
    answersByQuestion = {};
    renderAllAnswers();
    setGroupStatus("Vælg en turkode, så gruppen kan se de samme svar.");
    return;
  }

  if (!supabaseClient) {
    answersByQuestion = {};
    renderAllAnswers();
    setGroupStatus("Supabase er ikke sat op endnu. Tilføj projektets URL og anon key i js/supabase-config.js.");
    return;
  }

  setGroupStatus(`Forbundet til turkoden ${tourCode}. Henter gruppens svar...`);

  const { data, error } = await supabaseClient
    .from("answers")
    .select("id, question_key, answer_text, created_at")
    .eq("tour_code", tourCode)
    .order("created_at", { ascending: true });

  if (error) {
    answersByQuestion = {};
    renderAllAnswers();
    setGroupStatus("Kunne ikke hente gruppens svar endnu. Tjek Supabase-opsætningen.");
    return;
  }

  rebuildAnswerMap(data || []);
  renderAllAnswers();
  setGroupStatus(`Forbundet til turkoden ${tourCode}. Delte svar opdateres live.`);
};

const connectRealtime = async () => {
  await disconnectRealtime();

  const tourCode = readTourCode();
  if (!supabaseClient || !tourCode) {
    return;
  }

  channel = supabaseClient
    .channel(`answers-${tourCode}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "answers",
        filter: `tour_code=eq.${tourCode}`
      },
      () => {
        loadSharedAnswers();
      }
    )
    .subscribe();
};

const saveTourCode = async () => {
  if (!tourCodeInput) {
    return;
  }

  const normalized = normalizeTourCode(tourCodeInput.value);
  if (!normalized) {
    setGroupStatus("Skriv en gyldig turkode først.");
    return;
  }

  tourCodeInput.value = normalized;
  writeTourCode(normalized);
  await loadSharedAnswers();
  await connectRealtime();
};

const clearTourCode = async () => {
  writeTourCode("");
  if (tourCodeInput) {
    tourCodeInput.value = "";
  }
  await disconnectRealtime();
  await loadSharedAnswers();
};

const shareAnswer = async (questionKey) => {
  const textarea = document.querySelector(`[data-question="${questionKey}"]`);
  const tourCode = readTourCode();

  if (!textarea) {
    return;
  }

  const answerText = textarea.value.trim();
  if (!tourCode) {
    setQuestionStatus(questionKey, "Vælg først en turkode, før du deler svaret.");
    return;
  }

  if (!supabaseClient) {
    setQuestionStatus(questionKey, "Supabase er ikke sat op endnu. Deling er midlertidigt slået fra.");
    return;
  }

  if (!answerText) {
    setQuestionStatus(questionKey, "Skriv et svar først.");
    return;
  }

  setQuestionStatus(questionKey, "Deler med gruppen...");

  const { error } = await supabaseClient.from("answers").insert({
    tour_code: tourCode,
    question_key: questionKey,
    question_label: textarea.dataset.questionLabel,
    answer_text: answerText
  });

  if (error) {
    setQuestionStatus(questionKey, "Kunne ikke dele svaret. Tjek Supabase-opsætningen og prøv igen.");
    return;
  }

  setQuestionStatus(questionKey, "Delt med gruppen.");
};

hydrateDrafts();
hydrateTourCode();
loadSharedAnswers();
connectRealtime();

textareas.forEach((textarea) => {
  textarea.addEventListener("input", (event) => {
    const drafts = readDrafts();
    drafts[event.currentTarget.dataset.question] = event.currentTarget.value;
    writeDrafts(drafts);
    setQuestionStatus(event.currentTarget.dataset.question, "Kladde gemt på denne enhed.");
  });
});

actions.forEach((action) => {
  action.addEventListener("click", async () => {
    if (action.dataset.action === "download") {
      downloadDrafts();
      return;
    }

    if (action.dataset.action === "reset") {
      const confirmed = window.confirm("Vil du slette alle lokale kladder på denne enhed?");
      if (confirmed) {
        resetDrafts();
      }
      return;
    }

    if (action.dataset.action === "save-tour-code") {
      await saveTourCode();
      return;
    }

    if (action.dataset.action === "clear-tour-code") {
      await clearTourCode();
      return;
    }

    if (action.dataset.action === "share-answer") {
      await shareAnswer(action.dataset.questionTarget);
    }
  });
});
