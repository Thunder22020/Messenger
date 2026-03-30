package com.daniel.messenger.call.dto

import com.daniel.messenger.call.enum.CallEventType

data class CallEvent(
    val callId: String,
    val type: CallEventType,
    val chatId: Long,
    val callerUsername: String,
    val receiverUsername: String,
    val durationSeconds: Long? = null,
    val video: Boolean = false,
)
