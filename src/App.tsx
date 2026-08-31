// ============================================================
// App.tsx — 문서 Q&A (RAG) + 대화 기억
// 문서(텍스트/PDF)를 넣어 저장 → 그 내용으로 이어지는 대화.
// ============================================================

import { useState } from "react";

const C = {
    bg: "#0d0f14",
    card: "#151922",
    cardBorder: "#232936",
    text: "#e8eaed",
    dim: "#8b93a3",
    faint: "#5a6272",
    accent: "#e0a458",
    accentDim: "#3a2f1f",
    ok: "#5fb87a",
    err: "#e07a7a",
    field: "#0f1218",
};

// 대화 메시지 하나의 형태
type Message = {
    role: "user" | "assistant";  // user=내 질문, assistant=AI 답변
    text: string;
    sources?: string[];          // 답변일 때만: 참고한 문서 구절
};

export default function App() {
    const [docText, setDocText] = useState("");
    const [uploaded, setUploaded] = useState(false);
    const [savedInfo, setSavedInfo] = useState("");
    const [question, setQuestion] = useState("");
    // 대화 기록 (질문/답변이 순서대로 쌓임)
    const [messages, setMessages] = useState<Message[]>([]);
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
        setMessages([]); // 새 문서 넣으면 이전 대화 초기화
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
        setMessages([]); // 새 문서 넣으면 이전 대화 초기화
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

    // 질문 (이전 대화 기록을 함께 보냄)
    async function ask() {
        if (!question.trim()) {
            setError("질문을 입력하세요.");
            return;
        }
        setError("");
        setAsking(true);

        const currentQuestion = question;
        setQuestion("");

        // 내 질문을 화면에 먼저 추가
        setMessages((prev) => [...prev, { role: "user", text: currentQuestion }]);

        try {
            // 이전 대화(history)를 함께 전송
            const history = messages.map((m) => ({ role: m.role, text: m.text }));

            const res = await fetch("/api/ask", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ question: currentQuestion, history }),
            });
            const data = await res.json();

            if (data.error) {
                setError(data.error);
            } else {
                setMessages((prev) => [
                    ...prev,
                    { role: "assistant", text: data.answer, sources: data.sources || [] },
                ]);
            }
        } catch {
            setError("서버에 연결할 수 없습니다.");
        } finally {
            setAsking(false);
        }
    }

    // 대화 초기화 (문서는 유지)
    function resetChat() {
        setMessages([]);
        setError("");
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
                {/* 헤더 */}
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
                    <h1 style={{ fontSize: 32, fontWeight: 600, margin: 0, lineHeight: 1.2, letterSpacing: "-0.02em" }}>
                        문서에게 직접 물어보세요
                    </h1>
                    <p style={{ color: C.dim, fontSize: 15, marginTop: 12, lineHeight: 1.6 }}>
                        문서를 넣으면 그 내용만 근거로 답합니다.
                        <br />
                        이어지는 질문도 맥락을 기억해 답합니다.
                    </p>
                </header>

                {/* 1단계: 문서 넣기 */}
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

                {/* 2단계: 대화 */}
                <section
                    style={{
                        ...cardStyle(),
                        marginTop: 20,
                        opacity: uploaded ? 1 : 0.45,
                        pointerEvents: uploaded ? "auto" : "none",
                        transition: "opacity 0.25s",
                    }}
                >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <StepLabel n="2" title="대화하기" />
                        {messages.length > 0 && (
                            <button
                                onClick={resetChat}
                                style={{
                                    background: "none",
                                    border: `1px solid ${C.cardBorder}`,
                                    borderRadius: 8,
                                    color: C.dim,
                                    padding: "6px 12px",
                                    fontSize: 12,
                                    fontFamily: "inherit",
                                    cursor: "pointer",
                                }}
                            >
                                대화 초기화
                            </button>
                        )}
                    </div>

                    {/* 대화 내역 */}
                    {messages.length > 0 && (
                        <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 14 }}>
                            {messages.map((m, i) => (
                                <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                                    <div
                                        style={{
                                            maxWidth: "85%",
                                            background: m.role === "user" ? C.accent : C.field,
                                            color: m.role === "user" ? "#1a1206" : C.text,
                                            border: m.role === "user" ? "none" : `1px solid ${C.cardBorder}`,
                                            borderLeft: m.role === "assistant" ? `3px solid ${C.accent}` : undefined,
                                            borderRadius: 10,
                                            padding: "12px 15px",
                                            fontSize: 14,
                                            lineHeight: 1.7,
                                            whiteSpace: "pre-wrap",
                                        }}
                                    >
                                        {m.text}
                                        {m.role === "assistant" && m.sources && m.sources.length > 0 && (
                                            <details style={{ marginTop: 10 }}>
                                                <summary style={{ fontSize: 11, color: C.faint, cursor: "pointer", userSelect: "none" }}>
                                                    📎 참고 구절 {m.sources.length}개
                                                </summary>
                                                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                                                    {m.sources.map((src, j) => (
                                                        <div
                                                            key={j}
                                                            style={{
                                                                background: C.bg,
                                                                border: `1px solid ${C.cardBorder}`,
                                                                borderRadius: 6,
                                                                padding: "8px 10px",
                                                                fontSize: 12,
                                                                lineHeight: 1.5,
                                                                color: C.dim,
                                                            }}
                                                        >
                                                            {src}
                                                        </div>
                                                    ))}
                                                </div>
                                            </details>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {asking && <div style={{ color: C.faint, fontSize: 13 }}>답변 생각 중…</div>}
                        </div>
                    )}

                    {/* 입력창 */}
                    <div style={{ display: "flex", gap: 10, marginTop: messages.length > 0 ? 18 : 16 }}>
                        <input
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && uploaded && !asking && ask()}
                            placeholder={messages.length > 0 ? "이어서 질문하세요…" : "문서에 대해 물어보세요"}
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
                </section>

                {error && (
                    <div style={{ color: C.err, fontSize: 13, marginTop: 16, textAlign: "center" }}>{error}</div>
                )}
            </div>
        </div>
    );

    function cardStyle(): React.CSSProperties {
        return { background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: 16, padding: 24 };
    }
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