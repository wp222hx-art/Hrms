import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaSearch, FaClock, FaCertificate, FaGraduationCap, FaCheck, FaPlay, FaBolt, FaTrophy } from 'react-icons/fa';
import { useApp } from '../../context/AppContext';
import { trainingApi } from '../../mock/enterpriseApi';
import { useCurrentEmployee, relativeTime } from '../../utils/format';
import EmptyState from '../../components/ui/EmptyState';
import './Training.css';

export default function Training() {
  const navigate = useNavigate();
  const { tenant } = useApp();
  const { me } = useCurrentEmployee();
  const [tab, setTab] = useState('all'); // all | required | mine | certs
  const [q, setQ] = useState('');
  const [courses, setCourses] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [certs, setCerts] = useState([]);

  useEffect(() => {
    if (!tenant) return;
    let live = true;
    trainingApi.courses(tenant.id).then((cs) => { if (live) setCourses(cs); });
    return () => { live = false; };
  }, [tenant]);

  useEffect(() => {
    if (!tenant || !me) return;
    let live = true;
    Promise.all([
      trainingApi.myEnrollments(tenant.id, me.id),
      trainingApi.myCerts(tenant.id, me.id),
    ]).then(([es, cs]) => {
      if (!live) return;
      setEnrollments(es);
      setCerts(cs);
    });
    return () => { live = false; };
  }, [tenant, me]);

  const courseMap = useMemo(() => Object.fromEntries(courses.map((c) => [c.id, c])), [courses]);
  const enrollMap = useMemo(() => Object.fromEntries(enrollments.map((e) => [e.courseId, e])), [enrollments]);

  const list = useMemo(() => {
    let arr = courses;
    if (q.trim()) {
      const k = q.toLowerCase();
      arr = arr.filter((c) =>
        c.title.toLowerCase().includes(k) ||
        (c.titleEn || '').toLowerCase().includes(k) ||
        c.summary.toLowerCase().includes(k));
    }
    if (tab === 'required') arr = arr.filter((c) => c.required);
    if (tab === 'mine') {
      const ids = new Set(enrollments.map((e) => e.courseId));
      arr = arr.filter((c) => ids.has(c.id));
    }
    return arr;
  }, [courses, q, tab, enrollments]);

  const stats = useMemo(() => {
    const required = courses.filter((c) => c.required).length;
    const inProgress = enrollments.filter((e) => e.status !== 'completed').length;
    const done = enrollments.filter((e) => e.status === 'completed').length;
    return { required, inProgress, done, certCount: certs.length };
  }, [courses, enrollments, certs]);

  const progress = (course, enr) => {
    if (!enr) return 0;
    return Math.round((enr.completedLessonIds.length / course.lessons.length) * 100);
  };

  return (
    <div className="tr-page">
      {/* Hero */}
      <div className="tr-hero">
        <div className="tr-hero-left">
          <div className="tr-hero-icon"><FaGraduationCap /></div>
          <div>
            <h1>培训中心</h1>
            <p>Learning Hub · 持续学习，成就未来</p>
          </div>
        </div>
        <div className="tr-hero-stats">
          <div className="tr-hero-stat">
            <div className="tr-hero-stat-num">{stats.required}</div>
            <div className="tr-hero-stat-label">必修课程</div>
          </div>
          <div className="tr-hero-stat">
            <div className="tr-hero-stat-num">{stats.inProgress}</div>
            <div className="tr-hero-stat-label">学习中</div>
          </div>
          <div className="tr-hero-stat">
            <div className="tr-hero-stat-num">{stats.done}</div>
            <div className="tr-hero-stat-label">已完成</div>
          </div>
          <div className="tr-hero-stat">
            <div className="tr-hero-stat-num">{stats.certCount}</div>
            <div className="tr-hero-stat-label">获得证书</div>
          </div>
        </div>
      </div>

      {/* Tabs + search */}
      <div className="tr-toolbar">
        <div className="tr-tabs">
          {[
            { k: 'all',      label: '全部课程' },
            { k: 'required', label: '必修课程' },
            { k: 'mine',     label: '我的学习' },
            { k: 'certs',    label: '我的证书' },
          ].map((t) => (
            <button
              key={t.k}
              className={`tr-tab ${tab === t.k ? 'active' : ''}`}
              onClick={() => setTab(t.k)}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tab !== 'certs' && (
          <div className="tr-search">
            <FaSearch />
            <input
              placeholder="搜索课程…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Body */}
      {tab === 'certs' ? (
        <CertList certs={certs} courseMap={courseMap} />
      ) : list.length === 0 ? (
        <EmptyState title="暂无课程" desc="试试其他筛选条件" />
      ) : (
        <div className="tr-grid">
          {list.map((c) => {
            const enr = enrollMap[c.id];
            const pct = progress(c, enr);
            return (
              <button
                key={c.id}
                className="tr-card"
                onClick={() => navigate(`/training/${c.id}`)}
              >
                <div className="tr-cover" style={{ background: c.coverColor }}>
                  <span className="tr-cover-emoji">{c.cover}</span>
                  {c.required && (
                    <span className="tr-card-badge"><FaBolt /> 必修</span>
                  )}
                  {enr?.status === 'completed' && (
                    <span className="tr-card-done"><FaCheck /></span>
                  )}
                </div>
                <div className="tr-card-body">
                  <div className="tr-card-cat">{c.category} · {c.level}</div>
                  <h3 className="tr-card-title">{c.title}</h3>
                  <p className="tr-card-sum">{c.summary}</p>
                  <div className="tr-card-meta">
                    <span><FaClock /> {c.duration} 分钟</span>
                    <span>·</span>
                    <span>{c.lessons.length} 课时</span>
                    <span>·</span>
                    <span>{c.instructor}</span>
                  </div>
                  {enr && (
                    <div className="tr-progress">
                      <div className="tr-progress-bar">
                        <div className="tr-progress-fill" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="tr-progress-text">
                        {enr.status === 'completed' ? '已完成' : `${pct}%`}
                      </span>
                    </div>
                  )}
                  {!enr && (
                    <span className="tr-start">
                      <FaPlay /> 开始学习
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CertList({ certs, courseMap }) {
  if (!certs.length) {
    return (
      <EmptyState
        title="还没有证书"
        desc="完成课程并通过测验即可获得证书"
      />
    );
  }
  return (
    <div className="tr-cert-grid">
      {certs.map((c) => {
        const course = courseMap[c.courseId];
        return (
          <div key={c.id} className="tr-cert-card">
            <div className="tr-cert-ribbon">
              <FaTrophy /> CERTIFIED
            </div>
            <div className="tr-cert-icon"><FaCertificate /></div>
            <div className="tr-cert-title">{c.courseName}</div>
            <div className="tr-cert-score">分数 {c.score} / 100</div>
            <div className="tr-cert-code">证书编号：{c.code}</div>
            <div className="tr-cert-time">
              颁发于 {relativeTime(c.issuedAt, 'zh')}
            </div>
            {course && (
              <div className="tr-cert-meta">
                {course.category} · {course.duration} 分钟 · {course.instructor}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
