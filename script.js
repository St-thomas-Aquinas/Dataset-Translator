// ⚠️ UPDATE THIS: Point to your actual FastAPI backend URL 
const API_BASE_URL = "https://st-thomas-of-aquinas-no-language-left-behind-api.hf.space"; 

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

/* ---------- Smart Sentence-based Chunking ---------- */
function chunkBySentences(text, maxLength = 500, overlap = 50) {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks = [];
  let current = "";

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i].trim();
    if ((current + " " + sentence).length > maxLength) {
      if (current) chunks.push(current.trim());
      const overlapText = current.slice(-overlap);
      current = overlapText + " " + sentence;
    } else {
      current += (current ? " " : "") + sentence;
    }
  }
  if (current) chunks.push(current.trim());
  return chunks;
}

/* ---------- Batch Translation Helper ---------- */
async function translateTextArray(texts, sourceLang, targetLang, onProgress) {
  const batchSize = 15; // Process 15 items at a time to prevent GPU OOM
  const results = [];
  const totalBatches = Math.ceil(texts.length / batchSize);
  
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    if (onProgress) {
      onProgress(Math.floor(i / batchSize) + 1, totalBatches);
    }
    
    const response = await fetch(`${API_BASE_URL}/translate_batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        texts: batch,
        source_lang: sourceLang,
        target_lang: targetLang
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    if (data.translations && Array.isArray(data.translations)) {
      results.push(...data.translations);
    } else {
      throw new Error("Unexpected response format from server");
    }
  }
  
  return results;
}

/* ---------- Parse CSV Helper ---------- */
function parseCSVFile(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results),
      error: (err) => reject(err)
    });
  });
}

/* ---------- Text Translation ---------- */
async function translateText() {
  const text = document.getElementById("inputText").value.trim();
  const sourceLang = document.getElementById("sourceLang").value;
  const targetLang = document.getElementById("targetLang").value;
  const output = document.getElementById("outputText");
  const loading = document.getElementById("textLoading");
  const btn = document.getElementById("translateTextBtn");

  if (!text) {
    output.value = "⚠️ Please enter text.";
    return;
  }

  loading.style.display = "inline-block";
  btn.disabled = true;
  output.value = "Preparing chunks...";

  const chunks = chunkBySentences(text, 500, 50);

  try {
    const translatedChunks = await translateTextArray(chunks, sourceLang, targetLang, (current, total) => {
      output.value = `Translating batch ${current} of ${total}...`;
    });

    output.value = translatedChunks.join("\n\n").trim();
  } catch (e) {
    console.error(e);
    output.value = `⚠️ API error: ${e.message}. Ensure backend is running at ${API_BASE_URL}`;
  } finally {
    loading.style.display = "none";
    btn.disabled = false;
  }
}

/* ---------- Document Translation ---------- */
async function translateDocument() {
  const file = document.getElementById("fileInput").files[0];
  const sourceLang = document.getElementById("sourceLang").value;
  const targetLang = document.getElementById("targetLang").value;
  const status = document.getElementById("fileStatus");
  const loading = document.getElementById("docLoading");
  const btn = document.getElementById("translateDocBtn");

  if (!file) {
    status.value = "⚠️ Please select a document.";
    return;
  }

  loading.style.display = "inline-block";
  btn.disabled = true;
  status.value = "Reading document...";

  try {
    // --- CSV HANDLING ---
    if (file.name.toLowerCase().endsWith('.csv')) {
      const results = await parseCSVFile(file);
      const data = results.data;
      
      // Collect all non-empty text cells with their coordinates
      const tasks = [];
      for (let r = 0; r < data.length; r++) {
        for (const key in data[r]) {
          const val = String(data[r][key]).trim();
          if (val) {
            tasks.push({ row: r, key: key, text: val });
          }
        }
      }
      
      if (tasks.length === 0) {
        status.value = "⚠️ No text found in CSV.";
        loading.style.display = "none";
        btn.disabled = false;
        return;
      }
      
      const textsToTranslate = tasks.map(t => t.text);
      
      const translatedTexts = await translateTextArray(textsToTranslate, sourceLang, targetLang, (currentBatch, totalBatches) => {
        status.value = `Translating CSV cells: Batch ${currentBatch} of ${totalBatches}...`;
      });
      
      // Map translated text back to the exact original row/column
      for (let i = 0; i < tasks.length; i++) {
        data[tasks[i].row][tasks[i].key] = translatedTexts[i];
      }
      
      // Generate new CSV with quotes to preserve structure/newlines
      const newCsv = Papa.unparse(data, { quotes: true });
      status.value = "✅ Translation complete! Downloading...";
      downloadFile(newCsv, file.name);
      
    } 
    // --- TXT / PDF / DOCX HANDLING ---
    else {
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
        throw new Error("Unsupported file type. Please use .txt, .pdf, .docx, or .csv");
      }

      status.value = `Chunking document...`;
      const chunks = chunkBySentences(text, 500, 50);
      
      const translatedChunks = await translateTextArray(chunks, sourceLang, targetLang, (current, total) => {
        status.value = `Translating document batch ${current} of ${total}...`;
      });

      const translatedText = translatedChunks.join("\n\n").trim();
      status.value = translatedText;
      downloadFile(translatedText, file.name);
    }
  } catch (e) {
    console.error(e);
    status.value = `❌ Error: ${e.message}`;
  } finally {
    loading.style.display = "none";
    btn.disabled = false;
  }
}

/* ---------- Download Helper ---------- */
function downloadFile(text, originalName) {
  const isCsv = originalName.toLowerCase().endsWith('.csv');
  const ext = isCsv ? '.csv' : '.txt';
  const nameWithoutExt = originalName.replace(/\.\w+$/, "");
  
  const mimeType = isCsv ? "text/csv;charset=utf-8" : "text/plain;charset=utf-8";
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `translated_${nameWithoutExt}${ext}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ---------- Fullscreen ---------- */
function toggleFullscreen(id) {
  const el = document.getElementById(id);
  if (!document.fullscreenElement) {
    el.classList.add("fullscreen");
    if (el.requestFullscreen) el.requestFullscreen();
  } else {
    el.classList.remove("fullscreen");
    if (document.exitFullscreen) document.exitFullscreen();
  }
}
