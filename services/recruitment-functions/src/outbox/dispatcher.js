'use strict';

const {
  NOTIFICATION_EVENTS: EVENTS
} = require('../../../../api/recruitment/core/constants');

const PROJECTION_EVENTS = new Set([
  EVENTS.ApplicationReceived,
  EVENTS.DocumentsReady,
  EVENTS.ManualReviewRequired,
  EVENTS.MaliciousFileDetected,
  EVENTS.QuarantineCleanupRequired
]);

const ACKNOWLEDGEMENT_PROPERTY_ID =
  'String {61d91fcb-ec61-4f51-9a2d-2d6f3307d8bd} Name ShoreVestApplicationReference';

function deliveryError(code, message, permanent = false) {
  return Object.assign(new Error(message), { code, permanent });
}

function compactFields(fields) {
  const output = {};
  for (const [key, value] of Object.entries(fields || {})) {
    if (value !== undefined) output[key] = value;
  }
  return output;
}

function boundedText(value, maximum) {
  const text = String(value || '');
  return text.length <= maximum ? text : text.slice(0, maximum);
}

function applicationFields(application, event) {
  const fields = compactFields({
    Title: application.applicationReference,
    ApplicationReference: application.applicationReference,
    RoleId: application.roleId,
    RoleTitle: application.roleTitle,
    RoleDepartment: application.roleDepartment,
    RoleLocation: application.roleLocation,
    Locale: application.locale,
    Source: application.source,
    CandidateName: application.candidateName,
    CandidateEmail: application.candidateEmail,
    CandidateTelephone: application.candidateTelephone,
    CandidateLocation: application.candidateLocation,
    LinkedInUrl: application.linkedInUrl,
    CoverNote: application.coverNote,
    PrivacyNoticeVersion: application.privacyNoticeVersion,
    PrivacyAcceptedAtUtc: application.privacyAcceptedAtUtc,
    InitiatedAtUtc: application.initiatedAtUtc,
    SubmittedAtClientUtc: application.submittedAtClientUtc,
    SubmittedAtServerUtc: application.submittedAtServerUtc,
    FinalizedAtUtc: application.finalizedAtUtc,
    AccuracyConfirmedAtUtc: application.accuracyConfirmedAtUtc,
    CandidateSubmissionStatus: application.candidateSubmissionStatus,
    TechnicalStatus: application.technicalStatus,
    HiringStage: application.hiringStage,
    FileCount: application.fileCount,
    ReadyFileCount: application.readyFileCount,
    RequiresManualReview: application.requiresManualReview,
    RetentionReviewDate: application.retentionReviewDate,
    LastUpdatedAtUtc: application.lastUpdatedAtUtc
  });

  if ([EVENTS.ApplicationReceived, EVENTS.DocumentsReady].includes(event.type)) {
    fields.NotificationState = 'Pending';
    fields.NotificationEventKey = event.idempotencyKey;
    fields.NotificationSentAtUtc = null;
    fields.NotificationAttemptCount = 0;
    fields.NotificationLastErrorCode = null;
  }
  return fields;
}

function fileFields(file) {
  return compactFields({
    Title: file.fileReference,
    FileReference: file.fileReference,
    ApplicationReference: file.applicationReference,
    FilePurpose: file.filePurpose,
    OriginalFileName: file.originalFileName,
    DeclaredMimeType: file.declaredMimeType,
    DetectedFileType: file.detectedFileType,
    SizeBytes: file.sizeBytes,
    ExpectedHash: file.expectedHash,
    QuarantineBlobPath: file.quarantineBlobPath,
    CleanBlobPath: file.cleanBlobPath,
    QuarantineRemovalPending: file.quarantineRemovalPending,
    TechnicalStatus: file.technicalStatus,
    ScanResult: file.scanResult,
    ScanEventId: file.scanEventId,
    UploadVerifiedAtUtc: file.uploadVerifiedAtUtc,
    ScanStartedAtUtc: file.scanStartedAtUtc,
    ScanCompletedAtUtc: file.scanCompletedAtUtc,
    ReadyAtUtc: file.readyAtUtc,
    QuarantineRemovedAtUtc: file.quarantineRemovedAtUtc,
    RetentionReviewDate: file.retentionReviewDate,
    LastUpdatedAtUtc: file.lastUpdatedAtUtc
  });
}

function acknowledgementMessage(application, config) {
  const submittedAt = application.submittedAtServerUtc || application.finalizedAtUtc || application.lastUpdatedAtUtc;
  const privacyUrl = config.privacyNoticeUrl;
  const reference = application.applicationReference;
  const role = application.roleTitle;
  const name = application.candidateName;

  const chinese = application.locale === 'zh-CN';
  const subject = chinese
    ? `ShoreVest 已收到您的申请 - ${role} - ${reference}`
    : `ShoreVest application received - ${role} - ${reference}`;
  const content = chinese
    ? [
      `${name}，您好：`,
      '',
      `我们已收到您对 ${role} 职位的申请。`,
      `申请编号：${reference}`,
      `提交时间：${submittedAt}`,
      '',
      '我们的招聘团队会审阅您的申请。如需进一步资料或安排面试，我们会通过 ShoreVest 官方渠道与您联系。',
      '',
      `隐私说明：${privacyUrl}`,
      '',
      'ShoreVest 不会在招聘过程中要求候选人付款。请勿向未经核实的联系人提供密码、银行资料或敏感身份证明。',
      '',
      'ShoreVest 人力资源团队'
    ].join('\n')
    : [
      `Dear ${name},`,
      '',
      `We have received your application for the ${role} position.`,
      `Application reference: ${reference}`,
      `Submitted: ${submittedAt}`,
      '',
      'Our recruitment team will review your application. We will contact you through an official ShoreVest channel if we require further information or would like to arrange an interview.',
      '',
      `Privacy notice: ${privacyUrl}`,
      '',
      'ShoreVest will never ask a candidate to make a payment during the recruitment process. Do not provide passwords, banking information, or sensitive identity documents to an unverified contact.',
      '',
      'ShoreVest Human Resources'
    ].join('\n');

  return {
    subject: boundedText(subject, 255),
    body: {
      contentType: 'Text',
      content
    },
    toRecipients: [{
      emailAddress: {
        address: application.candidateEmail
      }
    }]
  };
}

function classifyAcknowledgementMessages(messages) {
  const items = Array.isArray(messages) ? messages : [];
  if (items.length > 1) {
    throw deliveryError(
      'CANDIDATE_ACKNOWLEDGEMENT_DUPLICATE_STATE',
      'Multiple mailbox messages have the same application acknowledgement key',
      true
    );
  }
  const message = items[0] || null;
  return {
    message,
    sent: Boolean(message && (message.isDraft === false || message.sentDateTime)),
    draft: Boolean(message && message.isDraft === true)
  };
}

function createOutboxDispatcher({ graph, config } = {}) {
  const requiredGraphMethods = [
    'upsertListItem',
    'findMessagesByExtendedProperty',
    'getMessage',
    'createDraftMessage',
    'sendDraftMessage'
  ];
  if (!graph || requiredGraphMethods.some((method) => typeof graph[method] !== 'function')) {
    throw deliveryError('GRAPH_ADAPTER_MISSING', 'Microsoft Graph adapter is not configured', true);
  }

  const sharePoint = config?.sharePoint || {};
  const acknowledgement = config?.candidateAcknowledgement || {};

  async function loadApplication(event, dependencies) {
    const application = await dependencies.applicationStore.getApplication(event.applicationReference);
    if (!application) {
      throw deliveryError('APPLICATION_PROJECTION_SOURCE_MISSING', 'Application projection source was not found', true);
    }
    return application;
  }

  async function loadFiles(event, dependencies) {
    if (event.fileReference) {
      const file = await dependencies.applicationStore.getFile(event.fileReference);
      if (!file || file.applicationReference !== event.applicationReference) {
        throw deliveryError('FILE_PROJECTION_SOURCE_MISSING', 'File projection source was not found', true);
      }
      return [file];
    }
    if (!dependencies.projectionReader || typeof dependencies.projectionReader.getFilesForApplication !== 'function') {
      throw deliveryError('PROJECTION_READER_MISSING', 'Projection reader is not configured', true);
    }
    const files = await dependencies.projectionReader.getFilesForApplication(event.applicationReference);
    if (!Array.isArray(files) || files.length === 0) {
      throw deliveryError('FILE_PROJECTION_SOURCE_MISSING', 'No files were found for the application', true);
    }
    return files;
  }

  async function project(event, dependencies) {
    const application = await loadApplication(event, dependencies);
    const files = await loadFiles(event, dependencies);

    const applicationItem = await graph.upsertListItem({
      siteId: sharePoint.siteId,
      listId: sharePoint.applicationsListId,
      keyField: 'ApplicationReference',
      keyValue: application.applicationReference,
      fields: applicationFields(application, event)
    });

    const fileItems = [];
    for (const file of files) {
      const projected = await graph.upsertListItem({
        siteId: sharePoint.siteId,
        listId: sharePoint.filesListId,
        keyField: 'FileReference',
        keyValue: file.fileReference,
        fields: fileFields(file)
      });
      fileItems.push(projected);
    }

    return {
      deliveryReference: [
        `application:${applicationItem.itemId}`,
        ...fileItems.map((item) => `file:${item.itemId}`)
      ].join('|')
    };
  }

  async function acknowledge(event, dependencies) {
    if (acknowledgement.enabled !== true || acknowledgement.templateApproved !== true) {
      throw deliveryError('CANDIDATE_ACKNOWLEDGEMENT_DISABLED', 'Candidate acknowledgement is not approved and enabled', true);
    }
    if (!dependencies.outboxCheckpoint || typeof dependencies.outboxCheckpoint.checkpoint !== 'function') {
      throw deliveryError('OUTBOX_CHECKPOINT_MISSING', 'Outbox checkpoint store is not configured', true);
    }

    const application = await loadApplication(event, dependencies);
    if (!application.finalizedAtUtc || application.candidateSubmissionStatus !== 'Submitted') {
      throw deliveryError('APPLICATION_NOT_FINALIZED', 'Candidate acknowledgement requires a finalized application', true);
    }

    const mailbox = acknowledgement.mailbox;
    const reference = application.applicationReference;
    let activeEvent = event;
    let mailboxState = classifyAcknowledgementMessages(
      await graph.findMessagesByExtendedProperty(mailbox, ACKNOWLEDGEMENT_PROPERTY_ID, reference)
    );

    if (mailboxState.sent) {
      return {
        deliveryReference: `mail:${mailboxState.message.id}`,
        event: activeEvent,
        reconciled: true
      };
    }

    const checkpointedId = activeEvent.deliveryCheckpoint?.draftMessageId;
    let draft = mailboxState.draft ? mailboxState.message : null;

    if (checkpointedId) {
      const checkpointedMessage = await graph.getMessage(mailbox, checkpointedId);
      if (checkpointedMessage && (checkpointedMessage.isDraft === false || checkpointedMessage.sentDateTime)) {
        return {
          deliveryReference: `mail:${checkpointedMessage.id}`,
          event: activeEvent,
          reconciled: true
        };
      }
      if (checkpointedMessage?.isDraft === true) {
        draft = checkpointedMessage;
      } else if (!draft) {
        throw deliveryError(
          'CANDIDATE_ACKNOWLEDGEMENT_STATE_UNCERTAIN',
          'The checkpointed acknowledgement message could not be reconciled'
        );
      }
    }

    if (!draft) {
      draft = await graph.createDraftMessage(
        mailbox,
        acknowledgementMessage(application, acknowledgement),
        { id: ACKNOWLEDGEMENT_PROPERTY_ID, value: reference }
      );
    }
    if (!draft?.id) {
      throw deliveryError('CANDIDATE_ACKNOWLEDGEMENT_DRAFT_INVALID', 'Microsoft Graph did not return a draft id');
    }

    if (checkpointedId !== draft.id) {
      activeEvent = await dependencies.outboxCheckpoint.checkpoint(activeEvent, {
        draftMessageId: draft.id,
        extendedPropertyId: ACKNOWLEDGEMENT_PROPERTY_ID,
        extendedPropertyValue: reference
      });
    }

    try {
      await graph.sendDraftMessage(mailbox, draft.id);
    } catch (error) {
      error.event = activeEvent;
      throw error;
    }

    return {
      deliveryReference: `mail:${draft.id}`,
      event: activeEvent
    };
  }

  async function deliver(event, dependencies) {
    if (!event || typeof event.type !== 'string' || typeof event.applicationReference !== 'string') {
      throw deliveryError('OUTBOX_EVENT_INVALID', 'Outbox event is invalid', true);
    }
    if (event.type === EVENTS.CandidateAcknowledgementRequested) {
      return acknowledge(event, dependencies);
    }
    if (PROJECTION_EVENTS.has(event.type)) {
      return project(event, dependencies);
    }
    throw deliveryError('OUTBOX_EVENT_UNSUPPORTED', `Unsupported recruitment outbox event: ${event.type}`, true);
  }

  return { deliver, project, acknowledge };
}

module.exports = {
  PROJECTION_EVENTS,
  ACKNOWLEDGEMENT_PROPERTY_ID,
  compactFields,
  applicationFields,
  fileFields,
  acknowledgementMessage,
  classifyAcknowledgementMessages,
  createOutboxDispatcher
};
