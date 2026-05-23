import { generateId } from "@/lib/storage";

export interface KnowledgeDoc {
  id: string;
  title: string;
  content: string;
  uploadedAt: string;
  charCount: number;
}

const KNOWLEDGE_STORAGE_KEY = "examtouch_local_knowledge";

// Get list of all uploaded knowledge documents
export function getLocalKnowledgeDocs(): KnowledgeDoc[] {
  try {
    const stored = localStorage.getItem(KNOWLEDGE_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error("Failed to read local knowledge base:", e);
    return [];
  }
}

// Add a new document to the local knowledge base
export function addKnowledgeDoc(title: string, content: string): KnowledgeDoc | null {
  if (!content.trim()) return null;

  const docs = getLocalKnowledgeDocs();
  const newDoc: KnowledgeDoc = {
    id: generateId(),
    title: title.trim() || "Tài liệu không tên",
    content: content,
    uploadedAt: new Date().toISOString().split("T")[0],
    charCount: content.length
  };

  docs.push(newDoc);
  try {
    localStorage.setItem(KNOWLEDGE_STORAGE_KEY, JSON.stringify(docs));
    return newDoc;
  } catch (e) {
    console.error("Failed to save document (possibly quota exceeded):", e);
    return null;
  }
}

// Delete a document from the local knowledge base
export function deleteKnowledgeDoc(id: string): boolean {
  const docs = getLocalKnowledgeDocs();
  const filtered = docs.filter(d => d.id !== id);
  try {
    localStorage.setItem(KNOWLEDGE_STORAGE_KEY, JSON.stringify(filtered));
    return true;
  } catch (e) {
    console.error("Failed to delete document:", e);
    return false;
  }
}

// Perform simple keyword search to find relevant context (Local RAG)
export function searchKnowledgeBase(query: string, limit = 3): string {
  const docs = getLocalKnowledgeDocs();
  if (docs.length === 0 || !query.trim()) return "";

  // Split query into keywords
  const keywords = query.toLowerCase()
    .replace(/[^a-z0-9A-ZÀ-ỹ ]/g, '')
    .split(/\s+/)
    .filter(k => k.length > 2);

  if (keywords.length === 0) return "";

  interface ScoredChunk {
    docTitle: string;
    text: string;
    score: number;
  }

  const scoredChunks: ScoredChunk[] = [];

  docs.forEach(doc => {
    // Split document content into chunks of ~500 characters with 100 character overlap
    const chunkSize = 500;
    const overlap = 100;
    const text = doc.content;
    
    for (let i = 0; i < text.length; i += (chunkSize - overlap)) {
      const chunkText = text.slice(i, i + chunkSize);
      if (chunkText.length < 50) continue;

      let score = 0;
      const lowerChunk = chunkText.toLowerCase();

      // Simple keyword matching score
      keywords.forEach(keyword => {
        if (lowerChunk.includes(keyword)) {
          score += 1;
          // Exact match bonus
          const regex = new RegExp(`\\b${keyword}\\b`, 'g');
          const matches = lowerChunk.match(regex);
          if (matches) score += matches.length * 1.5;
        }
      });

      if (score > 0) {
        scoredChunks.push({
          docTitle: doc.title,
          text: chunkText.trim(),
          score: score
        });
      }
    }
  });

  // Sort by score descending and take top results
  const topChunks = scoredChunks
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  if (topChunks.length === 0) return "";

  // Format context block for the LLM
  return `\n=== TÀI LIỆU THAM KHẢO TỪ PHỤ HUYNH (LOCAL KNOWLEDGE BASE) ===\n` +
    topChunks.map((c, i) => `[Tài liệu ${i + 1}: "${c.docTitle}"]\n...${c.text}...\n`).join("\n") +
    `============================================================\n`;
}
