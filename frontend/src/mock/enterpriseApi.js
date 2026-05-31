/**
 * Async API wrappers around enterpriseStore.
 * Mirror style of /mock/api.js for consistency.
 */
import * as ES from './enterpriseStore';
import { getState } from './store';

const delay = (ms = 120) => new Promise((r) => setTimeout(r, ms));

/** Ensure the tenant bucket is seeded (idempotent) */
export async function ensureEnterpriseSeeded(tenantId) {
  await delay(0);
  const tenant = getState().tenants.find((t) => t.id === tenantId);
  const emps = getState().employees.filter((e) => e.tenantId === tenantId);
  ES.seedTenant(tenantId, emps, tenant?.region || 'SG');
  return ES.bucket(tenantId);
}

/* Departments */
export const deptApi = {
  list:   async (tid) => { await delay(); await ensureEnterpriseSeeded(tid); return ES.listDepartments(tid); },
  tree:   async (tid) => { await delay(); await ensureEnterpriseSeeded(tid); return ES.deptTree(tid); },
  create: async (tid, payload) => { await delay(); return ES.createDept(tid, payload); },
  update: async (tid, id, patch) => { await delay(); ES.updateDept(tid, id, patch); return ES.listDepartments(tid).find((d) => d.id === id); },
  remove: async (tid, id) => { await delay(); ES.deleteDept(tid, id); return true; },
};

/* Positions */
export const positionApi = {
  list: async (tid) => { await delay(); await ensureEnterpriseSeeded(tid); return ES.listPositions(tid); },
};

/* Workflows */
export const workflowApi = {
  templates: async (tid) => { await delay(); await ensureEnterpriseSeeded(tid); return ES.listWorkflowTemplates(tid); },
  template:  async (tid, id) => { await delay(); return ES.workflowTemplate(tid, id); },
  resolveSteps: (tpl, payload) => ES.resolveSteps(tpl, payload),
  submit: async (tid, p) => {
    await delay();
    const inst = ES.submitWorkflow(tid, p);
    // Push approval notification to applicant and (mock) approver
    if (inst) {
      ES.pushNotification(tid, {
        employeeId: inst.applicantId, kind: 'approval',
        title: '已提交申请', body: `${inst.templateName} · 待 ${inst.steps[0]?.label || '审批'}`,
        link: `/approval/${inst.id}`,
      });
    }
    return inst;
  },
  list: async (tid, filter = {}) => { await delay(); return ES.listWorkflowInstances(tid, filter); },
  decide: async (tid, instanceId, decision, opts) => {
    await delay();
    ES.decideWorkflowStep(tid, instanceId, decision, opts);
    const inst = ES.listWorkflowInstances(tid).find((x) => x.id === instanceId);
    if (inst) {
      ES.pushNotification(tid, {
        employeeId: inst.applicantId,
        kind: decision === 'approved' ? 'success' : decision === 'rejected' ? 'error' : 'info',
        title: `${inst.templateName} ${decision === 'approved' ? '已通过' : decision === 'rejected' ? '已驳回' : '更新'}`,
        body: opts?.comment || '',
        link: `/approval/${inst.id}`,
      });
    }
    return inst;
  },
  withdraw: async (tid, id) => { await delay(); ES.withdrawWorkflow(tid, id); return true; },
};

/* IM */
export const imApi = {
  conversations: async (tid, employeeId) => { await delay(); await ensureEnterpriseSeeded(tid); return ES.listConversations(tid, employeeId); },
  messages: async (tid, cvId) => { await delay(50); return ES.conversationMessages(tid, cvId); },
  send: async (tid, cvId, msg) => { await delay(50); return ES.sendMessage(tid, cvId, msg); },
  createGroup: async (tid, payload) => { await delay(); return ES.createGroupChat(tid, payload); },
  findOrCreateDM: async (tid, aId, bId) => { await delay(); return ES.findOrCreateDM(tid, aId, bId); },
};

/* Announcements */
export const annApi = {
  list:   async (tid) => { await delay(); await ensureEnterpriseSeeded(tid); return ES.listAnnouncements(tid); },
  publish:async (tid, p) => { await delay(); return ES.publishAnnouncement(tid, p); },
  read:   async (tid, id, eid) => { await delay(); ES.markAnnouncementRead(tid, id, eid); return true; },
};

/* Notifications */
export const notifyApi = {
  list:   async (tid, eid, o) => { await delay(); return ES.listNotifications(tid, eid, o); },
  push:   async (tid, p) => { await delay(); return ES.pushNotification(tid, p); },
  read:   async (tid, id) => { await delay(); ES.markNotificationRead(tid, id); return true; },
  readAll:async (tid, eid) => { await delay(); ES.markAllNotificationsRead(tid, eid); return true; },
};

/* Workspace */
export const workspaceApi = {
  layout: async (tid, eid) => { await delay(); return ES.getWorkspaceLayout(tid, eid); },
  togglePin: async (tid, eid, key) => { await delay(); ES.togglePinnedApp(tid, eid, key); return ES.getWorkspaceLayout(tid, eid); },
};

/* Holidays */
export const holidayApi = {
  list: async (tid) => { await delay(); await ensureEnterpriseSeeded(tid); return ES.listHolidays(tid); },
};

/* Region meta */
export const regionMeta = ES.REGION_META;

/* SEA statutory */
export const seaApi = {
  calcStatutory: (region, gross) => ES.calcStatutorySEA(region, gross),
};

/* Handbook (Employee Handbook / Knowledge Base) */
export const handbookApi = {
  categories: async (tid) => { await delay(); await ensureEnterpriseSeeded(tid); return ES.listHandbookCategories(tid); },
  list:       async (tid, filter) => { await delay(); await ensureEnterpriseSeeded(tid); return ES.listHandbookArticles(tid, filter); },
  get:        async (tid, id) => { await delay(80); return ES.getHandbookArticle(tid, id); },
  markRead:   async (tid, id, eid) => { await delay(40); ES.markArticleRead(tid, id, eid); return true; },
};

/* Training (Courses + Lessons + Quizzes + Certificates) */
export const trainingApi = {
  courses:       async (tid, f) => { await delay(); await ensureEnterpriseSeeded(tid); return ES.listCourses(tid, f); },
  course:        async (tid, id) => { await delay(80); return ES.getCourse(tid, id); },
  myEnrollments: async (tid, eid) => { await delay(80); return ES.listMyEnrollments(tid, eid); },
  enrollment:    async (tid, eid, cid) => { await delay(40); return ES.getEnrollment(tid, eid, cid); },
  enroll:        async (tid, eid, cid) => { await delay(80); return ES.enrollCourse(tid, eid, cid); },
  markLesson:    async (tid, eid, cid, lid) => { await delay(60); return ES.markLessonDone(tid, eid, cid, lid); },
  submitQuiz:    async (tid, eid, cid, lid, answers) => { await delay(120); return ES.submitQuiz(tid, eid, cid, lid, answers); },
  myCerts:       async (tid, eid) => { await delay(60); return ES.listMyCertificates(tid, eid); },
};
