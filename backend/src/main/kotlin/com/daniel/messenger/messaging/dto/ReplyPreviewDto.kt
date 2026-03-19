package com.daniel.messenger.messaging.dto

data class ReplyPreviewDto(
    val messageId: Long,
    val sender: String,
    val content: String?,
    val attachmentType: String? = null,
)
