package com.daniel.messenger.messaging

import com.daniel.messenger.messaging.dto.MessageResponse
import com.daniel.messenger.messaging.entity.MessageEntity

fun MessageEntity.toResponse(): MessageResponse =
    MessageResponse(
        id = id,
        content = if (deletedAt != null) "" else content,
        sender = sender.username,
        createdAt = createdAt,
        editedAt = editedAt,
        deletedAt = deletedAt,
    )