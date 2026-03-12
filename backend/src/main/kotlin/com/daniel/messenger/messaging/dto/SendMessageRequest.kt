package com.daniel.messenger.messaging.dto

data class SendMessageRequest(
    val chatId: Long,
    val content: String
)
