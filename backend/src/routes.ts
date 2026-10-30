import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from './async-handler';
import * as auth from './controllers/auth-controller';
import * as family from './controllers/family-controller';
import * as learning from './controllers/learning-controller';
import * as clubs from './controllers/club-controller';
import * as events from './controllers/event-controller';
import * as payments from './controllers/payment-controller';
import * as programmes from './controllers/programme-controller';
import * as admin from './controllers/admin-controller';
import * as adminContent from './controllers/admin-content-controller';
import * as safeguarding from './controllers/safeguarding-controller';
import { authenticateParent } from './middleware/authenticate';
import { requireClubStaffRole } from './middleware/require-club-staff-role';
import { requireFinanceSupport } from './middleware/require-finance-support';
import { requireStaffRole } from './middleware/require-staff-role';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Please wait before trying again.' } },
});

const router = Router();

// Administrative capabilities are reported to the signed-in staff account;
// role assignment is intentionally provisioned outside the public API.
router.get('/admin/capabilities', authenticateParent, asyncHandler(admin.capabilities));
router.get('/admin/overview', authenticateParent, requireStaffRole('platform_admin', 'safeguarding_lead', 'safeguarding_backup', 'club_reviewer', 'club_moderator', 'event_manager', 'content_editor', 'content_reviewer', 'finance_support', 'auditor'), asyncHandler(admin.overview));
router.get('/admin/provider-status', authenticateParent, requireStaffRole('finance_support', 'content_editor', 'content_reviewer'), asyncHandler(admin.providerStatus));
router.get('/admin/members', authenticateParent, requireStaffRole('platform_admin'), asyncHandler(admin.members));
router.patch('/admin/members/:parentId/status', authenticateParent, requireStaffRole('platform_admin'), asyncHandler(admin.setMemberStatus));
router.get('/admin/audit', authenticateParent, requireStaffRole('platform_admin', 'auditor'), asyncHandler(admin.auditLog));

router.post('/safeguarding/reports', authenticateParent, asyncHandler(safeguarding.submitReport));
router.get('/safeguarding/reports/mine', authenticateParent, asyncHandler(safeguarding.reporterReports));
router.get('/safeguarding/reports/:reportId/status', authenticateParent, asyncHandler(safeguarding.reporterStatus));
router.get('/safeguarding/staff/reports', authenticateParent, requireStaffRole('safeguarding_lead', 'safeguarding_backup'), asyncHandler(safeguarding.queue));
router.get('/safeguarding/staff/reports/:reportId', authenticateParent, requireStaffRole('safeguarding_lead', 'safeguarding_backup'), asyncHandler(safeguarding.caseDetails));
router.post('/safeguarding/staff/reports/:reportId/actions', authenticateParent, requireStaffRole('safeguarding_lead', 'safeguarding_backup'), asyncHandler(safeguarding.actOnCase));

router.get('/admin/content/topics', authenticateParent, requireStaffRole('content_editor', 'content_reviewer'), asyncHandler(adminContent.listTopics));
router.post('/admin/content/topics', authenticateParent, requireStaffRole('content_editor'), asyncHandler(adminContent.createTopic));
router.patch('/admin/content/topics/:topicId', authenticateParent, requireStaffRole('content_editor'), asyncHandler(adminContent.updateTopic));
router.post('/admin/content/topics/:topicId/publication', authenticateParent, requireStaffRole('content_editor', 'content_reviewer'), asyncHandler(adminContent.setTopicPublication));
router.get('/admin/content/items', authenticateParent, requireStaffRole('content_editor', 'content_reviewer'), asyncHandler(adminContent.listContent));
router.post('/admin/content/items', authenticateParent, requireStaffRole('content_editor'), asyncHandler(adminContent.createContent));
router.patch('/admin/content/items/:contentId', authenticateParent, requireStaffRole('content_editor'), asyncHandler(adminContent.updateContent));
router.post('/admin/content/items/:contentId/publication', authenticateParent, requireStaffRole('content_editor', 'content_reviewer'), asyncHandler(adminContent.setContentPublication));
router.get('/admin/programmes', authenticateParent, requireStaffRole('content_editor', 'content_reviewer'), asyncHandler(adminContent.listProgrammes));
router.post('/admin/programmes', authenticateParent, requireStaffRole('content_editor'), asyncHandler(adminContent.createProgramme));
router.get('/admin/programmes/:programmeId', authenticateParent, requireStaffRole('content_editor', 'content_reviewer'), asyncHandler(adminContent.programmeDetail));
router.patch('/admin/programmes/:programmeId', authenticateParent, requireStaffRole('content_editor'), asyncHandler(adminContent.updateProgramme));
router.post('/admin/programmes/:programmeId/publication', authenticateParent, requireStaffRole('content_editor', 'content_reviewer'), asyncHandler(adminContent.setProgrammePublication));
router.post('/admin/programmes/:programmeId/modules', authenticateParent, requireStaffRole('content_editor'), asyncHandler(adminContent.createModule));
router.patch('/admin/programmes/:programmeId/modules/:moduleId', authenticateParent, requireStaffRole('content_editor'), asyncHandler(adminContent.updateProgrammeComponent));
router.post('/admin/programmes/:programmeId/modules/:moduleId/publication', authenticateParent, requireStaffRole('content_editor', 'content_reviewer'), asyncHandler(adminContent.setProgrammeComponentPublication));
router.post('/admin/programmes/:programmeId/activities', authenticateParent, requireStaffRole('content_editor'), asyncHandler(adminContent.createActivity));
router.patch('/admin/programmes/:programmeId/activities/:activityId', authenticateParent, requireStaffRole('content_editor'), asyncHandler(adminContent.updateProgrammeComponent));
router.post('/admin/programmes/:programmeId/activities/:activityId/publication', authenticateParent, requireStaffRole('content_editor', 'content_reviewer'), asyncHandler(adminContent.setProgrammeComponentPublication));

router.post('/auth/parents/registrations', authLimiter, asyncHandler(auth.registerParent));
router.post('/auth/verification/complete', authLimiter, asyncHandler(auth.completeVerification));
router.post('/auth/sessions', authLimiter, asyncHandler(auth.signIn));
router.post('/auth/sessions/refresh', authLimiter, asyncHandler(auth.refreshSession));
router.delete('/auth/sessions/current', authenticateParent, asyncHandler(auth.signOut));
router.get('/auth/me', authenticateParent, asyncHandler(auth.currentParent));
router.patch('/auth/me/language', authenticateParent, asyncHandler(auth.updatePreferredLanguage));
router.post('/auth/recovery-requests', authLimiter, asyncHandler(auth.requestRecovery));
router.post('/auth/recovery-completions', authLimiter, asyncHandler(auth.completeRecovery));

router.get('/family/students', authenticateParent, asyncHandler(family.listStudents));
router.get('/family/audit', authenticateParent, asyncHandler(family.listFamilyAudit));
router.post('/family/students', authenticateParent, asyncHandler(family.createStudent));
router.patch('/family/students/:studentId', authenticateParent, asyncHandler(family.updateStudent));
router.delete('/family/students/:studentId', authenticateParent, asyncHandler(family.archiveStudent));
router.get('/family/consent-policy', authenticateParent, asyncHandler(family.getConsentPolicy));
router.post('/family/relationships/:relationshipId/consent', authenticateParent, asyncHandler(family.grantConsent));
router.post('/family/relationships/:relationshipId/consent/revocations', authenticateParent, asyncHandler(family.revokeConsent));

router.get('/learning/topics', authenticateParent, asyncHandler(learning.listTopics));
router.get('/learning/catalog', authenticateParent, asyncHandler(learning.listContent));
router.get('/learning/content/:contentId', authenticateParent, asyncHandler(learning.getContent));
router.get('/learning/content/:contentId/media-access', authenticateParent, asyncHandler(learning.createMediaAccess));
router.get('/learning/content/:contentId/thumbnail-access', authenticateParent, asyncHandler(learning.createThumbnailAccess));

router.get('/programmes', authenticateParent, asyncHandler(programmes.listProgrammes));
router.get('/programmes/:programmeId', authenticateParent, asyncHandler(programmes.getProgramme));
router.post('/programmes/:programmeId/enrolments', authenticateParent, asyncHandler(programmes.enroll));
router.get('/programmes/:programmeId/progress', authenticateParent, asyncHandler(programmes.listProgress));
router.put('/programmes/:programmeId/activities/:activityId/progress', authenticateParent, asyncHandler(programmes.updateProgress));

router.get('/payments/quote/:programmeId', authenticateParent, asyncHandler(payments.quote));
router.post('/payments/orders/:programmeId', authenticateParent, asyncHandler(payments.createOrder));
router.get('/payments/orders', authenticateParent, asyncHandler(payments.listOrders));
router.get('/payments/orders/:orderId', authenticateParent, asyncHandler(payments.getOrder));
router.post('/payments/orders/:orderId/refunds', authenticateParent, asyncHandler(payments.requestRefund));
router.get('/payments/support/refunds', authenticateParent, requireFinanceSupport, asyncHandler(payments.supportRefundQueue));
router.get('/payments/support/orders', authenticateParent, requireFinanceSupport, asyncHandler(payments.supportOrders));
router.get('/payments/support/orders/:orderId/audit', authenticateParent, requireFinanceSupport, asyncHandler(payments.supportOrderAudit));
router.post('/payments/support/refunds/:refundRequestId/review', authenticateParent, requireFinanceSupport, asyncHandler(payments.reviewRefund));
router.get('/payments/support/refunds/:refundRequestId/notes', authenticateParent, requireFinanceSupport, asyncHandler(payments.refundSupportNotes));
router.post('/payments/webhooks/:providerId', asyncHandler(payments.webhook));

router.get('/clubs/me/capabilities', authenticateParent, asyncHandler(clubs.staffCapabilities));
router.get('/clubs', authenticateParent, asyncHandler(clubs.listClubs));
router.get('/clubs/:clubId', authenticateParent, asyncHandler(clubs.getClub));
router.post('/clubs/applications', authenticateParent, asyncHandler(clubs.createApplication));
router.get('/clubs/applications/mine', authenticateParent, asyncHandler(clubs.listMyApplications));
router.post('/clubs/applications/:applicationId/cancellation', authenticateParent, asyncHandler(clubs.cancelApplication));
router.get('/clubs/staff/applications', authenticateParent, requireClubStaffRole('club_reviewer'), asyncHandler(clubs.staffApplicationQueue));
router.get('/clubs/staff/clubs', authenticateParent, requireClubStaffRole('club_moderator'), asyncHandler(clubs.staffClubList));
router.post('/clubs/staff/applications/:applicationId/review', authenticateParent, requireClubStaffRole('club_reviewer'), asyncHandler(clubs.reviewApplication));
router.post('/clubs/staff/:clubId/moderation', authenticateParent, requireClubStaffRole('club_moderator'), asyncHandler(clubs.moderateClub));
router.get('/clubs/staff/audit', authenticateParent, requireClubStaffRole('club_moderator'), asyncHandler(clubs.staffAudit));
router.post('/clubs/:clubId/membership-requests', authenticateParent, asyncHandler(clubs.createMembershipRequest));
router.get('/clubs/guardian/requests', authenticateParent, asyncHandler(clubs.listGuardianRequests));
router.post('/clubs/membership-requests/:requestId/guardian-decision', authenticateParent, asyncHandler(clubs.decideGuardianRequest));
router.post('/clubs/membership-requests/:requestId/cancellation', authenticateParent, asyncHandler(clubs.cancelMembershipRequest));
router.get('/clubs/leader/clubs', authenticateParent, asyncHandler(clubs.leaderClubs));
router.get('/clubs/leader/requests', authenticateParent, asyncHandler(clubs.leaderRequests));
router.post('/clubs/leader/membership-requests/:requestId/decision', authenticateParent, asyncHandler(clubs.decideLeaderRequest));
router.post('/clubs/leader/clubs/:clubId/announcements', authenticateParent, asyncHandler(clubs.createAnnouncement));
router.get('/clubs/:clubId/announcements', authenticateParent, asyncHandler(clubs.clubAnnouncements));
router.delete('/clubs/staff/announcements/:announcementId', authenticateParent, requireClubStaffRole('club_moderator'), asyncHandler(clubs.removeAnnouncement));

router.get('/events', authenticateParent, asyncHandler(events.listEvents));
router.get('/events/guardian/registrations', authenticateParent, asyncHandler(events.guardianRegistrations));
router.get('/events/leader/clubs', authenticateParent, asyncHandler(events.managedClubs));
router.get('/events/leader/managed', authenticateParent, asyncHandler(events.managedEvents));
router.get('/events/audit', authenticateParent, requireClubStaffRole('event_manager'), asyncHandler(events.eventAudit));
router.get('/events/:eventId', authenticateParent, asyncHandler(events.getEvent));
router.post('/clubs/:clubId/events', authenticateParent, asyncHandler(events.createEvent));
router.patch('/events/:eventId', authenticateParent, asyncHandler(events.updateEvent));
router.post('/events/:eventId/cancellation', authenticateParent, asyncHandler(events.cancelEvent));
router.post('/events/:eventId/registrations', authenticateParent, asyncHandler(events.registerForEvent));
router.post('/events/registrations/:registrationId/guardian-decision', authenticateParent, asyncHandler(events.decideGuardianRegistration));
router.post('/events/registrations/:registrationId/cancellation', authenticateParent, asyncHandler(events.cancelRegistration));
router.get('/events/:eventId/roster', authenticateParent, asyncHandler(events.eventRoster));
router.patch('/events/:eventId/attendance/:registrationId', authenticateParent, asyncHandler(events.recordAttendance));
router.get('/events/:eventId/announcements', authenticateParent, asyncHandler(events.eventAnnouncements));
router.post('/events/:eventId/announcements', authenticateParent, asyncHandler(events.createEventAnnouncement));
router.delete('/events/staff/announcements/:announcementId', authenticateParent, requireClubStaffRole('event_manager'), asyncHandler(events.removeEventAnnouncement));

export default router;
