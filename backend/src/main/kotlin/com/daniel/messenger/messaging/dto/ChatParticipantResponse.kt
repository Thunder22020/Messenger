package com.daniel.messenger.messaging.dto

data class ChatParticipantResponse(
    val id: Long,
    val username: String,
    val lastReadMessageId: Long?,
)
