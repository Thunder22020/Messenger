package com.daniel.messenger.messaging.dto.request

data class CreateGroupChatRequest(
    val title: String,
    val participantIds: List<Long>
)
