import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  FaArrowLeft, FaBookOpen, FaQuestionCircle, FaCheck, FaPlay,
  FaClock, FaCertificate, FaTrophy, FaRedoAlt, FaBolt,
} from 'react-icons/fa';
import { useApp } from '../../context/AppContext';
import { trainingApi } from '../../mock/enterpriseApi';
import { useCurrentEmployee } from '../../utils/format';
import './Training.css';

export default function TrainingCourse() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { tenant } = useApp();
  const { me } = useCurrentEmployee();
  const [course, setCourse] = useState(null);
  const [enr, setEnr] = useState(null);
  const [cert, setCert] = useState(null);
  const [activeLessonId, setActiveLessonId] = useState(null);
  const [quizAnswers, setQuizAnswers] = useState({});
  const [quizResult, setQuizResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!tenant || !courseId) return;
    let live = true;
    trainingApi.course(tenant.id, courseId).then((c) => {
      if (!live) return;
      setCourse(c);
      if (c?.lessons?.length) setActiveLessonId(c.lessons[0].id);
    });
    return () => { live = false; };
  }, [tenant, courseId]);

  const refreshEnr = async () => {
    if (!tenant || !me || !courseId) return;
    const e = await trainingApi.enrollment(tenant.id, me.id, courseId);
    setEnr(e);
    if (e?.status === 'completed') {
      const certs = await trainingApi.myCerts(tenant.id, me.id);
      const c = certs.find((x) => x.courseId === courseId);
      setCert(c || null);
    }
  };

  useEffect(() => { refreshEnr(); /* eslint-disable-next-line */ }, [tenant, me, courseId]);

  if (!course) {
    return (
      <div className="tr-page">
        <div className="tr-loading">加载中…</div>
      </div>
    );
  }

  const activeLesson = course.lessons.find((l) => l.id === activeLessonId) || course.lessons[0];
  const completedIds = enr?.completedLessonIds || [];
  const totalLessons = course.lessons.length;
  const doneCount = completedIds.length;
  const pct = Math.round((doneCount / totalLessons) * 100);

  const enroll = async () => {
    if (!me) return;
    await trainingApi.enroll(tenant.id, me.id, courseId);
    await refreshEnr();
  };

  const markDone = async (lessonId) => {
    if (!me) return;
    await trainingApi.markLesson(tenant.id, me.id, courseId, lessonId);
    await refreshEnr();
  };

  const submitQuiz = async () => {
    if (!me || !activeLesson || activeLesson.kind !== 'quiz') return;
    // Validate all answered
    if (activeLesson.quiz.some((_, i) => quizAnswers[i] === undefined)) {
      alert('请完成所有题目');
      return;
    }
    setSubmitting(true);
    const answers = activeLesson.quiz.map((_, i) => quizAnswers[i]);
    const result = await trainingApi.submitQuiz(tenant.id, me.id, courseId, activeLesson.id, answers);
    setQuizResult(result);
    setSubmitting(false);
    await refreshEnr();
  };

  const retryQuiz = () => {
    setQuizAnswers({});
    setQuizResult(null);
  };

  const switchLesson = (id) => {
    setActiveLessonId(id);
    setQuizAnswers({});
    setQuizResult(null);
  };

  const isLessonDone = (lid) => completedIds.includes(lid);

  return (
    <div className="tr-detail">
      <button className="tr-back" onClick={() => navigate('/training')}>
        <FaArrowLeft /> 返回课程列表
      </button>

      {/* Course header */}
      <div className="tr-detail-head">
        <div className="tr-detail-cover" style={{ background: course.coverColor }}>
          <span>{course.cover}</span>
        </div>
        <div className="tr-detail-info">
          <div className="tr-detail-cat">
            {course.category} · {course.level}
            {course.required && <span className="tr-card-badge inline"><FaBolt /> 必修</span>}
          </div>
          <h1>{course.title}</h1>
          {course.titleEn && <div className="tr-detail-en">{course.titleEn}</div>}
          <p className="tr-detail-sum">{course.summary}</p>
          <div className="tr-detail-meta">
            <span><FaClock /> {course.duration} 分钟</span>
            <span>· {totalLessons} 课时</span>
            <span>· 讲师：{course.instructor}</span>
          </div>

          {enr ? (
            <div className="tr-progress big">
              <div className="tr-progress-bar">
                <div className="tr-progress-fill" style={{ width: `${pct}%` }} />
              </div>
              <span className="tr-progress-text">
                {enr.status === 'completed' ? '✅ 已完成' : `已学习 ${doneCount}/${totalLessons} · ${pct}%`}
              </span>
            </div>
          ) : (
            <button className="tr-enroll-btn" onClick={enroll}>
              <FaPlay /> 立即报名学习
            </button>
          )}
        </div>
      </div>

      {/* Certificate banner */}
      {cert && (
        <div className="tr-cert-banner">
          <div className="tr-cert-banner-icon"><FaCertificate /></div>
          <div className="tr-cert-banner-body">
            <div className="tr-cert-banner-title">🏆 恭喜！您已获得课程证书</div>
            <div className="tr-cert-banner-sub">
              证书编号：{cert.code} · 分数 {cert.score}/100
            </div>
          </div>
        </div>
      )}

      {/* Lesson player */}
      <div className="tr-player">
        {/* Lesson sidebar */}
        <aside className="tr-lessons">
          <div className="tr-lessons-head">
            <span>课程大纲</span>
            <span className="tr-lessons-count">{doneCount}/{totalLessons}</span>
          </div>
          <ol className="tr-lesson-list">
            {course.lessons.map((l, idx) => {
              const done = isLessonDone(l.id);
              const active = l.id === activeLesson.id;
              const Icon = l.kind === 'quiz' ? FaQuestionCircle : FaBookOpen;
              return (
                <li
                  key={l.id}
                  className={`tr-lesson-item ${active ? 'active' : ''} ${done ? 'done' : ''}`}
                  onClick={() => switchLesson(l.id)}
                >
                  <span className="tr-lesson-num">{done ? <FaCheck /> : idx + 1}</span>
                  <Icon className="tr-lesson-kind" />
                  <span className="tr-lesson-title">{l.title}</span>
                  <span className="tr-lesson-dur">{l.duration}'</span>
                </li>
              );
            })}
          </ol>
        </aside>

        {/* Lesson content */}
        <main className="tr-lesson-pane">
          <div className="tr-lesson-head">
            <div className="tr-lesson-tag">
              {activeLesson.kind === 'quiz' ? (
                <><FaQuestionCircle /> 测验 · Quiz</>
              ) : (
                <><FaBookOpen /> 课时 · Lesson</>
              )}
            </div>
            <h2>{activeLesson.title}</h2>
            <div className="tr-lesson-dur-text">
              <FaClock /> 约 {activeLesson.duration} 分钟
            </div>
          </div>

          {activeLesson.kind !== 'quiz' ? (
            <>
              <div className="tr-reading">
                {activeLesson.content.split('\n').map((line, i) =>
                  line.trim() ? <p key={i}>{line}</p> : <div key={i} style={{ height: 8 }} />
                )}
              </div>
              <div className="tr-lesson-foot">
                {isLessonDone(activeLesson.id) ? (
                  <span className="tr-done-tag"><FaCheck /> 已完成本课时</span>
                ) : (
                  <button className="tr-enroll-btn" onClick={() => markDone(activeLesson.id)}>
                    <FaCheck /> 标记为已学习
                  </button>
                )}
              </div>
            </>
          ) : (
            <QuizPanel
              lesson={activeLesson}
              answers={quizAnswers}
              setAnswers={setQuizAnswers}
              result={quizResult}
              onSubmit={submitQuiz}
              onRetry={retryQuiz}
              submitting={submitting}
              alreadyPassed={isLessonDone(activeLesson.id)}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function QuizPanel({ lesson, answers, setAnswers, result, onSubmit, onRetry, submitting, alreadyPassed }) {
  const pickAnswer = (qIdx, optIdx) => {
    setAnswers((cur) => ({ ...cur, [qIdx]: optIdx }));
  };

  if (result) {
    return (
      <div className={`tr-quiz-result ${result.passed ? 'pass' : 'fail'}`}>
        <div className="tr-quiz-result-icon">
          {result.passed ? <FaTrophy /> : <FaRedoAlt />}
        </div>
        <h3>{result.passed ? '🎉 恭喜通过！' : '差一点点，再来一次'}</h3>
        <div className="tr-quiz-result-score">
          {result.correct}/{result.total} · {result.score} 分
        </div>
        <div className="tr-quiz-result-msg">
          {result.passed
            ? (result.score === 100
                ? '满分通过！您可以查看下方证书。'
                : '已通过本测验（≥70 分）')
            : '通过线为 70 分。复习课程内容后再试一次吧。'}
        </div>
        {!result.passed && (
          <button className="tr-enroll-btn" onClick={onRetry}>
            <FaRedoAlt /> 再次测验
          </button>
        )}
        {/* Show answer review */}
        <div className="tr-quiz-review">
          <h4>答题回顾</h4>
          {lesson.quiz.map((q, i) => {
            const my = answers[i];
            const correct = q.answer;
            const ok = my === correct;
            return (
              <div key={i} className={`tr-quiz-review-item ${ok ? 'ok' : 'bad'}`}>
                <div className="tr-quiz-review-q">{i + 1}. {q.q}</div>
                <div className="tr-quiz-review-a">
                  您的回答：{q.options[my]} {ok ? '✅' : '❌'}
                </div>
                {!ok && (
                  <div className="tr-quiz-review-c">正确答案：{q.options[correct]}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="tr-quiz">
      <p className="tr-quiz-intro">{lesson.content}</p>
      {alreadyPassed && (
        <div className="tr-quiz-alreadypass">
          ✅ 您已通过本测验。可重新作答查看反馈。
        </div>
      )}
      <ol className="tr-quiz-list">
        {lesson.quiz.map((q, qi) => (
          <li key={qi} className="tr-quiz-item">
            <div className="tr-quiz-q">{qi + 1}. {q.q}</div>
            <div className="tr-quiz-opts">
              {q.options.map((opt, oi) => (
                <label
                  key={oi}
                  className={`tr-quiz-opt ${answers[qi] === oi ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    name={`q-${qi}`}
                    checked={answers[qi] === oi}
                    onChange={() => pickAnswer(qi, oi)}
                  />
                  <span>{String.fromCharCode(65 + oi)}. {opt}</span>
                </label>
              ))}
            </div>
          </li>
        ))}
      </ol>
      <div className="tr-quiz-foot">
        <span className="tr-quiz-tip">通过线 ≥ 70 分</span>
        <button
          className="tr-enroll-btn"
          disabled={submitting}
          onClick={onSubmit}
        >
          {submitting ? '提交中…' : '提交测验'}
        </button>
      </div>
    </div>
  );
}
