package com.daniel.messenger.call.dto

data class CallEvent(
    val callId: String,
    val type: CallEventType,
    val chatId: Long,
    val callerUsername: String,
    val receiverUsername: String,
    val durationSeconds: Long? = null,
)

enum class CallEventType { RINGING, ACCEPTED, REJECTED, ENDED, BUSY, CANCELLED }
