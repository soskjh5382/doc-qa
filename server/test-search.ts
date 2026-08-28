// ============================================================
// test-search.ts
// 문서를 넣고, 질문했을 때 "관련된 조각"을 잘 찾는지 확인.
// ============================================================

import { addDocument, search } from "./store.js";

// 테스트용 가짜 회사 규정 문서 (문단들이 빈 줄로 구분됨)
const document = `
연차 휴가는 입사 1년 후부터 15일이 주어집니다. 3년마다 1일씩 추가됩니다.

급여는 매월 25일에 지급됩니다. 4대 보험이 공제된 후 입금됩니다.

출퇴근 시간은 오전 9시부터 오후 6시까지입니다. 유연근무제를 신청할 수 있습니다.

점심 식대는 회사에서 월 15만원을 지원합니다. 사내 식당도 이용 가능합니다.
`;

async function main() {
    // 1. 문서를 저장 (조각내고 임베딩)
    const count = await addDocument(document);
    console.log(`문서를 ${count}개 조각으로 저장했습니다.\n`);

    // 2. 질문해보기 (문서에 없는 단어로 물어봐서 "의미 검색"을 테스트)
    const question = "쉬는 날은 며칠 받나요?"; // "연차"란 단어를 안 씀!
    console.log(`질문: ${question}\n`);

    const results = await search(question, 2); // 상위 2개 조각

    console.log("가장 관련 있는 조각들:");
    results.forEach((text, i) => {
        console.log(`\n[${i + 1}] ${text}`);
    });
}

main();