const HF_API =
  "https://st-thomas-of-aquinas-no-language-left-behind-api.hf.space/translate";

const DEFAULT_SOURCE = "eng_Latn";

/* ---------- Tabs ---------- */
function showTab(tab) {
  const textCard = document.getElementById("textCard");
  const docCard = document.getElementById("docCard");
  const textTab = document.getElementById("textTab");
  const docTab = document.getElementById("docTab");

  if(tab === 'text') {
    textCard.style.display = 'block';
    docCard.style.display = 'none';
    textTab.classList.add('active');
    docTab.classList.remove('active');
  } else {
    textCard.style.display = 'none';
    docCard.style.display = 'block';
    textTab.classList.remove('active');
    docTab.classList.add('active');
  }
}

/* ---------- Chunking Function ---------- */
function chunkText(text, maxLength = 500) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    let end = start + maxLength;
    if (end < text.length) {
      const lastSpace = text.lastIndexOf(" ", end);
      if (lastSpace > start) end = lastSpace;
    }
    chunks.push(text.slice(start, end).trim());
    start = end;
  }
  return chunks;
}

/* ---------- Text Translation ---------- */
async function translateText() {
  const text = document.getElementById("inputText").value.trim();
  const target = document.getElementById("targetLang").value;
  const output = document.getElementById("outputText");
  const loading = document.getElementById("textLoading");
  const btn = document.getElementById("translateTextBtn");

  if (!text) {
    output.value = "⚠️ Please enter text.";
    return;
  }

  loading.style.display = "inline-block";
  btn.disabled = true;
  output.value = "";

  const chunks = chunkText(text, 500);
  let translatedText = "";

  for (let i = 0; i < chunks.length; i++) {
    const chunkTranslation = await translateWithNLLB(chunks[i], target);
    translatedText += chunkTranslation + "\n\n";
  }

  output.value = translatedText.trim();
  loading.style.display = "none";
  btn.disabled = false;
}

/* ---------- Document Translation ---------- */
async function translateDocument() {
  const file = document.getElementById("fileInput").files[0];
  const target = document.getElementById("targetLang").value;
  const status = document.getElementById("fileStatus");
  const loading = document.getElementById("docLoading");
  const btn = document.getElementById("translateDocBtn");

  if (!file) {
    status.value = "⚠️ Please select a document.";
    return;
  }

  loading.style.display = "inline-block";
  btn.disabled = true;
  status.value = "";

  let text = "";

  if (file.type === "text/plain") {
    text = await file.text();
  } else if (file.type === "application/pdf") {
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map(item => item.str).join(" ") + "\n";
    }
  } else if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const buffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    text = result.value;
  } else {
    status.value = "❌ Unsupported file type.";
    loading.style.display = "none";
    btn.disabled = false;
    return;
  }

  status.value = "🌍 Translating document...";

  const chunks = chunkText(text, 500);
  let translatedText = "";

  for (let i = 0; i < chunks.length; i++) {
    const chunkTranslation = await translateWithNLLB(chunks[i], target);
    translatedText += chunkTranslation + "\n\n";
  }

  status.value = translatedText.trim();
  downloadFile(translatedText, file.name);

  loading.style.display = "none";
  btn.disabled = false;
}

/* ---------- API ---------- */
async function translateWithNLLB(text, targetLang) {
  try {
    const response = await fetch(HF_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        source_lang: DEFAULT_SOURCE,
        target_lang: targetLang
      })
    });
    const data = await response.json();
    return data.translation || "❌ Translation failed.";
  } catch (e) {
    console.error(e);
    return "⚠️ API error.";
  }
}

/* ---------- Download ---------- */
function downloadFile(text, originalName) {
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "translated_" + originalName.replace(/\.\w+$/, ".txt");
  a.click();
  URL.revokeObjectURL(url);
}

/* ---------- Fullscreen ---------- */
function toggleFullscreen(id) {
  const el = document.getElementById(id);
  if (!document.fullscreenElement) {
    el.classList.add("fullscreen");
    el.requestFullscreen();
  } else {
    el.classList.remove("fullscreen");
    document.exitFullscreen();
  }
}
