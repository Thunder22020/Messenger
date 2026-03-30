package com.daniel.messenger.call.dto

data class InitiateCallRequest(
    val chatId: Long,
    val video: Boolean = false,
)
