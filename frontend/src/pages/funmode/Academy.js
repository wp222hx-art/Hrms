import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { employeeApi } from '../../mock/api';
import { UI_ICONS, REWARD_CARDS } from './assets';
import { RARITIES } from './engine';
import {
  TRAINING_COURSES, EXAMS,
  startCourse, markSectionRead, courseProgress, allTrainingProgress,
  submitExam, examResults,
} from './hubStore';
import { mintCard } from './ledger';
import MintModal from './MintModal';

/**
 * Training academy + exam center.
 * Routes inside this single page (state-driven):
 *   list  → catalog of courses
 *   course → read sections, mark progress
 *   examIntro → exam intro
 *   examTake  → take exam
 *   examResult → result screen, mint card if passed
 */
export default function Academy() {
  const { session, tenant } = useApp();
  const [me, setMe] = useState(null);
  const [view, setView] = useState('list');
  const [currentCourse, setCurrentCourse] = useState(null);
  const [currentExam, setCurrentExam] = useState(null);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [progress, setProgress] = useState({});
  const [results, setResults] = useState([]);
  const [mint, setMint] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!tenant) return;
      const emps = await employeeApi.list(tenant.id);
      const found =
        emps.find((e) => e.email && e.email.toLowerCase() === (session?.email || '').toLowerCase()) ||
        emps.find((e) => e.fullName === session?.name) ||
        emps[0];
      if (!cancelled && found) {
        setMe(found);
        setProgress(allTrainingProgress(tenant.id, found.id));
        setResults(examResults(tenant.id, found.id));
      }
    })();
    return () => { cancelled = true; };
  }, [tenant, session]);

  const refresh = () => {
    if (!me) return;
    setProgress(allTrainingProgress(tenant.id, me.id));
    setResults(examResults(tenant.id, me.id));
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  if (!me) {
    return (
      <div className="fm-loading">
        ◢ LOADING ACADEMY ◣
        <div className="fm-loading__bar"><div /></div>
      </div>
    );
  }

  /* ---------- LIST VIEW ---------- */
  const handleEnter = (course) => {
    startCourse(tenant.id, me.id, course.id);
    setCurrentCourse(course);
    setView('course');
    refresh();
  };

  const handleStartExam = (exam) => {
    setCurrentExam(exam);
    setAnswers({});
    setView('examIntro');
  };

  const handleAnswer = (qid, optIdx) => {
    setAnswers((a) => ({ ...a, [qid]: optIdx }));
  };

  const handleSubmitExam = () => {
    const ordered = currentExam.questions.map((q) => answers[q.id]);
    const r = submitExam(tenant.id, me.id, currentExam.id, ordered);
    setResult(r);
    setView('examResult');
    refresh();
    // Mint card if passed
    if (r.passed) {
      const card = REWARD_CARDS.exam;
      const token = mintCard({
        tenantId: tenant.id,
        employeeId: me.id,
        employeeName: me.fullName,
        cardType: 'reward',
        cardKey: 'exam',
        rarity: card.rarity,
        meta: {
          source: 'exam',
          examId: currentExam.id,
          score: r.score,
          date: new Date().toISOString().slice(0, 10),
        },
      });
      setTimeout(() => setMint({ token }), 600);
    }
  };

  const handleMarkRead = (sectionId) => {
    markSectionRead(tenant.id, me.id, currentCourse.id, sectionId);
    refresh();
    const cp = courseProgress(tenant.id, me.id, currentCourse.id);
    if (cp.progress === 100) {
      // Mint onboarding card on completion (handbook only)
      if (currentCourse.id === 'onboard_handbook' && !results.some((r) => r.examId === 'exam_onboard')) {
        const card = REWARD_CARDS.onboarding;
        const existing = examResults(tenant.id, me.id);
        // Only mint once
        const alreadyHas = (typeof window !== 'undefined' && JSON.parse(localStorage.getItem('hrms_chain_v1') || '{}')?.tokens || [])
          .some((t) => t.employeeId === me.id && t.cardKey === 'onboarding');
        if (!alreadyHas) {
          const token = mintCard({
            tenantId: tenant.id,
            employeeId: me.id,
            employeeName: me.fullName,
            cardType: 'reward',
            cardKey: 'onboarding',
            rarity: card.rarity,
            meta: { source: 'training', courseId: currentCourse.id, date: new Date().toISOString().slice(0, 10) },
          });
          setTimeout(() => setMint({ token }), 400);
        } else {
          showToast('✅ 课程已完成');
        }
      } else {
        showToast('✅ 课程已完成');
      }
    }
  };

  return (
    <>
      {toast && <div className="fm-toast">{toast}</div>}
      <MintModal open={!!mint} token={mint?.token} onClose={() => setMint(null)} />

      {/* Header */}
      <div className="fm-section fm-academy-hero">
        <div className="fm-expense-hero__top">
          <img src={UI_ICONS.ic_training} alt="" className="fm-expense-hero__icon" />
          <div>
            <div className="fm-expense-hero__title">企业学院 · Academy</div>
            <div className="fm-expense-hero__sub">员工手册 · 培训课程 · 入职考试</div>
          </div>
        </div>
        <div className="fm-expense-hero__stats">
          <div className="fm-expense-hero__stat">
            <div className="fm-expense-hero__stat-val">
              {Object.values(progress).filter((p) => p.progress === 100).length}/{TRAINING_COURSES.length}
            </div>
            <div className="fm-expense-hero__stat-lbl">课程完成</div>
          </div>
          <div className="fm-expense-hero__stat">
            <div className="fm-expense-hero__stat-val">
              {results.filter((r) => r.passed).length}
            </div>
            <div className="fm-expense-hero__stat-lbl">考试通过</div>
          </div>
          <div className="fm-expense-hero__stat">
            <div className="fm-expense-hero__stat-val">
              {Math.max(0, ...results.map((r) => r.score))}
            </div>
            <div className="fm-expense-hero__stat-lbl">最高分</div>
          </div>
        </div>
      </div>

      {/* ========== COURSE LIST ========== */}
      {view === 'list' && (
        <>
          <div className="fm-section">
            <div className="fm-section__head">
              <div className="fm-section__title">📘 我的课程</div>
            </div>
            <div className="fm-courselist">
              {TRAINING_COURSES.map((c) => {
                const p = progress[c.id] || { progress: 0 };
                return (
                  <div key={c.id} className="fm-course" onClick={() => handleEnter(c)}>
                    <div className="fm-course__icon">{c.icon}</div>
                    <div className="fm-course__body">
                      <div className="fm-course__name">
                        {c.name}
                        {c.mandatory && <span className="fm-tag fm-tag--mandatory">必修</span>}
                      </div>
                      <div className="fm-course__sub">{c.en} · {c.duration} · {c.sections.length} 节</div>
                      <div className="fm-bar" style={{ marginTop: 6 }}>
                        <div className="fm-bar__fill" style={{ width: `${p.progress}%` }} />
                      </div>
                    </div>
                    <div className="fm-course__pct">{p.progress}%</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="fm-section">
            <div className="fm-section__head">
              <div className="fm-section__title">📝 入职考试</div>
              <div className="fm-section__more">{results.length} 次记录</div>
            </div>
            {EXAMS.map((ex) => {
              const myResults = results.filter((r) => r.examId === ex.id);
              const best = myResults.reduce((m, r) => Math.max(m, r.score), 0);
              const passed = myResults.some((r) => r.passed);
              return (
                <div key={ex.id} className="fm-course" onClick={() => handleStartExam(ex)}>
                  <div className="fm-course__icon">📝</div>
                  <div className="fm-course__body">
                    <div className="fm-course__name">
                      {ex.name}
                      {passed && <span className="fm-tag fm-tag--pass">已通过</span>}
                    </div>
                    <div className="fm-course__sub">{ex.questions.length} 题 · 60 分及格 · 最佳成绩 {best || '—'}</div>
                  </div>
                  <div className="fm-course__pct">
                    {passed ? '✅' : myResults.length > 0 ? '↻ 重考' : '▶'}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="fm-section">
            <div className="fm-section__head">
              <div className="fm-section__title">⏰ 学习推送</div>
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--text-2)' }}>
              • 每周一 9:00 推送 <strong style={{color:'var(--neon-cyan)'}}>本周学习任务</strong><br />
              • 入职 7 日内必须通过 <strong style={{color:'var(--neon-orange)'}}>员工手册考试</strong><br />
              • 完成课程 → 自动铸造 <strong style={{color:'var(--neon-purple)'}}>"入职证书"</strong> NFT<br />
              • 考试通过 → 自动铸造 <strong style={{color:'var(--neon-pink)'}}>"考试通关"</strong> 史诗卡<br />
              • 季度 / 年度 课程定期推送，完成有额外勋章
            </div>
          </div>
        </>
      )}

      {/* ========== COURSE READER ========== */}
      {view === 'course' && currentCourse && (
        <div className="fm-section">
          <div className="fm-section__head">
            <div className="fm-section__title">{currentCourse.icon} {currentCourse.name}</div>
            <button className="fm-link" onClick={() => setView('list')}>← 返回</button>
          </div>
          <div className="fm-bar" style={{ margin: '4px 0 12px' }}>
            <div className="fm-bar__fill"
              style={{ width: `${(progress[currentCourse.id]?.progress || 0)}%` }} />
          </div>
          {currentCourse.sections.map((s, i) => {
            const cp = progress[currentCourse.id] || { completedSections: [] };
            const read = cp.completedSections?.includes(s.id);
            return (
              <div key={s.id} className={`fm-section-card ${read ? 'is-read' : ''}`}>
                <div className="fm-section-card__head">
                  <span className="fm-section-card__no">第 {i + 1} 节</span>
                  <strong>{s.title}</strong>
                  {read && <span className="fm-tag fm-tag--pass">已读</span>}
                </div>
                <p className="fm-section-card__content">{s.content}</p>
                {!read && (
                  <button className="fm-mini" onClick={() => handleMarkRead(s.id)}>
                    标记已读 → +20 EXP
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ========== EXAM INTRO ========== */}
      {view === 'examIntro' && currentExam && (
        <div className="fm-section">
          <div className="fm-section__head">
            <div className="fm-section__title">📝 {currentExam.name}</div>
            <button className="fm-link" onClick={() => setView('list')}>← 返回</button>
          </div>
          <div className="fm-exam-intro">
            <div className="fm-exam-intro__icon">📝</div>
            <div className="fm-exam-intro__title">{currentExam.name}</div>
            <div className="fm-exam-intro__rules">
              <div>• 共 <strong>{currentExam.questions.length}</strong> 道单选题</div>
              <div>• 60 分及格</div>
              <div>• 通过后铸造 <strong style={{color:'var(--neon-purple)'}}>"考试通关"</strong> 史诗 NFT 卡</div>
              <div>• 失败可无限重考</div>
            </div>
            <button className="fm-punch" onClick={() => setView('examTake')}>
              ⚡ 开始考试
            </button>
          </div>
        </div>
      )}

      {/* ========== EXAM TAKING ========== */}
      {view === 'examTake' && currentExam && (
        <div className="fm-section">
          <div className="fm-section__head">
            <div className="fm-section__title">📝 答题中 · {currentExam.name}</div>
            <div className="fm-section__more">{Object.keys(answers).length}/{currentExam.questions.length}</div>
          </div>
          {currentExam.questions.map((q, i) => (
            <div key={q.id} className="fm-question">
              <div className="fm-question__q"><strong>Q{i + 1}.</strong> {q.q}</div>
              <div className="fm-question__opts">
                {q.options.map((opt, idx) => (
                  <button
                    key={idx}
                    className={`fm-question__opt ${answers[q.id] === idx ? 'is-selected' : ''}`}
                    onClick={() => handleAnswer(q.id, idx)}
                  >
                    <span className="fm-question__letter">{'ABCD'[idx]}</span>
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button
            className="fm-punch"
            onClick={handleSubmitExam}
            disabled={Object.keys(answers).length < currentExam.questions.length}
          >
            ⛓️ 提交答案 · 链上判卷
          </button>
        </div>
      )}

      {/* ========== EXAM RESULT ========== */}
      {view === 'examResult' && result && (
        <div className="fm-section">
          <div className="fm-section__head">
            <div className="fm-section__title">{result.passed ? '🏆 考试通过' : '💀 未通过'}</div>
            <button className="fm-link" onClick={() => setView('list')}>返回</button>
          </div>
          <div className={`fm-result fm-result--${result.passed ? 'pass' : 'fail'}`}>
            <div className="fm-result__score">{result.score}</div>
            <div className="fm-result__lbl">{result.correct}/{result.total} 题正确</div>
            <div className="fm-result__msg">
              {result.passed
                ? '🎉 恭喜通关 · 史诗级"考试通关"卡牌已铸造上链'
                : '不要灰心 · 多看几遍员工手册再来挑战'
              }
            </div>
            <button className="fm-punch" onClick={() => setView('list')}>返回学院</button>
          </div>
        </div>
      )}
    </>
  );
}
