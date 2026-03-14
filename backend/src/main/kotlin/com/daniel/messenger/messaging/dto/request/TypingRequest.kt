package com.daniel.messenger.messaging.dto.request

data class TypingRequest(
    val chatId: Long,
    val isTyping: Boolean,
)
