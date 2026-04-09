package com.daniel.messenger.messaging.dto.response

data class ChatParticipantResponse(
    val id: Long,
    val username: String,
    val displayName: String?,
    val avatarUrl: String?,
    val lastReadMessageId: Long?,
)
