const storageKey = "ungdomsoen-rundtur-svar";

const readAnswers = () => {
  try {
    return JSON.parse(window.localStorage.getItem(storageKey) || "{}");
  } catch {
    return {};
  }
};

const writeAnswers = (answers) => {
  window.localStorage.setItem(storageKey, JSON.stringify(answers));
};

const textareas = Array.from(document.querySelectorAll("[data-question]"));
const actions = Array.from(document.querySelectorAll("[data-action]"));

const hydrate = () => {
  const answers = readAnswers();
  textareas.forEach((textarea) => {
    textarea.value = answers[textarea.dataset.question] || "";
  });
};

const downloadAnswers = () => {
  const answers = readAnswers();
  const sections = textareas.map((textarea) => {
    const label = textarea.closest("label")?.querySelector("span")?.textContent?.trim() || textarea.dataset.question;
    const value = answers[textarea.dataset.question] || "";
    return `${label}\n${value || "Ingen svar endnu."}`;
  });

  const blob = new Blob([sections.join("\n\n---\n\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "ungdomsoen-rundtur-svar.txt";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const resetAnswers = () => {
  window.localStorage.removeItem(storageKey);
  textareas.forEach((textarea) => {
    textarea.value = "";
  });
};

hydrate();

textareas.forEach((textarea) => {
  textarea.addEventListener("input", (event) => {
    const answers = readAnswers();
    answers[event.currentTarget.dataset.question] = event.currentTarget.value;
    writeAnswers(answers);
  });
});

actions.forEach((action) => {
  action.addEventListener("click", () => {
    if (action.dataset.action === "download") {
      downloadAnswers();
      return;
    }

    if (action.dataset.action === "reset") {
      const confirmed = window.confirm("Vil du slette alle gemte svar paa denne enhed?");
      if (confirmed) {
        resetAnswers();
      }
    }
  });
});
