package com.daniel.messenger.messaging.dto

import com.daniel.messenger.messaging.enum.AttachmentType

data class AttachmentDto(
    val id: Long,
    val url: String,
    val type: AttachmentType,
    val fileName: String,
    val mimeType: String,
    val fileSize: Long,
)
