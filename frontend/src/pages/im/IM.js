import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FaSearch, FaPaperPlane, FaThumbtack, FaUserFriends, FaUsers, FaRobot, FaPlus } from 'react-icons/fa';
import { useApp } from '../../context/AppContext';
import { imApi } from '../../mock/enterpriseApi';
import { useCurrentEmployee, relativeTime, timeHM, findEmployee } from '../../utils/format';
import Avatar from '../../components/ui/Avatar';
import EmptyState from '../../components/ui/EmptyState';
import './IM.css';

export default function IM() {
  const { i18n } = useTranslation();
  const { tenant } = useApp();
  const { me, employees } = useCurrentEmployee();

  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // Load conversations
  useEffect(() => {
    if (!tenant || !me) return;
    let live = true;
    imApi.conversations(tenant.id, me.id).then((list) => {
      if (!live) return;
      setConversations(list);
      if (!activeId && list.length > 0) setActiveId(list[0].id);
    });
    return () => { live = false; };
    // eslint-disable-next-line
  }, [tenant, me]);

  // Load messages on active change
  useEffect(() => {
    if (!tenant || !activeId) return;
    let live = true;
    imApi.messages(tenant.id, activeId).then((m) => {
      if (!live) return;
      setMessages(m);
    });
    return () => { live = false; };
  }, [tenant, activeId]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const active = conversations.find((c) => c.id === activeId);

  const send = async () => {
    if (!text.trim() || !tenant || !me || !activeId) return;
    const payload = { senderId: me.id, senderName: me.fullName, text: text.trim() };
    await imApi.send(tenant.id, activeId, payload);
    setText('');
    // refresh messages
    const m = await imApi.messages(tenant.id, activeId);
    setMessages(m);
    // for bot conversations, wait a tick and refresh again to pick up the auto-reply
    if (active?.type === 'bot') {
      setTimeout(async () => {
        const m2 = await imApi.messages(tenant.id, activeId);
        setMessages(m2);
        const list = await imApi.conversations(tenant.id, me.id);
        setConversations(list);
      }, 750);
    } else {
      const list = await imApi.conversations(tenant.id, me.id);
      setConversations(list);
    }
    inputRef.current?.focus();
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const filteredConvs = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter((c) => {
      const nm = (c.name || conversationDisplayName(c, me, employees) || '').toLowerCase();
      return nm.includes(q) || (c.lastMessage || '').toLowerCase().includes(q);
    });
  }, [conversations, search, me, employees]);

  if (!tenant) return <EmptyState title="No tenant selected" />;

  return (
    <div className="im-shell">
      {/* LEFT — conversation list */}
      <aside className="im-list">
        <div className="im-list__head">
          <div className="im-list__title">
            <FaCommentLogo /> 消息
          </div>
          <button className="im-icon-btn" onClick={() => setShowNew(true)} title="发起新会话">
            <FaPlus />
          </button>
        </div>
        <div className="im-list__search">
          <FaSearch />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索会话或消息"
          />
        </div>
        <div className="im-list__items">
          {filteredConvs.length === 0 ? (
            <div className="im-empty">暂无会话</div>
          ) : filteredConvs.map((c) => (
            <ConvItem
              key={c.id}
              cv={c}
              me={me}
              employees={employees}
              active={c.id === activeId}
              onClick={() => setActiveId(c.id)}
              lang={i18n.language}
            />
          ))}
        </div>
      </aside>

      {/* RIGHT — chat panel */}
      <main className="im-chat">
        {!active ? (
          <div className="im-chat__empty">
            <FaCommentLogo style={{ fontSize: 40, opacity: .3 }} />
            <p>选择一个会话开始聊天</p>
          </div>
        ) : (
          <>
            <header className="im-chat__head">
              <div className="im-chat__head-l">
                <ConvAvatar cv={active} me={me} employees={employees} />
                <div>
                  <div className="im-chat__name">
                    {conversationDisplayName(active, me, employees)}
                    {active.pinned && <FaThumbtack className="im-chat__pin" />}
                  </div>
                  <div className="im-chat__sub">
                    {active.type === 'bot' && '🤖 智能助手'}
                    {active.type === 'group' && `${active.memberIds.length} 位成员`}
                    {active.type === 'dm' && '私聊'}
                  </div>
                </div>
              </div>
            </header>

            <div className="im-chat__body" ref={scrollRef}>
              {messages.length === 0 ? (
                <div className="im-empty">还没有消息，发个招呼吧 👋</div>
              ) : messages.map((m, idx) => {
                const isMe = m.senderId === me?.id;
                const isSystem = m.kind === 'system' || m.senderId === 'system';
                const prev = messages[idx - 1];
                const showSenderName = !isMe && !isSystem && (active.type !== 'dm') && (!prev || prev.senderId !== m.senderId);
                return (
                  <div key={m.id} className={`im-msg ${isMe ? 'im-msg--me' : ''} ${isSystem ? 'im-msg--sys' : ''}`}>
                    {isSystem ? (
                      <div className="im-msg__sys">{m.text}</div>
                    ) : (
                      <>
                        {!isMe && (
                          <div className="im-msg__avatar">
                            {m.senderId?.startsWith('bot-')
                              ? <span className="im-bot-av">{active.avatar || '🤖'}</span>
                              : <Avatar name={m.senderName} size={32} />}
                          </div>
                        )}
                        <div className="im-msg__col">
                          {showSenderName && <div className="im-msg__sender">{m.senderName}</div>}
                          <div className="im-msg__bubble">
                            {m.text?.split('\n').map((line, i) => <div key={i}>{line}</div>)}
                            <span className="im-msg__time">{timeHM(m.at)}</span>
                          </div>
                        </div>
                        {isMe && (
                          <div className="im-msg__avatar">
                            <Avatar name={m.senderName} size={32} />
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="im-chat__composer">
              <textarea
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKey}
                placeholder={active.type === 'bot' ? '问我任何 HR 相关问题…（请假/报销/薪资/政策）' : '输入消息… Enter 发送，Shift+Enter 换行'}
                rows={2}
              />
              <button className="im-send" onClick={send} disabled={!text.trim()}>
                <FaPaperPlane /> <span>发送</span>
              </button>
            </div>
          </>
        )}
      </main>

      {showNew && (
        <NewChatModal
          me={me}
          employees={employees}
          tenant={tenant}
          onClose={() => setShowNew(false)}
          onCreated={async (cv) => {
            setShowNew(false);
            const list = await imApi.conversations(tenant.id, me.id);
            setConversations(list);
            setActiveId(cv.id);
          }}
        />
      )}
    </div>
  );
}

function ConvItem({ cv, me, employees, active, onClick, lang }) {
  const display = conversationDisplayName(cv, me, employees);
  return (
    <button className={`im-conv ${active ? 'is-active' : ''}`} onClick={onClick}>
      <ConvAvatar cv={cv} me={me} employees={employees} />
      <div className="im-conv__col">
        <div className="im-conv__row1">
          <span className="im-conv__name">
            {display}
            {cv.pinned && <FaThumbtack style={{ fontSize: 10, marginLeft: 4, opacity: .6 }} />}
          </span>
          <span className="im-conv__time">{relativeTime(cv.lastAt, lang)}</span>
        </div>
        <div className="im-conv__last">{cv.lastMessage || '—'}</div>
      </div>
    </button>
  );
}

function ConvAvatar({ cv, me, employees }) {
  if (cv.type === 'bot') {
    return <span className="im-conv__bot">{cv.avatar || '🤖'}</span>;
  }
  if (cv.type === 'group') {
    return <span className="im-conv__group"><FaUsers /></span>;
  }
  // DM — show the other member
  const otherId = cv.memberIds.find((id) => id !== me?.id) || cv.memberIds[0];
  const other = findEmployee(employees, otherId);
  return <Avatar name={other?.fullName || '?'} size={40} />;
}

function conversationDisplayName(cv, me, employees) {
  if (cv.name) return cv.name;
  if (cv.type === 'dm') {
    const otherId = cv.memberIds.find((id) => id !== me?.id) || cv.memberIds[0];
    return findEmployee(employees, otherId)?.fullName || '未知联系人';
  }
  return '群组';
}

// New chat modal
function NewChatModal({ me, employees, tenant, onClose, onCreated }) {
  const [tab, setTab] = useState('dm');
  const [selected, setSelected] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [q, setQ] = useState('');

  const candidates = employees.filter((e) => e.id !== me?.id && (
    !q || e.fullName.toLowerCase().includes(q.toLowerCase()) || (e.department || '').toLowerCase().includes(q.toLowerCase())
  ));

  const toggle = (id) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  const submit = async () => {
    if (tab === 'dm') {
      if (selected.length !== 1) return;
      const cv = await imApi.findOrCreateDM(tenant.id, me.id, selected[0]);
      if (cv) onCreated(cv);
    } else {
      if (selected.length < 2) return;
      const cv = await imApi.createGroup(tenant.id, {
        name: groupName || `${me.fullName} 创建的群`,
        creatorId: me.id,
        memberIds: [me.id, ...selected],
      });
      onCreated(cv);
    }
  };

  return (
    <div className="im-modal-overlay" onClick={onClose}>
      <div className="im-modal" onClick={(e) => e.stopPropagation()}>
        <div className="im-modal__head">
          <h3>发起新会话</h3>
          <button className="im-icon-btn" onClick={onClose}>×</button>
        </div>
        <div className="im-modal__tabs">
          <button className={tab === 'dm' ? 'is-on' : ''} onClick={() => { setTab('dm'); setSelected([]); }}>
            <FaUserFriends /> 私聊
          </button>
          <button className={tab === 'group' ? 'is-on' : ''} onClick={() => { setTab('group'); setSelected([]); }}>
            <FaUsers /> 群组
          </button>
        </div>
        {tab === 'group' && (
          <input
            className="im-modal__input"
            placeholder="群组名称（可选）"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
        )}
        <input
          className="im-modal__input"
          placeholder="搜索员工…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="im-modal__list">
          {candidates.map((e) => (
            <label key={e.id} className={`im-pick ${selected.includes(e.id) ? 'is-on' : ''}`}>
              <input
                type={tab === 'dm' ? 'radio' : 'checkbox'}
                name="picker"
                checked={selected.includes(e.id)}
                onChange={() => { if (tab === 'dm') setSelected([e.id]); else toggle(e.id); }}
              />
              <Avatar name={e.fullName} size={28} />
              <span className="im-pick__name">{e.fullName}</span>
              <span className="im-pick__dept">{e.department}</span>
            </label>
          ))}
          {candidates.length === 0 && <div className="im-empty">没有匹配的员工</div>}
        </div>
        <div className="im-modal__foot">
          <button className="im-btn" onClick={onClose}>取消</button>
          <button className="im-btn im-btn--primary" onClick={submit} disabled={
            (tab === 'dm' && selected.length !== 1) || (tab === 'group' && selected.length < 2)
          }>
            创建 {selected.length > 0 && `(${selected.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}

// Small inline logo icon (FaCommentDots variant — avoid extra import)
function FaCommentLogo() { return <span style={{ fontSize: 18 }}>💬</span>; }
