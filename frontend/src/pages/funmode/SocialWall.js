import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { employeeApi } from '../../mock/api';
import { UI_ICONS } from './assets';
import {
  POST_KINDS, listPosts, addPost, likePost, commentPost,
  removePost, popularityOf,
} from './hubStore';
import { mintCard, tokensOf } from './ledger';
import MintModal from './MintModal';

/**
 * Social Wall — cyberpunk-style 动态墙
 * Anyone can post cheers/thanks/birthday wishes; likes contribute to popularity.
 * Hitting 10 lifetime likes mints a 'wall' (Social Star) NFT (once).
 */
export default function SocialWall() {
  const { session, tenant } = useApp();
  const [me, setMe] = useState(null);
  const [allEmps, setAllEmps] = useState([]);
  const [posts, setPosts] = useState([]);
  const [text, setText] = useState('');
  const [kind, setKind] = useState('cheer');
  const [filter, setFilter] = useState('all');
  const [openComment, setOpenComment] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [mint, setMint] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!tenant) return;
      const emps = await employeeApi.list(tenant.id);
      const found =
        emps.find((e) => e.email && e.email.toLowerCase() === (session?.email || '').toLowerCase()) ||
        emps.find((e) => e.fullName === session?.name) ||
        emps[0];
      if (!cancelled) {
        setAllEmps(emps);
        setMe(found);
        setPosts(listPosts(tenant.id));
      }
    })();
    return () => { cancelled = true; };
  }, [tenant, session]);

  const myStats = useMemo(() => {
    if (!me || !tenant) return { likes: 0, posts: 0 };
    return popularityOf(tenant.id, me.id);
  }, [me, tenant, posts]);

  const tryMintSocialStar = () => {
    if (!me || !tenant) return;
    const tokens = tokensOf(tenant.id, me.id);
    const already = tokens.some((t) => t.cardKey === 'wall');
    if (already) return;
    const token = mintCard({
      tenantId: tenant.id,
      employeeId: me.id,
      employeeName: me.fullName,
      cardType: 'reward',
      cardKey: 'wall',
      rarity: 'epic',
      meta: {
        source: 'social_wall',
        likesAtMint: myStats.likes,
        date: new Date().toISOString().slice(0, 10),
      },
    });
    setTimeout(() => setMint({ token }), 200);
  };

  const handlePost = () => {
    if (!text.trim() || !me || !tenant) return;
    addPost(tenant.id, {
      authorId: me.id,
      authorName: me.fullName,
      department: me.department,
      kind,
      text: text.trim().slice(0, 240),
    });
    setText('');
    setPosts(listPosts(tenant.id));
    showToast('📣 已发布到动态墙');
  };

  const handleLike = (p) => {
    if (!me || !tenant) return;
    likePost(tenant.id, p.id, me.id);
    setPosts(listPosts(tenant.id));
    // Auto check unlock after action (use latest stat)
    const pop = popularityOf(tenant.id, me.id);
    if (pop.likes >= 10) tryMintSocialStar();
  };

  const handleComment = (postId) => {
    if (!commentText.trim()) return;
    commentPost(tenant.id, postId, {
      authorId: me.id,
      authorName: me.fullName,
      text: commentText.trim().slice(0, 120),
    });
    setCommentText('');
    setOpenComment(null);
    setPosts(listPosts(tenant.id));
  };

  const handleDelete = (p) => {
    if (p.authorId !== me?.id) return;
    if (!window.confirm('删除这条动态？')) return;
    removePost(tenant.id, p.id);
    setPosts(listPosts(tenant.id));
  };

  if (!me) {
    return (
      <div className="fm-loading">
        ◢ LOADING WALL ◣
        <div className="fm-loading__bar"><div /></div>
      </div>
    );
  }

  const filteredPosts = filter === 'all' ? posts : posts.filter((p) => p.kind === filter);
  const kindMeta = (k) => POST_KINDS.find((x) => x.id === k) || POST_KINDS[0];

  return (
    <>
      {toast && <div className="fm-toast">{toast}</div>}
      <MintModal open={!!mint} token={mint?.token} onClose={() => setMint(null)} />

      {/* Header */}
      <div className="fm-section fm-wall-hero">
        <div className="fm-expense-hero__top">
          <img src={UI_ICONS.ic_wall} alt="" className="fm-expense-hero__icon" />
          <div>
            <div className="fm-expense-hero__title">动态墙 · Social Wall</div>
            <div className="fm-expense-hero__sub">喊话 · 祝福 · 吐槽 · 点赞 · 出圈</div>
          </div>
        </div>
        <div className="fm-expense-hero__stats">
          <div className="fm-expense-hero__stat">
            <div className="fm-expense-hero__stat-val">{myStats.likes}</div>
            <div className="fm-expense-hero__stat-lbl">我的人气</div>
          </div>
          <div className="fm-expense-hero__stat">
            <div className="fm-expense-hero__stat-val">{myStats.posts}</div>
            <div className="fm-expense-hero__stat-lbl">已发动态</div>
          </div>
          <div className="fm-expense-hero__stat">
            <div className="fm-expense-hero__stat-val">{posts.length}</div>
            <div className="fm-expense-hero__stat-lbl">全员动态</div>
          </div>
        </div>
        {myStats.likes < 10 && (
          <div className="fm-wall-progress">
            <div className="fm-wall-progress__lbl">
              人气之星 NFT · 累计 10 赞解锁（已获 {myStats.likes}/10）
            </div>
            <div className="fm-wall-progress__bar">
              <div style={{ width: `${Math.min(100, (myStats.likes / 10) * 100)}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="fm-section">
        <div className="fm-section__head">
          <div className="fm-section__title">✍️ 发布新动态</div>
        </div>
        <div className="fm-composer">
          <div className="fm-composer__kinds">
            {POST_KINDS.map((k) => (
              <button
                key={k.id}
                className={`fm-kind ${kind === k.id ? 'is-active' : ''}`}
                style={{ '--c': k.color }}
                onClick={() => setKind(k.id)}
              >
                <span>{k.icon}</span>{k.label}
              </button>
            ))}
          </div>
          <textarea
            className="fm-composer__text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="今天想给同事们说点什么？240 字以内…"
            maxLength={240}
          />
          <div className="fm-composer__row">
            <span className="fm-composer__count">{text.length}/240</span>
            <button className="fm-mini" onClick={handlePost} disabled={!text.trim()}>
              🚀 发布
            </button>
          </div>
        </div>
      </div>

      {/* Filter chips */}
      <div className="fm-section" style={{ paddingTop: 6, paddingBottom: 6 }}>
        <div className="fm-chips">
          <button className={`fm-chip ${filter === 'all' ? 'is-active' : ''}`} onClick={() => setFilter('all')}>
            全部
          </button>
          {POST_KINDS.map((k) => (
            <button
              key={k.id}
              className={`fm-chip ${filter === k.id ? 'is-active' : ''}`}
              style={{ '--c': k.color }}
              onClick={() => setFilter(k.id)}
            >
              {k.icon} {k.label}
            </button>
          ))}
        </div>
      </div>

      {/* Feed */}
      <div className="fm-section">
        <div className="fm-section__head">
          <div className="fm-section__title">📜 动态流</div>
          <div className="fm-section__more">{filteredPosts.length} 条</div>
        </div>
        {filteredPosts.length === 0 && (
          <div className="fm-empty">还没有动态 · 来发第一条吧 ✨</div>
        )}
        <div className="fm-feed">
          {filteredPosts.map((p) => {
            const km = kindMeta(p.kind);
            const liked = (p.likes || []).includes(me.id);
            const mine = p.authorId === me.id;
            const time = new Date(p.createdAt);
            const ago = relativeTime(time);
            return (
              <div key={p.id} className="fm-post" style={{ '--c': km.color }}>
                <div className="fm-post__head">
                  <div className="fm-post__avatar" style={{ background: km.color }}>
                    {(p.authorName || '?').slice(0, 1)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="fm-post__author">
                      {p.authorName}
                      <span className="fm-post__dept">· {p.department || ''}</span>
                    </div>
                    <div className="fm-post__meta">
                      <span className="fm-post__kind">{km.icon} {km.label}</span>
                      <span>· {ago}</span>
                    </div>
                  </div>
                  {mine && (
                    <button className="fm-post__del" onClick={() => handleDelete(p)} title="删除">
                      ✕
                    </button>
                  )}
                </div>
                <div className="fm-post__text">{p.text}</div>
                <div className="fm-post__actions">
                  <button
                    className={`fm-post__btn ${liked ? 'is-liked' : ''}`}
                    onClick={() => handleLike(p)}
                  >
                    {liked ? '💖' : '🤍'} {(p.likes || []).length}
                  </button>
                  <button
                    className="fm-post__btn"
                    onClick={() => setOpenComment(openComment === p.id ? null : p.id)}
                  >
                    💬 {(p.comments || []).length}
                  </button>
                </div>

                {(p.comments || []).length > 0 && (
                  <div className="fm-post__comments">
                    {(p.comments || []).slice(-3).map((c) => (
                      <div key={c.id} className="fm-post__cmt">
                        <strong>{c.authorName}:</strong> {c.text}
                      </div>
                    ))}
                  </div>
                )}

                {openComment === p.id && (
                  <div className="fm-post__cmtbox">
                    <input
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="留个言…"
                      maxLength={120}
                      onKeyDown={(e) => e.key === 'Enter' && handleComment(p.id)}
                    />
                    <button className="fm-mini" onClick={() => handleComment(p.id)}>
                      发送
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function relativeTime(d) {
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60)   return '刚刚';
  if (sec < 3600) return `${Math.floor(sec / 60)} 分钟前`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} 小时前`;
  if (sec < 86400 * 7) return `${Math.floor(sec / 86400)} 天前`;
  return d.toLocaleDateString();
}
