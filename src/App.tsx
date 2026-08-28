// ============================================================
// App.tsx — 문서 Q&A (RAG)
// 문서(텍스트/PDF)를 넣어 저장 → 그 내용으로 질문에 답변.
// ============================================================

import { useState } from "react";

// 색상 토큰 (한 곳에서 관리)
const C = {
  bg: "#0d0f14",          // 배경 (깊은 잉크)
  card: "#151922",        // 카드
  cardBorder: "#232936",  // 카드 테두리
  text: "#e8eaed",        // 본문
  dim: "#8b93a3",         // 보조 텍스트
  faint: "#5a6272",       // 더 흐린
  accent: "#e0a458",      // 호박색 (문서/종이 느낌) — 유일한 강조색
  accentDim: "#3a2f1f",   // 호박 어두운 배경
  ok: "#5fb87a",          // 성공
  err: "#e07a7a",         // 에러
  field: "#0f1218",       // 입력창 배경
};

export default function App() {
  const [docText, setDocText] = useState("");
  const [uploaded, setUploaded] = useState(false);
  const [savedInfo, setSavedInfo] = useState("");   // 저장 결과 안내
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<string[]>([]); // 출처 조각들
  const [uploading, setUploading] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");

  // 텍스트 저장
  async function uploadDoc() {
    if (!docText.trim()) {
      setError("문서를 입력하세요.");
      return;
    }
    setError("");
    setUploading(true);
    setUploaded(false);
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: docText }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else {
        setUploaded(true);
        setSavedInfo(`${data.count}개 구절로 정리했습니다.`);
      }
    } catch {
      setError("서버에 연결할 수 없습니다.");
    } finally {
      setUploading(false);
    }
  }

  // PDF 저장
  async function uploadPdf(file: File) {
    setError("");
    setUploading(true);
    setUploaded(false);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload-pdf", { method: "POST", body: formData });
      const data = await res.json();
      if (data.error) setError(data.error);
      else {
        setUploaded(true);
        setDocText(`📄 ${file.name}`);
        setSavedInfo(`${data.count}개 구절로 정리했습니다.`);
      }
    } catch {
      setError("PDF 업로드에 실패했습니다.");
    } finally {
      setUploading(false);
    }
  }

  // 질문
  async function ask() {
    if (!question.trim()) {
      setError("질문을 입력하세요.");
      return;
    }
    setError("");
    setAsking(true);
    setAnswer("");
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const data = await res.json();
      if (data.error) setError(data.error);
      else {
        setAnswer(data.answer);
        setSources(data.sources || []); // 출처 저장
      }
    } catch {
      setError("서버에 연결할 수 없습니다.");
    } finally {
      setAsking(false);
    }
  }

  return (
      <div
          style={{
            minHeight: "100vh",
            background: C.bg,
            color: C.text,
            fontFamily: "'Inter', system-ui, sans-serif",
            padding: "56px 20px 80px",
            boxSizing: "border-box",
          }}
      >
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          {/* ── 헤더 ── */}
          <header style={{ marginBottom: 40 }}>
            <div
                style={{
                  display: "inline-block",
                  fontSize: 11,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  color: C.accent,
                  borderBottom: `1px solid ${C.accentDim}`,
                  paddingBottom: 6,
                  marginBottom: 16,
                }}
            >
              Document Q&A
            </div>
            <h1
                style={{
                  fontSize: 32,
                  fontWeight: 600,
                  margin: 0,
                  lineHeight: 1.2,
                  letterSpacing: "-0.02em",
                }}
            >
              문서에게 직접 물어보세요
            </h1>
            <p style={{ color: C.dim, fontSize: 15, marginTop: 12, lineHeight: 1.6 }}>
              문서를 넣으면 그 내용만 근거로 답합니다.
              <br />
              문서에 없는 것은 지어내지 않고 없다고 말합니다.
            </p>
          </header>

          {/* ── 1단계: 문서 넣기 ── */}
          <section style={cardStyle()}>
            <StepLabel n="1" title="문서 넣기" done={uploaded} />

            <textarea
                value={docText}
                onChange={(e) => {
                  setDocText(e.target.value);
                  setUploaded(false);
                  setSavedInfo("");
                }}
                placeholder="문서를 붙여넣으세요. 문단은 빈 줄로 나누면 더 정확합니다."
                spellCheck={false}
                style={{
                  width: "100%",
                  minHeight: 150,
                  background: C.field,
                  color: C.text,
                  border: `1px solid ${C.cardBorder}`,
                  borderRadius: 10,
                  padding: 16,
                  fontSize: 14,
                  lineHeight: 1.6,
                  fontFamily: "inherit",
                  resize: "vertical",
                  outline: "none",
                  boxSizing: "border-box",
                  marginTop: 16,
                }}
            />

            {/* 액션 줄 */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14 }}>
              <button onClick={uploadDoc} disabled={uploading} style={primaryBtn(uploading)}>
                {uploading ? "정리하는 중…" : "텍스트 저장"}
              </button>

              <span style={{ color: C.faint, fontSize: 13 }}>또는</span>

              <label style={ghostBtn(uploading)}>
                PDF 열기
                <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadPdf(f);
                    }}
                    style={{ display: "none" }}
                />
              </label>
            </div>

            {uploaded && (
                <div
                    style={{
                      marginTop: 16,
                      padding: "10px 14px",
                      background: C.accentDim,
                      border: `1px solid ${C.accent}33`,
                      borderRadius: 8,
                      fontSize: 13,
                      color: C.accent,
                    }}
                >
                  ✓ 저장 완료 · {savedInfo}
                </div>
            )}
          </section>

          {/* ── 2단계: 질문 ── */}
          <section
              style={{
                ...cardStyle(),
                marginTop: 20,
                opacity: uploaded ? 1 : 0.45,
                pointerEvents: uploaded ? "auto" : "none",
                transition: "opacity 0.25s",
              }}
          >
            <StepLabel n="2" title="질문하기" />

            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && uploaded && ask()}
                  placeholder="문서에 대해 무엇이든 물어보세요"
                  disabled={!uploaded}
                  style={{
                    flex: 1,
                    background: C.field,
                    color: C.text,
                    border: `1px solid ${C.cardBorder}`,
                    borderRadius: 10,
                    padding: "13px 16px",
                    fontSize: 15,
                    fontFamily: "inherit",
                    outline: "none",
                  }}
              />
              <button onClick={ask} disabled={!uploaded || asking} style={primaryBtn(!uploaded || asking)}>
                {asking ? "…" : "묻기"}
              </button>
            </div>

            {/* 답변 */}
            {answer && (
                <div style={{ marginTop: 20 }}>
                  <div
                      style={{
                        fontSize: 11,
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: C.faint,
                        marginBottom: 10,
                      }}
                  >
                    답변
                  </div>
                  <div
                      style={{
                        background: C.field,
                        border: `1px solid ${C.cardBorder}`,
                        borderLeft: `3px solid ${C.accent}`,
                        borderRadius: 8,
                        padding: 18,
                        fontSize: 15,
                        lineHeight: 1.75,
                        color: C.text,
                        whiteSpace: "pre-wrap",
                      }}
                  >
                    {answer}
                  </div>
                </div>
            )}

            {/* 출처 표시 */}
            {sources.length > 0 && (
                <details style={{ marginTop: 14 }}>
                  <summary
                      style={{
                        fontSize: 12,
                        color: C.faint,
                        cursor: "pointer",
                        letterSpacing: "0.05em",
                        userSelect: "none",
                      }}
                  >
                    📎 참고한 문서 구절 {sources.length}개 보기
                  </summary>
                  <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                    {sources.map((src, i) => (
                        <div
                            key={i}
                            style={{
                              background: C.bg,
                              border: `1px solid ${C.cardBorder}`,
                              borderRadius: 6,
                              padding: "10px 12px",
                              fontSize: 13,
                              lineHeight: 1.6,
                              color: C.dim,
                            }}
                        >
                          <span style={{ color: C.accent, fontSize: 11 }}>자료 {i + 1}</span>
                          <div style={{ marginTop: 4 }}>{src}</div>
                        </div>
                    ))}
                  </div>
                </details>
            )}
          </section>

          {/* 에러 */}
          {error && (
              <div style={{ color: C.err, fontSize: 13, marginTop: 16, textAlign: "center" }}>
                {error}
              </div>
          )}
        </div>
      </div>
  );

  // 카드 스타일
  function cardStyle(): React.CSSProperties {
    return {
      background: C.card,
      border: `1px solid ${C.cardBorder}`,
      borderRadius: 16,
      padding: 24,
    };
  }

  // 주 버튼
  function primaryBtn(disabled: boolean): React.CSSProperties {
    return {
      background: disabled ? "#2a3040" : C.accent,
      color: disabled ? C.faint : "#1a1206",
      border: "none",
      borderRadius: 10,
      padding: "12px 22px",
      fontSize: 14,
      fontWeight: 600,
      fontFamily: "inherit",
      cursor: disabled ? "default" : "pointer",
      whiteSpace: "nowrap",
      transition: "background 0.15s",
    };
  }

  // 외곽선 버튼 (PDF)
  function ghostBtn(disabled: boolean): React.CSSProperties {
    return {
      background: "transparent",
      color: disabled ? C.faint : C.text,
      border: `1px solid ${C.cardBorder}`,
      borderRadius: 10,
      padding: "12px 20px",
      fontSize: 14,
      fontWeight: 500,
      fontFamily: "inherit",
      cursor: disabled ? "default" : "pointer",
      display: "inline-block",
      whiteSpace: "nowrap",
    };
  }
}

// 단계 라벨 (숫자 + 제목)
function StepLabel({ n, title, done }: { n: string; title: string; done?: boolean }) {
  return (
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span
          style={{
            width: 26,
            height: 26,
            borderRadius: "50%",
            background: done ? "#5fb87a" : "#e0a458",
            color: "#1a1206",
            fontSize: 13,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
      >
        {done ? "✓" : n}
      </span>
        <span style={{ fontSize: 16, fontWeight: 600 }}>{title}</span>
      </div>
  );
}