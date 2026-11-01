import mongoose, { Schema, type Model } from 'mongoose';

const objectId = Schema.Types.ObjectId;
// The API intentionally uses Model<any> at its persistence boundary. Keep Mongoose
// from re-inferring deep document types from every large runtime schema definition.
const createSchema = (definition: any, options: any): Schema<any> => new Schema<any>(definition, options);

const parentSchema = createSchema({
  name: { type: String, required: true, trim: true, minlength: 1, maxlength: 120 },
  contact: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  contactType: { type: String, enum: ['email', 'phone'], required: true },
  passwordHash: { type: String, required: true, select: false },
  preferredLanguage: { type: String, enum: ['en', 'hi', 'ml', 'ta'], default: 'en', required: true },
  membershipCategory: { type: String, enum: ['mother', 'father', 'guardian'], default: 'guardian', required: true, index: true },
  communityNetworkingOptIn: { type: Boolean, default: false, required: true },
  membershipId: { type: String, unique: true, sparse: true, immutable: true },
  membershipStatus: { type: String, enum: ['pending_verification', 'active', 'suspended'], default: 'active', required: true, index: true },
  verificationStatus: { type: String, enum: ['pending', 'verified'], default: 'pending', index: true },
  verifiedAt: Date,
  adultVerificationStatus: { type: String, enum: ['unavailable', 'pending', 'verified'], default: 'unavailable', select: false, index: true },
  adultVerifiedAt: { type: Date, select: false },
  accountStatus: { type: String, enum: ['active', 'suspended'], default: 'active', index: true },
  sessionVersion: { type: Number, default: 0, min: 0 },
  staffRoles: { type: [{ type: String, enum: ['platform_admin', 'safeguarding_lead', 'safeguarding_backup', 'club_reviewer', 'club_moderator', 'event_manager', 'content_editor', 'content_reviewer', 'finance_support', 'auditor'] }], default: [], select: false },
}, { timestamps: true, collection: 'nte_parent_accounts' });
parentSchema.index({ contact: 1 }, { unique: true });

const familySchema = createSchema({
  guardianId: { type: objectId, ref: 'NteParentAccount', required: true },
  status: { type: String, enum: ['active', 'closed'], default: 'active', required: true },
  closedReason: { type: String, enum: ['connected_family'], select: false },
}, { timestamps: true, collection: 'nte_families' });
familySchema.index({ guardianId: 1 }, { unique: true });

const familyGuardianSchema = createSchema({
  familyId: { type: objectId, ref: 'NteFamily', required: true, index: true, immutable: true },
  guardianId: { type: objectId, ref: 'NteParentAccount', required: true, immutable: true },
  invitedBy: { type: objectId, ref: 'NteParentAccount', required: true, immutable: true },
  status: { type: String, enum: ['active', 'disputed', 'revoked'], default: 'active', required: true, index: true },
  permissions: { type: [{ type: String, enum: ['view_students'] }], default: ['view_students'], required: true },
  acceptedAt: { type: Date, required: true },
  revokedAt: Date,
}, { timestamps: true, collection: 'nte_family_guardians' });
familyGuardianSchema.index({ familyId: 1, guardianId: 1 }, { unique: true });
familyGuardianSchema.index(
  { guardianId: 1 },
  { unique: true, partialFilterExpression: { status: 'active' }, name: 'guardianId_active_unique' },
);

const familyInvitationSchema = createSchema({
  familyId: { type: objectId, ref: 'NteFamily', required: true, immutable: true, index: true },
  inviterId: { type: objectId, ref: 'NteParentAccount', required: true, immutable: true },
  inviteeContact: { type: String, required: true, lowercase: true, trim: true },
  contactType: { type: String, enum: ['email', 'phone'], required: true },
  tokenHash: { type: String, required: true, unique: true, select: false },
  status: { type: String, enum: ['pending', 'accepted', 'rejected', 'revoked', 'expired'], default: 'pending', required: true, index: true },
  expiresAt: { type: Date, required: true, index: true },
  respondedAt: Date,
  acceptedBy: { type: objectId, ref: 'NteParentAccount' },
}, { timestamps: true, collection: 'nte_family_invitations' });
familyInvitationSchema.index({ familyId: 1, inviteeContact: 1, status: 1 });

const familyAccessDisputeSchema = createSchema({
  familyId: { type: objectId, ref: 'NteFamily', required: true, index: true, immutable: true },
  reporterId: { type: objectId, ref: 'NteParentAccount', required: true, index: true, immutable: true },
  subjectGuardianId: { type: objectId, ref: 'NteParentAccount', required: true, index: true, immutable: true },
  affectedGuardianId: { type: objectId, ref: 'NteParentAccount', required: true, index: true, immutable: true },
  reason: { type: String, required: true, trim: true, minlength: 10, maxlength: 2000, select: false, immutable: true },
  status: { type: String, enum: ['open', 'resolved'], default: 'open', required: true, index: true },
  resolution: { type: String, enum: ['maintain_restriction', 'restore_connection'] },
  resolutionReason: { type: String, trim: true, minlength: 10, maxlength: 2000, select: false },
  resolvedBy: { type: objectId, ref: 'NteParentAccount', select: false },
  resolvedAt: Date,
}, { timestamps: true, collection: 'nte_family_access_disputes' });
familyAccessDisputeSchema.index({ status: 1, createdAt: 1 });

const studentSchema = createSchema({
  familyId: { type: objectId, ref: 'NteFamily', required: true, index: true },
  preferredName: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
  ageGroup: { type: String, enum: ['child', 'youth'], required: true },
  preferredLanguage: { type: String, enum: ['en', 'hi', 'ml', 'ta'], default: 'en', required: true },
  status: { type: String, enum: ['pending_consent', 'active', 'archived'], default: 'pending_consent', index: true },
}, { timestamps: true, collection: 'nte_student_profiles' });

const relationshipSchema = createSchema({
  familyId: { type: objectId, ref: 'NteFamily', required: true, index: true },
  guardianId: { type: objectId, ref: 'NteParentAccount', required: true, index: true },
  studentId: { type: objectId, ref: 'NteStudentProfile', required: true, index: true },
  relationshipType: { type: String, enum: ['parent', 'guardian'], required: true },
  relationshipStatus: { type: String, enum: ['pending_consent', 'active', 'revoked', 'archived'], default: 'pending_consent', required: true },
  consentStatus: { type: String, enum: ['not_recorded', 'granted', 'revoked'], default: 'not_recorded', required: true },
  consentPolicyId: String,
  consentPolicyVersion: String,
  consentLanguageCode: String,
  consentRecordedAt: Date,
  consentRevokedAt: Date,
}, { timestamps: true, collection: 'nte_guardian_relationships' });
relationshipSchema.index({ guardianId: 1, studentId: 1 }, { unique: true });

const sessionSchema = createSchema({
  parentId: { type: objectId, ref: 'NteParentAccount', required: true, index: true },
  refreshTokenHash: { type: String, required: true, unique: true, select: false },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  revokedAt: Date,
  lastUsedAt: Date,
}, { timestamps: true, collection: 'nte_auth_sessions' });
sessionSchema.index({ parentId: 1, revokedAt: 1 });

const challengeSchema = createSchema({
  parentId: { type: objectId, ref: 'NteParentAccount', required: true, index: true },
  contact: { type: String, required: true, select: false },
  purpose: { type: String, enum: ['registration', 'recovery'], required: true },
  tokenHash: { type: String, required: true, select: false },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
  attempts: { type: Number, default: 0, min: 0 },
  consumedAt: Date,
}, { timestamps: true, collection: 'nte_identity_challenges' });

const policySchema = createSchema({
  policyId: { type: String, required: true, trim: true },
  version: { type: String, required: true, trim: true },
  languageCode: { type: String, enum: ['en', 'hi', 'ml', 'ta'], required: true },
  title: { type: String, required: true, maxlength: 240 },
  body: { type: String, required: true, maxlength: 100_000 },
  reviewStatus: { type: String, enum: ['draft', 'approved', 'published', 'retired'], default: 'draft', required: true },
  effectiveAt: Date,
  retiredAt: Date,
}, { timestamps: true, collection: 'nte_consent_policies' });
policySchema.index({ policyId: 1, version: 1, languageCode: 1 }, { unique: true });
policySchema.index({ reviewStatus: 1, languageCode: 1, effectiveAt: 1 });

const consentEventSchema = createSchema({
  relationshipId: { type: objectId, ref: 'NteGuardianRelationship', required: true, index: true, immutable: true },
  familyId: { type: objectId, ref: 'NteFamily', required: true, index: true, immutable: true },
  actorId: { type: objectId, ref: 'NteParentAccount', required: true, immutable: true },
  action: { type: String, enum: ['granted', 'revoked'], required: true, immutable: true },
  policyId: { type: String, required: true, immutable: true },
  policyVersion: { type: String, required: true, immutable: true },
  languageCode: { type: String, required: true, immutable: true },
  occurredAt: { type: Date, required: true, immutable: true },
  requestId: { type: String, required: true, immutable: true },
}, { timestamps: false, collection: 'nte_consent_events' });
consentEventSchema.index({ relationshipId: 1, occurredAt: -1 });

const auditSchema = createSchema({
  actorId: { type: objectId, ref: 'NteParentAccount', required: true, immutable: true },
  familyId: { type: objectId, ref: 'NteFamily', immutable: true },
  subjectId: { type: objectId, immutable: true },
  eventType: { type: String, required: true, maxlength: 80, immutable: true },
  requestId: { type: String, required: true, immutable: true },
  occurredAt: { type: Date, required: true, immutable: true },
  details: { type: Schema.Types.Mixed, default: {}, immutable: true },
}, { timestamps: false, collection: 'nte_audit_events' });
auditSchema.index({ familyId: 1, occurredAt: -1 });
auditSchema.index({ actorId: 1, occurredAt: -1 });

const safeguardingReportSchema = createSchema({
  reportId: { type: String, required: true, unique: true, immutable: true, index: true },
  reporterId: { type: objectId, ref: 'NteParentAccount', required: true, immutable: true, select: false, index: true },
  reporterFamilyId: { type: objectId, ref: 'NteFamily', select: false, index: true },
  category: { type: String, enum: ['safety', 'wellbeing', 'conduct', 'other'], required: true },
  urgency: { type: String, enum: ['routine', 'urgent'], required: true },
  description: { type: String, required: true, trim: true, minlength: 10, maxlength: 4000, select: false },
  resourceType: { type: String, enum: ['club', 'event', 'programme', 'other'] },
  resourceId: { type: String, trim: true, maxlength: 120 },
  subjectStudentId: { type: objectId, ref: 'NteStudentProfile', select: false },
  subjectGuardianId: { type: objectId, ref: 'NteParentAccount', select: false },
  status: { type: String, enum: ['submitted', 'acknowledged', 'assigned', 'escalated', 'resolved', 'closed'], default: 'submitted', required: true, index: true },
  assignedTo: { type: objectId, ref: 'NteParentAccount', select: false },
  resolvedAt: Date,
  closedAt: Date,
}, { timestamps: true, collection: 'nte_safeguarding_reports' });
safeguardingReportSchema.index({ status: 1, urgency: 1, createdAt: 1 });

const safeguardingNoteSchema = createSchema({
  reportId: { type: String, required: true, immutable: true, index: true },
  authorId: { type: objectId, ref: 'NteParentAccount', required: true, immutable: true },
  body: { type: String, required: true, trim: true, minlength: 1, maxlength: 3000 },
  createdAt: { type: Date, required: true, immutable: true },
}, { timestamps: false, collection: 'nte_safeguarding_notes' });
safeguardingNoteSchema.index({ reportId: 1, createdAt: 1 });

const safeguardingAuditSchema = createSchema({
  reportId: { type: String, required: true, immutable: true, index: true },
  actorId: { type: objectId, ref: 'NteParentAccount', required: true, immutable: true },
  action: { type: String, required: true, maxlength: 80, immutable: true },
  reason: { type: String, required: true, maxlength: 1000, immutable: true },
  requestId: { type: String, required: true, immutable: true },
  occurredAt: { type: Date, required: true, immutable: true },
}, { timestamps: false, collection: 'nte_safeguarding_audit_events' });
safeguardingAuditSchema.index({ actorId: 1, occurredAt: -1 });
safeguardingAuditSchema.index({ reportId: 1, occurredAt: -1 });

const learningTopicSchema = createSchema({
  topicId: { type: String, required: true, trim: true, lowercase: true, unique: true, maxlength: 80 },
  labels: {
    en: { type: String, trim: true, maxlength: 120 },
    hi: { type: String, trim: true, maxlength: 120 },
    ml: { type: String, trim: true, maxlength: 120 },
    ta: { type: String, trim: true, maxlength: 120 },
  },
  publicationStatus: { type: String, enum: ['draft', 'in_review', 'published', 'archived'], default: 'draft', required: true, index: true },
}, { timestamps: true, collection: 'nte_learning_topics' });

const learningContentSchema = createSchema({
  contentId: { type: String, required: true, trim: true, unique: true, maxlength: 120 },
  contentGroupId: { type: String, required: true, trim: true, index: true, maxlength: 120 },
  title: { type: String, required: true, trim: true, maxlength: 240 },
  description: { type: String, required: true, maxlength: 4000 },
  contentLanguage: { type: String, enum: ['en', 'hi', 'ml', 'ta'], required: true, index: true },
  mediaType: { type: String, enum: ['audio', 'video', 'reading'], required: true },
  readingBody: { type: String, trim: true, maxlength: 20000, select: false },
  mediaAssetKey: { type: String, trim: true, maxlength: 500, select: false },
  thumbnailAssetKey: { type: String, trim: true, maxlength: 500, select: false },
  durationSeconds: { type: Number, min: 1 },
  topicIds: [{ type: String, trim: true, lowercase: true }],
  programmeId: { type: String, trim: true, maxlength: 120 },
  programmeName: { type: String, trim: true, maxlength: 240 },
  ageBands: [{ type: String, enum: ['child', 'youth'] }],
  learningObjectives: [{ type: String, trim: true, maxlength: 500 }],
  accessRequirement: { type: String, enum: ['free', 'paid'], required: true },
  priceAmountMinor: { type: Number, min: 1 },
  priceCurrency: { type: String, match: /^[A-Z]{3}$/ },
  priceCurrencyExponent: { type: Number, min: 0, max: 3 },
  purchaseType: { type: String, enum: ['one_time', 'subscription'] },
  purchaseTermsVersion: { type: String, trim: true, maxlength: 80 },
  purchaseTerms: { type: String, maxlength: 8000 },
  purchaseTermsLanguageCode: { type: String, enum: ['en', 'hi', 'ml', 'ta'] },
  purchaseTermsReviewStatus: { type: String, enum: ['unreviewed', 'approved'], default: 'unreviewed' },
  publicationStatus: { type: String, enum: ['draft', 'in_review', 'published', 'archived'], default: 'draft', required: true, index: true },
  publishedAt: Date,
}, { timestamps: true, collection: 'nte_learning_content' });
learningContentSchema.index({ publicationStatus: 1, contentLanguage: 1, publishedAt: -1 });
learningContentSchema.index({ publicationStatus: 1, ageBands: 1, topicIds: 1 });
learningContentSchema.index({ contentGroupId: 1, contentLanguage: 1 }, { unique: true });

// Programme records are deliberately separate from learning media. Only an
// approved publishing workflow may create published records; this phase adds
// no public authoring route and seeds no catalogue data.
const programmeSchema = createSchema({
  programmeId: { type: String, required: true, trim: true, lowercase: true, unique: true, maxlength: 120 },
  title: { type: String, required: true, trim: true, maxlength: 240 },
  description: { type: String, required: true, maxlength: 4000 },
  contentLanguage: { type: String, enum: ['en', 'hi', 'ml', 'ta'], required: true, index: true },
  availableLanguages: [{ type: String, enum: ['en', 'hi', 'ml', 'ta'] }],
  ageBands: [{ type: String, enum: ['child', 'youth'] }],
  durationMinutes: { type: Number, min: 1 },
  learningObjectives: [{ type: String, trim: true, maxlength: 500 }],
  accessRequirement: { type: String, enum: ['free', 'paid'], required: true },
  priceAmountMinor: { type: Number, min: 1 },
  priceCurrency: { type: String, match: /^[A-Z]{3}$/ },
  priceCurrencyExponent: { type: Number, min: 0, max: 3 },
  purchaseType: { type: String, enum: ['one_time', 'subscription'] },
  purchaseTermsVersion: { type: String, trim: true, maxlength: 80 },
  purchaseTerms: { type: String, maxlength: 8000 },
  purchaseTermsLanguageCode: { type: String, enum: ['en', 'hi', 'ml', 'ta'] },
  purchaseTermsReviewStatus: { type: String, enum: ['unreviewed', 'approved'], default: 'unreviewed' },
  publicationStatus: { type: String, enum: ['draft', 'in_review', 'published', 'archived'], default: 'draft', required: true, index: true },
  publishedAt: Date,
}, { timestamps: true, collection: 'nte_programmes' });
programmeSchema.index({ publicationStatus: 1, contentLanguage: 1, publishedAt: -1 });

const programmeModuleSchema = createSchema({
  programmeId: { type: String, required: true, index: true },
  moduleId: { type: String, required: true, trim: true, maxlength: 120 },
  title: { type: String, required: true, trim: true, maxlength: 240 },
  description: { type: String, required: true, maxlength: 4000 },
  contentLanguage: { type: String, enum: ['en', 'hi', 'ml', 'ta'], required: true },
  sortOrder: { type: Number, default: 0 },
  publicationStatus: { type: String, enum: ['draft', 'in_review', 'published', 'archived'], default: 'draft', required: true, index: true },
}, { timestamps: true, collection: 'nte_programme_modules' });
programmeModuleSchema.index({ programmeId: 1, moduleId: 1, contentLanguage: 1 }, { unique: true });

const programmeActivitySchema = createSchema({
  programmeId: { type: String, required: true, index: true },
  activityId: { type: String, required: true, trim: true, maxlength: 120 },
  moduleId: { type: String, trim: true, maxlength: 120 },
  stage: { type: String, enum: ['learn', 'practise', 'participate', 'take_action', 'reflect', 'grow'], default: 'learn', required: true, index: true },
  activityType: { type: String, enum: ['lesson', 'practice', 'assignment', 'participation', 'action', 'reflection', 'recognition'], default: 'lesson', required: true },
  responseRequired: { type: Boolean, default: false, required: true },
  requiresReview: { type: Boolean, default: false, required: true },
  title: { type: String, required: true, trim: true, maxlength: 240 },
  description: { type: String, required: true, maxlength: 4000 },
  contentLanguage: { type: String, enum: ['en', 'hi', 'ml', 'ta'], required: true },
  ageBands: [{ type: String, enum: ['child', 'youth'] }],
  learningContentId: { type: String, trim: true, maxlength: 120 },
  sortOrder: { type: Number, default: 0 },
  publicationStatus: { type: String, enum: ['draft', 'in_review', 'published', 'archived'], default: 'draft', required: true, index: true },
}, { timestamps: true, collection: 'nte_programme_activities' });
programmeActivitySchema.index({ programmeId: 1, publicationStatus: 1, sortOrder: 1 });
programmeActivitySchema.index({ programmeId: 1, activityId: 1, contentLanguage: 1 }, { unique: true });

const programmeEnrollmentSchema = createSchema({
  programmeId: { type: String, required: true, index: true },
  familyId: { type: objectId, ref: 'NteFamily', required: true, index: true },
  guardianId: { type: objectId, ref: 'NteParentAccount', required: true, index: true },
  studentId: { type: objectId, ref: 'NteStudentProfile', required: true, index: true },
  status: { type: String, enum: ['active', 'completed', 'withdrawn'], default: 'active', required: true, index: true },
  enrolledAt: { type: Date, required: true },
  completedAt: Date,
}, { timestamps: true, collection: 'nte_programme_enrollments' });
programmeEnrollmentSchema.index({ programmeId: 1, studentId: 1 }, { unique: true });

const programmeProgressSchema = createSchema({
  programmeId: { type: String, required: true, index: true },
  activityId: { type: String, required: true },
  familyId: { type: objectId, ref: 'NteFamily', required: true, index: true },
  guardianId: { type: objectId, ref: 'NteParentAccount', required: true, index: true },
  studentId: { type: objectId, ref: 'NteStudentProfile', required: true, index: true },
  status: { type: String, enum: ['not_started', 'in_progress', 'completed'], required: true },
  recordedBy: { type: objectId, ref: 'NteParentAccount', required: true },
  recordedAt: { type: Date, required: true },
  completionSource: { type: String, enum: ['guardian_recorded', 'activity_submission', 'system_earned'], default: 'guardian_recorded', required: true },
}, { timestamps: true, collection: 'nte_programme_progress' });
programmeProgressSchema.index({ programmeId: 1, activityId: 1, studentId: 1 }, { unique: true });

const programmeSubmissionSchema = createSchema({
  programmeId: { type: String, required: true, index: true, immutable: true },
  activityId: { type: String, required: true, index: true, immutable: true },
  familyId: { type: objectId, ref: 'NteFamily', required: true, index: true, immutable: true },
  guardianId: { type: objectId, ref: 'NteParentAccount', required: true, index: true, immutable: true },
  studentId: { type: objectId, ref: 'NteStudentProfile', required: true, index: true, immutable: true },
  attempt: { type: Number, required: true, min: 1, immutable: true },
  responseText: { type: String, required: true, trim: true, minlength: 1, maxlength: 4000, select: false, immutable: true },
  status: { type: String, enum: ['submitted', 'reviewed', 'needs_revision'], default: 'submitted', required: true, index: true },
  feedback: { type: String, trim: true, maxlength: 2000, select: false },
  reviewedBy: { type: objectId, ref: 'NteParentAccount' },
  reviewedAt: Date,
  submittedAt: { type: Date, required: true, immutable: true },
}, { timestamps: true, collection: 'nte_programme_submissions' });
programmeSubmissionSchema.index({ programmeId: 1, activityId: 1, studentId: 1, attempt: 1 }, { unique: true });
programmeSubmissionSchema.index({ status: 1, submittedAt: 1 });

const learningContentProgressSchema = createSchema({
  contentId: { type: String, required: true, index: true, immutable: true },
  accountId: { type: objectId, ref: 'NteParentAccount', required: true, index: true, immutable: true },
  familyId: { type: objectId, ref: 'NteFamily' },
  studentId: { type: objectId, ref: 'NteStudentProfile' },
  status: { type: String, enum: ['in_progress', 'completed'], required: true },
  lastOpenedAt: { type: Date, required: true },
  completedAt: Date,
}, { timestamps: true, collection: 'nte_learning_progress' });
learningContentProgressSchema.index({ contentId: 1, accountId: 1, studentId: 1 }, { unique: true });
learningContentProgressSchema.index({ accountId: 1, lastOpenedAt: -1 });

const learningBookmarkSchema = createSchema({
  contentId: { type: String, required: true, index: true, immutable: true },
  accountId: { type: objectId, ref: 'NteParentAccount', required: true, index: true, immutable: true },
  studentId: { type: objectId, ref: 'NteStudentProfile' },
  bookmarkedAt: { type: Date, required: true },
}, { timestamps: true, collection: 'nte_learning_bookmarks' });
learningBookmarkSchema.index({ accountId: 1, contentId: 1, studentId: 1 }, { unique: true });

const paymentOrderSchema = createSchema({
  orderId: { type: String, required: true, unique: true, immutable: true, index: true },
  idempotencyKey: { type: String, required: true, immutable: true, maxlength: 120 },
  guardianId: { type: objectId, ref: 'NteParentAccount', required: true, immutable: true, index: true },
  familyId: { type: objectId, ref: 'NteFamily', required: true, immutable: true, index: true },
  studentId: { type: objectId, ref: 'NteStudentProfile', required: true, immutable: true, index: true },
  learnerName: { type: String, required: true, immutable: true, maxlength: 80 },
  programmeId: { type: String, required: true, immutable: true, index: true },
  programmeTitle: { type: String, required: true, immutable: true, maxlength: 240 },
  amountMinor: { type: Number, required: true, min: 1, immutable: true },
  currency: { type: String, required: true, match: /^[A-Z]{3}$/, immutable: true },
  currencyExponent: { type: Number, required: true, min: 0, max: 3, immutable: true },
  purchaseType: { type: String, enum: ['one_time', 'subscription'], required: true, immutable: true },
  purchaseTermsVersion: { type: String, required: true, immutable: true },
  purchaseTermsLanguageCode: { type: String, enum: ['en', 'hi', 'ml', 'ta'], required: true, immutable: true },
  providerId: { type: String, required: true, immutable: true },
  providerOrderReference: { type: String, maxlength: 200, select: false },
  providerTransactionReference: { type: String, maxlength: 200, select: false },
  status: { type: String, enum: ['pending', 'succeeded', 'failed', 'cancelled', 'refunded', 'partially_refunded', 'reversed', 'chargeback'], default: 'pending', required: true, index: true },
  checkoutUrl: { type: String, maxlength: 2000, select: false },
  receiptReference: { type: String, maxlength: 200, select: false },
  verifiedAt: Date,
  expiresAt: Date,
}, { timestamps: true, collection: 'nte_payment_orders' });
paymentOrderSchema.index({ guardianId: 1, createdAt: -1 });
paymentOrderSchema.index({ guardianId: 1, idempotencyKey: 1 }, { unique: true });
paymentOrderSchema.index({ providerId: 1, providerOrderReference: 1 }, { unique: true, sparse: true });
paymentOrderSchema.index({ providerId: 1, providerTransactionReference: 1 }, { unique: true, sparse: true });

const paymentEntitlementSchema = createSchema({
  guardianId: { type: objectId, ref: 'NteParentAccount', required: true, immutable: true, index: true },
  familyId: { type: objectId, ref: 'NteFamily', required: true, immutable: true, index: true },
  studentId: { type: objectId, ref: 'NteStudentProfile', required: true, immutable: true, index: true },
  programmeId: { type: String, required: true, immutable: true, index: true },
  orderId: { type: String, required: true, immutable: true, unique: true },
  providerId: { type: String, required: true, immutable: true },
  providerTransactionReference: { type: String, required: true, immutable: true, select: false },
  amountMinor: { type: Number, required: true, min: 1, immutable: true },
  currency: { type: String, required: true, match: /^[A-Z]{3}$/, immutable: true },
  currencyExponent: { type: Number, required: true, min: 0, max: 3, immutable: true },
  status: { type: String, enum: ['active', 'expired', 'revoked', 'review_required'], default: 'active', required: true, index: true },
  grantedAt: { type: Date, required: true, immutable: true },
  expiresAt: Date,
  revokedAt: Date,
  revocationReason: { type: String, enum: ['refund', 'reversal', 'chargeback', 'manual_override', 'partial_refund_review'] },
}, { timestamps: true, collection: 'nte_payment_entitlements' });
paymentEntitlementSchema.index({ guardianId: 1, studentId: 1, programmeId: 1, status: 1 });

const paymentWebhookEventSchema = createSchema({
  providerId: { type: String, required: true, immutable: true },
  providerEventId: { type: String, required: true, immutable: true },
  orderId: { type: String, required: true, immutable: true, index: true },
  eventType: { type: String, required: true, immutable: true, maxlength: 80 },
  payloadDigest: { type: String, maxlength: 128, select: false },
  status: { type: String, enum: ['processed'], default: 'processed', required: true },
  occurredAt: { type: Date, required: true, immutable: true },
}, { timestamps: false, collection: 'nte_payment_webhook_events' });
paymentWebhookEventSchema.index({ providerId: 1, providerEventId: 1 }, { unique: true });

const refundRequestSchema = createSchema({
  refundRequestId: { type: String, required: true, unique: true, immutable: true },
  orderId: { type: String, required: true, immutable: true, index: true },
  guardianId: { type: objectId, ref: 'NteParentAccount', required: true, immutable: true, index: true },
  familyId: { type: objectId, ref: 'NteFamily', required: true, immutable: true, index: true },
  studentId: { type: objectId, ref: 'NteStudentProfile', required: true, immutable: true, index: true },
  reasonCode: { type: String, enum: ['duplicate', 'unable_to_access', 'other'], required: true },
  message: { type: String, trim: true, maxlength: 1200 },
  status: { type: String, enum: ['requested', 'under_review', 'approved_for_provider', 'denied', 'provider_pending', 'issued', 'failed'], default: 'requested', required: true, index: true },
  amountMinor: { type: Number, min: 1 },
  currency: { type: String, match: /^[A-Z]{3}$/ },
  providerRefundReference: { type: String, maxlength: 200, select: false },
  providerConfirmedAt: Date,
  reviewedBy: { type: objectId, ref: 'NteParentAccount' },
  reviewedAt: Date,
}, { timestamps: true, collection: 'nte_refund_requests' });
refundRequestSchema.index({ guardianId: 1, createdAt: -1 });

const paymentSupportNoteSchema = createSchema({
  refundRequestId: { type: String, required: true, index: true, immutable: true },
  authorId: { type: objectId, ref: 'NteParentAccount', required: true, immutable: true },
  body: { type: String, required: true, trim: true, minlength: 1, maxlength: 2000 },
  createdAt: { type: Date, required: true, immutable: true },
}, { timestamps: false, collection: 'nte_payment_support_notes' });
paymentSupportNoteSchema.index({ refundRequestId: 1, createdAt: 1 });

const paymentAuditSchema = createSchema({
  actorType: { type: String, enum: ['guardian', 'finance_support', 'provider'], required: true, immutable: true },
  actorId: { type: objectId, ref: 'NteParentAccount', immutable: true },
  eventType: { type: String, required: true, maxlength: 100, immutable: true },
  orderId: { type: String, immutable: true, index: true },
  refundRequestId: { type: String, immutable: true, index: true },
  requestId: { type: String, required: true, immutable: true },
  occurredAt: { type: Date, required: true, immutable: true },
  details: { type: Schema.Types.Mixed, default: {}, immutable: true },
}, { timestamps: false, collection: 'nte_payment_audit_events' });
paymentAuditSchema.index({ actorId: 1, occurredAt: -1 });

const clubApplicationSchema = createSchema({
  communityId: { type: objectId, ref: 'NteCommunity', index: true },
  applicantId: { type: objectId, ref: 'NteParentAccount', required: true, index: true },
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  purpose: { type: String, required: true, trim: true, minlength: 10, maxlength: 1200 },
  approximateLocality: { type: String, required: true, trim: true, maxlength: 100 },
  meetingFormat: { type: String, enum: ['online', 'in_person', 'hybrid'], required: true },
  ageBands: [{ type: String, enum: ['child', 'youth'] }],
  status: { type: String, enum: ['awaiting_verification', 'pending_review', 'approved', 'rejected', 'cancelled'], default: 'awaiting_verification', required: true, index: true },
  adultVerificationStatus: { type: String, enum: ['unavailable', 'pending', 'verified'], default: 'unavailable', required: true, index: true },
  clubId: { type: objectId, ref: 'NteClub' },
  reviewerId: { type: objectId, ref: 'NteParentAccount' },
  reviewedAt: Date,
  reviewNote: { type: String, trim: true, maxlength: 500 },
}, { timestamps: true, collection: 'nte_club_applications' });
clubApplicationSchema.index({ applicantId: 1, createdAt: -1 });

const clubSchema = createSchema({
  communityId: { type: objectId, ref: 'NteCommunity', index: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  purpose: { type: String, required: true, trim: true, maxlength: 1200 },
  approximateLocality: { type: String, required: true, trim: true, maxlength: 100 },
  meetingFormat: { type: String, enum: ['online', 'in_person', 'hybrid'], required: true },
  ageBands: [{ type: String, enum: ['child', 'youth'] }],
  status: { type: String, enum: ['approved', 'suspended', 'archived'], default: 'approved', required: true, index: true },
  leaderAccountIds: [{ type: objectId, ref: 'NteParentAccount', required: true }],
  createdFromApplicationId: { type: objectId, ref: 'NteClubApplication', required: true, unique: true },
  approvedBy: { type: objectId, ref: 'NteParentAccount', required: true },
  approvedAt: { type: Date, required: true },
  suspendedBy: { type: objectId, ref: 'NteParentAccount' },
  suspendedAt: Date,
  moderationReason: { type: String, trim: true, maxlength: 500 },
}, { timestamps: true, collection: 'nte_clubs' });
clubSchema.index({ status: 1, approximateLocality: 1, ageBands: 1 });

const clubMembershipSchema = createSchema({
  clubId: { type: objectId, ref: 'NteClub', required: true, index: true },
  familyId: { type: objectId, ref: 'NteFamily', required: true, index: true },
  guardianId: { type: objectId, ref: 'NteParentAccount', required: true, index: true },
  studentId: { type: objectId, ref: 'NteStudentProfile', required: true, index: true },
  status: { type: String, enum: ['pending_guardian', 'pending_leader', 'accepted', 'declined', 'cancelled'], default: 'pending_guardian', required: true, index: true },
  guardianApprovalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', required: true },
  guardianReviewedAt: Date,
  leaderDecision: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending', required: true },
  leaderAccountId: { type: objectId, ref: 'NteParentAccount' },
  leaderDecidedAt: Date,
  activeKey: { type: String, unique: true, sparse: true, select: false },
  cancelledAt: Date,
}, { timestamps: true, collection: 'nte_club_membership_requests' });
clubMembershipSchema.index({ guardianId: 1, createdAt: -1 });
clubMembershipSchema.index({ clubId: 1, status: 1, createdAt: 1 });

const clubAnnouncementSchema = createSchema({
  clubId: { type: objectId, ref: 'NteClub', required: true, index: true, immutable: true },
  authorId: { type: objectId, ref: 'NteParentAccount', required: true, immutable: true },
  body: { type: String, required: true, trim: true, minlength: 1, maxlength: 1600 },
  status: { type: String, enum: ['published', 'removed'], default: 'published', required: true, index: true },
  removedBy: { type: objectId, ref: 'NteParentAccount' },
  removedAt: Date,
}, { timestamps: true, collection: 'nte_club_announcements' });
clubAnnouncementSchema.index({ clubId: 1, status: 1, createdAt: -1 });

const eventSchema = createSchema({
  clubId: { type: objectId, ref: 'NteClub', required: true, index: true, immutable: true },
  title: { type: String, required: true, trim: true, minlength: 2, maxlength: 160 },
  description: { type: String, required: true, trim: true, minlength: 10, maxlength: 4000 },
  startsAt: { type: Date, required: true, index: true },
  endsAt: { type: Date, required: true },
  approximateLocality: { type: String, required: true, trim: true, maxlength: 100 },
  ageBands: [{ type: String, enum: ['child', 'youth'] }],
  capacity: { type: Number, required: true, min: 1, max: 10000 },
  confirmedCount: { type: Number, default: 0, min: 0 },
  participationInstructions: { type: String, trim: true, maxlength: 2000 },
  status: { type: String, enum: ['published', 'cancelled'], default: 'published', required: true, index: true },
  createdBy: { type: objectId, ref: 'NteParentAccount', required: true },
  cancelledBy: { type: objectId, ref: 'NteParentAccount' },
  cancelledAt: Date,
}, { timestamps: true, collection: 'nte_events' });
eventSchema.index({ status: 1, startsAt: 1, clubId: 1 });

const eventRegistrationSchema = createSchema({
  eventId: { type: objectId, ref: 'NteEvent', required: true, index: true },
  clubId: { type: objectId, ref: 'NteClub', required: true, index: true },
  familyId: { type: objectId, ref: 'NteFamily', required: true, index: true },
  guardianId: { type: objectId, ref: 'NteParentAccount', required: true, index: true },
  studentId: { type: objectId, ref: 'NteStudentProfile', required: true, index: true },
  status: { type: String, enum: ['pending_guardian', 'confirmed', 'waitlisted', 'declined', 'cancelled'], default: 'pending_guardian', required: true, index: true },
  guardianApprovalStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', required: true },
  guardianReviewedAt: Date,
  activeKey: { type: String, unique: true, sparse: true, select: false },
  cancelledAt: Date,
}, { timestamps: true, collection: 'nte_event_registrations' });
eventRegistrationSchema.index({ eventId: 1, status: 1, createdAt: 1 });
eventRegistrationSchema.index({ guardianId: 1, createdAt: -1 });

const attendanceSchema = createSchema({
  eventId: { type: objectId, ref: 'NteEvent', required: true, immutable: true, index: true },
  registrationId: { type: objectId, ref: 'NteEventRegistration', required: true, immutable: true, unique: true },
  studentId: { type: objectId, ref: 'NteStudentProfile', required: true, immutable: true },
  status: { type: String, enum: ['present', 'absent', 'excused'], required: true },
  recordedBy: { type: objectId, ref: 'NteParentAccount', required: true },
  recordedAt: { type: Date, required: true },
}, { timestamps: true, collection: 'nte_event_attendance' });

const eventAnnouncementSchema = createSchema({
  eventId: { type: objectId, ref: 'NteEvent', required: true, immutable: true, index: true },
  authorId: { type: objectId, ref: 'NteParentAccount', required: true, immutable: true },
  body: { type: String, required: true, trim: true, minlength: 1, maxlength: 1600 },
  status: { type: String, enum: ['published', 'removed'], default: 'published', required: true, index: true },
  removedBy: { type: objectId, ref: 'NteParentAccount' },
  removedAt: Date,
}, { timestamps: true, collection: 'nte_event_announcements' });
eventAnnouncementSchema.index({ eventId: 1, status: 1, createdAt: -1 });

// Configurable national/state/district/local community tree. Region labels and
// codes are data, so expansion is not tied to a single state's geography.
const communitySchema = createSchema({
  level: { type: String, enum: ['national', 'state', 'district', 'local'], required: true, index: true },
  audience: { type: String, enum: ['all', 'families', 'mothers', 'fathers', 'students'], default: 'all', required: true, index: true },
  parentCommunityId: { type: objectId, ref: 'NteCommunity', default: null, index: true },
  code: { type: String, required: true, trim: true, lowercase: true, maxlength: 80 },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  localityLabel: { type: String, trim: true, maxlength: 160 },
  status: { type: String, enum: ['draft', 'approved', 'suspended', 'archived'], default: 'draft', required: true, index: true },
  createdBy: { type: objectId, ref: 'NteParentAccount', required: true, immutable: true },
  approvedBy: { type: objectId, ref: 'NteParentAccount' }, approvedAt: Date,
  moderationReason: { type: String, trim: true, maxlength: 1000 },
}, { timestamps: true, collection: 'nte_communities' });
communitySchema.index({ parentCommunityId: 1, code: 1 }, { unique: true });

const communityMembershipSchema = createSchema({
  communityId: { type: objectId, ref: 'NteCommunity', required: true, index: true, immutable: true },
  accountId: { type: objectId, ref: 'NteParentAccount', required: true, index: true, immutable: true },
  membershipCategory: { type: String, enum: ['mother', 'father', 'guardian', 'student'], required: true, immutable: true },
  studentId: { type: objectId, ref: 'NteStudentProfile', index: true, immutable: true },
  status: { type: String, enum: ['pending_guardian', 'pending_review', 'active', 'rejected', 'cancelled', 'suspended'], default: 'pending_review', required: true, index: true },
  guardianApprovedAt: Date, decidedBy: { type: objectId, ref: 'NteParentAccount' }, decidedAt: Date,
  activeKey: { type: String, unique: true, sparse: true, select: false },
}, { timestamps: true, collection: 'nte_community_memberships' });
communityMembershipSchema.index({ accountId: 1, communityId: 1, studentId: 1 }, { unique: true });
communityMembershipSchema.index({ communityId: 1, status: 1, createdAt: 1 });

const communityAnnouncementSchema = createSchema({
  communityId: { type: objectId, ref: 'NteCommunity', required: true, index: true, immutable: true },
  authorId: { type: objectId, ref: 'NteParentAccount', required: true, immutable: true },
  body: { type: String, required: true, trim: true, minlength: 1, maxlength: 1600 },
  status: { type: String, enum: ['published', 'removed'], default: 'published', required: true, index: true },
  removedBy: { type: objectId, ref: 'NteParentAccount' }, removedAt: Date,
}, { timestamps: true, collection: 'nte_community_announcements' });
communityAnnouncementSchema.index({ communityId: 1, status: 1, createdAt: -1 });

const communityAppointmentSchema = createSchema({
  communityId: { type: objectId, ref: 'NteCommunity', required: true, index: true, immutable: true },
  accountId: { type: objectId, ref: 'NteParentAccount', required: true, index: true, immutable: true },
  role: { type: String, enum: ['state_leader', 'district_leader', 'community_leader', 'community_moderator', 'approved_trainer', 'approved_mentor'], required: true, immutable: true },
  status: { type: String, enum: ['active', 'revoked'], default: 'active', required: true, index: true },
  appointedBy: { type: objectId, ref: 'NteParentAccount', required: true, immutable: true }, appointedAt: { type: Date, required: true, immutable: true },
  revokedBy: { type: objectId, ref: 'NteParentAccount' }, revokedAt: Date, reason: { type: String, trim: true, maxlength: 1000 },
}, { timestamps: true, collection: 'nte_community_appointments' });
communityAppointmentSchema.index({ communityId: 1, accountId: 1, role: 1 }, { unique: true, partialFilterExpression: { status: 'active' } });

const communityParticipationSchema = createSchema({
  communityId: { type: objectId, ref: 'NteCommunity', required: true, index: true, immutable: true },
  membershipId: { type: objectId, ref: 'NteCommunityMembership', required: true, index: true, immutable: true },
  activityType: { type: String, enum: ['event_attendance', 'volunteering', 'leadership_contribution', 'practical_activity', 'recognition'], required: true, immutable: true },
  description: { type: String, required: true, trim: true, minlength: 3, maxlength: 500 },
  sourceEventId: { type: objectId, ref: 'NteEvent' },
  recordedBy: { type: objectId, ref: 'NteParentAccount', required: true, immutable: true }, recordedAt: { type: Date, required: true, immutable: true },
  status: { type: String, enum: ['active', 'retracted'], default: 'active', required: true, index: true },
}, { timestamps: true, collection: 'nte_community_participation' });
communityParticipationSchema.index({ membershipId: 1, recordedAt: -1 });
communityParticipationSchema.index({ membershipId: 1, sourceEventId: 1, activityType: 1 }, { unique: true, partialFilterExpression: { sourceEventId: { $exists: true } } });

const communityIntroductionSchema = createSchema({
  communityId: { type: objectId, ref: 'NteCommunity', required: true, index: true, immutable: true },
  requesterId: { type: objectId, ref: 'NteParentAccount', required: true, index: true, immutable: true },
  recipientId: { type: objectId, ref: 'NteParentAccount', required: true, index: true, immutable: true },
  message: { type: String, required: true, trim: true, minlength: 10, maxlength: 500, select: false, immutable: true },
  status: { type: String, enum: ['pending', 'accepted', 'declined', 'cancelled'], default: 'pending', required: true, index: true },
  decidedAt: Date,
}, { timestamps: true, collection: 'nte_community_introductions' });
communityIntroductionSchema.index({ communityId: 1, requesterId: 1, recipientId: 1, status: 1 });
communityIntroductionSchema.index({ communityId: 1, requesterId: 1, recipientId: 1 }, { unique: true, partialFilterExpression: { status: 'pending' } });

function model(name: string, schema: Schema<any>): Model<any> {
  return (mongoose.models[name] as Model<any> | undefined) ?? (mongoose.model(name, schema) as Model<any>);
}

export const ParentAccount = model('NteParentAccount', parentSchema);
export const Family = model('NteFamily', familySchema);
export const FamilyGuardian = model('NteFamilyGuardian', familyGuardianSchema);
export const FamilyInvitation = model('NteFamilyInvitation', familyInvitationSchema);
export const FamilyAccessDispute = model('NteFamilyAccessDispute', familyAccessDisputeSchema);
export const StudentProfile = model('NteStudentProfile', studentSchema);
export const GuardianRelationship = model('NteGuardianRelationship', relationshipSchema);
export const AuthSession = model('NteAuthSession', sessionSchema);
export const IdentityChallenge = model('NteIdentityChallenge', challengeSchema);
export const ConsentPolicy = model('NteConsentPolicy', policySchema);
export const ConsentEvent = model('NteConsentEvent', consentEventSchema);
export const AuditEvent = model('NteAuditEvent', auditSchema);
export const SafeguardingReport = model('NteSafeguardingReport', safeguardingReportSchema);
export const SafeguardingNote = model('NteSafeguardingNote', safeguardingNoteSchema);
export const SafeguardingAuditEvent = model('NteSafeguardingAuditEvent', safeguardingAuditSchema);
export const LearningTopic = model('NteLearningTopic', learningTopicSchema);
export const LearningContent = model('NteLearningContent', learningContentSchema);
export const Programme = model('NteProgramme', programmeSchema);
export const ProgrammeModule = model('NteProgrammeModule', programmeModuleSchema);
export const ProgrammeActivity = model('NteProgrammeActivity', programmeActivitySchema);
export const ProgrammeEnrollment = model('NteProgrammeEnrollment', programmeEnrollmentSchema);
export const ProgrammeProgress = model('NteProgrammeProgress', programmeProgressSchema);
export const ProgrammeSubmission = model('NteProgrammeSubmission', programmeSubmissionSchema);
export const LearningContentProgress = model('NteLearningContentProgress', learningContentProgressSchema);
export const LearningBookmark = model('NteLearningBookmark', learningBookmarkSchema);
export const PaymentOrder = model('NtePaymentOrder', paymentOrderSchema);
export const PaymentEntitlement = model('NtePaymentEntitlement', paymentEntitlementSchema);
export const PaymentWebhookEvent = model('NtePaymentWebhookEvent', paymentWebhookEventSchema);
export const RefundRequest = model('NteRefundRequest', refundRequestSchema);
export const PaymentSupportNote = model('NtePaymentSupportNote', paymentSupportNoteSchema);
export const PaymentAuditEvent = model('NtePaymentAuditEvent', paymentAuditSchema);
export const ClubApplication = model('NteClubApplication', clubApplicationSchema);
export const Club = model('NteClub', clubSchema);
export const ClubMembershipRequest = model('NteClubMembershipRequest', clubMembershipSchema);
export const ClubAnnouncement = model('NteClubAnnouncement', clubAnnouncementSchema);
export const Event = model('NteEvent', eventSchema);
export const EventRegistration = model('NteEventRegistration', eventRegistrationSchema);
export const EventAttendance = model('NteEventAttendance', attendanceSchema);
export const EventAnnouncement = model('NteEventAnnouncement', eventAnnouncementSchema);
export const Community = model('NteCommunity', communitySchema);
export const CommunityMembership = model('NteCommunityMembership', communityMembershipSchema);
export const CommunityAnnouncement = model('NteCommunityAnnouncement', communityAnnouncementSchema);
export const CommunityAppointment = model('NteCommunityAppointment', communityAppointmentSchema);
export const CommunityParticipation = model('NteCommunityParticipation', communityParticipationSchema);
export const CommunityIntroduction = model('NteCommunityIntroduction', communityIntroductionSchema);

export const allNteModels: Model<any>[] = [ParentAccount, Family, FamilyGuardian, FamilyInvitation, FamilyAccessDispute, StudentProfile, GuardianRelationship,
  AuthSession, IdentityChallenge, ConsentPolicy, ConsentEvent, AuditEvent, SafeguardingReport, SafeguardingNote, SafeguardingAuditEvent, LearningTopic, LearningContent,
  Programme, ProgrammeModule, ProgrammeActivity, ProgrammeEnrollment, ProgrammeProgress,
  ProgrammeSubmission, LearningContentProgress, LearningBookmark,
  PaymentOrder, PaymentEntitlement, PaymentWebhookEvent, RefundRequest, PaymentSupportNote, PaymentAuditEvent,
  ClubApplication, Club, ClubMembershipRequest, ClubAnnouncement, Event, EventRegistration, EventAttendance, EventAnnouncement,
  Community, CommunityMembership, CommunityAnnouncement, CommunityAppointment, CommunityParticipation, CommunityIntroduction];
