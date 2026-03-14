package com.daniel.messenger.messaging

import com.daniel.messenger.messaging.dto.AttachmentDto
import com.daniel.messenger.messaging.dto.response.MessageResponse
import com.daniel.messenger.messaging.dto.ReplyPreviewDto
import com.daniel.messenger.messaging.entity.Attachment
import com.daniel.messenger.messaging.entity.MessageEntity

fun MessageEntity.toResponse(
    senderUsername: String? = null,
    replyPreview: ReplyPreviewDto? = null,
    attachments: List<AttachmentDto> = emptyList(),
): MessageResponse = MessageResponse(
    id = requireNotNull(id),
    content = if (deletedAt != null) "" else content,
    sender = senderUsername ?: sender.username,
    createdAt = createdAt,
    editedAt = editedAt,
    deletedAt = deletedAt,
    replyToMessageId = replyToMessageId,
    replyPreview = replyPreview,
    attachments = attachments,
)

fun Attachment.toDto(): AttachmentDto = AttachmentDto(
    id = requireNotNull(id),
    url = filePath,
    type = attachmentType,
    fileName = fileName,
    mimeType = mimeType,
    fileSize = fileSize,
)
