package com.daniel.messenger.messaging.dto.event

data class ChatDeletedEvent(
    val s3Keys: List<String>,
)
