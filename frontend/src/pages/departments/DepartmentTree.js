import React, { useEffect, useState } from 'react';
import { FaChevronDown, FaChevronRight, FaUsers, FaPlus, FaTrash, FaEdit, FaCrown, FaUserTie } from 'react-icons/fa';
import { useApp } from '../../context/AppContext';
import { deptApi } from '../../mock/enterpriseApi';
import { employeeApi } from '../../mock/api';
import EmptyState from '../../components/ui/EmptyState';
import Avatar from '../../components/ui/Avatar';
import './DepartmentTree.css';

export default function DepartmentTree() {
  const { tenant, role } = useApp();
  const [tree, setTree] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selected, setSelected] = useState(null);
  const [expanded, setExpanded] = useState({ 'd-root': true });
  const [editing, setEditing] = useState(null); // {id, name, code, managerId, hrbpId}
  const [showAdd, setShowAdd] = useState(false);
  const [newDept, setNewDept] = useState({ name: '', code: '', parentId: 'd-root' });

  const canEdit = role === 'hr_admin' || role === 'super_admin';

  useEffect(() => {
    if (!tenant) return;
    let live = true;
    (async () => {
      const [t, e] = await Promise.all([
        deptApi.tree(tenant.id),
        employeeApi.list(tenant.id),
      ]);
      if (!live) return;
      setTree(t);
      setEmployees(e);
      setSelected((cur) => cur || (t[0] || null));
    })();
    return () => { live = false; };
  }, [tenant]);

  const refresh = async () => {
    const t = await deptApi.tree(tenant.id);
    setTree(t);
  };

  const flat = flatten(tree);
  const selectedDept = flat.find((d) => d.id === selected?.id) || null;
  const selectedEmployees = selectedDept
    ? (selectedDept.id === 'd-root'
      ? employees
      : employees.filter((e) => e.department === selectedDept.name))
    : [];
  const totalHeadcount = employees.length;

  const handleSave = async () => {
    if (!editing) return;
    await deptApi.update(tenant.id, editing.id, {
      name: editing.name,
      code: editing.code,
      managerId: editing.managerId || null,
      hrbpId: editing.hrbpId || null,
    });
    setEditing(null);
    await refresh();
  };
  const handleDelete = async (id) => {
    if (id === 'd-root') return;
    if (!window.confirm('确认删除该部门？子部门会被移至 集团 / Group 下')) return;
    await deptApi.remove(tenant.id, id);
    await refresh();
    if (selected?.id === id) setSelected(tree[0]);
  };
  const handleCreate = async () => {
    if (!newDept.name.trim()) return;
    await deptApi.create(tenant.id, {
      name: newDept.name.trim(),
      code: newDept.code.trim() || newDept.name.slice(0, 3).toUpperCase(),
      parentId: newDept.parentId,
      headcount: 0,
    });
    setShowAdd(false);
    setNewDept({ name: '', code: '', parentId: 'd-root' });
    await refresh();
  };

  if (!tenant) return <EmptyState title="No tenant selected" />;

  const findEmp = (id) => employees.find((e) => e.id === id);

  return (
    <div className="page dept-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">组织架构</h1>
          <p className="page-subtitle">部门 · 主管 · HRBP · 编制 总览 · 共 {totalHeadcount} 人</p>
        </div>
        {canEdit && (
          <button className="dept-btn dept-btn--primary" onClick={() => setShowAdd(true)}>
            <FaPlus /> <span>新建部门</span>
          </button>
        )}
      </div>

      <div className="dept-grid">
        <aside className="dept-tree-panel">
          <div className="dept-tree-panel__head">
            <FaUsers /> 部门树
          </div>
          <ul className="dept-tree">
            {tree.map((root) => (
              <TreeNode
                key={root.id}
                node={root}
                level={0}
                expanded={expanded}
                setExpanded={setExpanded}
                selectedId={selected?.id}
                onSelect={setSelected}
                employees={employees}
              />
            ))}
          </ul>
        </aside>

        <main className="dept-detail">
          {!selectedDept ? (
            <EmptyState title="请选择部门" />
          ) : editing ? (
            <DeptEditor
              editing={editing}
              setEditing={setEditing}
              employees={employees}
              onSave={handleSave}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <>
              <div className="dept-detail__head">
                <div>
                  <h2 className="dept-detail__title">
                    {selectedDept.name}
                    <span className="dept-detail__code">{selectedDept.code}</span>
                  </h2>
                  <p className="dept-detail__meta">
                    {selectedEmployees.length} 位成员
                    {selectedDept.parentId && (() => {
                      const parent = flat.find((d) => d.id === selectedDept.parentId);
                      return parent ? <> · 上级：{parent.name}</> : null;
                    })()}
                  </p>
                </div>
                {canEdit && selectedDept.id !== 'd-root' && (
                  <div className="dept-actions">
                    <button className="dept-btn" onClick={() => setEditing({
                      id: selectedDept.id,
                      name: selectedDept.name,
                      code: selectedDept.code,
                      managerId: selectedDept.managerId,
                      hrbpId: selectedDept.hrbpId,
                    })}>
                      <FaEdit /> 编辑
                    </button>
                    <button className="dept-btn dept-btn--danger" onClick={() => handleDelete(selectedDept.id)}>
                      <FaTrash /> 删除
                    </button>
                  </div>
                )}
              </div>

              <div className="dept-leads">
                <RoleBadge
                  icon={<FaCrown />}
                  label="部门主管"
                  emp={findEmp(selectedDept.managerId)}
                />
                <RoleBadge
                  icon={<FaUserTie />}
                  label="HRBP"
                  emp={findEmp(selectedDept.hrbpId)}
                />
              </div>

              <div className="dept-roster">
                <h3>成员列表 ({selectedEmployees.length})</h3>
                {selectedEmployees.length === 0 ? (
                  <div className="dept-empty">该部门暂无成员</div>
                ) : (
                  <div className="dept-roster__grid">
                    {selectedEmployees.map((e) => (
                      <div key={e.id} className="dept-member">
                        <Avatar name={e.fullName} size={36} />
                        <div className="dept-member__col">
                          <div className="dept-member__name">{e.fullName}</div>
                          <div className="dept-member__sub">{e.position || e.role || '员工'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>

      {showAdd && (
        <div className="dept-modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="dept-modal" onClick={(e) => e.stopPropagation()}>
            <div className="dept-modal__head"><h3>新建部门</h3></div>
            <div className="dept-modal__body">
              <label>部门名称 *
                <input
                  value={newDept.name}
                  onChange={(e) => setNewDept((n) => ({ ...n, name: e.target.value }))}
                  placeholder="如：研发部"
                />
              </label>
              <label>部门编码
                <input
                  value={newDept.code}
                  onChange={(e) => setNewDept((n) => ({ ...n, code: e.target.value }))}
                  placeholder="如：ENG"
                />
              </label>
              <label>上级部门
                <select
                  value={newDept.parentId}
                  onChange={(e) => setNewDept((n) => ({ ...n, parentId: e.target.value }))}
                >
                  {flat.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="dept-modal__foot">
              <button className="dept-btn" onClick={() => setShowAdd(false)}>取消</button>
              <button className="dept-btn dept-btn--primary" onClick={handleCreate}>创建</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TreeNode({ node, level, expanded, setExpanded, selectedId, onSelect, employees }) {
  const hasChildren = node.children && node.children.length > 0;
  const isOpen = expanded[node.id] !== false;
  const isSelected = node.id === selectedId;
  const headcount = node.id === 'd-root'
    ? employees.length
    : employees.filter((e) => e.department === node.name).length;

  return (
    <li>
      <div
        className={`dept-tree__item ${isSelected ? 'is-selected' : ''}`}
        style={{ paddingLeft: 12 + level * 18 }}
        onClick={() => onSelect(node)}
      >
        {hasChildren ? (
          <button
            className="dept-tree__caret"
            onClick={(e) => { e.stopPropagation(); setExpanded((m) => ({ ...m, [node.id]: !isOpen })); }}
          >
            {isOpen ? <FaChevronDown /> : <FaChevronRight />}
          </button>
        ) : <span className="dept-tree__caret dept-tree__caret--empty" />}
        <span className="dept-tree__name">{node.name}</span>
        <span className="dept-tree__count">{headcount}</span>
      </div>
      {hasChildren && isOpen && (
        <ul>
          {node.children.map((c) => (
            <TreeNode
              key={c.id}
              node={c}
              level={level + 1}
              expanded={expanded}
              setExpanded={setExpanded}
              selectedId={selectedId}
              onSelect={onSelect}
              employees={employees}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function RoleBadge({ icon, label, emp }) {
  return (
    <div className="dept-lead">
      <span className="dept-lead__icon">{icon}</span>
      <div className="dept-lead__col">
        <div className="dept-lead__label">{label}</div>
        {emp ? (
          <div className="dept-lead__name">
            <Avatar name={emp.fullName} size={28} />
            <span>{emp.fullName}</span>
          </div>
        ) : (
          <div className="dept-lead__empty">未指派</div>
        )}
      </div>
    </div>
  );
}

function DeptEditor({ editing, setEditing, employees, onSave, onCancel }) {
  return (
    <div className="dept-editor">
      <h2 className="dept-detail__title">编辑部门</h2>
      <label>部门名称
        <input
          value={editing.name}
          onChange={(e) => setEditing({ ...editing, name: e.target.value })}
        />
      </label>
      <label>部门编码
        <input
          value={editing.code}
          onChange={(e) => setEditing({ ...editing, code: e.target.value })}
        />
      </label>
      <label>部门主管
        <select
          value={editing.managerId || ''}
          onChange={(e) => setEditing({ ...editing, managerId: e.target.value || null })}
        >
          <option value="">未指派</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.fullName} · {e.position || e.department}</option>)}
        </select>
      </label>
      <label>HRBP
        <select
          value={editing.hrbpId || ''}
          onChange={(e) => setEditing({ ...editing, hrbpId: e.target.value || null })}
        >
          <option value="">未指派</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.fullName} · {e.position || e.department}</option>)}
        </select>
      </label>
      <div className="dept-modal__foot" style={{ borderTop: 'none', paddingLeft: 0, paddingRight: 0 }}>
        <button className="dept-btn" onClick={onCancel}>取消</button>
        <button className="dept-btn dept-btn--primary" onClick={onSave}>保存</button>
      </div>
    </div>
  );
}

function flatten(tree) {
  const out = [];
  const walk = (nodes) => nodes.forEach((n) => { out.push(n); if (n.children) walk(n.children); });
  walk(tree);
  return out;
}
