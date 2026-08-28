// ============================================================
// server/store.ts
// 역할: 문서를 조각내 저장하고, 질문과 관련된 조각을 검색한다.
//   이게 RAG의 "검색(Retrieval)" 부분.
//
// 저장 방식: 지금은 간단하게 "메모리 배열"에 저장한다.
//   (서버를 끄면 사라짐. 진짜 서비스는 벡터DB를 쓰지만,
//    원리를 익히려면 이게 제일 명확하다.)
// ============================================================

import { embed } from "./embedding.js";

// ------------------------------------------------------------
// 저장되는 조각 하나의 형태.
//   text   : 원본 글 조각
//   vector : 그 조각의 임베딩(숫자 배열)
// ------------------------------------------------------------
type Chunk = {
    text: string;
    vector: number[];
};

// 조각들을 담아두는 메모리 저장소 (서버 켜져있는 동안 유지)
let store: Chunk[] = [];

// ------------------------------------------------------------
// 두 벡터가 얼마나 비슷한지 (코사인 유사도). 1에 가까울수록 비슷.
// test-embed.ts에서 썼던 것과 같은 함수.
// ------------------------------------------------------------
function similarity(a: number[], b: number[]): number {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ------------------------------------------------------------
// 긴 글을 적당한 크기의 조각(chunk)으로 쪼갠다.
//   1) 먼저 문단(빈 줄)으로 나눔
//   2) 그래도 너무 긴 조각은 글자 수 기준으로 다시 자름
//   왜: 조각이 너무 크면 "관련 부분만 콕 집기"가 안 된다.
// ------------------------------------------------------------
function splitIntoChunks(text: string): string[] {
    const MAX_CHARS = 300; // 조각 하나의 최대 글자 수 (조절 가능)

    // 1단계: 문단(빈 줄)으로 1차 분리
    const paragraphs = text
        .split(/\n\s*\n/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

    const chunks: string[] = [];

    // 2단계: 각 문단이 너무 길면 더 잘게 자름
    for (const para of paragraphs) {
        if (para.length <= MAX_CHARS) {
            chunks.push(para); // 적당한 크기면 그대로
        } else {
            // 너무 길면: 문장 단위로 나눠서 MAX_CHARS 넘지 않게 묶음
            const sentences = para.split(/(?<=[.!?。\n])\s*/); // 문장부호/줄바꿈 기준
            let current = "";
            for (const sentence of sentences) {
                if ((current + sentence).length > MAX_CHARS && current) {
                    chunks.push(current.trim());
                    current = sentence;
                } else {
                    current += sentence;
                }
            }
            if (current.trim()) chunks.push(current.trim());
        }
    }

    return chunks.filter((c) => c.length > 0);
}

// ------------------------------------------------------------
// 문서를 받아서 조각내고, 각 조각을 임베딩해 저장한다.
// (RAG의 "준비 단계")
// ------------------------------------------------------------
export async function addDocument(text: string): Promise<number> {
    store = []; // 새 문서를 넣을 때 기존 저장소를 비운다 (단순하게)

    const chunks = splitIntoChunks(text);

    // 각 조각을 임베딩해서 저장
    for (const chunk of chunks) {
        const vector = await embed(chunk);   // 조각을 숫자로
        store.push({ text: chunk, vector }); // 조각 + 숫자를 저장
    }

    return store.length; // 저장된 조각 개수를 돌려줌
}

// ------------------------------------------------------------
// 질문을 받아서, 관련된 조각들을 찾아 돌려준다.
// (RAG의 "검색 단계")
//   topK: 상위 몇 개 조각을 가져올지 (기본 3개)
// ------------------------------------------------------------
export async function search(question: string, topK = 3): Promise<string[]> {
    if (store.length === 0) return [];

    // 질문도 임베딩 (같은 방식으로 숫자화해야 비교 가능)
    const questionVector = await embed(question);

    // 모든 조각에 대해 "질문과의 유사도"를 계산
    const scored = store.map((chunk) => ({
        text: chunk.text,
        score: similarity(questionVector, chunk.vector),
    }));

    // 유사도 높은 순으로 정렬
    scored.sort((a, b) => b.score - a.score);

    // 상위 topK개의 텍스트만 돌려줌
    return scored.slice(0, topK).map((s) => s.text);
}