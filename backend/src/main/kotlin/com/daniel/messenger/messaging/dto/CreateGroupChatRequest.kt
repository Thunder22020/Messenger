package com.daniel.messenger.messaging.dto

data class CreateGroupChatRequest(
    val title: String,
    val participantIds: List<Long>
)
