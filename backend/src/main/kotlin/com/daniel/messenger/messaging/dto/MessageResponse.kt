package com.daniel.messenger.messaging.dto

import java.time.Instant

data class MessageResponse(
    val id: Long,
    val content: String,
    val sender: String,
    val createdAt: Instant,
    val editedAt: Instant?,
    val deletedAt: Instant?,
    val replyToMessageId: Long? = null,
    val replyPreview: ReplyPreviewDto? = null,
    val attachments: List<AttachmentDto> = emptyList(),
)
