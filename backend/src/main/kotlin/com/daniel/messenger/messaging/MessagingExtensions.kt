package com.daniel.messenger.messaging

import com.daniel.messenger.messaging.dto.MessageResponse
import com.daniel.messenger.messaging.dto.ReplyPreviewDto
import com.daniel.messenger.messaging.entity.MessageEntity

fun MessageEntity.toResponse(replyPreview: ReplyPreviewDto? = null): MessageResponse =
    MessageResponse(
        id = requireNotNull(id),
        content = if (deletedAt != null) "" else content,
        sender = sender.username,
        createdAt = createdAt,
        editedAt = editedAt,
        deletedAt = deletedAt,
        replyToMessageId = replyToMessageId,
        replyPreview = replyPreview,
    )