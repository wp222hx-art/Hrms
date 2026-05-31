import React, { useEffect, useMemo, useState } from 'react';
import { FaSearch, FaBookmark, FaCheckCircle, FaTags, FaBookOpen, FaArrowLeft, FaShieldAlt } from 'react-icons/fa';
import { useApp } from '../../context/AppContext';
import { handbookApi, regionMeta } from '../../mock/enterpriseApi';
import { useCurrentEmployee, relativeTime } from '../../utils/format';
import EmptyState from '../../components/ui/EmptyState';
import './Handbook.css';

/* ----- Tiny markdown renderer for handbook bodies (## headings, **bold**, lists) ----- */
function renderBody(body) {
  if (!body) return null;
  const lines = body.split('\n');
  const out = [];
  let listBuf = [];
  const flushList = () => {
    if (listBuf.length) {
      out.push(
        <ul key={`ul-${out.length}`} className="hb-list">
          {listBuf.map((t, i) => <li key={i}>{renderInline(t)}</li>)}
        </ul>
      );
      listBuf = [];
    }
  };
  lines.forEach((raw, idx) => {
    const line = raw.trimEnd();
    if (!line.trim()) { flushList(); out.push(<div key={`sp-${idx}`} className="hb-sp" />); return; }
    if (line.startsWith('## ')) {
      flushList();
      out.push(<h3 key={`h-${idx}`} className="hb-h">{line.slice(3)}</h3>);
    } else if (line.startsWith('### ')) {
      flushList();
      out.push(<h4 key={`h4-${idx}`} className="hb-h4">{line.slice(4)}</h4>);
    } else if (/^\s*[-*]\s+/.test(line)) {
      listBuf.push(line.replace(/^\s*[-*]\s+/, ''));
    } else if (/^\s*\d+\.\s+/.test(line)) {
      listBuf.push(line.replace(/^\s*\d+\.\s+/, ''));
    } else {
      flushList();
      out.push(<p key={`p-${idx}`} className="hb-p">{renderInline(line)}</p>);
    }
  });
  flushList();
  return out;
}

function renderInline(text) {
  // **bold**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (/^\*\*[^*]+\*\*$/.test(p)) return <strong key={i}>{p.slice(2, -2)}</strong>;
    return <React.Fragment key={i}>{p}</React.Fragment>;
  });
}

export default function Handbook() {
  const { tenant } = useApp();
  const { me } = useCurrentEmployee();
  const [categories, setCategories] = useState([]);
  const [articles, setArticles] = useState([]);
  const [activeCat, setActiveCat] = useState(null);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(null);
  const [onlyMustRead, setOnlyMustRead] = useState(false);

  useEffect(() => {
    if (!tenant) return;
    let live = true;
    Promise.all([
      handbookApi.categories(tenant.id),
      handbookApi.list(tenant.id),
    ]).then(([cats, arts]) => {
      if (!live) return;
      setCategories(cats);
      setArticles(arts);
    });
    return () => { live = false; };
  }, [tenant]);

  // Re-filter
  useEffect(() => {
    if (!tenant) return;
    let live = true;
    handbookApi.list(tenant.id, { categoryId: activeCat || undefined, q: q || undefined })
      .then((arts) => { if (live) setArticles(arts); });
    return () => { live = false; };
  }, [tenant, activeCat, q]);

  const filtered = useMemo(() => {
    let list = articles;
    if (onlyMustRead) list = list.filter((a) => a.mustRead);
    return list;
  }, [articles, onlyMustRead]);

  const openArticle = async (id) => {
    const a = await handbookApi.get(tenant.id, id);
    setSelected(a);
    if (me && a && !a.readers.includes(me.id)) {
      handbookApi.markRead(tenant.id, id, me.id).then(() => {
        // refresh readers locally
        setSelected((cur) => cur ? { ...cur, readers: [...cur.readers, me.id] } : cur);
        setArticles((arr) => arr.map((x) => x.id === id ? { ...x, readers: [...x.readers, me.id] } : x));
      });
    }
  };

  const allCount = articles.length;
  const mustReadCount = articles.filter((a) => a.mustRead).length;
  const myReadCount = me ? articles.filter((a) => a.readers.includes(me.id)).length : 0;
  const region = tenant?.region || 'SG';
  const meta = regionMeta[region] || regionMeta.SG;
  // Read version from any article (all articles in this tenant share the same version)
  const handbookVersion = articles[0]?.version || `${region}-v2024.Q4`;

  return (
    <div className="hb-page">
      {/* Left: category tree + filters */}
      <aside className="hb-side">
        <div className="hb-side-head">
          <span className="hb-flag" title={meta.name}>{meta.flag}</span>
          <div>
            <div className="hb-side-title">员工手册</div>
            <div className="hb-side-sub">{meta.nameZh} · {meta.name}</div>
          </div>
        </div>
        <div className="hb-version">
          <FaShieldAlt /> 版本 {handbookVersion}
        </div>

        <div className="hb-search">
          <FaSearch />
          <input
            placeholder="搜索手册标题/标签/内容…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="hb-stats">
          <div className="hb-stat"><span>{allCount}</span>篇</div>
          <div className="hb-stat hb-stat-warn"><span>{mustReadCount}</span>必读</div>
          <div className="hb-stat hb-stat-ok"><span>{myReadCount}</span>已读</div>
        </div>

        <div className="hb-cat-list">
          <button
            className={`hb-cat ${!activeCat ? 'active' : ''}`}
            onClick={() => { setActiveCat(null); setSelected(null); }}
          >
            <span className="hb-cat-ic">📚</span>
            <span className="hb-cat-name">全部</span>
            <span className="hb-cat-count">{allCount}</span>
          </button>
          {categories.map((c) => {
            const cnt = articles.filter((a) => a.categoryId === c.id).length;
            return (
              <button
                key={c.id}
                className={`hb-cat ${activeCat === c.id ? 'active' : ''}`}
                onClick={() => { setActiveCat(c.id); setSelected(null); }}
              >
                <span className="hb-cat-ic">{c.icon}</span>
                <span className="hb-cat-name">{c.name}</span>
                <span className="hb-cat-count">{cnt}</span>
              </button>
            );
          })}
        </div>

        <label className="hb-toggle">
          <input
            type="checkbox"
            checked={onlyMustRead}
            onChange={(e) => setOnlyMustRead(e.target.checked)}
          />
          <span>仅看必读</span>
        </label>
      </aside>

      {/* Right pane */}
      <main className="hb-main">
        {selected ? (
          <ArticleView
            article={selected}
            onBack={() => setSelected(null)}
            isRead={me ? selected.readers.includes(me.id) : false}
          />
        ) : (
          <ArticleList
            articles={filtered}
            categories={categories}
            onOpen={openArticle}
            me={me}
          />
        )}
      </main>
    </div>
  );
}

function ArticleList({ articles, categories, onOpen, me }) {
  const catMap = useMemo(() => Object.fromEntries(categories.map((c) => [c.id, c])), [categories]);
  if (!articles.length) {
    return <EmptyState title="暂无相关手册" desc="试试更换分类或搜索关键词" />;
  }
  return (
    <div className="hb-list-wrap">
      <div className="hb-list-head">
        <h2>{articles.length} 篇文章</h2>
      </div>
      <div className="hb-grid">
        {articles.map((a) => {
          const cat = catMap[a.categoryId];
          const isRead = me ? a.readers.includes(me.id) : false;
          return (
            <button key={a.id} className="hb-card" onClick={() => onOpen(a.id)}>
              <div className="hb-card-top">
                <span className="hb-card-cat">
                  {cat?.icon} {cat?.name}
                </span>
                {a.mustRead && (
                  <span className="hb-badge hb-badge-must">
                    <FaBookmark /> 必读
                  </span>
                )}
              </div>
              <h3 className="hb-card-title">{a.title}</h3>
              <p className="hb-card-sum">{a.summary}</p>
              <div className="hb-card-foot">
                {(a.tags || []).slice(0, 3).map((t) => (
                  <span key={t} className="hb-tag">{t}</span>
                ))}
                <span className="hb-card-meta">
                  {isRead && <FaCheckCircle className="hb-read-ic" title="已读" />}
                  {relativeTime(a.updatedAt, 'zh')}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ArticleView({ article, onBack, isRead }) {
  return (
    <article className="hb-art">
      <button className="hb-back" onClick={onBack}>
        <FaArrowLeft /> 返回列表
      </button>
      <header className="hb-art-head">
        <div className="hb-art-meta">
          {article.mustRead && (
            <span className="hb-badge hb-badge-must">
              <FaBookmark /> 必读
            </span>
          )}
          {isRead && (
            <span className="hb-badge hb-badge-ok">
              <FaCheckCircle /> 已读
            </span>
          )}
          <span className="hb-art-time">更新于 {relativeTime(article.updatedAt, 'zh')}</span>
        </div>
        <h1 className="hb-art-title">{article.title}</h1>
        <p className="hb-art-sum">{article.summary}</p>
        {!!(article.tags || []).length && (
          <div className="hb-art-tags">
            <FaTags />
            {article.tags.map((t) => <span key={t} className="hb-tag">{t}</span>)}
          </div>
        )}
      </header>
      <div className="hb-art-body">{renderBody(article.body)}</div>
      <footer className="hb-art-foot">
        <span>{article.readers?.length || 0} 位同事已阅读</span>
      </footer>
    </article>
  );
}
