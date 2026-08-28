// ============================================================
// test-embed.ts
// 임베딩이 실제로 "의미가 비슷하면 숫자도 가까운지" 눈으로 확인하는 테스트.
// ============================================================

import { embed } from "./embedding.js";

// 두 벡터(숫자 배열)가 얼마나 비슷한지 계산하는 함수.
// "코사인 유사도"라는 방법. 결과는 -1~1, 1에 가까울수록 비슷함.
function similarity(a: number[], b: number[]): number {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];       // 두 벡터를 곱해서 더함
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function main() {
    // 세 문장을 임베딩. 앞 둘은 뜻이 비슷하고, 셋째는 완전 다름.
    const a = await embed("연차 휴가는 며칠인가요?");
    const b = await embed("휴가 규정이 어떻게 되나요?");   // a와 비슷한 뜻
    const c = await embed("점심 메뉴로 피자가 좋아요");      // 완전 다른 뜻

    console.log("숫자 몇 개로 바뀌나:", a.length, "개");
    console.log();
    console.log("[연차] vs [휴가규정] 유사도:", similarity(a, b).toFixed(3));
    console.log("[연차] vs [피자]     유사도:", similarity(a, c).toFixed(3));
}

main();