package com.daniel.messenger.messaging.dto

data class TypingRequest(
    val chatId: Long,
    val isTyping: Boolean,
)
