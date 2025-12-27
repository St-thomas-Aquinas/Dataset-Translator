async function translateText() {
  const text = document.getElementById("inputText").value.trim();
  const target = document.getElementById("targetLang").value;
  const source = document.getElementById("sourceLang").value; // New
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
    const chunkTranslation = await translateWithNLLB(chunks[i], source, target);
    translatedText += chunkTranslation + "\n\n";
  }

  output.value = translatedText.trim();
  loading.style.display = "none";
  btn.disabled = false;
}

async function translateDocument() {
  const file = document.getElementById("fileInput").files[0];
  const target = document.getElementById("targetLang").value;
  const source = document.getElementById("sourceLang").value; // New
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
    const chunkTranslation = await translateWithNLLB(chunks[i], source, target);
    translatedText += chunkTranslation + "\n\n";
  }

  status.value = translatedText.trim();
  downloadFile(translatedText, file.name);

  loading.style.display = "none";
  btn.disabled = false;
}

/* ---------- API ---------- */
async function translateWithNLLB(text, sourceLang, targetLang) {
  try {
    const response = await fetch(HF_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        source_lang: sourceLang,  // use selected source
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
